import { GoogleGenAI } from "@google/genai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const ThemeAssignmentSchema = z.object({
  action: z.enum(["existing", "new"]),
  themeName: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1),
})

type ThemeAssignment = z.infer<typeof ThemeAssignmentSchema>

async function callGeminiForTheme(
  content: string,
  featureArea: string | null,
  themeTags: string[],
  existingThemes: { name: string; description: string | null }[]
): Promise<string> {
  const themeList = existingThemes.length
    ? existingThemes.map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n")
    : "(no themes exist yet for this workspace)"

  const prompt = `You are a feedback theme-clustering engine for a B2B SaaS feedback platform called LOOP.

Existing themes in this workspace:
${themeList}

New feedback item to assign:
Content: "${content}"
Feature area: ${featureArea ?? "unknown"}
Tags: ${themeTags.join(", ") || "none"}

Decide whether this feedback fits an EXISTING theme above, or needs a NEW theme.
Prefer matching an existing theme if it's a reasonable fit — only propose a new theme if nothing above genuinely covers the topic.

Respond with ONLY valid JSON, no markdown, no preamble:
{
  "action": "existing" | "new",
  "themeName": <the exact existing theme name if action is "existing", or a short new theme name (2-4 words) if action is "new">,
  "description": <only include if action is "new" — one sentence describing this theme>,
  "confidence": <number 0 to 1, how confident you are in this assignment>
}`

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  })

  const text = response.text
  if (!text) throw new Error("Empty response from Gemini")
  return text
}

export async function assignTheme(
  feedbackId: string,
  content: string,
  featureArea: string | null,
  themeTags: string[],
  workspaceId: string
): Promise<{ themeId: string; themeName: string; confidence: number } | null> {
  const existingThemes = await prisma.theme.findMany({
    where: { workspaceId },
    select: { id: true, name: true, description: true },
  })

  let lastError: unknown
  let parsed: ThemeAssignment | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGeminiForTheme(content, featureArea, themeTags, existingThemes)
      const json = JSON.parse(raw)
      parsed = ThemeAssignmentSchema.parse(json)
      break
    } catch (err) {
      lastError = err
      console.error(`assignTheme attempt ${attempt + 1} failed:`, err)
    }
  }

  if (!parsed) {
    console.error("Theme assignment failed after 2 attempts:", lastError)
    return null // fail-soft — feedback stays unassigned, doesn't block anything
  }

  // Try to match an existing theme by name (case-insensitive), regardless of what Gemini claimed
  const matched = existingThemes.find(
    (t) => t.name.toLowerCase() === parsed!.themeName.toLowerCase()
  )

  let themeId: string
  let themeName: string

  if (matched) {
    themeId = matched.id
    themeName = matched.name
  } else {
    // Either action was "new", or Gemini hallucinated a name that doesn't match — create it
    const created = await prisma.theme.create({
      data: {
        name: parsed.themeName,
        description: parsed.description ?? null,
        workspaceId,
      },
    })
    themeId = created.id
    themeName = created.name
  }

  await prisma.feedbackTheme.upsert({
    where: { feedbackId_themeId: { feedbackId, themeId } },
    create: { feedbackId, themeId, confidence: parsed.confidence },
    update: { confidence: parsed.confidence },
  })

  return { themeId, themeName, confidence: parsed.confidence }
}