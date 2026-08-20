import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { embedText } from '@/lib/ai/embed'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const askSchema = z.object({
  question: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(5),
})

// cosine distance threshold — pgvector's <=> operator returns distance (0 = identical, 2 = opposite)
// 0.5 is a reasonably strict cutoff for "genuinely relevant" on normalized embeddings
const MAX_DISTANCE = 0.5

interface RetrievedItem {
  id: string
  content: string
  sentiment: string | null
  featureArea: string | null
  distance: number
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = askSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 }
    )
  }

  const { question, topK } = parsed.data
  const workspaceId = session.user.workspaceId

  try {
    // 1. Embed the question
    const questionVector = await embedText(question)
    const vectorLiteral = `[${questionVector.join(',')}]`

    // 2. Vector search, tenant-scoped, with distance threshold
    const retrieved = await prisma.$queryRawUnsafe<RetrievedItem[]>(
      `SELECT f.id, f.content, f.sentiment, f."featureArea",
              (e.vector <=> $1::vector) AS distance
       FROM "Embedding" e
       JOIN "Feedback" f ON f.id = e."feedbackId"
       WHERE f."workspaceId" = $2
         AND (e.vector <=> $1::vector) < $3
       ORDER BY distance ASC
       LIMIT $4`,
      vectorLiteral,
      workspaceId,
      MAX_DISTANCE,
      topK
    )

    // 3. No relevant feedback found — don't force an answer
    if (retrieved.length === 0) {
      return NextResponse.json({
        data: {
          answer: "I couldn't find any feedback relevant to that question in your workspace's data.",
          sources: [],
        },
      })
    }

    // 4. Build grounded prompt — answer ONLY from retrieved items
    const contextBlock = retrieved
      .map((item, i) => `[${i + 1}] (${item.sentiment ?? 'unknown'}, ${item.featureArea ?? 'general'}): "${item.content}"`)
      .join('\n')

    const prompt = `You are Ask LOOP, a Q&A assistant for a B2B SaaS feedback platform. Answer the user's question using ONLY the feedback items listed below. Do not invent, assume, or reference any feedback not shown here.

Feedback items:
${contextBlock}

Question: ${question}

Instructions:
- Base your answer strictly on the items above.
- Reference items by their number, e.g. "[2]", when citing specific feedback.
- If the provided feedback only partially answers the question, say so clearly rather than filling gaps with assumptions.
- Keep the answer concise and factual.`

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })

    const answer = response.text ?? 'No answer generated.'

    return NextResponse.json({
      data: {
        answer,
        sources: retrieved.map((item) => ({
          id: item.id,
          content: item.content,
          sentiment: item.sentiment,
          featureArea: item.featureArea,
          relevance: Number((1 - item.distance).toFixed(3)), // convert distance to a rough similarity score
        })),
      },
    })
  } catch (err) {
    console.error('POST /api/ai/ask error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong answering your question.' } },
      { status: 500 }
    )
  }
}