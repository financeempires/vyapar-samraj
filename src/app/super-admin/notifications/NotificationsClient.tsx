'use client'

import { useState } from 'react'
import {
  Bell,
  CheckCheck,
  Shield,
  CreditCard,
  Crown,
  Users,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react'

export interface NotificationItem {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
  updated_at: string
}

const CATEGORY_STYLES: Record<string, { bg: string; color: string; icon: React.ElementType }> = {
  SECURITY:     { bg: '#FEE2E2', color: '#DC2626', icon: Shield },
  PAYMENT:      { bg: '#DCFCE7', color: '#15803D', icon: CreditCard },
  SUBSCRIPTION: { bg: '#FEF9C3', color: '#92400E', icon: Crown },
  USER:         { bg: '#EEF2FF', color: '#2351D9', icon: Users },
  ERROR:        { bg: '#FFF1F2', color: '#E11D48', icon: AlertTriangle },
  SYSTEM:       { bg: '#F1F5F9', color: '#475569', icon: Info },
}

export function NotificationsClient({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadingAll, setLoadingAll] = useState(false)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleMarkAsRead(id: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch (e) {
      console.error('Failed to mark notification read:', e)
    } finally {
      setLoadingId(null)
    }
  }

  async function handleMarkAllRead() {
    setLoadingAll(true)
    try {
      const res = await fetch('/api/notifications', { method: 'PATCH' })
      if (res.ok) {
        setNotifications([])
      } else {
        const unreadList = notifications.filter((n) => !n.is_read)
        await Promise.all(
          unreadList.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' }))
        )
        setNotifications([])
      }
    } catch (e) {
      console.error('Failed to mark all notifications read:', e)
    } finally {
      setLoadingAll(false)
    }
  }

  return (
    <div>
      {/* Action Subheader */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: '#0D1B3E' }}>
            System Notifications
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
            Database-persisted system alerts & messages
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={loadingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#2351D9] bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            {loadingAll ? 'Updating...' : 'Mark All Read'}
          </button>
        )}
      </div>

      {/* Unread Counter Status */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3.5 mb-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2351D9] flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#0D1B3E]">
              {unreadCount > 0 ? `${unreadCount} Unread Notifications` : 'All notifications read'}
            </div>
            <div className="text-xs text-slate-500">
              {notifications.length} total system alerts in database
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List / Empty State */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <Bell className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-bold text-[#0D1B3E]">No system notifications</h3>
          <p className="text-xs text-slate-500 mt-1">
            System alerts, security notifications, and payment updates will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm divide-y divide-slate-100">
          {notifications.map((n) => {
            const catKey = (n.type || 'SYSTEM').toUpperCase()
            const catInfo = CATEGORY_STYLES[catKey] ?? CATEGORY_STYLES.SYSTEM
            const CatIcon = catInfo.icon
            const dateStr = new Date(n.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={n.id}
                className={`p-4 transition-colors flex items-start gap-3.5 ${
                  n.is_read ? 'bg-white' : 'bg-blue-50/40'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: catInfo.bg, color: catInfo.color }}
                >
                  <CatIcon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                        style={{ backgroundColor: catInfo.bg, color: catInfo.color }}
                      >
                        {n.type || 'SYSTEM'}
                      </span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{dateStr}</span>
                  </div>

                  <h4 className="text-sm font-bold text-[#0D1B3E] mt-1.5 leading-snug">
                    {n.title}
                  </h4>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      disabled={loadingId === n.id}
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#2351D9] hover:underline disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {loadingId === n.id ? 'Marking...' : 'Mark as Read'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
