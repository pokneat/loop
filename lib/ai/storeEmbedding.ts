import { prisma } from "@/lib/prisma"

export async function storeEmbedding(feedbackId: string, vector: number[]): Promise<void> {
  const vectorLiteral = `[${vector.join(",")}]`

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Embedding" (id, "feedbackId", vector)
     VALUES (gen_random_uuid()::text, $1, $2::vector)
     ON CONFLICT ("feedbackId") DO UPDATE SET vector = $2::vector`,
    feedbackId,
    vectorLiteral
  )
}