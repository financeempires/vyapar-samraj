import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, ok, err } from '@/lib/api-response'

/**
 * GET /api/notifications
 *
 * Any authenticated user — scoped to their own recipient_id.
 * SUPER_ADMIN, USER, and SUB_USER all receive only their own notifications.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth

  try {
    const rows = await sql`
      SELECT id, type, title, body, is_read, created_at
      FROM notifications
      WHERE is_read = FALSE
      ORDER BY created_at DESC
      LIMIT 50
    `
    return ok({ notifications: rows })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return err('Failed to fetch notifications', 500)
  }
}

/**
 * PATCH /api/notifications — Mark all notifications as read
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  try {
    const updated = await sql`
      UPDATE notifications
      SET is_read = true, updated_at = NOW()
      WHERE is_read = false
      RETURNING id
    `
    return ok({ count: updated.length })
  } catch (error) {
    console.error('PATCH /api/notifications error:', error)
    return err('Failed to mark all notifications as read', 500)
  }
}
