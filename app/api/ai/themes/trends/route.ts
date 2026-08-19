import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  const now = new Date()
  const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  try {
    // Pull all theme links for feedback created in the last 60 days, tenant-scoped
    const links = await prisma.feedbackTheme.findMany({
      where: {
        theme: { workspaceId: session.user.workspaceId },
        feedback: { createdAt: { gte: previousStart } },
      },
      select: {
        theme: { select: { id: true, name: true, color: true } },
        feedback: { select: { createdAt: true } },
      },
    })

    // Bucket counts by theme into current vs previous 30-day window
    const themeMap = new Map<string, { id: string; name: string; color: string | null; currentCount: number; previousCount: number }>() 
     

    for (const link of links) {
      const { id, name, color } = link.theme
      if (!themeMap.has(id)) {
        themeMap.set(id, { id, name, color, currentCount: 0, previousCount: 0 })
      }
      const entry = themeMap.get(id)!
      if (link.feedback.createdAt >= currentStart) {
        entry.currentCount += 1
      } else {
        entry.previousCount += 1
      }
    }

    const themes = Array.from(themeMap.values())
      .map((t) => ({ ...t, isSpiking: t.currentCount > t.previousCount }))
      .sort((a, b) => b.currentCount - a.currentCount)

    return NextResponse.json({
      data: themes,
      period: {
        currentStart: currentStart.toISOString(),
        currentEnd: now.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: currentStart.toISOString(),
      },
    })
  } catch (err) {
    console.error('GET /api/ai/themes/trends error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong fetching theme trends.' } },
      { status: 500 }
    )
  }
}