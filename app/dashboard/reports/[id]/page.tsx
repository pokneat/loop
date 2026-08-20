import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import DownloadPdfButton from './DownLoadPdfButton'

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const report = await prisma.report.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  })

  if (!report) notFound()

  const content = report.contentJson as any
  // console.log('DEBUG content:', JSON.stringify(content))
  if (!content?.sentimentBreakdown || !content?.notableQuotes) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/dashboard/reports" className="text-sm text-gray-500 hover:text-gray-700">
          ← All reports
        </Link>
        <p className="text-sm text-gray-500 mt-6">
          This report was generated with an older format and can't be displayed. Generate a new report instead.
        </p>
      </div>
      )
    }
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/dashboard/reports" className="text-sm text-gray-500 hover:text-gray-700">
          ← All reports
        </Link>

        <div className="flex items-start justify-between mt-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{content.periodLabel}</p>
          </div>
          <DownloadPdfButton report={report} content={content} />
        </div>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</h2>
          <p className="text-gray-800 leading-relaxed">{content.summary}</p>
        </section>

        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-2">This period ({content.totalFeedback} items)</p>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">{content.sentimentBreakdown.pos} pos</span>
              <span className="text-gray-500">{content.sentimentBreakdown.neu} neu</span>
              <span className="text-red-600">{content.sentimentBreakdown.neg} neg</span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-2">Previous period</p>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">{content.previousSentimentBreakdown.pos} pos</span>
              <span className="text-gray-500">{content.previousSentimentBreakdown.neu} neu</span>
              <span className="text-red-600">{content.previousSentimentBreakdown.neg} neg</span>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Top Themes</h2>
          <div className="space-y-2">
            {content.topThemes.map((t: any) => (
              <div key={t.name} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-2.5">
                <span className="text-sm text-gray-800">{t.name}</span>
                <span className="text-sm text-gray-500">
                  {t.count} <span className="text-gray-400">(was {t.previousCount})</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Notable Quotes</h2>
          <div className="space-y-2">
            {content.notableQuotes.map((q: any, i: number) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-sm text-gray-800 italic">"{q.content}"</p>
                <p className="text-xs text-gray-400 mt-1">
                  {q.sentiment ?? 'unclassified'} {q.featureArea ? `· ${q.featureArea}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Recommended Actions</h2>
          <ul className="space-y-2">
            {content.recommendedActions.map((a: string, i: number) => (
              <li key={i} className="flex gap-2 text-sm text-gray-800">
                <span className="text-gray-400">{i + 1}.</span>
                {a}
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  
}