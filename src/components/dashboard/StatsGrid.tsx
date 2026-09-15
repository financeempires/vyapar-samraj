'use client'

import { TrendingUp, Users, User, CalendarX } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  change?: string
  changeLabel?: string
  icon: React.ReactNode
  iconBg: string
  changeColor?: string
}

function StatCard({ title, value, change, changeLabel, icon, iconBg, changeColor = '#16A34A' }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-2xl p-4 flex flex-col gap-2"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}
    >
      {/* Icon + Title row */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <span className="text-[13px] font-medium" style={{ color: '#7B8BB2' }}>
          {title}
        </span>
      </div>

      {/* Value */}
      <div className="text-[22px] font-bold leading-tight" style={{ color: '#0D1B3E' }}>
        {value}
      </div>

      {/* Change */}
      {change && (
        <div>
          <span className="text-[13px] font-semibold" style={{ color: changeColor }}>
            ↑ {change}
          </span>
          {changeLabel && (
            <div className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>
              {changeLabel}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface StatsGridProps {
  totalRevenue?: string
  totalUsers?: number
  activeUsers?: number
  expiredUsers?: number
  revenueChange?: string
  usersChange?: string
  activeUsersChange?: string
  expiredUsersChange?: string
}

export function StatsGrid({
  totalRevenue = '₹ 0',
  totalUsers = 0,
  activeUsers = 0,
  expiredUsers = 0,
  revenueChange,
  usersChange,
  activeUsersChange,
  expiredUsersChange,
}: StatsGridProps) {
  return (
    <div className="px-4 pt-3 grid grid-cols-2 gap-3">
      {/* Total Revenue */}
      <StatCard
        title="Total Revenue"
        value={totalRevenue}
        change={revenueChange}
        changeLabel={revenueChange ? 'vs last month' : undefined}
        iconBg="#EEF2FF"
        icon={<TrendingUp className="w-5 h-5" style={{ color: '#2351D9' }} strokeWidth={1.8} />}
      />

      {/* Total Users */}
      <StatCard
        title="Total Users"
        value={totalUsers.toLocaleString()}
        change={usersChange}
        changeLabel={usersChange ? 'vs last month' : undefined}
        iconBg="#DCFCE7"
        icon={<Users className="w-5 h-5" style={{ color: '#16A34A' }} strokeWidth={1.8} />}
      />

      {/* Active Users */}
      <StatCard
        title="Active Users"
        value={activeUsers.toLocaleString()}
        change={activeUsersChange}
        changeLabel={activeUsersChange ? 'vs last month' : undefined}
        iconBg="#F3E8FF"
        icon={<User className="w-5 h-5" style={{ color: '#9333EA' }} strokeWidth={1.8} />}
      />

      {/* Expired Users */}
      <StatCard
        title="Expired Users"
        value={expiredUsers.toLocaleString()}
        change={expiredUsersChange}
        changeLabel={expiredUsersChange ? 'vs last month' : undefined}
        iconBg="#FFF7ED"
        icon={<CalendarX className="w-5 h-5" style={{ color: '#EA580C' }} strokeWidth={1.8} />}
        changeColor="#EA580C"
      />
    </div>
  )
}
