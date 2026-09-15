import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, requireSuperAdmin, isSuperAdmin, ok, err } from '@/lib/api-response'
import bcrypt from 'bcryptjs'

/**
 * GET /api/users/:id
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if ('status' in auth) return auth

    const { id } = await context.params
    if (!id) return err('Invalid user ID', 400)

    const { session } = auth

    if (!isSuperAdmin(session) && session.id !== id) {
      return err('Forbidden', 403)
    }

    const [profile] = await sql`
      SELECT id, username, email, full_name, role, status, organization, created_at, updated_at
      FROM profiles
      WHERE id = ${id}::uuid
    `
    if (!profile) return err('User not found', 404)

    const [uRow] = await sql`SELECT phone, password FROM users WHERE id = ${id}::uuid LIMIT 1`
    const [subRow] = await sql`
      SELECT plan_id, max_sub_users, start_date, end_date
      FROM subscriptions
      WHERE user_id = ${id}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `

    let maxSubUsers: number | null = null
    let isCustomSubAdmins = false
    if (subRow?.max_sub_users !== undefined && subRow?.max_sub_users !== null) {
      maxSubUsers = Number(subRow.max_sub_users)
      isCustomSubAdmins = true
    }

    if (maxSubUsers === null && subRow?.plan_id) {
      const [pRow] = await sql`SELECT max_sub_users FROM plans WHERE id = ${subRow.plan_id}::uuid LIMIT 1`
      if (pRow && pRow.max_sub_users !== null && pRow.max_sub_users !== undefined) {
        maxSubUsers = Number(pRow.max_sub_users)
      }
    }

    if (maxSubUsers === null) maxSubUsers = 1

    return ok({
      ...profile,
      phone: uRow?.phone || '',
      password: uRow?.password || '',
      plan_id: subRow?.plan_id || '',
      start_date: subRow?.start_date || profile.created_at,
      end_date: subRow?.end_date || '',
      sub_admins: maxSubUsers,
      is_custom_sub_admins: isCustomSubAdmins,
    })
  } catch (error: any) {
    console.error('GET /api/users/:id error:', error)
    return err(error?.message || 'Failed to fetch user', 500)
  }
}

/**
 * PATCH /api/users/:id
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request)
    if ('status' in auth) return auth

    const { id } = await context.params
    if (!id) return err('Invalid user ID', 400)

    const body = await request.json()
    const {
      full_name,
      email,
      phone,
      username,
      password,
      plan_id,
      start_date,
      end_date,
      status,
    } = body

    // 1. Check existing profile
    const [existingProfile] = await sql`SELECT id, username, email FROM profiles WHERE id = ${id}::uuid`
    if (!existingProfile) return err('User not found', 404)

    // 2. Check username/email uniqueness safely (only if provided and changed)
    const newUsername = username ? String(username).trim() : null
    const newEmail = email ? String(email).trim() : null

    if (newUsername && newUsername !== existingProfile.username) {
      const conflict = await sql`
        SELECT id FROM profiles WHERE username = ${newUsername} AND id != ${id}::uuid LIMIT 1
      `
      if (conflict.length > 0) return err('Username already in use by another user', 409)
    }

    if (newEmail && newEmail !== existingProfile.email) {
      const conflict = await sql`
        SELECT id FROM profiles WHERE email = ${newEmail} AND id != ${id}::uuid LIMIT 1
      `
      if (conflict.length > 0) return err('Email already in use by another user', 409)
    }

    // 3. Update profiles table
    let updatedProfile;
    if (status) {
      const [p] = await sql`
        UPDATE profiles
        SET
          full_name  = COALESCE(${full_name  || null}, full_name),
          email      = COALESCE(${newEmail   || null}, email),
          username   = COALESCE(${newUsername|| null}, username),
          status     = ${String(status).toLowerCase()}::user_status,
          updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING id, username, email, full_name, role, status, organization, updated_at
      `
      updatedProfile = p
    } else {
      const [p] = await sql`
        UPDATE profiles
        SET
          full_name  = COALESCE(${full_name  || null}, full_name),
          email      = COALESCE(${newEmail   || null}, email),
          username   = COALESCE(${newUsername|| null}, username),
          updated_at = NOW()
        WHERE id = ${id}::uuid
        RETURNING id, username, email, full_name, role, status, organization, updated_at
      `
      updatedProfile = p
    }

    // 4. Update users table
    const [existingUser] = await sql`SELECT id, organization_id FROM users WHERE id = ${id}::uuid LIMIT 1`
    let orgId = existingUser?.organization_id

    const newPhone = phone !== undefined && phone !== null ? String(phone).trim() : null

    if (!orgId) {
      const [org] = await sql`
        INSERT INTO organizations (name, email, phone, status, created_at, updated_at)
        VALUES (${`${updatedProfile.full_name || updatedProfile.username}'s Org`}, ${updatedProfile.email}, ${newPhone || ''}, 'ACTIVE', NOW(), NOW())
        RETURNING id
      `
      orgId = org.id
    }

    if (existingUser) {
      const updatedStatus = status ? String(status).toUpperCase() : null
      if (password && String(password).trim()) {
        const plainPass = String(password).trim()
        const passwordHash = await bcrypt.hash(plainPass, 10)
        await sql`
          UPDATE users
          SET
            full_name     = COALESCE(${full_name  || null}, full_name),
            email         = COALESCE(${newEmail   || null}, email),
            username      = COALESCE(${newUsername|| null}, username),
            phone         = COALESCE(${newPhone}, phone),
            status        = COALESCE(${updatedStatus}, status),
            organization_id = ${orgId}::uuid,
            password_hash = ${passwordHash},
            password      = ${plainPass},
            updated_at    = NOW()
          WHERE id = ${id}::uuid
        `
      } else {
        await sql`
          UPDATE users
          SET
            full_name  = COALESCE(${full_name  || null}, full_name),
            email      = COALESCE(${newEmail   || null}, email),
            username   = COALESCE(${newUsername|| null}, username),
            phone      = COALESCE(${newPhone}, phone),
            status     = COALESCE(${updatedStatus}, status),
            organization_id = ${orgId}::uuid,
            updated_at = NOW()
          WHERE id = ${id}::uuid
        `
      }
    } else {
      if (!password || !String(password).trim()) {
        return err('Password is required when creating a new user record', 400)
      }
      const plainPass = String(password).trim()
      const passHash = await bcrypt.hash(plainPass, 10)

      await sql`
        INSERT INTO users (id, organization_id, username, password_hash, password, full_name, email, phone, status, created_at, updated_at)
        VALUES (
          ${id}::uuid, ${orgId}::uuid, ${updatedProfile.username}, ${passHash}, ${plainPass},
          ${updatedProfile.full_name}, ${updatedProfile.email}, ${newPhone || ''}, 'ACTIVE', NOW(), NOW()
        )
      `
    }

    // 5. Update subscription with valid organization reference
    if (plan_id && plan_id !== 'undefined' && plan_id !== 'null') {
      const [selectedPlan] = await sql`
        SELECT id, name, duration_days FROM plans WHERE id = ${plan_id}::uuid LIMIT 1
      `
      if (selectedPlan) {
        const sDate = start_date ? String(start_date) : new Date().toISOString().split('T')[0]
        let eDate = end_date ? String(end_date) : null
        if (!eDate) {
          const dur = Number(selectedPlan.duration_days) || 365
          const end = new Date(new Date(sDate).getTime() + dur * 24 * 60 * 60 * 1000)
          eDate = end.toISOString().split('T')[0]
        }

        const subAdminsVal = body.sub_admins !== undefined && body.sub_admins !== null
          ? Math.max(0, Number(body.sub_admins))
          : (body.max_sub_users !== undefined && body.max_sub_users !== null ? Math.max(0, Number(body.max_sub_users)) : null)

        const [existingSub] = await sql`SELECT id FROM subscriptions WHERE user_id = ${id}::uuid LIMIT 1`
        if (existingSub) {
          if (subAdminsVal !== null) {
            await sql`
              UPDATE subscriptions
              SET
                plan_id         = ${selectedPlan.id}::uuid,
                organization_id = ${orgId}::uuid,
                start_date      = ${sDate}::date,
                end_date        = ${eDate}::date,
                max_sub_users   = ${subAdminsVal},
                updated_at      = NOW()
              WHERE user_id = ${id}::uuid
            `
          } else {
            await sql`
              UPDATE subscriptions
              SET
                plan_id         = ${selectedPlan.id}::uuid,
                organization_id = ${orgId}::uuid,
                start_date      = ${sDate}::date,
                end_date        = ${eDate}::date,
                updated_at      = NOW()
              WHERE user_id = ${id}::uuid
            `
          }
        } else {
          await sql`
            INSERT INTO subscriptions (
              id, user_id, organization_id, plan_id, max_sub_users, status,
              start_date, end_date, auto_renew, auto_renewal, created_at, updated_at
            )
            VALUES (
              gen_random_uuid(), ${id}::uuid, ${orgId}::uuid, ${selectedPlan.id}::uuid, ${subAdminsVal}, 'ACTIVE',
              ${sDate}::date, ${eDate}::date, false, false, NOW(), NOW()
            )
          `
        }
      }
    }

    // 6. Audit log & Notifications
    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('USER_UPDATED', ${`User ${updatedProfile.username} updated by admin`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log fallback */ }

    if (status) {
      try {
        const { createNotification } = await import('@/lib/notifications')
        const stLower = String(status).toLowerCase()
        const userName = updatedProfile.full_name || updatedProfile.username || 'User'
        if (stLower === 'paused' || stLower === 'inactive') {
          await createNotification({
            userId: id,
            type: 'USER',
            title: 'User Inactive',
            body: `${userName} has been marked inactive.`,
          })
        } else if (stLower === 'active') {
          await createNotification({
            userId: id,
            type: 'USER',
            title: 'User Resumed',
            body: `${userName} has been resumed.`,
          })
        }
      } catch (e) {
        console.error('Failed to trigger user status notification:', e)
      }
    }

    return ok(updatedProfile)
  } catch (error: any) {
    console.error('CRITICAL PATCH EXCEPTION:', error)
    return err(error?.message || String(error), 400)
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

/**
 * DELETE /api/users/:id — SUPER_ADMIN only
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperAdmin(request)
    if ('status' in auth) return auth

    const { id } = await context.params
    if (!id) return err('Invalid user ID', 400)
    if (id === auth.session.id) return err('Cannot delete your own account', 400)

    await sql`DELETE FROM subscriptions WHERE user_id = ${id}::uuid`
    await sql`DELETE FROM users WHERE id = ${id}::uuid`
    const [deleted] = await sql`
      DELETE FROM profiles WHERE id = ${id}::uuid RETURNING id, username
    `
    if (!deleted) return err('User not found', 404)

    try {
      await sql`
        INSERT INTO activity_logs (type, description, actor_id, created_at)
        VALUES ('USER_DELETED', ${`User ${deleted.username} deleted`}, ${auth.session.id}, NOW())
      `
    } catch { /* audit log fallback */ }

    return ok({ deleted: true, id })
  } catch (error: any) {
    console.error('DELETE /api/users/:id error:', error)
    return err(error?.message || String(error), 400)
  }
}
