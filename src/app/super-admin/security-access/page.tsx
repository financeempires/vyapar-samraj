import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import {
  Shield,
  Lock,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Activity,
  ChevronRight,
  Cpu,
  Mail,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security & Access Control | Vyapar Samraj',
  description: 'Manage real security parameters, access privileges, and system security logs.',
}

interface SuperAdminItem {
  id: string
  username: string
  email: string
  full_name: string
  last_login_at?: string
  created_at: string
}

interface SecurityLogItem {
  id: string
  type: string
  description: string
  actor_id?: string
  created_at: string
}

function maskUsername(username: string): string {
  if (!username) return ''
  const clean = username.replace(/^@/, '')
  if (clean.length <= 1) return `@${clean}••••••`
  return `@${clean[0]}••••••`
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (!local) return email
  const maskedLocal = local[0] + '••••••••••••'
  return `${maskedLocal}@${domain}`
}

export default async function SecurityAccessPage() {
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const displayName = session.fullName || 'Super Admin'

  let superAdmins: SuperAdminItem[] = []
  let securityLogs: SecurityLogItem[] = []

  try {
    // 1. Fetch Super Admin accounts
    const saRows = await sql`
      SELECT id, username, email, full_name, last_login_at, created_at
      FROM super_admin_accounts
      ORDER BY created_at ASC
    `
    superAdmins = saRows as unknown as SuperAdminItem[]

    // 2. Fetch recent security audit logs
    const secLogRows = await sql`
      SELECT id, type, description, actor_id, created_at
      FROM activity_logs
      WHERE type LIKE '%LOGIN%' 
         OR type LIKE '%PIN%' 
         OR type LIKE '%PASSWORD%' 
         OR type LIKE '%OTP%'
         OR type LIKE '%SECURITY%'
      ORDER BY created_at DESC
      LIMIT 10
    `
    securityLogs = secLogRows as unknown as SecurityLogItem[]
  } catch (err) {
    console.error('Security page error:', err)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName={displayName} />
      </div>

      <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: '#0D1B3E' }}>
              Security & Access Control
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
              Real system access privileges & security enforcements
            </p>
          </div>
        </div>

        {/* System Hardening Status Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-4 mb-4 shadow-md border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Hardened Security Active</h2>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 uppercase">
                  Protected
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                4-Factor Super Admin Auth: Password + Email OTP + BCrypt PIN + Session Cookie.
              </p>
            </div>
          </div>
        </div>

        {/* Security Parameters Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
              <Lock className="w-4 h-4 text-[#2351D9]" />
              <span>Password Security</span>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Algorithm:</span>
                <span className="font-bold text-slate-700">BCrypt (Cost 10)</span>
              </div>
              <div className="flex justify-between">
                <span>Database:</span>
                <span className="font-bold text-slate-700">Neon PostgreSQL</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
              <KeyRound className="w-4 h-4 text-purple-600" />
              <span>Security PIN</span>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="font-bold text-slate-700">pin_hash only</span>
              </div>
              <div className="flex justify-between">
                <span>Length:</span>
                <span className="font-bold text-slate-700">4-6 Digits</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
              <Mail className="w-4 h-4 text-amber-600" />
              <span>2FA Verification</span>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span className="font-bold text-slate-700">SMTP Email</span>
              </div>
              <div className="flex justify-between">
                <span>OTP Hash:</span>
                <span className="font-bold text-slate-700">60-char BCrypt</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>Session Rules</span>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-bold text-slate-700">HttpOnly Cookie</span>
              </div>
              <div className="flex justify-between">
                <span>SameSite:</span>
                <span className="font-bold text-slate-700">Lax</span>
              </div>
            </div>
          </div>
        </div>

        {/* Authorized Super Admin Accounts */}
        <div className="mb-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Authorized Super Admin Accounts
          </h3>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {superAdmins.map((sa) => (
              <div key={sa.id} className="p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-[#2351D9] font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {sa.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#0D1B3E] truncate">{sa.full_name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-[#2351D9] uppercase">
                      Super Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {maskUsername(sa.username)} • {maskEmail(sa.email)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <UserCheck className="w-3 h-3" />
                  <span>Authorized</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Security Activity Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Recent Security Audit Events
            </h3>
            <Link
              href="/super-admin/activity-logs"
              className="text-xs font-bold text-[#2351D9] hover:underline flex items-center gap-0.5"
            >
              Full Logs <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {securityLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200">
              <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs text-slate-500">No security audit events recorded yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {securityLogs.map((log) => {
                const dateStr = new Date(log.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <div key={log.id} className="p-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2351D9] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#0D1B3E] truncate">{log.type}</span>
                        <span className="text-slate-400">{dateStr}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 truncate">{log.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}
