import { prisma } from '@/lib/prisma'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export interface ReportContent {
  summary: string
  periodLabel: string
  totalFeedback: number
  sentimentBreakdown: { pos: number; neu: number; neg: number }
  previousSentimentBreakdown: { pos: number; neu: number; neg: number }
  topThemes: { name: string; count: number; previousCount: number }[]
  notableQuotes: { content: string; sentiment: string | null; featureArea: string | null }[]
  recommendedActions: string[]
}

export async function generateReportContent(
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ReportContent> {
  const periodLengthMs = periodEnd.getTime() - periodStart.getTime()
  const previousStart = new Date(periodStart.getTime() - periodLengthMs)
  const previousEnd = periodStart

  const currentFeedback = await prisma.feedback.findMany({
    where: { workspaceId, createdAt: { gte: periodStart, lte: periodEnd } },
    include: { themes: { include: { theme: true } } },
  })

  const previousFeedback = await prisma.feedback.findMany({
    where: { workspaceId, createdAt: { gte: previousStart, lt: previousEnd } },
    include: { themes: { include: { theme: true } } },
  })

  function breakdown(items: typeof currentFeedback) {
    return {
      pos: items.filter((f) => f.sentiment === 'POS').length,
      neu: items.filter((f) => f.sentiment === 'NEU').length,
      neg: items.filter((f) => f.sentiment === 'NEG').length,
    }
  }
  const sentimentBreakdown = breakdown(currentFeedback)
  const previousSentimentBreakdown = breakdown(previousFeedback)

  function themeCounts(items: typeof currentFeedback): Map<string, number> {
    const map = new Map<string, number>()
    for (const item of items) {
      for (const ft of item.themes) {
        map.set(ft.theme.name, (map.get(ft.theme.name) ?? 0) + 1)
      }
    }
    return map
  }
  const currentThemeCounts = themeCounts(currentFeedback)
  const previousThemeCounts = themeCounts(previousFeedback)

  const topThemes = Array.from(currentThemeCounts.entries())
    .map(([name, count]) => ({ name, count, previousCount: previousThemeCounts.get(name) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const withScore = currentFeedback.filter((f) => f.sentimentScore !== null)
  const sortedByScore = [...withScore].sort((a, b) => (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0))
  const mostPositive = sortedByScore.slice(0, 2)
  const mostNegative = sortedByScore.slice(-2).reverse()
  const notableQuotes = [...mostPositive, ...mostNegative].map((f) => ({
    content: f.content,
    sentiment: f.sentiment,
    featureArea: f.featureArea,
  }))

  const periodLabel = `${periodStart.toLocaleDateString()} – ${periodEnd.toLocaleDateString()}`

  const prompt = `You are writing a Voice-of-Customer report for a B2B SaaS feedback platform called LOOP.

Period: ${periodLabel}
Total feedback items this period: ${currentFeedback.length}
Sentiment breakdown: ${sentimentBreakdown.pos} positive, ${sentimentBreakdown.neu} neutral, ${sentimentBreakdown.neg} negative
Previous period sentiment: ${previousSentimentBreakdown.pos} positive, ${previousSentimentBreakdown.neu} neutral, ${previousSentimentBreakdown.neg} negative

Top themes this period (name: current count vs previous count):
${topThemes.map((t) => `- ${t.name}: ${t.count} (was ${t.previousCount})`).join('\n')}

Notable verbatim quotes:
${notableQuotes.map((q, i) => `${i + 1}. "${q.content}" (${q.sentiment ?? 'unclassified'})`).join('\n')}

Write ONLY valid JSON, no markdown, no preamble:
{
  "summary": <2-3 sentence executive summary of this period based strictly on the data above>,
  "recommendedActions": [<3-4 short, specific, actionable recommendations based strictly on the themes and sentiment shown above>]
}

Do not invent statistics, quotes, or themes not listed above. Do not use generic filler language — be specific to the actual numbers and theme names given.`

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  })

  const text = response.text
  if (!text) throw new Error('Empty response from Gemini during report generation')

  const parsed = JSON.parse(text) as { summary: string; recommendedActions: string[] }

  return {
    summary: parsed.summary,
    periodLabel,
    totalFeedback: currentFeedback.length,
    sentimentBreakdown,
    previousSentimentBreakdown,
    topThemes,
    notableQuotes,
    recommendedActions: parsed.recommendedActions,
  }
}