import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { classifyFeedback } from '@/lib/ai/classify'
import { assignTheme } from '@/lib/ai/assignTheme'
import { embedText } from '@/lib/ai/embed'
import { storeEmbedding } from '@/lib/ai/storeEmbedding'

const querySchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'ACTIONED']).optional(),
  search: z.string().optional(),
  themeId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  // 2. Validate query params
  const searchParams = request.nextUrl.searchParams
  const parsed = querySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    themeId: searchParams.get('themeId') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })

  

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 }
    )
  }

  const { status, search,themeId, page, limit } = parsed.data

  // 3. Build tenant-scoped where clause — workspaceId ALWAYS comes from session, never from the client
  const where = {
    workspaceId: session.user.workspaceId,
    ...(status ? { status } : {}),
    ...(search
      ? {
          content: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {}),

   ...(themeId ? { themes: { some: { themeId } } } : {}),    
  }

  try {
    // 4. Run count + page query together
    const [total, feedback] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          themes: {
            include: { theme: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      data: feedback,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('GET /api/feedback error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong fetching feedback.' } },
      { status: 500 }
    )
  }
}
const createFeedbackSchema = z.object({
  content: z.string().min(1, 'Feedback content is required.').max(5000),
  customerLabel: z.string().max(120).optional(),
  sourceRef: z.string().max(120).optional(),
})

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  // 2. Validate body
  const body = await request.json().catch(() => null)
  const parsed = createFeedbackSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 }
    )
  }

  const { content, customerLabel, sourceRef } = parsed.data

  try {
    // 3. Create the feedback record first (tenant-scoped from session, never from client)
    const feedback = await prisma.feedback.create({
      data: {
        content,
        customerLabel,
        sourceRef,
        channel: 'MANUAL',
        workspaceId: session.user.workspaceId,
      },
    })

    // 4. Classify — but don't let a classification failure block feedback creation.
    // If it fails, the item is saved with classifiedAt = null and can be re-classified later.
    try {
      const classification = await classifyFeedback(content)

      const updated = await prisma.feedback.update({
        where: { id: feedback.id },
        data: {
          sentiment: classification.sentiment,
          sentimentScore: classification.sentimentScore,
          featureArea: classification.featureArea,
          themeTags: classification.themeTags,
          classifiedAt: new Date(),
        },
      })
      
      // AI2: assign theme right after classification succeeds
        await assignTheme(
        updated.id,
        updated.content,
        updated.featureArea,
        updated.themeTags,
        session.user.workspaceId
      )

      // AI3 groundwork: generate real embedding for semantic search
      try {
        const vector = await embedText(updated.content)
        await storeEmbedding(updated.id, vector)
      } catch (embedErr) {
        console.error('Embedding failed for feedback', updated.id, embedErr)
        // fail-soft — item just won't be retrievable via Ask LOOP until backfilled/retried
      }
      return NextResponse.json({ data: updated }, { status: 201 })

      
    } catch (classifyErr) {
      console.error('Classification failed for feedback', feedback.id, classifyErr)
      // Feedback still exists, just unclassified — return it as-is
      return NextResponse.json({ data: feedback }, { status: 201 })
    }
  } catch (err) {
    console.error('POST /api/feedback error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong creating feedback.' } },
      { status: 500 }
    )
  }
}