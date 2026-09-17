import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { createSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawUsername = body.username ?? ''
    const rawPassword = body.password ?? ''

    const cleanUsername = String(rawUsername).trim()
    const cleanPassword = String(rawPassword)

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      )
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8085'

    // 1. Check SuperAdmin Accounts First
    const saAccounts = await sql`
      SELECT id, username, email, full_name, password_hash
      FROM public.super_admin_accounts
      WHERE LOWER(username) = LOWER(${cleanUsername}) OR LOWER(email) = LOWER(${cleanUsername})
      LIMIT 1
    `

    if (saAccounts.length > 0) {
      // Forward to Spring Boot backend for Super Admin 2FA/OTP/PIN flow
      try {
        const springRes = await fetch(`${backendUrl}/api/auth/super-admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
        })
        const springJson = await springRes.json()
        return NextResponse.json(springJson, { status: springRes.status })
      } catch {
        return NextResponse.json(
          { success: false, message: 'Backend service is unavailable. Please try again later.' },
          { status: 503 }
        )
      }
    }

    // 2. Check Users / Profiles tables for Normal User Account
    const userRows = await sql`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.full_name, 
        u.password_hash, 
        u.password, 
        u.status, 
        u.organization_id,
        COALESCE(p.role::text, 'USER') as role,
        p.status as profile_status
      FROM public.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      WHERE LOWER(u.username) = LOWER(${cleanUsername}) OR LOWER(u.email) = LOWER(${cleanUsername})
      LIMIT 1
    `

    let userRecord = userRows[0] || null

    if (!userRecord) {
      const profileRows = await sql`
        SELECT 
          p.id, 
          p.username, 
          p.email, 
          p.full_name, 
          p.role::text as role, 
          p.status as profile_status,
          u.password_hash,
          u.password,
          u.organization_id
        FROM public.profiles p
        LEFT JOIN public.users u ON u.id = p.id
        WHERE (LOWER(p.username) = LOWER(${cleanUsername}) OR LOWER(p.email) = LOWER(${cleanUsername}))
          AND (p.role IS NULL OR p.role::text != 'SUPER_ADMIN')
        LIMIT 1
      `
      if (profileRows.length > 0) {
        userRecord = profileRows[0]
      }
    }

    if (userRecord) {
      const statusStr = String(userRecord.status || userRecord.profile_status || 'ACTIVE').toUpperCase()
      if (statusStr === 'INACTIVE' || statusStr === 'DISABLED') {
        return NextResponse.json(
          { success: false, message: 'Account is inactive. Please contact administrator.' },
          { status: 401 }
        )
      }

      let isPasswordValid = false
      if (userRecord.password_hash) {
        isPasswordValid = await bcrypt.compare(cleanPassword, userRecord.password_hash)
      }
      if (!isPasswordValid && userRecord.password) {
        isPasswordValid =
          cleanPassword === userRecord.password ||
          (await bcrypt.compare(cleanPassword, userRecord.password).catch(() => false))
      }

      if (isPasswordValid) {
        const userRole = (userRecord.role === 'SUB_USER' ? 'SUB_USER' : 'USER') as 'USER' | 'SUB_USER'
        await createSession({
          id: userRecord.id,
          username: userRecord.username,
          fullName: userRecord.full_name || 'User',
          role: userRole,
          organizationId: userRecord.organization_id || undefined,
        })

        return NextResponse.json({
          success: true,
          data: {
            success: true,
            role: userRole,
            redirectTo: '/dashboard',
          },
        })
      }
    }

    return NextResponse.json(
      { success: false, message: 'Invalid username or password' },
      { status: 401 }
    )
  } catch (error) {
    console.error('POST /api/auth/super-admin/login error:', error)
    return NextResponse.json(
      { success: false, message: 'Invalid username or password' },
      { status: 401 }
    )
  }
}
