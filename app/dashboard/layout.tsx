import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import SignOutButton from './sign-out-button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
    select: { name: true },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-gray-900">
              {workspace?.name ?? 'LOOP'}
            </span>
            <nav className="flex gap-6 text-sm">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Overview
              </Link>
              <Link href="/dashboard/feedback" className="text-gray-600 hover:text-gray-900">
                Feedback Inbox
              </Link>
              <Link href="/dashboard/analytics" className="text-gray-600 hover:text-gray-900">
                Analytics
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              {session.user.name} · <span className="font-medium">{session.user.role}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}