import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'ACTIONED']).optional(),
  search: z.string().optional(),
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
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 }
    )
  }

  const { status, search, page, limit } = parsed.data

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