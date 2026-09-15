'use server'

import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validations/auth'
import type { UserRole } from '@/types/auth'

function getRoleRedirect(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin/dashboard'
    case 'SUB_USER':
      return '/sub-user/dashboard'
    case 'USER':
    default:
      return '/dashboard'
  }
}

export async function loginAction(
  formData: { username: string; password: string }
): Promise<{ success: false; error: string } | { success: true; redirectTo: string }> {
  // Server-side validation
  const validation = loginSchema.safeParse(formData)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid input',
    }
  }

  const { username, password } = validation.data

  const supabase = await createClient()

  // Supabase Auth uses email, so we treat username as email.
  // If your users login with a plain username, you can look up the email from a profiles table first.
  // For now we support both: if it contains @, treat as email; otherwise append your domain or look up.
  let email = username
  if (!username.includes('@')) {
    // Look up email from profiles table by username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', username)
      .single()

    if (profileError || !profile?.email) {
      return {
        success: false,
        error: 'Invalid username or password',
      }
    }
    email = profile.email
  }

  // Sign in with Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    // Return a generic message to prevent user enumeration
    return {
      success: false,
      error: 'Invalid username or password. Please try again.',
    }
  }

  // Fetch user role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  const role: UserRole = (profile?.role as UserRole) ?? 'USER'
  const redirectTo = getRoleRedirect(role)

  return { success: true, redirectTo }
}
