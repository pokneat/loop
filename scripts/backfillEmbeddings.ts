import { PrismaClient } from '@prisma/client'
import { embedText } from '../lib/ai/embed'
import { storeEmbedding } from '../lib/ai/storeEmbedding'

const prisma = new PrismaClient()

async function main() {
  const feedbackItems = await prisma.feedback.findMany({
    select: { id: true, content: true },
  })

  console.log(`Found ${feedbackItems.length} feedback items to embed.`)

  let succeeded = 0
  let failed = 0

  for (const item of feedbackItems) {
    try {
      const vector = await embedText(item.content)
      await storeEmbedding(item.id, vector)
      succeeded++
      console.log(`✓ Embedded ${item.id} (${succeeded}/${feedbackItems.length})`)
    } catch (err) {
      failed++
      console.error(`✗ Failed to embed ${item.id}:`, err instanceof Error ? err.message : err)
    }

    // Small delay to be gentle on free-tier rate limits, even though embeddings have a generous quota
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  console.log(`\nDone. Succeeded: ${succeeded}, Failed: ${failed}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })