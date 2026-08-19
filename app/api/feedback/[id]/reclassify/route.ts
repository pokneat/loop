import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { classifyFeedback } from '@/lib/ai/classify'
import { assignTheme } from '@/lib/ai/assignTheme'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' } },
      { status: 401 }
    )
  }

  // 2. RBAC — Viewer cannot trigger re-classification
  if (session.user.role === 'VIEWER') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to re-classify feedback.' } },
      { status: 403 }
    )
  }

  const { id } = params

  try {
    // 3. Tenant-scoped lookup — 404, not 403, if it belongs to another workspace
    const existing = await prisma.feedback.findFirst({
      where: {
        id,
        workspaceId: session.user.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Feedback item not found.' } },
        { status: 404 }
      )
    }

    // 4. Re-run classification
    try {
      const classification = await classifyFeedback(existing.content)

      const updated = await prisma.feedback.update({
        where: { id: existing.id },
        data: {
          sentiment: classification.sentiment,
          sentimentScore: classification.sentimentScore,
          featureArea: classification.featureArea,
          themeTags: classification.themeTags,
          classifiedAt: new Date(),
        },
      })

        // AI2: re-assign theme too, since content/tags may have changed classification
  await assignTheme(
    updated.id,
    updated.content,
    updated.featureArea,
    updated.themeTags,
    session.user.workspaceId
  )

  return NextResponse.json({ data: updated })
} catch (classifyErr) {
  console.error('Re-classification failed for feedback', existing.id, classifyErr)
  return NextResponse.json(
    { error: { code: 'CLASSIFICATION_FAILED', message: 'Re-classification failed. Please try again.' } },
    { status: 502 }
  )
}

      return NextResponse.json({ data: updated })
    } catch (classifyErr) {
      console.error('Re-classification failed for feedback', existing.id, classifyErr)
      return NextResponse.json(
        { error: { code: 'CLASSIFICATION_FAILED', message: 'Re-classification failed. Please try again.' } },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('PATCH /api/feedback/[id]/reclassify error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
      { status: 500 }
    )
  }
}