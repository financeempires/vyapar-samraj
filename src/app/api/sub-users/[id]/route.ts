import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const patchSubUserSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  email:     z.string().email().optional(),
  status:    z.enum(['active', 'inactive', 'pending']).optional(),
})

/** GET /api/sub-users/:id */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  try {
    const [subUser] = await sql`
      SELECT id, username, email, full_name, role, status, parent_id, created_at, updated_at
      FROM profiles
      WHERE id = ${id} AND role = 'SUB_USER'
    `
    if (!subUser) return err('Sub-user not found', 404)

    // USER can only view their own sub-users
    if (!isSuperAdmin(session) && String(subUser.parent_id) !== session.id) {
      return err('Forbidden', 403)
    }

    return ok(subUser)
  } catch (error) {
    console.error('GET /api/sub-users/:id error:', error)
    return err('Failed to fetch sub-user', 500)
  }
}

/** PATCH /api/sub-users/:id */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  try {
    const [subUser] = await sql`SELECT parent_id FROM profiles WHERE id = ${id} AND role = 'SUB_USER'`
    if (!subUser) return err('Sub-user not found', 404)

    // USER can only update their own sub-users
    if (!isSuperAdmin(session) && String(subUser.parent_id) !== session.id) {
      return err('Forbidden', 403)
    }

    const body   = await request.json()
    const parsed = patchSubUserSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const { full_name, email, status } = parsed.data

    const [updated] = await sql`
      UPDATE profiles
      SET
        full_name  = COALESCE(${full_name ?? null}, full_name),
        email      = COALESCE(${email     ?? null}, email),
        status     = COALESCE(${status    ?? null}, status),
        updated_at = NOW()
      WHERE id = ${id} AND role = 'SUB_USER'
      RETURNING id, username, email, full_name, role, status, parent_id, updated_at
    `

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('SUB_USER_UPDATED', ${`Sub-user ${id} updated`}, ${session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok(updated)
  } catch (error) {
    console.error('PATCH /api/sub-users/:id error:', error)
    return err('Failed to update sub-user', 500)
  }
}

/** DELETE /api/sub-users/:id — SUPER_ADMIN or owning USER */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { id } = await params
  const { session } = auth

  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  try {
    const [subUser] = await sql`SELECT parent_id, username FROM profiles WHERE id = ${id} AND role = 'SUB_USER'`
    if (!subUser) return err('Sub-user not found', 404)

    // USER can only delete their own sub-users
    if (!isSuperAdmin(session) && String(subUser.parent_id) !== session.id) {
      return err('Forbidden', 403)
    }

    await sql`DELETE FROM profiles WHERE id = ${id} AND role = 'SUB_USER'`

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('SUB_USER_DELETED', ${`Sub-user ${subUser.username} deleted`}, ${session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok({ deleted: true, id })
  } catch (error) {
    console.error('DELETE /api/sub-users/:id error:', error)
    return err('Failed to delete sub-user', 500)
  }
}
