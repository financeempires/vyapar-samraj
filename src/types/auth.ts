// Re-export UserRole from the session module as the canonical type.
// This avoids having two independent definitions of role strings.
export type { UserRole } from '@/lib/session'

export interface UserProfile {
  id: string
  username: string
  role: import('@/lib/session').UserRole
  full_name?: string
  organization?: string
  parent_id?: string
  created_at: string
  updated_at: string
}

export type LoginResult =
  | { success: true; role: import('@/lib/session').UserRole }
  | { success: false; error: string }
