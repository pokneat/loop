import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const workspaceId = session.user.workspaceId

  const [total, unresolved, actioned] = await Promise.all([
    prisma.feedback.count({ where: { workspaceId } }),
    prisma.feedback.count({ where: { workspaceId, status: 'NEW' } }),
    prisma.feedback.count({ where: { workspaceId, status: 'ACTIONED' } }),
  ])

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">
        Welcome back, {session.user.name?.split(' ')[0]}
      </h1>
      <p className="text-gray-500 mb-8">Here's what's happening in your workspace.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-1">Total Feedback</p>
          <p className="text-3xl font-semibold text-gray-900">{total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-1">Needs Review</p>
          <p className="text-3xl font-semibold text-blue-600">{unresolved}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-500 mb-1">Actioned</p>
          <p className="text-3xl font-semibold text-green-600">{actioned}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/feedback"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-medium text-gray-900 mb-1">Feedback Inbox</h2>
          <p className="text-sm text-gray-500">Review, filter, and triage incoming feedback</p>
        </Link>
        <Link
          href="/dashboard/analytics"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
        >
          <h2 className="font-medium text-gray-900 mb-1">Analytics</h2>
          <p className="text-sm text-gray-500">Trends, sentiment, and theme breakdowns</p>
        </Link>
      </div>
    </div>
  )
}