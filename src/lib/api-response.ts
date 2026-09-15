import { NextResponse } from 'next/server'

// ─── Standard API Response helpers ───────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── Re-export RBAC guards so existing imports keep working ──────────────────
// Routes may still import { requireSuperAdmin, ok, err } from '@/lib/api-response'
// and get the proper RBAC-aware version automatically.

export {
  requireAuth,
  requireSuperAdmin,
  requireUser,
  isSuperAdmin,
  isUser,
  isSubUser,
  getOwnerId,
  canAccessResource,
} from './rbac'

export type { SessionPayload } from './session'
