'use client'

import { useState, useEffect, useMemo } from 'react'
import { UserPlus, IndianRupee, FileText, UserX } from 'lucide-react'

export interface ActivityLogItem {
  id: string
  type: string
  description: string
  created_at: string
}

function formatRelativeTime(dateInput: string | Date, nowInput?: Date): string {
  if (!dateInput) return 'Just now'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return 'Just now'
  const now = nowInput || new Date()
  const diffMs = now.getTime() - date.getTime()
  if (isNaN(diffMs) || diffMs < 0) return 'Just now'

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

function getActivityIcon(type: string) {
  const upper = (type || '').toUpperCase()
  if (upper.includes('USER')) {
    return {
      icon: <UserPlus className="w-4 h-4" style={{ color: '#2351D9' }} strokeWidth={1.8} />,
      iconBg: '#EEF2FF',
    }
  }
  if (upper.includes('PAYMENT') || upper.includes('TRANSACTION') || upper.includes('REVENUE')) {
    return {
      icon: <IndianRupee className="w-4 h-4" style={{ color: '#16A34A' }} strokeWidth={1.8} />,
      iconBg: '#DCFCE7',
    }
  }
  if (upper.includes('EXPIRED') || upper.includes('DELETE') || upper.includes('FAILED')) {
    return {
      icon: <UserX className="w-4 h-4" style={{ color: '#EA580C' }} strokeWidth={1.8} />,
      iconBg: '#FFF7ED',
    }
  }
  // Default for PLAN, OTP, PIN, SYSTEM
  return {
    icon: <FileText className="w-4 h-4" style={{ color: '#9333EA' }} strokeWidth={1.8} />,
    iconBg: '#F3E8FF',
  }
}

interface RecentActivityProps {
  activities?: ActivityLogItem[]
}

export function RecentActivity({ activities = [] }: RecentActivityProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [now, setNow] = useState<Date | null>(null)

  // Stable snapshot date for SSR and initial hydration render
  const snapshotDate = useMemo(() => {
    if (activities.length > 0 && activities[0].created_at) {
      const parsed = new Date(activities[0].created_at)
      if (!isNaN(parsed.getTime())) return parsed
    }
    return new Date(0)
  }, [activities])

  useEffect(() => {
    setIsMounted(true)
    setNow(new Date())

    const interval = setInterval(() => {
      setNow(new Date())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="bg-white rounded-2xl p-4"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold" style={{ color: '#0D1B3E' }}>
          Recent Activity
        </h2>
        <a
          href="/super-admin/activity-logs"
          className="text-[13px] font-medium hover:underline"
          style={{ color: '#2351D9' }}
        >
          View All
        </a>
      </div>

      {/* Activity list */}
      {activities.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">
          No recent activity recorded.
        </p>
      ) : (
        <div className="space-y-3">
          {activities.map((item, index) => {
            const { icon, iconBg } = getActivityIcon(item.type)
            const timeStr = formatRelativeTime(
              item.created_at,
              isMounted && now ? now : snapshotDate
            )

            return (
              <div key={item.id || index}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: iconBg }}
                  >
                    {icon}
                  </div>

                  {/* Text + time */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug" style={{ color: '#0D1B3E' }}>
                      {item.description}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>
                      {timeStr}
                    </p>
                  </div>
                </div>

                {/* Divider (except last) */}
                {index < activities.length - 1 && (
                  <div className="mt-3 border-t" style={{ borderColor: '#F1F5F9' }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
