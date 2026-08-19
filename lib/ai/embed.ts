import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const EMBEDDING_DIMENSION = 1536

function l2Normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  if (magnitude === 0) return vector
  return vector.map((val) => val / magnitude)
}

export async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
    },
  })

  const raw = response.embeddings?.[0]?.values
  if (!raw || raw.length === 0) {
    throw new Error("Empty embedding response from Gemini")
  }

  // Manual L2 normalization required for non-default (non-3072) output dimensions
  return l2Normalize(raw)
}