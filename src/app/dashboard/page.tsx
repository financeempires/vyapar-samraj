import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { UserDashboardClient } from '@/components/dashboard/UserDashboardClient'

export const metadata: Metadata = {
  title: 'Vyapar Samraj — Smart Finance. Stronger Business.',
  description: 'Smart Finance. Stronger Business.',
}

export default async function DashboardPage() {
  const session = await verifySession()

  if (!session) {
    redirect('/login')
  }

  if (session.role === 'SUPER_ADMIN') {
    redirect('/super-admin/dashboard')
  }

  return <UserDashboardClient userName={session.fullName || session.username} />
}
