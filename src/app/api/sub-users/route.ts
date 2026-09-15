import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const PAGE_SIZE = 50

const createSubUserSchema = z.object({
  username:  z.string().min(3).max(50).regex(/^[a-zA-Z0-9._@+-]+$/),
  email:     z.string().email(),
  full_name: z.string().min(1).max(100),
  parent_id: z.string().uuid(),
  status:    z.enum(['active', 'inactive', 'pending']).default('active'),
})

/**
 * GET /api/sub-users
 *
 * SUPER_ADMIN  → all sub-users (filterable by parent_id)
 * USER         → only their own sub-users (parent_id = session.id)
 * SUB_USER     → forbidden (sub-users cannot manage sub-users)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth

  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, Number(searchParams.get('page') ?? 1))
  const offset = (page - 1) * PAGE_SIZE

  // Determine which parent_id to filter by
  let filterParentId: string | null = null

  if (isSuperAdmin(session)) {
    // Admin may pass any parent_id or see all
    filterParentId = searchParams.get('parent_id') ?? null
  } else {
    // USER: only their own sub-users
    filterParentId = session.id
  }

  try {
    let rows
    let countRows

    if (filterParentId) {
      rows = await sql`
        SELECT id, username, email, full_name, role, status, parent_id, created_at, updated_at
        FROM profiles
        WHERE role = 'SUB_USER' AND parent_id = ${filterParentId}
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
      countRows = await sql`
        SELECT COUNT(*) AS count FROM profiles WHERE role = 'SUB_USER' AND parent_id = ${filterParentId}
      `
    } else {
      rows = await sql`
        SELECT id, username, email, full_name, role, status, parent_id, created_at, updated_at
        FROM profiles
        WHERE role = 'SUB_USER'
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*) AS count FROM profiles WHERE role = 'SUB_USER'`
    }

    return ok({ subUsers: rows, pagination: { page, pageSize: PAGE_SIZE, total: Number(countRows[0].count) } })
  } catch (error) {
    console.error('GET /api/sub-users error:', error)
    return err('Failed to fetch sub-users', 500)
  }
}

/**
 * POST /api/sub-users
 *
 * SUPER_ADMIN  → can create a sub-user under any USER parent
 * USER         → can only create sub-users under themselves (parent_id must equal session.id)
 * SUB_USER     → forbidden
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth
  if (session.role === 'SUB_USER') return err('Forbidden', 403)

  try {
    const body   = await request.json()
    const parsed = createSubUserSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const { username, email, full_name, parent_id, status } = parsed.data

    // USER can only create sub-users under themselves
    if (!isSuperAdmin(session) && parent_id !== session.id) {
      return err('Forbidden: cannot create sub-users under another user', 403)
    }

    const [parent] = await sql`
      SELECT id FROM profiles WHERE id = ${parent_id} AND role = 'USER' LIMIT 1
    `
    if (!parent) return err('Parent user not found or not a USER role', 400)

    const existing = await sql`
      SELECT id FROM profiles WHERE username = ${username} OR email = ${email} LIMIT 1
    `
    if (existing.length > 0) return err('Username or email already exists', 409)

    const [subUser] = await sql`
      INSERT INTO profiles (username, email, full_name, role, status, parent_id, created_at, updated_at)
      VALUES (${username}, ${email}, ${full_name}, 'SUB_USER', ${status}, ${parent_id}, NOW(), NOW())
      RETURNING id, username, email, full_name, role, status, parent_id, created_at
    `

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('SUB_USER_CREATED', ${`Sub-user ${username} created under ${parent_id}`}, ${session.id}, NOW())
      `
    } catch { /* audit log table may not exist */ }

    return ok(subUser, 201)
  } catch (error) {
    console.error('POST /api/sub-users error:', error)
    return err('Failed to create sub-user', 500)
  }
}
