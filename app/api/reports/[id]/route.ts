import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  try {
    const report = await prisma.report.findFirst({
      where: {
        id: params.id,
        workspaceId: session.user.workspaceId, // tenant-scoped — 404, not 403, for cross-tenant
      },
    })

    if (!report) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Report not found.' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: report })
  } catch (err) {
    console.error('GET /api/reports/[id] error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong fetching the report.' } },
      { status: 500 }
    )
  }
}