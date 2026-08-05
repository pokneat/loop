import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'ACTIONED']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 1. Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  // 2. RBAC — Viewers cannot change status
  if (session.user.role === 'VIEWER') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Viewers cannot update feedback status.' } },
      { status: 403 }
    )
  }

  // 3. Validate body
  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 }
    )
  }

  // 4. Tenant-scoped lookup — confirm this feedback belongs to the caller's workspace
  //    before updating. If it doesn't exist OR belongs to another tenant, return 404
  //    (not 403) so we don't leak whether the ID exists in someone else's workspace.
  const existing = await prisma.feedback.findFirst({
    where: {
      id,
      workspaceId: session.user.workspaceId,
    },
  })

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Feedback not found.' } },
      { status: 404 }
    )
  }

  // 5. Update
  try {
    const updated = await prisma.feedback.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PATCH /api/feedback/[id] error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update status.' } },
      { status: 500 }
    )
  }
}