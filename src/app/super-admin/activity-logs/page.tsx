import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'
import {
  Activity,
  ShieldAlert,
  LogIn,
  LogOut,
  KeyRound,
  UserCheck,
  RefreshCw,
  Clock,
  ShieldCheck,
  FileText,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Activity Logs | Vyapar Samraj',
  description: 'View real audit logs and system activity records.',
}

interface ActivityLogItem {
  id: string
  type: string
  description: string
  actor_id?: string
  actor_name?: string
  metadata?: Record<string, unknown>
  created_at: string
}

function getLogIcon(type: string) {
  const t = (type || '').toUpperCase()
  if (t.includes('LOGIN')) return LogIn
  if (t.includes('LOGOUT')) return LogOut
  if (t.includes('PIN') || t.includes('PASSWORD') || t.includes('OTP')) return KeyRound
  if (t.includes('USER')) return UserCheck
  if (t.includes('SECURITY')) return ShieldAlert
  return Activity
}

function LogRow({ log }: { log: ActivityLogItem }) {
  const Icon = getLogIcon(log.type)
  const dateStr = new Date(log.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // Format type nicely (e.g., SUPER_ADMIN_LOGIN_SUCCESS -> Login Success)
  const formattedType = log.type
    ? log.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : 'System Event'

  return (
    <div
      className="bg-white flex items-start gap-3.5 p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
      style={{ borderColor: '#F1F5F9' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: '#EEF2FF', color: '#2351D9' }}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase tracking-wider">
            {formattedType}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">{dateStr}</span>
        </div>

        <p className="text-sm font-semibold text-[#0D1B3E] mt-1.5 leading-snug">
          {log.description}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
          <span className="font-medium text-slate-600">
            Actor: <span className="text-[#2351D9] font-bold">{log.actor_name || log.actor_id || 'System'}</span>
          </span>
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <span className="text-slate-400 font-mono text-[10px]">
              {JSON.stringify(log.metadata).slice(0, 60)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function ActivityLogsPage() {
  const session = await verifySession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  const displayName = session.fullName || 'Super Admin'

  let logs: ActivityLogItem[] = []
  let fetchError = false

  try {
    const rows = await sql`
      SELECT 
        a.id,
        a.type,
        a.description,
        a.actor_id,
        a.metadata,
        a.created_at,
        COALESCE(sa.full_name, p.full_name, sa.username, p.username) as actor_name
      FROM activity_logs a
      LEFT JOIN super_admin_accounts sa ON a.actor_id = sa.id::text OR a.actor_id = sa.username
      LEFT JOIN profiles p ON a.actor_id = p.id::text OR a.actor_id = p.username
      ORDER BY a.created_at DESC
      LIMIT 100
    `
    logs = rows as unknown as ActivityLogItem[]
  } catch (err) {
    console.error('Activity logs query error:', err)
    fetchError = true
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
              Activity Logs
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
              Real-time audit trail stored in Neon PostgreSQL
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#2351D9] border border-blue-100">
            {logs.length} Log Entries
          </span>
        </div>

        {/* Audit summary card */}
        <div
          className="bg-white rounded-2xl p-4 mb-4 flex items-center gap-3.5"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0D1B3E]">Audit Persistence Active</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All authentication, PIN changes, user operations & system events are logged server-side.
            </p>
          </div>
        </div>

        {/* Logs list / Empty State */}
        {fetchError ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-red-200">
            <p className="text-sm font-medium text-red-600">Failed to load activity logs from database.</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
            <Activity className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-base font-bold text-[#0D1B3E]">No activity logs recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              System operations and audit actions will be recorded here automatically.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  )
}
