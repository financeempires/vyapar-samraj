import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireSuperAdmin, ok, err } from '@/lib/api-response'

/**
 * PATCH /api/plans/:id/toggle
 *
 * Atomically flips is_active for the given plan.
 * Active   → is_active = false  (Inactive)
 * Inactive → is_active = true   (Active)
 *
 * Only is_active changes — all other plan fields remain untouched.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  const { id } = await params

  try {
    // Step 1: flip is_active atomically
    const [updated] = await sql`
      UPDATE plans
      SET
        is_active  = NOT is_active,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, description, price, currency, duration_days,
                max_sub_users, areas, is_active, created_at, updated_at
    `

    if (!updated) return err('Plan not found', 404)

    // Step 2: also sync the status TEXT column if it exists (non-fatal if it doesn't)
    try {
      await sql`
        UPDATE plans
        SET status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END
        WHERE id = ${id}
      `
    } catch {
      // status column may not exist in all environments — this is non-fatal
    }

    // Step 3: audit log (non-critical)
    try {
      const action = updated.is_active ? 'resumed' : 'paused'
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES (
          'PLAN_TOGGLED',
          ${`Plan "${updated.name}" ${action} (is_active=${updated.is_active})`},
          ${auth.session.id},
          NOW()
        )
      `
    } catch { /* audit log is non-critical */ }

    return ok(updated)
  } catch (error: any) {
    console.error('[toggle] PATCH /api/plans/:id/toggle FAILED', {
      planId: id,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorDetail: error?.detail,
    })
    return err('Failed to toggle plan status', 500)
  }
}
