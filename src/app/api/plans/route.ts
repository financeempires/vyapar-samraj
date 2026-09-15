import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, isSuperAdmin, ok, err } from '@/lib/api-response'
import { z } from 'zod'

const PAGE_SIZE = 50

const createPlanSchema = z.object({
  planName:      z.string().min(1).max(100).optional(),
  name:          z.string().min(1).max(100).optional(),
  description:   z.string().max(500).optional(),
  price:         z.number({ invalid_type_error: 'Price must be a valid number' }).gt(0, 'Price must be greater than 0'),
  currency:      z.string().length(3).default('INR'),
  days:          z.number().int('Days must be an integer').gt(0, 'Days must be greater than 0').optional(),
  years:         z.number().int().gt(0).optional(),
  duration_days: z.number().int().gt(0).optional(),
  subadmins:     z.number().int('Sub Admins must be an integer').min(0, 'Sub Admins cannot be negative').optional(),
  max_sub_users: z.number().int().min(0).optional(),
  areas:         z.string().optional(),
  features:      z.record(z.unknown()).optional(),
  is_active:     z.boolean().default(true),
})

/**
 * GET /api/plans
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const { session } = auth
  const { searchParams } = new URL(request.url)
  const page   = Math.max(1, Number(searchParams.get('page') ?? 1))
  const offset = (page - 1) * PAGE_SIZE

  try {
    let rows
    let countRows

    if (isSuperAdmin(session)) {
      rows = await sql`
        SELECT id, name, description, price, currency, duration_days, max_sub_users, areas, features, is_active, status, created_at, updated_at
        FROM plans
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*) AS count FROM plans`
    } else {
      rows = await sql`
        SELECT id, name, description, price, currency, duration_days, max_sub_users, areas, features, is_active, status, created_at, updated_at
        FROM plans
        WHERE is_active = TRUE
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `
      countRows = await sql`SELECT COUNT(*) AS count FROM plans WHERE is_active = TRUE`
    }

    return ok({ plans: rows, pagination: { page, pageSize: PAGE_SIZE, total: Number(countRows[0].count) } })
  } catch (error) {
    console.error('GET /api/plans error:', error)
    return err('Failed to fetch plans', 500)
  }
}

/**
 * POST /api/plans — SUPER_ADMIN only
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if ('status' in auth) return auth

  try {
    const body   = await request.json()
    const parsed = createPlanSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? 'Validation error', 400)

    const planName = (parsed.data.planName ?? parsed.data.name ?? '').trim()
    if (!planName) return err('Plan Name is required', 400)

    const daysVal = parsed.data.days ?? parsed.data.duration_days ?? parsed.data.years
    if (!daysVal || daysVal <= 0) return err('Days is required and must be greater than 0', 400)
    const durationDays = daysVal

    const subadminsVal = parsed.data.subadmins ?? parsed.data.max_sub_users
    if (subadminsVal === undefined || subadminsVal === null || subadminsVal < 0) {
      return err('Sub Admins is required and must be 0 or greater', 400)
    }

    const priceVal = parsed.data.price
    if (priceVal <= 0) return err('Price must be greater than 0', 400)

    const areasVal = parsed.data.areas ? parsed.data.areas.trim() : null

    const [plan] = await sql`
      INSERT INTO plans (name, description, price, currency, duration_days, max_sub_users, areas, billing_cycle, status, features, is_active, created_at, updated_at)
      VALUES (${planName}, ${parsed.data.description ?? null}, ${priceVal}, 'INR', ${durationDays},
              ${subadminsVal}, ${areasVal}, 'YEARLY', 'ACTIVE', ${JSON.stringify(parsed.data.features ?? {})}::jsonb, ${parsed.data.is_active}, NOW(), NOW())
      RETURNING *
    `

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('PLAN_CREATED', ${`Plan "${planName}" created`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log table fallback */ }

    try {
      const { createNotification } = await import('@/lib/notifications')
      await createNotification({
        type: 'SUBSCRIPTION',
        title: 'New Plan Created',
        body: `Plan ${planName} was created.`,
      })
    } catch (e) {
      console.error('Failed to trigger plan notification:', e)
    }

    return ok(plan, 201)
  } catch (error: any) {
    console.error('POST /api/plans error:', error)
    return err(error?.message || 'Failed to create plan', 500)
  }
}
