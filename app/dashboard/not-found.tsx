import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <p className="text-lg font-medium text-gray-900 mb-1">Not found</p>
      <p className="text-sm text-gray-500 mb-6">
        This page or item doesn't exist, or you may not have access to it.
      </p>
      <Link
        href="/dashboard"
        className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
      >
        Back to dashboard
      </Link>
    </div>
  )
}