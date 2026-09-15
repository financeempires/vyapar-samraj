import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const PAGE_SIZE = 50

const createUserSchema = z.object({
  full_name:    z.string().min(1, 'Name is required').max(100),
  email:        z.string().email('Invalid email address'),
  phone:        z.string().min(1, 'Phone is required').max(25),
  username:     z.string().min(3, 'Username must be at least 3 characters').max(50).regex(/^[a-zA-Z0-9._@+-]+$/, 'Invalid username format'),
  password:     z.string().min(6, 'Password must be at least 6 characters'),
  sub_admins:   z.number().int().min(0).default(1),
  plan_id:      z.string().uuid('Invalid Plan ID'),
  start_date:   z.string().optional(),
  end_date:     z.string().optional(),
})

/**
 * GET /api/users
 *
 * SUPER_ADMIN  → paginated list of all users with search + status filter
 * USER         → returns only their own profile record
 * SUB_USER     → returns only their own profile record
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth
  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, Number(searchParams.get('page') ?? 1))
  const offset = (page - 1) * PAGE_SIZE

  // ── Non-admins: return only their own profile ─────────────────────────────
  if (!isSuperAdmin(session)) {
    try {
      const [profile] = await sql`
        SELECT id, username, email, full_name, role, status, organization, parent_id, created_at, updated_at
        FROM profiles
        WHERE id = ${session.id}
      `
      return ok({ users: profile ? [profile] : [], pagination: { page: 1, pageSize: 1, total: profile ? 1 : 0 } })
    } catch (error) {
      console.error('GET /api/users (self) error:', error)
      return err('Failed to fetch profile', 500)
    }
  }

  // ── SUPER_ADMIN: full paginated list with optional filters ────────────────
  try {
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''

    let rows
    if (search && status) {
      rows = await sql`
        SELECT id, username, email, full_name, role, status, organization, parent_id, created_at, updated_at
        FROM profiles
        WHERE status = ${status}
          AND (username ILIKE ${'%' + search + '%'} OR full_name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'})
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
    } else if (search) {
      rows = await sql`
        SELECT id, username, email, full_name, role, status, organization, parent_id, created_at, updated_at
        FROM profiles
        WHERE username ILIKE ${'%' + search + '%'} OR full_name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'}
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
    } else if (status) {
      rows = await sql`
        SELECT id, username, email, full_name, role, status, organization, parent_id, created_at, updated_at
        FROM profiles
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
    } else {
      rows = await sql`
        SELECT id, username, email, full_name, role, status, organization, parent_id, created_at, updated_at
        FROM profiles
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
    }

    const userIds = rows.map((r: any) => r.id)
    let phoneMap: Record<string, string> = {}
    let planMap: Record<string, string> = {}
    let startDateMap: Record<string, string> = {}
    let endDateMap: Record<string, string> = {}

    if (userIds.length > 0) {
      try {
        const uRows = await sql`SELECT id, phone FROM users WHERE id = ANY(${userIds}::uuid[])`
        for (const u of uRows) {
          if (u.phone) phoneMap[u.id] = u.phone
        }
        const subRows = await sql`
          SELECT DISTINCT ON (user_id) user_id, plan_id, start_date, end_date
          FROM subscriptions
          WHERE user_id = ANY(${userIds}::uuid[])
          ORDER BY user_id, created_at DESC
        `
        for (const s of subRows) {
          if (s.plan_id) planMap[s.user_id] = s.plan_id
          if (s.start_date) startDateMap[s.user_id] = String(s.start_date)
          if (s.end_date) endDateMap[s.user_id] = String(s.end_date)
        }
      } catch (err) {
        console.error('Error mapping phone/plan/end_date in GET /api/users:', err)
      }
    }

    const usersWithDetails = rows.map((r: any) => ({
      ...r,
      phone: phoneMap[r.id] || '',
      plan_id: planMap[r.id] || '',
      start_date: startDateMap[r.id] || null,
      end_date: endDateMap[r.id] || null,
    }))

    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM profiles`
    return ok({ users: usersWithDetails, pagination: { page, pageSize: PAGE_SIZE, total: Number(count) } })
  } catch (error) {
    console.error('GET /api/users error:', error)
    return err('Failed to fetch users', 500)
  }
}

/**
 * POST /api/users — SUPER_ADMIN only
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  try {
    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)
    }

    const {
      full_name,
      email,
      phone,
      username,
      password,
      sub_admins,
      plan_id,
      start_date,
      end_date,
    } = parsed.data

    // 1. Check Username / Email uniqueness
    const existing = await sql`
      SELECT id FROM profiles WHERE username = ${username} OR email = ${email}
      UNION
      SELECT id FROM users WHERE username = ${username} OR email = ${email}
      LIMIT 1
    `
    if (existing.length > 0) {
      return err('Username or email already exists', 409)
    }

    // 2. Load authoritative Plan record from Neon DB
    const [selectedPlan] = await sql`
      SELECT id, name, price, duration_days, max_sub_users, is_active
      FROM plans
      WHERE id = ${plan_id}
      LIMIT 1
    `
    if (!selectedPlan) {
      return err('Selected plan does not exist in database', 400)
    }

    // 3. Hash password securely using bcrypt (NEVER store plaintext)
    const passwordHash = await bcrypt.hash(password, 10)

    // 4. Create or resolve Organization
    const orgName = `${full_name}'s Org`
    const [org] = await sql`
      INSERT INTO organizations (name, email, phone, status, created_at, updated_at)
      VALUES (${orgName}, ${email}, ${phone}, 'ACTIVE', NOW(), NOW())
      RETURNING id
    `
    const orgId = org.id
    const userId = crypto.randomUUID()

    // 5. Insert into profiles (application user store)
    const [newProfile] = await sql`
      INSERT INTO profiles (id, username, email, full_name, role, status, organization, created_at, updated_at)
      VALUES (${userId}, ${username}, ${email}, ${full_name}, 'USER', 'active', ${orgName}, NOW(), NOW())
      RETURNING id, username, email, full_name, role, status, organization, created_at, updated_at
    `

    // 6. Insert into users (auth user store with bcrypt hash & phone)
    await sql`
      INSERT INTO users (id, organization_id, username, password_hash, password, full_name, email, phone, status, created_at, updated_at)
      VALUES (${userId}, ${orgId}, ${username}, ${passwordHash}, ${password}, ${full_name}, ${email}, ${phone}, 'ACTIVE', NOW(), NOW())
    `

    // 7. Calculate dates using plan's duration_days if not specified
    const sDate = start_date ? start_date : new Date().toISOString().split('T')[0]
    let eDate = end_date
    if (!eDate) {
      const s = new Date(sDate)
      const dur = Number(selectedPlan.duration_days) || 365
      const end = new Date(s.getTime() + dur * 24 * 60 * 60 * 1000)
      eDate = end.toISOString().split('T')[0]
    }

    // 8. Create Subscription referencing user_id and plan_id
    const subAdminsVal = sub_admins !== undefined && sub_admins !== null
      ? Math.max(0, Number(sub_admins))
      : null

    await sql`
      INSERT INTO subscriptions (
        id, user_id, organization_id, plan_id, max_sub_users, status,
        start_date, end_date, auto_renew, auto_renewal, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), ${userId}, ${orgId}, ${selectedPlan.id}, ${subAdminsVal}, 'ACTIVE',
        ${sDate}, ${eDate}, false, false, NOW(), NOW()
      )
    `

    // 9. Log activity & Create Notification
    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('USER_CREATED', ${`User ${username} created with plan "${selectedPlan.name}"`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log fallback */ }

    try {
      const { createNotification } = await import('@/lib/notifications')
      await createNotification({
        userId: userId,
        type: 'USER',
        title: 'New User Created',
        body: `User ${full_name} was created successfully.`,
      })
    } catch (e) {
      console.error('Failed to create user notification:', e)
    }

    return ok(newProfile, 201)
  } catch (error: any) {
    console.error('POST /api/users error:', error)
    return err(error.message || 'Failed to create user', 500)
  }
}
