import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Greeting } from '@/components/dashboard/Greeting'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { RevenueOverview, type RevenueChartDataPoint } from '@/components/dashboard/RevenueOverview'
import { UsersOverview } from '@/components/dashboard/UsersOverview'
import { RecentActivity, type ActivityLogItem } from '@/components/dashboard/RecentActivity'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'

export const metadata: Metadata = {
  title: 'Super Admin Dashboard | Vyapar Samraj',
  description: 'Vyapar Samraj Super Admin Dashboard — manage revenue, users, and business activity.',
}

function formatIndianCurrency(amount: number): string {
  const num = Number(amount) || 0
  return `₹ ${num.toLocaleString('en-IN')}`
}

export default async function SuperAdminDashboardPage() {
  // 1. Verify Super Admin Session
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  // 2. Fetch live data from Neon PostgreSQL concurrently
  let displayName = session.fullName || 'Super Admin'
  let displayRevenue = '₹ 0'
  let displayTotalUsers = 0
  let displayActiveUsers = 0
  let displayExpiredUsers = 0
  let displayInactiveUsers = 0
  let revenueChangePercent: string | undefined = undefined
  let revenueChartData: RevenueChartDataPoint[] = []
  let recentActivities: ActivityLogItem[] = []

  const [adminResult, countsResult, revResult, revChartResult, logsResult] = await Promise.allSettled([
    sql`
      SELECT full_name, username
      FROM super_admin_accounts
      WHERE id = ${session.id}
      LIMIT 1
    `,
    sql`
      SELECT
        COUNT(DISTINCT p.id) AS total,
        COUNT(DISTINCT p.id) FILTER (
          WHERE (s.end_date IS NULL OR s.end_date >= NOW())
            AND LOWER(p.status::text) NOT IN ('inactive', 'paused')
        ) AS active,
        COUNT(DISTINCT p.id) FILTER (
          WHERE LOWER(p.status::text) = 'expired' OR (s.end_date IS NOT NULL AND s.end_date < NOW())
        ) AS expired,
        COUNT(DISTINCT p.id) FILTER (
          WHERE (s.end_date IS NULL OR s.end_date >= NOW())
            AND LOWER(p.status::text) IN ('inactive', 'paused')
        ) AS inactive
      FROM public.profiles p
      LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, start_date, end_date
        FROM public.subscriptions
        ORDER BY user_id, created_at DESC
      ) s ON s.user_id = p.id
    `,
    sql`
      SELECT COALESCE(SUM(p.price), 0) AS total
      FROM (
        SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id
        FROM public.subscriptions s
        JOIN public.profiles pr ON pr.id = s.user_id
        ORDER BY s.user_id, s.created_at DESC
      ) latest_subs
      JOIN public.plans p ON p.id = latest_subs.plan_id
    `,
    sql`
      SELECT
        TO_CHAR(COALESCE(latest_subs.start_date, latest_subs.created_at), 'DD Mon') AS date,
        DATE_TRUNC('day', COALESCE(latest_subs.start_date, latest_subs.created_at))  AS day_date,
        COALESCE(SUM(p.price), 0)                                                      AS value
      FROM (
        SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id, s.created_at, s.start_date
        FROM public.subscriptions s
        JOIN public.profiles pr ON pr.id = s.user_id
        ORDER BY s.user_id, s.created_at DESC
      ) latest_subs
      JOIN public.plans p ON p.id = latest_subs.plan_id
      GROUP BY TO_CHAR(COALESCE(latest_subs.start_date, latest_subs.created_at), 'DD Mon'), DATE_TRUNC('day', COALESCE(latest_subs.start_date, latest_subs.created_at))
      ORDER BY DATE_TRUNC('day', COALESCE(latest_subs.start_date, latest_subs.created_at)) ASC
    `,
    sql`
      SELECT id, type, description, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ])

  if (adminResult.status === 'fulfilled' && adminResult.value && adminResult.value.length > 0 && adminResult.value[0].full_name) {
    displayName = adminResult.value[0].full_name
  }

  if (countsResult.status === 'fulfilled' && countsResult.value && countsResult.value.length > 0) {
    const row = countsResult.value[0]
    displayTotalUsers = Number(row.total) || 0
    displayActiveUsers = Number(row.active) || 0
    displayExpiredUsers = Number(row.expired) || 0
    displayInactiveUsers = Number(row.inactive) || 0
  }

  if (revResult.status === 'fulfilled' && revResult.value && revResult.value.length > 0) {
    const totalRev = Number(revResult.value[0].total) || 0
    const lastMonthRev = Number(revResult.value[0].last_month) || 0
    displayRevenue = formatIndianCurrency(totalRev)

    if (lastMonthRev > 0) {
      const pct = (((totalRev - lastMonthRev) / lastMonthRev) * 100).toFixed(2)
      revenueChangePercent = `${pct}%`
    }
  }

  if (revChartResult.status === 'fulfilled' && revChartResult.value) {
    const rawPoints = revChartResult.value.map((r) => ({
      date: String(r.date),
      value: Number(r.value) || 0,
    }))

    if (rawPoints.length === 0) {
      revenueChartData = [{ date: 'Today', value: 0 }]
    } else if (rawPoints.length === 1) {
      const firstDateStr = rawPoints[0].date
      const parts = firstDateStr.split(' ')
      const monthStr = parts[1] || ''
      const baselineDate = monthStr ? `01 ${monthStr}` : '01 Aug'
      if (baselineDate !== firstDateStr) {
        revenueChartData = [{ date: baselineDate, value: 0 }, ...rawPoints]
      } else {
        revenueChartData = rawPoints
      }
    } else {
      revenueChartData = rawPoints
    }
  }

  if (logsResult.status === 'fulfilled' && logsResult.value) {
    recentActivities = logsResult.value.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      description: String(r.description),
      created_at: String(r.created_at),
    }))
  }

  return (
    <div className="min-h-screen bg-white" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName={displayName} />
      </div>

      {/* Scrollable content */}
      <div className="pb-24 max-w-lg mx-auto">
        {/* Greeting */}
        <Greeting name={displayName} />

        {/* 4 KPI Cards */}
        <StatsGrid
          totalRevenue={displayRevenue}
          totalUsers={displayTotalUsers}
          activeUsers={displayActiveUsers}
          expiredUsers={displayExpiredUsers}
          revenueChange={revenueChangePercent}
        />

        {/* Revenue Overview with Line Chart */}
        <RevenueOverview
          totalRevenue={displayRevenue}
          change={revenueChangePercent}
          data={revenueChartData}
        />

        {/* Users Overview + Recent Activity */}
        <div className="px-4 mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <UsersOverview
            total={displayTotalUsers}
            active={displayActiveUsers}
            expired={displayExpiredUsers}
            inactive={displayInactiveUsers}
          />
          <RecentActivity activities={recentActivities} />
        </div>

        <div className="h-4" />
      </div>

      {/* Fixed bottom navigation */}
      <BottomNavigation />
    </div>
  )
}
