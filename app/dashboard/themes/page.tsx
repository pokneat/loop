import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

interface ThemeTrend {
  id: string
  name: string
  color: string | null
  currentCount: number
  previousCount: number
  isSpiking: boolean
}

async function getTrends(workspaceId: string): Promise<ThemeTrend[]> {
  const now = new Date()
  const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const links = await prisma.feedbackTheme.findMany({
    where: {
      theme: { workspaceId },
      feedback: { createdAt: { gte: previousStart } },
    },
    select: {
      theme: { select: { id: true, name: true, color: true } },
      feedback: { select: { createdAt: true } },
    },
  })

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

  return Array.from(themeMap.values())
    .map((t) => ({ ...t, isSpiking: t.currentCount > t.previousCount }))
    .sort((a, b) => b.currentCount - a.currentCount)
}

export default async function ThemesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const themes = await getTrends(session.user.workspaceId)

  if (themes.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Themes & Trends</h1>
        <p className="text-gray-500">
          No theme activity in the last 60 days. Themes appear here once feedback has been classified and clustered.
        </p>
      </div>
    )
  }

  const maxCount = Math.max(...themes.map((t) => t.currentCount), 1)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Themes & Trends</h1>
        <p className="text-sm text-gray-500 mt-1">
          Last 30 days vs. the 30 days before. Click a theme to see its feedback.
        </p>
      </div>

      <div className="grid gap-3">
        {themes.map((theme) => {
          const delta = theme.currentCount - theme.previousCount
          const barWidth = Math.max((theme.currentCount / maxCount) * 100, theme.currentCount > 0 ? 4 : 0)

          return (
          <Link
              key={theme.id}
              href={`/dashboard/feedback?themeId=${theme.id}`}
              className="group flex items-center gap-3 sm:gap-4 rounded-lg border border-gray-200 bg-white px-4 sm:px-5 py-4 hover:border-gray-300 hover:shadow-sm transition"
          >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: theme.color ?? '#9CA3AF' }}
                aria-hidden
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{theme.name}</span>
                  {theme.isSpiking && (
                    <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
                      ↑ Spiking
                    </span>
                  )}
                </div>
                <div
                  className="mt-2 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={theme.currentCount}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-label={`${theme.name}: ${theme.currentCount} feedback items`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: theme.color ?? '#9CA3AF' }}
                  />
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-lg font-semibold text-gray-900">{theme.currentCount}</div>
                <div className={`text-xs ${delta > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                  {delta > 0 ? `+${delta}` : delta} vs prior
                </div>
              </div>

              <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )
        })}
      </div>
    </div>
  )
}