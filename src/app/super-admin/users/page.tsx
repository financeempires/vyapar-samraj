import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import { UsersClient, type Profile } from '@/components/dashboard/UsersClient'

export const metadata: Metadata = {
  title: 'User Management | Vyapar Samraj',
  description: 'Manage all registered users on Vyapar Samraj.',
}

export default async function UsersPage() {
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const displayName = session.fullName || 'Super Admin'

  let users: Profile[] = []
  let fetchError = false

  try {
    const rows = await sql`
      SELECT id, username, email, full_name, role, status, organization, created_at
      FROM profiles
      ORDER BY created_at DESC
      LIMIT 100
    `
    const userIds = rows.map((r: any) => r.id)
    let phoneMap: Record<string, string> = {}
    let planMap: Record<string, string> = {}
    let startDateMap: Record<string, string> = {}
    let endDateMap: Record<string, string> = {}

    if (userIds.length > 0) {
      try {
        const uRows = await sql`SELECT id, phone FROM users WHERE id = ANY(${userIds}::uuid[])`
        for (const u of uRows) {
          if (u.phone) phoneMap[u.id] = u.phone
        }
        const subRows = await sql`
          SELECT DISTINCT ON (user_id) user_id, plan_id, start_date, end_date
          FROM subscriptions
          WHERE user_id = ANY(${userIds}::uuid[])
          ORDER BY user_id, created_at DESC
        `
        for (const s of subRows) {
          if (s.plan_id) planMap[s.user_id] = s.plan_id
          if (s.start_date) startDateMap[s.user_id] = String(s.start_date)
          if (s.end_date) endDateMap[s.user_id] = String(s.end_date)
        }
      } catch (err) {
        console.error('Error mapping phone/plan/end_date in UsersPage:', err)
      }
    }

    users = rows.map((r: any) => ({
      ...r,
      phone: phoneMap[r.id] || '',
      plan_id: planMap[r.id] || '',
      start_date: startDateMap[r.id] || null,
      end_date: endDateMap[r.id] || null,
    })) as Profile[]
  } catch {
    fetchError = true
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-40 bg-white"
        style={{ borderBottom: '1px solid #F1F5F9' }}
      >
        <DashboardHeader userName={displayName} />
      </div>

      {/* Main client component with Add User Modal */}
      <UsersClient initialUsers={users} fetchError={fetchError} />

      {/* Fixed bottom navigation */}
      <BottomNavigation />
    </div>
  )
}
