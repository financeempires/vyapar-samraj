import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import { NotificationsClient, NotificationItem } from './NotificationsClient'

export const metadata: Metadata = {
  title: 'System Notifications | Vyapar Samraj',
  description: 'View database-backed system alerts and notifications.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function NotificationsPage() {
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const displayName = session.fullName || 'Super Admin'

  let notifications: NotificationItem[] = []

  try {
    const rows = await sql`
      SELECT id, recipient_id, type, title, body, is_read, created_at, updated_at
      FROM notifications
      WHERE is_read = FALSE
      ORDER BY created_at DESC
      LIMIT 100
    `
    notifications = rows as unknown as NotificationItem[]
  } catch (err) {
    console.error('Notifications query error:', err)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName={displayName} />
      </div>

      <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
        <NotificationsClient initialNotifications={notifications} />
      </div>

      <BottomNavigation />
    </div>
  )
}
