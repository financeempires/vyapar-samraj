import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, ok, err } from '@/lib/api-response'

/**
 * GET /api/areas
 * Returns areas belonging ONLY to the currently authenticated User.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const rows = await sql`
      SELECT id, name, section, is_marked, created_at
      FROM areas
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `
    return ok({ areas: rows })
  } catch (error) {
    console.error('GET /api/areas error:', error)
    return err('Failed to fetch areas', 500)
  }
}

/**
 * POST /api/areas
 * Creates an area strictly scoped to the currently authenticated User.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const rawSection = String(body.section || 'DAILY').toUpperCase()
    const section = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(rawSection) ? rawSection : 'DAILY'

    if (!name) {
      return err('Area name is required', 400)
    }

    const [newArea] = await sql`
      INSERT INTO areas (user_id, name, section)
      VALUES (${userId}, ${name}, ${section})
      RETURNING id, name, section, is_marked, created_at
    `

    return ok({ area: newArea }, 201)
  } catch (error) {
    console.error('POST /api/areas error:', error)
    return err('Failed to create area', 500)
  }
}

/**
 * PATCH /api/areas
 * Toggles or updates is_marked for an area belonging to the authenticated user.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const areaId = String(body.area_id || body.id || '').trim()
    if (!areaId) {
      return err('area_id is required', 400)
    }

    const explicitMarked = typeof body.is_marked === 'boolean' ? body.is_marked : null

    const [updated] = explicitMarked !== null
      ? await sql`
          UPDATE areas
          SET is_marked = ${explicitMarked}, updated_at = NOW()
          WHERE id = ${areaId} AND user_id = ${userId}
          RETURNING id, name, section, is_marked, created_at
        `
      : await sql`
          UPDATE areas
          SET is_marked = NOT is_marked, updated_at = NOW()
          WHERE id = ${areaId} AND user_id = ${userId}
          RETURNING id, name, section, is_marked, created_at
        `

    if (!updated) {
      return err('Area not found or access denied', 404)
    }

    return ok({ area: updated })
  } catch (error) {
    console.error('PATCH /api/areas error:', error)
    return err('Failed to update area', 500)
  }
}
