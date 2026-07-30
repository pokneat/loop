import { PrismaClient, Role, Sentiment, FeedbackStatus, Channel } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ---------- helpers ----------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDateWithinDays(days: number): Date {
  const now = Date.now()
  const past = now - Math.random() * days * 24 * 60 * 60 * 1000
  return new Date(past)
}

// fake 1536-dim embedding vector (matches OpenAI/Voyage-style dimension)
function fakeVector(): number[] {
  return Array.from({ length: 1536 }, () => Number((Math.random() * 2 - 1).toFixed(4)))
}

const FEEDBACK_SAMPLES: { content: string; sentiment: Sentiment; score: number; themeHint: string }[] = [
  { content: 'The dashboard takes forever to load when I filter by last quarter.', sentiment: 'NEG', score: -0.6, themeHint: 'Performance' },
  { content: 'Loving the new CSV export feature, saves me so much time every week.', sentiment: 'POS', score: 0.8, themeHint: 'Exports & Reporting' },
  { content: 'Support responded within an hour and fixed my billing issue immediately.', sentiment: 'POS', score: 0.9, themeHint: 'Customer Support' },
  { content: 'Pricing tiers are confusing, hard to tell what Analyst role actually includes.', sentiment: 'NEG', score: -0.4, themeHint: 'Pricing & Plans' },
  { content: 'Would love a dark mode option for the inbox view.', sentiment: 'NEU', score: 0.1, themeHint: 'UI/UX' },
  { content: 'App crashed twice today while uploading a bulk CSV file.', sentiment: 'NEG', score: -0.8, themeHint: 'Reliability' },
  { content: 'The onboarding flow was smooth and self-explanatory, great job.', sentiment: 'POS', score: 0.7, themeHint: 'Onboarding' },
  { content: 'Search results are not returning relevant feedback when I type partial words.', sentiment: 'NEG', score: -0.5, themeHint: 'Search' },
  { content: 'Mobile responsiveness could use work, buttons overlap on smaller screens.', sentiment: 'NEG', score: -0.3, themeHint: 'UI/UX' },
  { content: 'Really impressed with how fast the AI classification tags new tickets.', sentiment: 'POS', score: 0.85, themeHint: 'AI Features' },
  { content: 'Not sure why my Viewer account cannot export data, unclear permissions.', sentiment: 'NEU', score: -0.1, themeHint: 'Permissions' },
  { content: 'The analytics charts are exactly what our team needed for weekly reviews.', sentiment: 'POS', score: 0.75, themeHint: 'Analytics' },
  { content: 'Login session expires too quickly, I get logged out mid-task constantly.', sentiment: 'NEG', score: -0.55, themeHint: 'Auth & Sessions' },
  { content: 'Feature request: bulk status updates for multiple feedback items at once.', sentiment: 'NEU', score: 0.2, themeHint: 'Feature Requests' },
  { content: 'The Ask LOOP Q&A feature gave a surprisingly accurate summary of our churn complaints.', sentiment: 'POS', score: 0.9, themeHint: 'AI Features' },
]

const THEMES = [
  { name: 'Performance', color: '#EF4444', description: 'Speed, load times, and responsiveness issues' },
  { name: 'Exports & Reporting', color: '#3B82F6', description: 'CSV export, report generation, data downloads' },
  { name: 'Customer Support', color: '#10B981', description: 'Support responsiveness and resolution quality' },
  { name: 'Pricing & Plans', color: '#F59E0B', description: 'Billing clarity, tier confusion, plan value' },
  { name: 'UI/UX', color: '#8B5CF6', description: 'Visual design, layout, and usability feedback' },
  { name: 'Reliability', color: '#DC2626', description: 'Crashes, bugs, and stability issues' },
  { name: 'Onboarding', color: '#059669', description: 'First-time setup and getting-started experience' },
  { name: 'Search', color: '#6366F1', description: 'Search accuracy and relevance' },
  { name: 'AI Features', color: '#EC4899', description: 'Classification, clustering, Ask LOOP, VoC reports' },
  { name: 'Permissions', color: '#F97316', description: 'Role-based access confusion or gaps' },
  { name: 'Analytics', color: '#14B8A6', description: 'Dashboard charts and metrics usefulness' },
  { name: 'Auth & Sessions', color: '#A855F7', description: 'Login, session expiry, auth friction' },
  { name: 'Feature Requests', color: '#84CC16', description: 'General feature suggestions' },
]

async function seedWorkspace(workspaceName: string, feedbackCount: number) {
  const workspace = await prisma.workspace.create({
    data: { name: workspaceName },
  })

  // --- Users: one per role ---
  const passwordHash = await bcrypt.hash('password123', 10)

  const admin = await prisma.user.create({
    data: {
      name: `${workspaceName} Admin`,
      email: `admin@${workspaceName.toLowerCase().replace(/\s+/g, '')}.com`,
      passwordHash,
      role: Role.ADMIN,
      workspaceId: workspace.id,
    },
  })

  await prisma.user.create({
    data: {
      name: `${workspaceName} Analyst`,
      email: `analyst@${workspaceName.toLowerCase().replace(/\s+/g, '')}.com`,
      passwordHash,
      role: Role.ANALYST,
      workspaceId: workspace.id,
    },
  })

  await prisma.user.create({
    data: {
      name: `${workspaceName} Viewer`,
      email: `viewer@${workspaceName.toLowerCase().replace(/\s+/g, '')}.com`,
      passwordHash,
      role: Role.VIEWER,
      workspaceId: workspace.id,
    },
  })

  // --- Themes ---
  const themeRecords = await Promise.all(
    THEMES.map((t) =>
      prisma.theme.create({
        data: {
          name: t.name,
          description: t.description,
          color: t.color,
          workspaceId: workspace.id,
        },
      })
    )
  )
  const themeByName = new Map(themeRecords.map((t) => [t.name, t]))

  // --- Feedback + FeedbackTheme + Embedding ---
  const channels: Channel[] = [Channel.MANUAL, Channel.CSV, Channel.SIMULATED_API]
  const statuses: FeedbackStatus[] = [FeedbackStatus.NEW, FeedbackStatus.REVIEWED, FeedbackStatus.ACTIONED]

  for (let i = 0; i < feedbackCount; i++) {
    const sample = pick(FEEDBACK_SAMPLES)

    const feedback = await prisma.feedback.create({
      data: {
        content: sample.content,
        channel: pick(channels),
        sourceRef: `seed-${i}`,
        customerLabel: `Customer ${i + 1}`,
        sentiment: sample.sentiment,
        sentimentScore: sample.score + (Math.random() * 0.1 - 0.05), // slight jitter
        status: pick(statuses),
        createdAt: randomDateWithinDays(60),
        workspaceId: workspace.id,
      },
    })

    // link to matching theme with a confidence score
    const theme = themeByName.get(sample.themeHint)
    if (theme) {
      await prisma.feedbackTheme.create({
        data: {
          feedbackId: feedback.id,
          themeId: theme.id,
          confidence: Number((0.7 + Math.random() * 0.3).toFixed(2)), // 0.70 - 1.00
        },
      })
    }

    // embedding requires raw SQL since `vector` is an Unsupported type in Prisma Client
    const vector = fakeVector()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Embedding" (id, "feedbackId", vector)
       VALUES (gen_random_uuid()::text, $1, $2::vector)`,
      feedback.id,
      `[${vector.join(',')}]`
    )
  }

  // --- One sample Report ---
  await prisma.report.create({
    data: {
      title: `${workspaceName} — Voice of Customer (Last 30 Days)`,
      periodStart: randomDateWithinDays(30),
      periodEnd: new Date(),
      contentJson: {
        summary: 'Auto-generated placeholder report. Replace with real VoC output once the AI report feature is built.',
        topThemes: ['Performance', 'Customer Support', 'AI Features'],
        overallSentiment: 'Mixed, leaning positive',
      },
      workspaceId: workspace.id,
      generatedById: admin.id,
    },
  })

  console.log(`Seeded workspace "${workspaceName}" with ${feedbackCount} feedback items.`)
}

async function main() {
  console.log('Clearing existing data...')
  // delete in FK-safe order
  await prisma.$executeRawUnsafe(`DELETE FROM "Embedding"`)
  await prisma.feedbackTheme.deleteMany()
  await prisma.report.deleteMany()
  await prisma.feedback.deleteMany()
  await prisma.theme.deleteMany()
  await prisma.user.deleteMany()
  await prisma.workspace.deleteMany()

  console.log('Seeding workspaces...')
  await seedWorkspace('Acme Inc', 30)
  await seedWorkspace('Globex Corp', 25)

  console.log('Done. Demo logins (all use password: password123):')
  console.log('  admin@acmeinc.com / analyst@acmeinc.com / viewer@acmeinc.com')
  console.log('  admin@globexcorp.com / analyst@globexcorp.com / viewer@globexcorp.com')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
