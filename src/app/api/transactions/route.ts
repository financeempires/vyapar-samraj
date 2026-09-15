import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const PAGE_SIZE = 50

const createTxSchema = z.object({
  user_id:         z.string().uuid(),
  organization_id: z.string().uuid().optional(),
  amount:          z.number().min(0),
  currency:        z.string().length(3).default('INR'),
  type:            z.enum(['payment', 'refund', 'adjustment']),
  status:          z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  description:     z.string().max(500).optional(),
  reference_id:    z.string().max(100).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { searchParams } = new URL(request.url)
  const rawPeriod = searchParams.get('period') ?? 'This Month'
  const rawDate = (searchParams.get('date') ?? '').trim()

  let period: 'Today' | 'This Week' | 'This Month' = 'This Month'
  const norm = rawPeriod.trim().toLowerCase()
  if (norm === 'today') period = 'Today'
  else if (norm === 'this week' || norm === 'week') period = 'This Week'
  else period = 'This Month'

  try {
    let timeFilter = sql``

    // If specific date (YYYY-MM-DD) is provided, perform exact IST calendar date comparison
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      timeFilter = sql`
        AND ((COALESCE(latest_sub.sub_created_at, latest_sub.start_date::timestamp with time zone, p.created_at) AT TIME ZONE 'Asia/Kolkata')::date = ${rawDate}::date)
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

    // Authoritative user/subscription start date filtering
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

    const formattedTransactions = rows.map((r: any) => {
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

    // Compute Dashboard-authoritative Month and Year revenue
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

    return ok({
      period,
      selectedDate: rawDate,
      totalRevenue,
      monthRevenue: Number(monthRow?.total) || 0,
      yearRevenue: Number(yearRow?.total) || 0,
      successCount,
      pendingCount,
      failedCount,
      refundCount,
      refundAmount: 0,
      transactions: formattedTransactions,
    })
  } catch (error) {
    console.error('GET /api/transactions error:', error)
    return err('Failed to fetch transactions', 500)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth
  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  try {
    const body   = await request.json()
    const parsed = createTxSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const { user_id, organization_id, amount, currency, type, status, description, reference_id } = parsed.data

    if (!isSuperAdmin(session) && user_id !== session.id) {
      return err('Forbidden: cannot create transactions for another user', 403)
    }

    const [tx] = await sql`
      INSERT INTO transactions
        (user_id, organization_id, amount, currency, type, status, description, reference_id, created_at, updated_at)
      VALUES
        (${user_id}, ${organization_id ?? null}, ${amount}, ${currency}, ${type},
         ${status}, ${description ?? null}, ${reference_id ?? null}, NOW(), NOW())
      RETURNING *
    `

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('TRANSACTION_CREATED', ${`Transaction of ${amount} ${currency} created`}, ${session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok(tx, 201)
  } catch (error) {
    console.error('POST /api/transactions error:', error)
    return err('Failed to create transaction', 500)
  }
}
