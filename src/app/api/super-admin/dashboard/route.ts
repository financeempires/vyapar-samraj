import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireSuperAdmin, ok, err } from '@/lib/api-response'

/**
 * GET /api/super-admin/dashboard
 *
 * Returns aggregated KPI stats, revenue overview data, users overview,
 * and recent activity — all computed server-side via SQL aggregation.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  try {
    // ── 1. User counts by status (strictly actual user records, deduplicated by profile ID) ────────────
    let totalUsers = 0
    let activeUsers = 0
    let expiredUsers = 0
    let inactiveUsers = 0
    let pendingUsers = 0

    try {
      const userCounts = await sql`
        SELECT
          COUNT(DISTINCT p.id)                                                                                                      AS total,
          COUNT(DISTINCT p.id) FILTER (WHERE LOWER(p.status::text) = 'active')                                                      AS active,
          COUNT(DISTINCT p.id) FILTER (WHERE LOWER(p.status::text) = 'expired' OR (s.end_date IS NOT NULL AND s.end_date < NOW()))  AS expired,
          COUNT(DISTINCT p.id) FILTER (WHERE LOWER(p.status::text) = 'inactive')                                                    AS inactive,
          COUNT(DISTINCT p.id) FILTER (WHERE LOWER(p.status::text) = 'pending')                                                     AS pending
        FROM public.profiles p
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) user_id, end_date
          FROM public.subscriptions
          ORDER BY user_id, created_at DESC
        ) s ON s.user_id = p.id
      `
      if (userCounts?.length > 0) {
        totalUsers    = Number(userCounts[0].total)    || 0
        activeUsers   = Number(userCounts[0].active)   || 0
        expiredUsers  = Number(userCounts[0].expired)  || 0
        inactiveUsers = Number(userCounts[0].inactive) || 0
        pendingUsers  = Number(userCounts[0].pending)  || 0
      }
    } catch { /* fallback */ }

    // ── 2. Revenue totals ─────────────────────────────────────────────────
    let totalRevenue = 0
    let lastMonthRevenue = 0

    try {
      const revRows = await sql`
        SELECT COALESCE(SUM(p.price), 0) AS total
        FROM (
          SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id
          FROM public.subscriptions s
          JOIN public.profiles pr ON pr.id = s.user_id
          ORDER BY s.user_id, s.created_at DESC
        ) latest_subs
        JOIN public.plans p ON p.id = latest_subs.plan_id
      `
      if (revRows?.length > 0) {
        totalRevenue = Number(revRows[0].total) || 0
      }
    } catch { /* fallback */ }

    const revenueChangePercent =
      lastMonthRevenue > 0
        ? (((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(2)
        : undefined

    // ── 3. Revenue overview chart data (daily for current month) ─────────
    let revenueChart: { date: string; value: number }[] = []

    try {
      const chartRows = await sql`
        SELECT
          TO_CHAR(created_at, 'DD Mon') AS date,
          COALESCE(SUM(amount), 0)      AS value
        FROM transactions
        WHERE UPPER(COALESCE(status::text, '')) = 'COMPLETED'
          AND created_at >= date_trunc('month', current_date)
        GROUP BY TO_CHAR(created_at, 'DD Mon'), DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at)
      `
      revenueChart = chartRows.map((r) => ({
        date: String(r.date),
        value: Number(r.value) || 0,
      }))
    } catch { /* fallback */ }

    // ── 4. Recent activity ────────────────────────────────────────────────
    let recentActivity: {
      id: string
      type: string
      description: string
      created_at: string
    }[] = []

    try {
      const activityRows = await sql`
        SELECT id, type, description, created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 10
      `
      recentActivity = activityRows.map((r) => ({
        id:          String(r.id),
        type:        String(r.type),
        description: String(r.description),
        created_at:  String(r.created_at),
      }))
    } catch { /* fallback */ }

    // ── 5. Format currency helper ─────────────────────────────────────────
    function formatINR(amount: number): string {
      const num = Number(amount) || 0
      return `₹ ${num.toLocaleString('en-IN')}`
    }

    return ok({
      totalRevenue:        formatINR(totalRevenue),
      totalUsers,
      activeUsers,
      expiredUsers,
      inactiveUsers,
      pendingUsers,
      revenueChangePercent,
      revenueChart,
      usersOverview: { totalUsers, activeUsers, expiredUsers, inactiveUsers, pendingUsers },
      recentActivity,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return err('Failed to load dashboard data', 500)
  }
}
