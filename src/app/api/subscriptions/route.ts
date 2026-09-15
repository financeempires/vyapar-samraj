import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const PAGE_SIZE = 50

const createSubscriptionSchema = z.object({
  user_id:      z.string().uuid(),
  plan_id:      z.string().uuid(),
  start_date:   z.string().datetime(),
  end_date:     z.string().datetime(),
  status:       z.enum(['active', 'expired', 'cancelled', 'pending']).default('active'),
  auto_renewal: z.boolean().default(false),
})

/**
 * GET /api/subscriptions
 *
 * SUPER_ADMIN  → all subscriptions (filterable by status)
 * USER         → only their own subscriptions
 * SUB_USER     → only their parent's subscriptions (read-only)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth
  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, Number(searchParams.get('page') ?? 1))
  const status = searchParams.get('status') ?? ''
  const offset = (page - 1) * PAGE_SIZE

  try {
    let rows
    let countRows

    if (isSuperAdmin(session)) {
      if (status) {
        rows = await sql`
          SELECT s.*, p.name AS plan_name, pr.username, pr.email
          FROM subscriptions s
          JOIN plans    p  ON s.plan_id = p.id
          JOIN profiles pr ON s.user_id = pr.id
          WHERE s.status = ${status}
          ORDER BY s.created_at DESC
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `
        countRows = await sql`SELECT COUNT(*) AS count FROM subscriptions WHERE status = ${status}`
      } else {
        rows = await sql`
          SELECT s.*, p.name AS plan_name, pr.username, pr.email
          FROM subscriptions s
          JOIN plans    p  ON s.plan_id = p.id
          JOIN profiles pr ON s.user_id = pr.id
          ORDER BY s.created_at DESC
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `
        countRows = await sql`SELECT COUNT(*) AS count FROM subscriptions`
      }
    } else {
      // USER/SUB_USER: scope to owner
      const ownerId = session.role === 'SUB_USER' ? session.parentId : session.id
      if (!ownerId) return err('Forbidden', 403)

      if (status) {
        rows = await sql`
          SELECT s.*, p.name AS plan_name, pr.username, pr.email
          FROM subscriptions s
          JOIN plans    p  ON s.plan_id = p.id
          JOIN profiles pr ON s.user_id = pr.id
          WHERE s.user_id = ${ownerId} AND s.status = ${status}
          ORDER BY s.created_at DESC
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `
        countRows = await sql`SELECT COUNT(*) AS count FROM subscriptions WHERE user_id = ${ownerId} AND status = ${status}`
      } else {
        rows = await sql`
          SELECT s.*, p.name AS plan_name, pr.username, pr.email
          FROM subscriptions s
          JOIN plans    p  ON s.plan_id = p.id
          JOIN profiles pr ON s.user_id = pr.id
          WHERE s.user_id = ${ownerId}
          ORDER BY s.created_at DESC
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `
        countRows = await sql`SELECT COUNT(*) AS count FROM subscriptions WHERE user_id = ${ownerId}`
      }
    }

    return ok({ subscriptions: rows, pagination: { page, pageSize: PAGE_SIZE, total: Number(countRows[0].count) } })
  } catch (error) {
    console.error('GET /api/subscriptions error:', error)
    return err('Failed to fetch subscriptions', 500)
  }
}

/**
 * POST /api/subscriptions — SUPER_ADMIN only
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  try {
    const body   = await request.json()
    const parsed = createSubscriptionSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const { user_id, plan_id, start_date, end_date, status, auto_renewal } = parsed.data

    const [sub] = await sql`
      INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, status, auto_renewal, created_at, updated_at)
      VALUES (${user_id}, ${plan_id}, ${start_date}, ${end_date}, ${status}, ${auto_renewal}, NOW(), NOW())
      RETURNING *
    `

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('SUBSCRIPTION_CREATED', ${`Subscription created for user ${user_id}`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok(sub, 201)
  } catch (error) {
    console.error('POST /api/subscriptions error:', error)
    return err('Failed to create subscription', 500)
  }
}
