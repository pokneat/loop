import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'
import { z } from 'zod'

const csvRowSchema = z.object({
  content: z.string().min(1, 'content is required'),
  customerLabel: z.string().optional().default(''),
  sourceRef: z.string().optional().default(''),
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

  // 2. RBAC check — Viewers cannot ingest data
  if (session.user.role === 'VIEWER') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Viewers cannot upload feedback.' } },
      { status: 403 }
    )
  }

  // 3. Get the uploaded file
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No CSV file was provided.' } },
      { status: 400 }
    )
  }

  if (!file.name.endsWith('.csv')) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'File must be a .csv file.' } },
      { status: 400 }
    )
  }

  const text = await file.text()

  // 4. Parse CSV
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: 'PARSE_ERROR',
          message: `CSV parsing failed: ${parsed.errors[0].message}`,
        },
      },
      { status: 400 }
    )
  }

  // 5. Validate each row, collect valid ones and errors separately
  const validRows: { content: string; customerLabel: string; sourceRef: string }[] = []
  const rowErrors: { row: number; message: string }[] = []

  parsed.data.forEach((row, index) => {
    const result = csvRowSchema.safeParse(row)
    if (result.success) {
      validRows.push(result.data)
    } else {
      rowErrors.push({
        row: index + 2, // +2 accounts for header row + 0-index
        message: result.error.issues[0].message,
      })
    }
  })

  if (validRows.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid rows found in CSV.',
        },
        rowErrors,
      },
      { status: 400 }
    )
  }

  // 6. Insert — tenant-scoped, always from session
  try {
    const created = await prisma.feedback.createMany({
      data: validRows.map((row) => ({
        content: row.content,
        customerLabel: row.customerLabel || null,
        sourceRef: row.sourceRef || null,
        channel: 'CSV' as const,
        status: 'NEW' as const,
        workspaceId: session.user.workspaceId,
      })),
    })

    return NextResponse.json({
      message: `Imported ${created.count} feedback entries.`,
      imported: created.count,
      skipped: rowErrors.length,
      rowErrors: rowErrors.length > 0 ? rowErrors : undefined,
    })
  } catch (err) {
    console.error('POST /api/feedback/bulk error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to import feedback.' } },
      { status: 500 }
    )
  }
}