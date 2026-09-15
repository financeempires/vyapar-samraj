import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, canAccessResource, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const patchSubscriptionSchema = z.object({
  status:       z.enum(['active', 'expired', 'cancelled', 'pending']).optional(),
  end_date:     z.string().datetime().optional(),
  auto_renewal: z.boolean().optional(),
})

/** GET /api/subscriptions/:id — enforces ownership */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  try {
    const [sub] = await sql`
      SELECT s.*, p.name AS plan_name, pr.username, pr.email
      FROM subscriptions s
      JOIN plans    p  ON s.plan_id = p.id
      JOIN profiles pr ON s.user_id = pr.id
      WHERE s.id = ${id}
    `
    if (!sub) return err('Subscription not found', 404)

    if (!canAccessResource(session, String(sub.user_id))) {
      return err('Forbidden', 403)
    }

    return ok(sub)
  } catch (error) {
    console.error('GET /api/subscriptions/:id error:', error)
    return err('Failed to fetch subscription', 500)
  }
}

/** PATCH /api/subscriptions/:id — SUPER_ADMIN only */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  const { id } = await params

  try {
    const body   = await request.json()
    const parsed = patchSubscriptionSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const { status, end_date, auto_renewal } = parsed.data

    const [updated] = await sql`
      UPDATE subscriptions
      SET
        status       = COALESCE(${status       ?? null}, status),
        end_date     = COALESCE(${end_date     ?? null}::timestamptz, end_date),
        auto_renewal = COALESCE(${auto_renewal ?? null}, auto_renewal),
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (!updated) return err('Subscription not found', 404)

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('SUBSCRIPTION_UPDATED', ${`Subscription ${id} updated`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok(updated)
  } catch (error) {
    console.error('PATCH /api/subscriptions/:id error:', error)
    return err('Failed to update subscription', 500)
  }
}
