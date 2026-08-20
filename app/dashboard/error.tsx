'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <p className="text-gray-600 mb-1">Something went wrong loading this page.</p>
      <p className="text-sm text-gray-400 mb-6">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
      >
        Try again
      </button>
    </div>
  )
}