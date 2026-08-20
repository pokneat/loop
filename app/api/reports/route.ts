import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { generateReportContent } from '@/lib/ai/generateReport'

const generateSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  title: z.string().min(1).max(150).optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  // RBAC — Viewer cannot generate reports (matches reclassify convention)
  if (session.user.role === 'VIEWER') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to generate reports.' } },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = generateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 }
    )
  }

  const { periodStart, periodEnd, title } = parsed.data

  if (periodEnd <= periodStart) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'periodEnd must be after periodStart.' } },
      { status: 400 }
    )
  }

  try {
    const content = await generateReportContent(session.user.workspaceId, periodStart, periodEnd)

    const report = await prisma.report.create({
      data: {
        title: title ?? `Voice of Customer — ${content.periodLabel}`,
        periodStart,
        periodEnd,
        contentJson: content as any,
        workspaceId: session.user.workspaceId,
        generatedById: session.user.id,
      },
    })

    return NextResponse.json({ data: report }, { status: 201 })
  } catch (err) {
    console.error('POST /api/reports error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong generating the report.' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  try {
    const reports = await prisma.report.findMany({
      where: { workspaceId: session.user.workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ data: reports })
  } catch (err) {
    console.error('GET /api/reports error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong fetching reports.' } },
      { status: 500 }
    )
  }
}