import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import { TransactionsClient, type TransactionsData, type TransactionItem } from '@/components/dashboard/TransactionsClient'

export const metadata: Metadata = {
  title: 'Transactions & Revenue | Vyapar Samraj',
  description: 'View real transaction history and financial performance metrics.',
}

async function getInitialTransactionsData(rawPeriod: string = 'This Month', rawDate: string = ''): Promise<TransactionsData> {
  let period: 'Today' | 'This Week' | 'This Month' = 'This Month'
  const norm = (rawPeriod || '').trim().toLowerCase()
  if (norm === 'today') period = 'Today'
  else if (norm === 'this week' || norm === 'week') period = 'This Week'
  else period = 'This Month'

  const targetDate = rawDate.trim()

  try {
    let timeFilter = sql``

    if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      timeFilter = sql`
        AND ((COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata')::date = ${targetDate}::date)
      `
    } else if (period === 'Today') {
      timeFilter = sql`
        AND (COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata')
        AND (COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day'
      `
    } else if (period === 'This Week') {
      timeFilter = sql`
        AND (COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Kolkata')
        AND (COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 week'
      `
    } else {
      timeFilter = sql`
        AND (COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')
        AND (COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 month'
      `
    }

    const rows = await sql`
      SELECT 
        p.id as user_id,
        p.full_name as customer_name,
        p.email as customer_email,
        p.created_at as joined_at,
        p.status as user_status,
        latest_sub.sub_id,
        latest_sub.sub_status,
        latest_sub.sub_created_at,
        latest_sub.start_date as sub_start_date,
        pl.id as plan_id,
        pl.name as plan_name,
        COALESCE(pl.price, 0) as amount,
        COALESCE(pl.currency, 'INR') as currency
      FROM public.profiles p
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) id as sub_id, user_id, plan_id, status as sub_status, start_date, created_at as sub_created_at
        FROM public.subscriptions
        ORDER BY user_id, created_at DESC
      ) latest_sub ON latest_sub.user_id = p.id
      LEFT JOIN public.plans pl ON pl.id = latest_sub.plan_id
      WHERE (p.role IS NULL OR p.role::text != 'SUPER_ADMIN') ${timeFilter}
      ORDER BY COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) DESC
    `

    let totalRevenue = 0
    let successCount = 0
    let pendingCount = 0
    let failedCount = 0
    let refundCount = 0

    const formattedTransactions: TransactionItem[] = rows.map((r: any) => {
      const amt = Number(r.amount) || 0
      const subStat = (r.sub_status || r.user_status || '').toLowerCase()

      let status: 'completed' | 'pending' | 'failed' | 'refunded' = 'completed'
      if (subStat === 'pending') {
        status = 'pending'
        pendingCount++
      } else if (subStat === 'failed') {
        status = 'failed'
        failedCount++
      } else if (subStat === 'refunded') {
        status = 'refunded'
        refundCount++
      } else {
        status = 'completed'
        totalRevenue += amt
        successCount++
      }

      const startDate = r.sub_created_at || (r.sub_start_date ? new Date(r.sub_start_date).toISOString() : r.joined_at)

      return {
        id: String(r.sub_id || r.user_id),
        user_id: String(r.user_id),
        customer_name: r.customer_name ? String(r.customer_name) : 'System User',
        customer_email: r.customer_email ? String(r.customer_email) : 'No email',
        amount: amt,
        currency: String(r.currency || 'INR'),
        type: 'payment' as const,
        status,
        description: r.plan_name ? String(r.plan_name) : 'User Registration',
        reference_id: r.sub_id ? String(r.sub_id).substring(0, 8) : String(r.user_id).substring(0, 8),
        created_at: String(startDate),
      }
    })

    const [monthRow] = await sql`
      SELECT COALESCE(SUM(p.price), 0) AS total
      FROM (
        SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id
        FROM public.subscriptions s
        JOIN public.profiles pr ON pr.id = s.user_id
        WHERE (COALESCE(s.created_at, s.start_date::timestamp with time zone, pr.created_at) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone, pr.created_at) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 month'
        ORDER BY s.user_id, s.created_at DESC
      ) latest_subs
      JOIN public.plans p ON p.id = latest_subs.plan_id
    `

    const [yearRow] = await sql`
      SELECT COALESCE(SUM(p.price), 0) AS total
      FROM (
        SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id
        FROM public.subscriptions s
        JOIN public.profiles pr ON pr.id = s.user_id
        WHERE (COALESCE(s.created_at, s.start_date::timestamp with time zone, pr.created_at) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone, pr.created_at) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 year'
        ORDER BY s.user_id, s.created_at DESC
      ) latest_subs
      JOIN public.plans p ON p.id = latest_subs.plan_id
    `

    return {
      period,
      selectedDate: targetDate,
      totalRevenue,
      monthRevenue: Number(monthRow?.total) || 0,
      yearRevenue: Number(yearRow?.total) || 0,
      successCount,
      pendingCount,
      failedCount,
      refundCount,
      refundAmount: 0,
      transactions: formattedTransactions,
    }
  } catch (err) {
    console.error('Failed to load initial transactions page data:', err)
    return {
      period: 'This Month',
      selectedDate: targetDate,
      totalRevenue: 0,
      monthRevenue: 0,
      yearRevenue: 0,
      successCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundCount: 0,
      refundAmount: 0,
      transactions: [],
    }
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string; date?: string }> | { period?: string; date?: string }
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const rawPeriod = resolvedSearchParams?.period || 'This Month'
  const rawDate = resolvedSearchParams?.date || ''

  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const displayName = session.fullName || 'Super Admin'
  const initialData = await getInitialTransactionsData(rawPeriod, rawDate)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName={displayName} />
      </div>

      <TransactionsClient initialData={initialData} />

      <BottomNavigation />
    </div>
  )
}
