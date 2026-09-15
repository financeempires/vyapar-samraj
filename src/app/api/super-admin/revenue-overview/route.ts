import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireSuperAdmin, ok, err } from '@/lib/api-response'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatIndianCurrency(amount: number): string {
  const num = Number(amount) || 0
  return `₹ ${num.toLocaleString('en-IN')}`
}

function normalizePeriod(raw: string): 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Till Now' {
  const norm = (raw || '').trim().toLowerCase().replace(/_/g, ' ')
  if (norm === 'today') return 'Today'
  if (norm === 'this week' || norm === 'week') return 'This Week'
  if (norm === 'this month' || norm === 'month') return 'This Month'
  if (norm === 'this year' || norm === 'year') return 'This Year'
  if (norm === 'till now' || norm === 'tillnow' || norm === 'all time' || norm === 'till_now') return 'Till Now'
  return 'This Month'
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  const searchParams = request.nextUrl.searchParams
  const rawPeriod = searchParams.get('period') || 'This Month'
  const period = normalizePeriod(rawPeriod)

  try {
    let totalRevenue = 0
    let points: { date: string; value: number }[] = []

    if (period === 'Till Now') {
      const [revRow] = await sql`
        SELECT COALESCE(SUM(p.price), 0) AS total
        FROM (
          SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id
          FROM public.subscriptions s
          JOIN public.profiles pr ON pr.id = s.user_id
          WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN')
          ORDER BY s.user_id, s.created_at DESC
        ) latest_subs
        JOIN public.plans p ON p.id = latest_subs.plan_id
      `
      totalRevenue = Number(revRow?.total) || 0

      const rows = await sql`
        SELECT
          TO_CHAR((COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'), 'DD Mon') AS date,
          COALESCE(SUM(p.price), 0) AS value
        FROM (
          SELECT DISTINCT ON (s.user_id) s.user_id, s.plan_id, s.created_at, s.start_date
          FROM public.subscriptions s
          JOIN public.profiles pr ON pr.id = s.user_id
          WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN')
          ORDER BY s.user_id, s.created_at DESC
        ) s
        JOIN public.plans p ON p.id = s.plan_id
        GROUP BY 1, DATE_TRUNC('day', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'))
        ORDER BY DATE_TRUNC('day', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata')) ASC
      `
      points = rows.map(r => ({ date: String(r.date), value: Number(r.value) || 0 }))

    } else {
      let timeFilter = sql``
      if (period === 'Today') {
        timeFilter = sql`
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 day'
        `
      } else if (period === 'This Week') {
        timeFilter = sql`
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 week'
        `
      } else if (period === 'This Month') {
        timeFilter = sql`
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 month'
        `
      } else { // This Year
        timeFilter = sql`
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Kolkata')
          AND (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata') < DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 year'
        `
      }

      const [revRow] = await sql`
        SELECT COALESCE(SUM(p.price), 0) AS total
        FROM public.subscriptions s
        JOIN public.plans p ON p.id = s.plan_id
        JOIN public.profiles pr ON pr.id = s.user_id
        WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN') ${timeFilter}
      `
      totalRevenue = Number(revRow?.total) || 0

      if (period === 'Today') {
        const rows = await sql`
          SELECT
            TO_CHAR((COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'), 'HH24:00') AS date,
            COALESCE(SUM(p.price), 0) AS value
          FROM public.subscriptions s
          JOIN public.plans p ON p.id = s.plan_id
          JOIN public.profiles pr ON pr.id = s.user_id
          WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN') ${timeFilter}
          GROUP BY 1, DATE_TRUNC('hour', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'))
          ORDER BY DATE_TRUNC('hour', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata')) ASC
        `
        points = rows.map(r => ({ date: String(r.date), value: Number(r.value) || 0 }))
      } else if (period === 'This Week') {
        const rows = await sql`
          SELECT
            TO_CHAR((COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'), 'Dy DD') AS date,
            COALESCE(SUM(p.price), 0) AS value
          FROM public.subscriptions s
          JOIN public.plans p ON p.id = s.plan_id
          JOIN public.profiles pr ON pr.id = s.user_id
          WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN') ${timeFilter}
          GROUP BY 1, DATE_TRUNC('day', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'))
          ORDER BY DATE_TRUNC('day', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata')) ASC
        `
        points = rows.map(r => ({ date: String(r.date), value: Number(r.value) || 0 }))
      } else if (period === 'This Month') {
        const rows = await sql`
          SELECT
            TO_CHAR((COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'), 'DD Mon') AS date,
            COALESCE(SUM(p.price), 0) AS value
          FROM public.subscriptions s
          JOIN public.plans p ON p.id = s.plan_id
          JOIN public.profiles pr ON pr.id = s.user_id
          WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN') ${timeFilter}
          GROUP BY 1, DATE_TRUNC('day', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'))
          ORDER BY DATE_TRUNC('day', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata')) ASC
        `
        points = rows.map(r => ({ date: String(r.date), value: Number(r.value) || 0 }))
      } else {
        const rows = await sql`
          SELECT
            TO_CHAR((COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'), 'Mon YYYY') AS date,
            COALESCE(SUM(p.price), 0) AS value
          FROM public.subscriptions s
          JOIN public.plans p ON p.id = s.plan_id
          JOIN public.profiles pr ON pr.id = s.user_id
          WHERE (pr.role IS NULL OR pr.role::text != 'SUPER_ADMIN') ${timeFilter}
          GROUP BY 1, DATE_TRUNC('month', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata'))
          ORDER BY DATE_TRUNC('month', (COALESCE(s.created_at, s.start_date::timestamp with time zone) AT TIME ZONE 'Asia/Kolkata')) ASC
        `
        points = rows.map(r => ({ date: String(r.date), value: Number(r.value) || 0 }))
      }
    }

    return ok({
      totalRevenue: formatIndianCurrency(totalRevenue),
      chartPoints: points,
    })
  } catch (error) {
    console.error('Revenue Overview API error:', error)
    return err('Failed to fetch revenue overview', 500)
  }
}
