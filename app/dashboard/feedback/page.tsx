'use client'

import { useEffect, useState, useCallback } from 'react'

type Theme = {
  id: string
  name: string
  color: string | null
}

type FeedbackItem = {
  id: string
  content: string
  channel: string
  customerLabel: string | null
  sentiment: string | null
  sentimentScore: number | null
  status: 'NEW' | 'REVIEWED' | 'ACTIONED'
  createdAt: string
  themes: { theme: Theme; confidence: number }[]
}

type ApiResponse = {
  data: FeedbackItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-yellow-100 text-yellow-700',
  ACTIONED: 'bg-green-100 text-green-700',
}

const SENTIMENT_STYLES: Record<string, string> = {
  POS: 'text-green-600',
  NEU: 'text-gray-500',
  NEG: 'text-red-600',
}

export default function FeedbackInboxPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)

  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  setUploading(true)
  setUploadMessage(null)

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('/api/feedback/bulk', {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()

    if (!res.ok) {
      setUploadMessage(`Error: ${json.error?.message ?? 'Upload failed.'}`)
    } else {
      setUploadMessage(`Imported ${json.imported} rows${json.skipped ? `, skipped ${json.skipped}` : ''}.`)
      fetchFeedback() // refresh the table
    }
  } catch {
    setUploadMessage('Could not reach the server.')
  } finally {
    setUploading(false)
    e.target.value = '' // reset file input so the same file can be re-selected later
  }
}

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status])

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('page', String(page))
    params.set('limit', '10')

    try {
      const res = await fetch(`/api/feedback?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error?.message ?? 'Something went wrong.')
        setItems([])
        setPagination(null)
        return
      }

      setItems(json.data)
      setPagination(json.pagination)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [status, debouncedSearch, page])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Feedback Inbox</h1>

      <div className="flex gap-3 mb-6">
      <label className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm cursor-pointer hover:bg-gray-800">
        {uploading ? 'Uploading...' : 'Upload CSV'}
        <input
          type="file"
          accept=".csv"
          onChange={handleCsvUpload}
          className="hidden"
          disabled={uploading}
        />
      </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="ACTIONED">Actioned</option>
        </select>
      </div>
      {uploadMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md mb-4">
          {uploadMessage}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-gray-500">Loading feedback...</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          No feedback found. Try adjusting your search or filters.
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Content</th>
                  <th className="px-4 py-3 font-medium">Theme</th>
                  <th className="px-4 py-3 font-medium">Sentiment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 max-w-md">
                      <p className="text-gray-900">{item.content}</p>
                      {item.customerLabel && (
                        <p className="text-xs text-gray-400 mt-1">{item.customerLabel} · {item.channel}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.themes[0] ? (
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${item.themes[0].theme.color}20`,
                            color: item.themes[0].theme.color ?? undefined,
                          }}
                        >
                          {item.themes[0].theme.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-medium ${SENTIMENT_STYLES[item.sentiment ?? ''] ?? 'text-gray-400'}`}>
                      {item.sentiment ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}