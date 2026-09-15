import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { PlansClient, Plan } from '@/components/dashboard/PlansClient'

export const metadata: Metadata = {
  title: 'Subscription Plans | Vyapar Samraj',
  description: 'Manage subscription plans for Vyapar Samraj users.',
}

export default async function PlansPage() {
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const displayName = session.fullName || 'Super Admin'

  let plans: Plan[] = []

  try {
    const rows = await sql`
      SELECT id, name, description, price, currency, duration_days, max_sub_users, areas, is_active, status, created_at
      FROM plans
      ORDER BY created_at DESC
    `
    plans = rows as Plan[]
  } catch {
    plans = []
  }

  return <PlansClient initialPlans={plans} displayName={displayName} />
}
