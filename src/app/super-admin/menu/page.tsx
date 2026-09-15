import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import { LogoutButton } from '@/components/dashboard/LogoutButton'
import { SetPinMenuButton } from '@/components/dashboard/SetPinMenuButton'
import {
  CreditCard,
  Activity,
  Bell,
  Shield,
  ChevronRight,
  UserCheck,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Menu | Vyapar Samraj',
  description: 'Vyapar Samraj Super Admin Navigation Menu',
}

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

const menuSections: MenuSection[] = [
  {
    title: 'Financial & System',
    items: [
      { label: 'Transactions & Revenue', href: '/super-admin/transactions', icon: CreditCard },
      { label: 'Activity Logs', href: '/super-admin/activity-logs', icon: Activity },
      { label: 'System Notifications', href: '/super-admin/notifications', icon: Bell },
      { label: 'Security & Access Control', href: '/super-admin/security-access', icon: Shield },
    ],
  },
]

export default async function SuperAdminMenuPage() {
  // 1. Server-side session verification for Super Admin
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

  return (
    <div className="min-h-screen bg-white" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName={displayName} />
      </div>

      {/* Main content container */}
      <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
        {/* User Account Profile Card */}
        <div
          className="p-3.5 sm:p-4 rounded-2xl mb-4 bg-white overflow-hidden"
          style={{
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0"
              style={{ backgroundColor: '#EEF2FF', color: '#2351D9' }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold truncate max-w-[130px] sm:max-w-none" style={{ color: '#0D1B3E' }}>
                  {displayName}
                </h2>
                <span
                  className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full uppercase tracking-wider flex-shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}
                >
                  SUPER ADMIN
                </span>
              </div>

            </div>
            <div
              className={`flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border flex-shrink-0 ${
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

        {/* Menu Navigation Sections */}
        {menuSections.map((section) => (
          <div key={section.title} className="mb-4">
            <h3
              className="text-xs font-bold uppercase tracking-wider px-1 mb-2"
              style={{ color: '#64748B' }}
            >
              {section.title}
            </h3>
            <div
              className="bg-white rounded-2xl overflow-hidden divide-y divide-slate-100"
              style={{
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              {section.items.map(({ label, href, icon: Icon, badge }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: '#F1F5F9' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: '#2351D9' }} strokeWidth={2} />
                    </div>
                    <span className="text-sm font-semibold truncate" style={{ color: '#0D1B3E' }}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {badge && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-md whitespace-nowrap"
                        style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                      >
                        {badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </div>
                </Link>
              ))}
              {section.title === 'Financial & System' && <SetPinMenuButton />}
            </div>
          </div>
        ))}

        {/* Logout Section */}
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>

      {/* Fixed bottom navigation */}
      <BottomNavigation />
    </div>
  )
}
