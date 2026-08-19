// lib/ai/classify.ts
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ClassificationSchema = z.object({
  sentiment: z.enum(["POS", "NEU", "NEG"]),
  sentimentScore: z.number().min(-1).max(1),
  featureArea: z.string().min(1).max(40),
  themeTags: z.array(z.string().min(1).max(30)).min(1).max(3),
});

export type Classification = z.infer<typeof ClassificationSchema>;

const SYSTEM_PROMPT = `You are a feedback classification engine for a B2B SaaS feedback platform called LOOP.
Given a piece of customer feedback, classify it and respond with ONLY valid JSON, no markdown, no preamble, no explanation.

Respond in exactly this JSON shape:
{
  "sentiment": "POS" | "NEU" | "NEG",
  "sentimentScore": <number between -1 and 1, where -1 is extremely negative and 1 is extremely positive>,
  "featureArea": <a short 1-3 word label for the product area this concerns, e.g. "Performance", "Pricing", "Onboarding", "Search", "Reliability">,
  "themeTags": [<1 to 3 short lowercase tags describing the topic, e.g. "csv-export", "login-timeout">]
}`;

async function callGemini(feedbackText: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\n\nFeedback to classify:\n"""${feedbackText}"""` }],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }
  return text;
}

export async function classifyFeedback(feedbackText: string): Promise<Classification> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rawText = await callGemini(feedbackText);
      const parsed = JSON.parse(rawText);
      const validated = ClassificationSchema.parse(parsed);
      return validated;
    } catch (err) {
      lastError = err;
      console.error(`classifyFeedback attempt ${attempt + 1} failed:`, err);
    }
  }

  throw new Error(
    `Classification failed after 2 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}