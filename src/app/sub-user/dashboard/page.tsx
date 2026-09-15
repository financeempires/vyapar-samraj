import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sub User Dashboard | Vyapar Samraj',
}

export default async function SubUserDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sub User Dashboard</h1>
        <p className="text-slate-500 text-sm mb-1">
          Logged in as: <span className="font-medium text-slate-700">{user.email}</span>
        </p>
        <p className="text-slate-400 text-xs mb-6">Role: SUB_USER</p>
        <a
          href="/api/auth/signout"
          className="inline-block rounded-lg bg-[#1B4FD8] px-5 py-2 text-sm font-medium text-white hover:bg-[#1741B3] transition-colors"
        >
          Sign Out
        </a>
      </div>
    </main>
  )
}
