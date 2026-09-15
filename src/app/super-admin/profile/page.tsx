import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import { Shield, UserCheck, CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Super Admin Profile | Vyapar Samraj',
  description: 'Manage Super Admin profile and account settings.',
}

export default async function SuperAdminProfilePage() {
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  let displayName = session.fullName || 'Super Admin'
  let accountStatus = 'active'

  try {
    const adminRes = await sql`
      SELECT full_name, COALESCE(status, 'active') AS status
      FROM super_admin_accounts
      WHERE id = ${session.id}
      LIMIT 1
    `
    if (adminRes && adminRes.length > 0) {
      displayName = adminRes[0].full_name || displayName
      accountStatus = (adminRes[0].status || 'active').toLowerCase()
    }
  } catch {
    // Keep session defaults
  }

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName={displayName} />
      </div>

      {/* Main Content Container */}
      <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
        {/* Page Title Header */}
        <div className="mb-4">
          <h1 className="text-[20px] font-bold" style={{ color: '#0D1B3E' }}>
            Account Profile
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
            Super Admin credentials and access control settings
          </p>
        </div>

        {/* Profile Card */}
        <div
          className="p-5 rounded-2xl mb-4 bg-white overflow-hidden"
          style={{
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{ backgroundColor: '#EEF2FF', color: '#2351D9' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold truncate" style={{ color: '#0D1B3E' }}>
                  {displayName}
                </h2>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider flex-shrink-0"
                  style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                >
                  SUPER ADMIN
                </span>
              </div>

            </div>
            <div
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                accountStatus === 'inactive'
                  ? 'text-slate-500 bg-slate-50 border-slate-200'
                  : 'text-emerald-600 bg-emerald-50 border-emerald-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                {accountStatus === 'inactive' ? 'Inactive' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* System Access & Privileges Card */}
        <div
          className="bg-white rounded-2xl p-4"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>
            Access & Security
          </h3>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Full System Database & Administration Access</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>2FA / OTP Authentication Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}
