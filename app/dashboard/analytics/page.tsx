'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts'

type AnalyticsData = {
  statusBreakdown: { status: string; count: number }[]
  sentimentBreakdown: { sentiment: string; count: number }[]
  volumeOverTime: { date: string; count: number }[]
  topThemes: { name: string; color: string | null; count: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3B82F6',
  REVIEWED: '#F59E0B',
  ACTIONED: '#10B981',
}

const SENTIMENT_COLORS: Record<string, string> = {
  POS: '#10B981',
  NEU: '#9CA3AF',
  NEG: '#EF4444',
  UNCLASSIFIED: '#D1D5DB',
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/analytics/summary')
        const json = await res.json()
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to load analytics.')
          return
        }
        setData(json)
      } catch {
        setError('Could not reach the server.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="text-center py-16 text-gray-500">Loading analytics...</div>
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-10 px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    )
  }

  if (!data || data.volumeOverTime.length === 0) {
    return (
      <div className="max-w-5xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h1>
        <div className="text-center py-16 text-gray-500">
          No data yet. Upload or simulate some feedback to see charts here.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">
      <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>

      {/* Volume over time */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Feedback Volume (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data.volumeOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.statusBreakdown}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry: any) => `${entry.status}: ${entry.count}`}
              >
                {data.statusBreakdown.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#9CA3AF'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Sentiment Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.sentimentBreakdown}
                dataKey="count"
                nameKey="sentiment"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry: any ) => `${entry.sentiment}: ${entry.count}`}
              >
                {data.sentimentBreakdown.map((entry) => (
                  <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment] ?? '#9CA3AF'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top themes */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Top Themes</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.topThemes} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
            <Tooltip />
            <Bar dataKey="count">
              {data.topThemes.map((entry) => (
                <Cell key={entry.name} fill={entry.color ?? '#3B82F6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
 