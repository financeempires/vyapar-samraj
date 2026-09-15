'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface UsersOverviewProps {
  total?: number
  active?: number
  expired?: number
  inactive?: number
  pending?: number
}

export function UsersOverview({
  total = 0,
  active = 0,
  expired = 0,
  inactive = 0,
  pending = 0,
}: UsersOverviewProps) {
  const rawData = [
    { name: 'Active Users', value: active, color: '#2351D9' },
    { name: 'Expired Users', value: expired, color: '#22C55E' },
    { name: 'Inactive Users', value: inactive, color: '#A855F7' },
  ]

  // Filter out 0 values for Pie chart rendering, or provide default slice if total is 0
  const chartData = total > 0 ? rawData.filter((d) => d.value > 0) : [{ name: 'No Users', value: 1, color: '#E2E8F0' }]

  const legendItems = [
    { label: 'Active Users', value: active, color: '#2351D9' },
    { label: 'Expired Users', value: expired, color: '#22C55E' },
    { label: 'Inactive Users', value: inactive, color: '#A855F7' },
  ]

  return (
    <div
      className="bg-white rounded-2xl p-4"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}
    >
      <h2 className="text-[15px] font-bold mb-4" style={{ color: '#0D1B3E' }}>
        Users Overview
      </h2>

      {/* Donut chart with center label */}
      <div className="relative flex items-center justify-center" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={total > 0 ? 2 : 0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[22px] font-bold leading-none" style={{ color: '#0D1B3E' }}>
            {total.toLocaleString()}
          </span>
          <span className="text-[12px] mt-1" style={{ color: '#9CA3AF' }}>
            Total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[13px]" style={{ color: '#5B6B8A' }}>
                {item.label}
              </span>
            </div>
            <span className="text-[13px] font-semibold" style={{ color: '#0D1B3E' }}>
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
