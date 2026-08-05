import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  const workspaceId = session.user.workspaceId

  try {
    // 1. Status breakdown
    const statusCounts = await prisma.feedback.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { status: true },
    })

    // 2. Sentiment breakdown
    const sentimentCounts = await prisma.feedback.groupBy({
      by: ['sentiment'],
      where: { workspaceId },
      _count: { sentiment: true },
    })

    // 3. Volume over time — last 30 days, grouped by day
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentFeedback = await prisma.feedback.findMany({
      where: {
        workspaceId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
    })

    // Group by date string (YYYY-MM-DD) in JS, since Prisma's groupBy
    // can't truncate timestamps to day-granularity across all DBs consistently
    const volumeByDay: Record<string, number> = {}
    recentFeedback.forEach((f) => {
      const day = f.createdAt.toISOString().split('T')[0]
      volumeByDay[day] = (volumeByDay[day] || 0) + 1
    })
    const volumeOverTime = Object.entries(volumeByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // 4. Top themes by feedback count
    const themes = await prisma.theme.findMany({
      where: { workspaceId },
      include: { _count: { select: { feedback: true } } },
      orderBy: { feedback: { _count: 'desc' } },
      take: 8,
    })

    return NextResponse.json({
      statusBreakdown: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      sentimentBreakdown: sentimentCounts.map((s) => ({
        sentiment: s.sentiment ?? 'UNCLASSIFIED',
        count: s._count.sentiment,
      })),
      volumeOverTime,
      topThemes: themes.map((t) => ({
        name: t.name,
        color: t.color,
        count: t._count.feedback,
      })),
    })
  } catch (err) {
    console.error('GET /api/analytics/summary error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load analytics.' } },
      { status: 500 }
    )
  }
}