 import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const SIMULATED_SOURCES = [
  'Simulated Zendesk Ticket',
  'Simulated App Store Review',
  'Simulated Twitter Mention',
  'Simulated Google Play Review',
  'Simulated Intercom Chat',
]

const SIMULATED_CONTENT = [
  'Just tried the new checkout flow, way smoother than before!',
  'Getting a 500 error whenever I try to invite a teammate.',
  'Support was helpful but it took a few days to hear back.',
  'The mobile experience feels like an afterthought compared to desktop.',
  'Really appreciate the recent performance improvements, noticeable difference.',
  'Would be great to have a Slack integration for notifications.',
  'Billing page shows the wrong renewal date for my account.',
  'The search feature has gotten a lot better recently, nice work.',
  'Documentation is outdated in a few places, caused some confusion.',
  'Loving the dark mode addition, easier on the eyes at night.',
]

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  // 2. RBAC — Viewers cannot ingest data (same rule as manual entry and CSV upload)
  if (session.user.role === 'VIEWER') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Viewers cannot trigger channel simulation.' } },
      { status: 403 }
    )
  }

  // 3. Generate a random batch of 2-5 fake feedback rows
  const count = randomInt(2, 5)
  const rows = Array.from({ length: count }, (_, i) => ({
    content: pick(SIMULATED_CONTENT),
    customerLabel: `Simulated Customer ${randomInt(100, 999)}`,
    sourceRef: pick(SIMULATED_SOURCES),
    channel: 'SIMULATED_API' as const,
    status: 'NEW' as const,
    workspaceId: session.user.workspaceId,
  }))

  try {
    const created = await prisma.feedback.createMany({ data: rows })

    return NextResponse.json({
      message: `Simulated ${created.count} incoming feedback item(s).`,
      imported: created.count,
    })
  } catch (err) {
    console.error('POST /api/channels/simulate error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to simulate channel feedback.' } },
      { status: 500 }
    )
  }
}