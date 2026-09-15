import type { Metadata } from 'next'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Greeting } from '@/components/dashboard/Greeting'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { RevenueOverview } from '@/components/dashboard/RevenueOverview'
import { UsersOverview } from '@/components/dashboard/UsersOverview'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { BottomNavigation } from '@/components/dashboard/BottomNavigation'

export const metadata: Metadata = {
  title: 'Dashboard Preview | Vyapar Samraj',
}

// Preview page — no auth required, uses sample data only
export default function DashboardPreviewPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <DashboardHeader userName="Super Admin" />
      </div>

      {/* Scrollable content */}
      <div className="pb-24 max-w-lg mx-auto">

        {/* Greeting */}
        <Greeting name="Super Admin" />

        {/* 4 KPI Cards */}
        <StatsGrid
          totalRevenue="₹2,45,67,890"
          totalUsers={1842}
          activeUsers={1256}
          expiredUsers={128}
          revenueChange="12.45%"
          usersChange="8.32%"
          activeUsersChange="6.25%"
          expiredUsersChange="3.21%"
        />

        {/* Revenue Overview */}
        <RevenueOverview
          totalRevenue="₹2,45,67,890"
          change="12.45%"
        />

        {/* Users Overview + Recent Activity */}
        <div className="px-4 mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <UsersOverview
            total={1842}
            active={1256}
            expired={128}
            inactive={305}
            pending={153}
          />
          <RecentActivity />
        </div>

        <div className="h-4" />
      </div>

      {/* Fixed bottom nav */}
      <BottomNavigation />
    </div>
  )
}
