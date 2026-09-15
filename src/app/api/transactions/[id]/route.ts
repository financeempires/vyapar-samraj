import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, canAccessResource, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const patchTxSchema = z.object({
  status:      z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  description: z.string().max(500).optional(),
})

/** GET /api/transactions/:id — enforces ownership */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  try {
    const [tx] = await sql`
      SELECT t.*, pr.username, pr.email
      FROM transactions t
      JOIN profiles pr ON t.user_id = pr.id
      WHERE t.id = ${id}
    `
    if (!tx) return err('Transaction not found', 404)

    // Verify ownership for non-admins
    if (!canAccessResource(session, String(tx.user_id))) {
      return err('Forbidden', 403)
    }

    return ok(tx)
  } catch (error) {
    console.error('GET /api/transactions/:id error:', error)
    return err('Failed to fetch transaction', 500)
  }
}

/** PATCH /api/transactions/:id — SUPER_ADMIN or owning USER only */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  // SUB_USER cannot update transactions
  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  try {
    // Verify the transaction exists and check ownership
    const [existing] = await sql`SELECT user_id FROM transactions WHERE id = ${id}`
    if (!existing) return err('Transaction not found', 404)

    if (!canAccessResource(session, String(existing.user_id))) {
      return err('Forbidden', 403)
    }

    const body   = await request.json()
    const parsed = patchTxSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const { status, description } = parsed.data

    const [updated] = await sql`
      UPDATE transactions
      SET
        status      = COALESCE(${status      ?? null}, status),
        description = COALESCE(${description ?? null}, description),
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('TRANSACTION_UPDATED', ${`Transaction ${id} updated`}, ${session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok(updated)
  } catch (error) {
    console.error('PATCH /api/transactions/:id error:', error)
    return err('Failed to update transaction', 500)
  }
}

/** DELETE /api/transactions/:id — SUPER_ADMIN only */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  const { id } = await params

  try {
    const [deleted] = await sql`
      DELETE FROM transactions WHERE id = ${id} RETURNING id
    `
    if (!deleted) return err('Transaction not found', 404)

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('TRANSACTION_DELETED', ${`Transaction ${id} deleted`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok({ deleted: true, id })
  } catch (error) {
    console.error('DELETE /api/transactions/:id error:', error)
    return err('Failed to delete transaction', 500)
  }
}
