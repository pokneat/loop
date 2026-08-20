'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ReportSummary {
  id: string
  title: string
  periodStart: string
  periodEnd: string
  createdAt: string
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [periodStart, setPeriodStart] = useState(thirtyDaysAgo)
  const [periodEnd, setPeriodEnd] = useState(today)

  async function loadReports() {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      const json = await res.json()
      setReports(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: new Date(periodStart).toISOString(),
          periodEnd: new Date(periodEnd + 'T23:59:59').toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to generate report.')
        return
      }
      await loadReports()
    } catch {
      setError('Failed to reach the server.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Voice of Customer Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and review period summaries of your feedback.</p>
      </div>

      <form onSubmit={handleGenerate} className="mb-8 bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">Generate a new report</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              max={periodEnd}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              min={periodStart}
              max={today}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition"
          >
            {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
        {generating && (
          <p className="text-xs text-gray-400 mt-2">This can take up to a minute — analyzing feedback and writing the summary.</p>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </form>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-400">No reports yet. Generate your first one above.</p>
        ) : (
          reports.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/reports/${r.id}`}
              className="flex items-center justify-between px-5 py-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Generated {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))
        )}
      </div>
    </div>
  )
} 