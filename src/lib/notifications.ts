import { sql } from '@/lib/db'

export interface CreateNotificationParams {
  userId?: string
  recipientId?: string
  type: string
  title: string
  body: string
}

/**
 * Creates a database-persisted notification.
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const { userId, recipientId = 'SYSTEM', type, title, body } = params

    let validUserId = userId
    if (!validUserId) {
      const [u] = await sql`SELECT id FROM profiles LIMIT 1`
      if (u) validUserId = u.id
    }

    if (!validUserId) return null

    const [inserted] = await sql`
      INSERT INTO notifications (
        id, user_id, recipient_id, type, title, body, message, is_read, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${validUserId}::uuid,
        ${recipientId},
        ${type},
        ${title},
        ${body},
        ${body},
        false,
        NOW(),
        NOW()
      )
      RETURNING *
    `
    return inserted
  } catch (err) {
    console.error('createNotification error:', err)
    return null
  }
}

/**
 * Scans user subscriptions and persists/updates expiry notifications.
 *
 * Deduplication key: user_id + title (NOT body).
 * - Expired / Expires Today: create once per user per title; never recreate.
 * - Expiring Soon: body changes daily (countdown). Update body only while unread.
 *   If the user marked it read, do NOT recreate it even as the countdown changes.
 */
export async function syncExpiryNotifications() {
  try {
    const profiles = await sql`
      SELECT p.id, p.full_name, p.username, s.end_date::text
      FROM profiles p
      JOIN (
        SELECT DISTINCT ON (user_id) user_id, end_date
        FROM subscriptions
        ORDER BY user_id, created_at DESC
      ) s ON s.user_id = p.id
      WHERE s.end_date IS NOT NULL
    `

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    for (const p of profiles) {
      if (!p.end_date) continue

      const endDate = new Date(p.end_date)
      if (isNaN(endDate.getTime())) continue

      let endDayStart: number
      if (typeof p.end_date === 'string' && p.end_date.includes('-')) {
        const parts = p.end_date.split('T')[0].split('-')
        endDayStart = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime()
      } else {
        endDayStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()
      }

      const diffMs = endDayStart - todayStart
      const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24))
      const userName = p.full_name || p.username || 'User'

      if (daysRemaining < 0) {
        // 1. Subscription Expired
        const title = 'Subscription Expired'
        const body = `${userName} subscription has expired.`

        // Deduplicate strictly by user_id + title — any read state counts
        const existing = await sql`
          SELECT id FROM notifications
          WHERE user_id = ${p.id}::uuid AND title = ${title}
          LIMIT 1
        `
        if (existing.length === 0) {
          await createNotification({ userId: p.id, type: 'SUBSCRIPTION', title, body })
        }
        // existing (read or unread) → event already fired, leave it alone
      } else if (daysRemaining === 0) {
        // 2. Subscription Expires Today
        const title = 'Subscription Expires Today'
        const body = `${userName} subscription expires today.`

        const existing = await sql`
          SELECT id FROM notifications
          WHERE user_id = ${p.id}::uuid AND title = ${title}
          LIMIT 1
        `
        if (existing.length === 0) {
          await createNotification({ userId: p.id, type: 'SUBSCRIPTION', title, body })
        }
        // existing (read or unread) → leave it alone
      } else if (daysRemaining >= 1 && daysRemaining <= 15) {
        // 3. Subscription Expiring Soon
        const title = 'Subscription Expiring Soon'
        const body = `${userName} subscription expires in ${daysRemaining} days.`

        // Deduplicate by user_id + title only — body changes daily, do NOT match on body
        const existing = await sql`
          SELECT id, body, is_read FROM notifications
          WHERE user_id = ${p.id}::uuid AND title = ${title}
          LIMIT 1
        `
        if (existing.length === 0) {
          // First time this event fires
          await createNotification({ userId: p.id, type: 'SUBSCRIPTION', title, body })
        } else if (!existing[0].is_read && existing[0].body !== body) {
          // Still unread and countdown changed — update body text only
          await sql`
            UPDATE notifications
            SET body = ${body}, message = ${body}, updated_at = NOW()
            WHERE id = ${existing[0].id}::uuid
          `
        }
        // is_read = true → user dismissed it, do NOT recreate under any circumstances
      }
    }
  } catch (err) {
    console.error('syncExpiryNotifications error:', err)
  }
}
