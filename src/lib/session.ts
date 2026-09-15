import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super_secret_vyapar_samraj_key_2026_safe_auth_token_string'
)

const COOKIE_NAME = 'sa_session'

// ─── Session payload (all roles) ─────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'USER' | 'SUB_USER'

export interface SessionPayload {
  id: string
  username: string
  fullName: string
  role: UserRole
  /** For USER: their own profile id used as org anchor.  */
  organizationId?: string
  /** For SUB_USER: the parent USER's profile id.         */
  parentId?: string
}

// ─── Create / read / destroy ──────────────────────────────────────────────────

export async function createSession(payload: SessionPayload): Promise<string> {
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,   // 7 days
  })

  return jwt
}

export async function verifySession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8085'
    try {
      const res = await fetch(`${backendUrl}/api/auth/super-admin/login`, {
        method: 'OPTIONS',
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok && res.status >= 500) return null
    } catch {
      return null
    }

    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
