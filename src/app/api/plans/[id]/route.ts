import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const patchPlanSchema = z.object({
  planName:      z.string().min(1).max(100).optional(),
  name:          z.string().min(1).max(100).optional(),
  description:   z.string().max(500).optional(),
  price:         z.number().gt(0).optional(),
  currency:      z.string().length(3).optional(),
  days:          z.number().int().gt(0).optional(),
  years:         z.number().int().gt(0).optional(),
  duration_days: z.number().int().gt(0).optional(),
  subadmins:     z.number().int().min(0).optional(),
  max_sub_users: z.number().int().min(0).optional(),
  areas:         z.string().optional(),
  features:      z.record(z.unknown()).optional(),
  is_active:     z.boolean().optional(),
})

/**
 * GET /api/plans/:id
 *
 * SUPER_ADMIN  → any plan (active or inactive)
 * USER/SUB_USER → only active plans
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  try {
    const [plan] = await sql`SELECT id, name, description, price, currency, duration_days, max_sub_users, areas, features, is_active, created_at, updated_at FROM plans WHERE id = ${id}`
    if (!plan) return err('Plan not found', 404)

    // Non-admins cannot view inactive plans
    if (!isSuperAdmin(session) && !plan.is_active) {
      return err('Plan not found', 404)
    }

    return ok(plan)
  } catch (error) {
    console.error('GET /api/plans/:id error:', error)
    return err('Failed to fetch plan', 500)
  }
}

/** PATCH /api/plans/:id — SUPER_ADMIN only */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  const { id } = await params

  try {
    const body   = await request.json()
    const parsed = patchPlanSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const finalName = (parsed.data.planName ?? parsed.data.name ?? '').trim() || undefined
    const finalPrice = parsed.data.price
    const finalDurationDays = parsed.data.days ?? parsed.data.duration_days ?? parsed.data.years
    const finalMaxSubUsers = parsed.data.subadmins ?? parsed.data.max_sub_users
    const finalAreas = parsed.data.areas !== undefined ? parsed.data.areas.trim() : undefined

    const [updated] = await sql`
      UPDATE plans
      SET
        name          = COALESCE(${finalName          ?? null}, name),
        description   = COALESCE(${parsed.data.description   ?? null}, description),
        price         = COALESCE(${finalPrice         ?? null}, price),
        currency      = COALESCE(${parsed.data.currency      ?? null}, currency),
        duration_days = COALESCE(${finalDurationDays ?? null}, duration_days),
        max_sub_users = COALESCE(${finalMaxSubUsers ?? null}, max_sub_users),
        areas         = COALESCE(${finalAreas        ?? null}, areas),
        features      = COALESCE(${parsed.data.features ? JSON.stringify(parsed.data.features) : null}::jsonb, features),
        is_active     = COALESCE(${parsed.data.is_active     ?? null}, is_active),
        status        = CASE WHEN COALESCE(${parsed.data.is_active ?? null}, is_active) THEN 'ACTIVE' ELSE 'INACTIVE' END,
        updated_at    = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (!updated) return err('Plan not found', 404)

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('PLAN_UPDATED', ${`Plan ${id} updated`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log fallback */ }

    return ok(updated)
  } catch (error) {
    console.error('PATCH /api/plans/:id error:', error)
    return err('Failed to update plan', 500)
  }
}

/** DELETE /api/plans/:id — SUPER_ADMIN only */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  const { id } = await params

  try {
    const [existingPlan] = await sql`SELECT id, name FROM plans WHERE id = ${id}`
    if (!existingPlan) return err('Plan not found', 404)

    // Safely update dependent subscriptions to NULL (preserving subscriptions, users, and transactions)
    await sql`UPDATE subscriptions SET plan_id = NULL WHERE plan_id = ${id}`

    // Remove plan from plans table
    const [deleted] = await sql`DELETE FROM plans WHERE id = ${id} RETURNING id, name`

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('PLAN_DELETED', ${`Plan "${existingPlan.name}" deleted`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log fallback */ }

    return ok({ deleted: true, id: existingPlan.id, name: existingPlan.name })
  } catch (error) {
    console.error('DELETE /api/plans/:id error:', error)
    return err('Failed to delete plan', 500)
  }
}
