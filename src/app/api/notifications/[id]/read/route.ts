import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireSuperAdmin, ok, err } from '@/lib/api-response'

/** PATCH /api/notifications/:id/read */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth
  const { id } = await params

  try {
    const [updated] = await sql`
      UPDATE notifications
      SET is_read = true, updated_at = NOW()
      WHERE id = ${id}::uuid OR id::text = ${id}
      RETURNING id, is_read
    `
    if (!updated) return err('Notification not found', 404)
    return ok(updated)
  } catch (error) {
    console.error('PATCH /api/notifications/:id/read error:', error)
    return err('Failed to update notification', 500)
  }
}
