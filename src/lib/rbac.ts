/**
 * RBAC — Role-Based Access Control helpers
 *
 * Authentication:  verifies the JWT session cookie
 * Authorization:   enforces role hierarchy
 * Ownership:       scopes data to the correct organization
 *
 * Role hierarchy:
 *   SUPER_ADMIN  — full system access
 *   USER         — own organization data only
 *   SUB_USER     — parent USER's organization data, read-only by default
 *
 * Usage in API routes:
 *
 *   // Any authenticated user:
 *   const auth = await requireAuth(request)
 *   if ('status' in auth) return auth   // returns 401 automatically
 *
 *   // Super admin only:
 *   const auth = await requireSuperAdmin(request)
 *   if ('status' in auth) return auth   // returns 403 automatically
 *
 *   // Scoped owner ID for WHERE clauses:
 *   const ownerId = getOwnerId(auth.session)  // undefined = no filter (super admin)
 */

import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
import type { SessionPayload } from './session'
import { err } from './api-response'

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super_secret_vyapar_samraj_key_2026_safe_auth_token_string'
)

// ─── Internal: extract session from request cookies ──────────────────────────

async function extractSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get('sa_session')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// ─── Guards (return { session } on success, NextResponse on failure) ──────────

/** Require ANY authenticated user (SUPER_ADMIN, USER, or SUB_USER). */
export async function requireAuth(
  request: NextRequest
): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await extractSession(request)
  if (!session) return err('Unauthorized', 401)
  return { session }
}

/** Require SUPER_ADMIN role — all other roles get 403. */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await extractSession(request)
  if (!session) return err('Unauthorized', 401)
  if (session.role !== 'SUPER_ADMIN') return err('Forbidden', 403)
  return { session }
}

/** Require USER or SUPER_ADMIN role — SUB_USER gets 403. */
export async function requireUser(
  request: NextRequest
): Promise<{ session: SessionPayload } | NextResponse> {
  const session = await extractSession(request)
  if (!session) return err('Unauthorized', 401)
  if (session.role === 'SUB_USER') return err('Forbidden', 403)
  return { session }
}

// ─── Role predicates ─────────────────────────────────────────────────────────

export const isSuperAdmin = (s: SessionPayload) => s.role === 'SUPER_ADMIN'
export const isUser       = (s: SessionPayload) => s.role === 'USER'
export const isSubUser    = (s: SessionPayload) => s.role === 'SUB_USER'

// ─── Data-scoping helpers ─────────────────────────────────────────────────────

/**
 * Returns the profile id that "owns" this session's data.
 *
 * SUPER_ADMIN → undefined  (no filter — sees everything)
 * USER        → session.id (their own profile)
 * SUB_USER    → session.parentId (parent USER's profile)
 */
export function getOwnerId(session: SessionPayload): string | undefined {
  if (isSuperAdmin(session)) return undefined
  if (isUser(session))       return session.id
  if (isSubUser(session))    return session.parentId
  return undefined
}

/**
 * Verify that a resource row belongs to the requesting user's scope.
 * Returns false (= deny) if the resource owner doesn't match.
 *
 * SUPER_ADMIN is always allowed.
 * USER        must own the resource directly (resourceOwnerId === session.id).
 * SUB_USER    must match parent (resourceOwnerId === session.parentId).
 */
export function canAccessResource(
  session: SessionPayload,
  resourceOwnerId: string | undefined
): boolean {
  if (isSuperAdmin(session)) return true
  const ownerId = getOwnerId(session)
  if (!ownerId || !resourceOwnerId) return false
  return ownerId === resourceOwnerId
}
