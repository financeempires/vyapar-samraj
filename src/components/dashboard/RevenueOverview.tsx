'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

export interface RevenueChartDataPoint {
  date: string
  value: number
}

function formatYAxis(value: number): string {
  if (value === 0) return '₹ 0'
  if (value >= 10000000) return `₹ ${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `₹ ${(value / 100000).toFixed(1)}L`
  return `₹ ${value.toLocaleString('en-IN')}`
}

function formatTooltipValue(value: number): string {
  return `₹ ${value.toLocaleString('en-IN')}`
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: { value: number }
}

function ChartDot({ cx, cy }: DotProps) {
  if (cx === undefined || cy === undefined) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#2351D9"
      stroke="white"
      strokeWidth={2}
    />
  )
}

export function ensureContinuousChartPoints(
  rawPoints: RevenueChartDataPoint[],
  period: string
): RevenueChartDataPoint[] {
  if (!rawPoints || rawPoints.length === 0) {
    let startLabel = 'Start'
    let endLabel = period
    if (period === 'Today' || period === 'today') {
      startLabel = '00:00'
      endLabel = '23:59'
    } else if (period === 'This Week' || period === 'this_week') {
      startLabel = 'Mon 01'
      endLabel = 'Sun 07'
    } else if (period === 'This Month' || period === 'this_month') {
      startLabel = '01'
      endLabel = '31'
    } else if (period === 'This Year' || period === 'this_year') {
      startLabel = 'Jan'
      endLabel = 'Dec'
    } else if (period === 'Till Now' || period === 'till_now') {
      startLabel = 'Start'
      endLabel = 'Today'
    }
    return [
      { date: startLabel, value: 0 },
      { date: endLabel, value: 0 },
    ]
  }

  if (rawPoints.length === 1) {
    const single = rawPoints[0]
    let startDate = 'Start'

    if (period === 'Today' || period === 'today') {
      startDate = single.date === '00:00' ? 'Start' : '00:00'
    } else if (period === 'This Week' || period === 'this_week') {
      startDate = 'Mon 01'
    } else if (period === 'This Month' || period === 'this_month') {
      const parts = single.date.split(' ')
      const monthStr = parts[1] || ''
      startDate = monthStr ? `01 ${monthStr}` : '01 Aug'
      if (startDate === single.date) startDate = '01 Start'
    } else if (period === 'This Year' || period === 'this_year') {
      const parts = single.date.split(' ')
      const yearStr = parts[1] || ''
      startDate = yearStr ? `Jan ${yearStr}` : 'Jan 2026'
      if (startDate === single.date) startDate = 'Start'
    } else {
      startDate = 'Start'
    }

    return [
      { date: startDate, value: 0 },
      single,
    ]
  }

  return rawPoints
}

interface RevenueOverviewProps {
  totalRevenue?: string
  change?: string
  data?: RevenueChartDataPoint[]
}

export function RevenueOverview({
  totalRevenue = '₹ 0',
  change,
  data = [],
}: RevenueOverviewProps) {
  const [period, setPeriod] = useState('This Month')
  const [currentAmount, setCurrentAmount] = useState(totalRevenue)
  const [currentData, setCurrentData] = useState<RevenueChartDataPoint[]>(data)
  const [isLoading, setIsLoading] = useState(false)

  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod)
    setIsLoading(true)

    try {
      const res = await fetch(`/api/super-admin/revenue-overview?period=${encodeURIComponent(newPeriod)}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setCurrentAmount(json.data.totalRevenue || '₹ 0')
          setCurrentData(json.data.chartPoints || [])
        }
      }
    } catch (err) {
      console.error('Failed to fetch revenue for period:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const chartData = ensureContinuousChartPoints(currentData, period)

  return (
    <div
      className="mx-4 mt-3 bg-white rounded-2xl p-4 relative"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[15px] font-bold truncate" style={{ color: '#0D1B3E' }}>
          Revenue Overview
        </h2>
        {/* Period Filter Dropdown */}
        <div className="relative z-10 flex-shrink-0">
          <select
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            disabled={isLoading}
            className="w-full max-w-[115px] sm:max-w-none flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-[12px] font-medium outline-none cursor-pointer appearance-none pr-7 transition-all disabled:opacity-50 text-ellipsis overflow-hidden"
            style={{ color: '#5B6B8A', border: '1px solid #E2E8F5', backgroundColor: '#F8FAFF' }}
            aria-label="Revenue Overview period filter"
          >
            <option value="Today" className="bg-white text-slate-700">Today</option>
            <option value="This Week" className="bg-white text-slate-700">This Week</option>
            <option value="This Month" className="bg-white text-slate-700">This Month</option>
            <option value="This Year" className="bg-white text-slate-700">This Year</option>
            <option value="Till Now" className="bg-white text-slate-700">Till Now</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Total value */}
      <div className="text-[26px] font-bold leading-none mb-1" style={{ color: '#0D1B3E' }}>
        {currentAmount}
      </div>
      {change && period === 'This Month' && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-[13px] font-semibold" style={{ color: '#16A34A' }}>
            ↑ {change}
          </span>
          <span className="text-[13px]" style={{ color: '#9CA3AF' }}>
            vs last month
          </span>
        </div>
      )}

      {/* Chart */}
      <div style={{ height: 200 }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2351D9" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#2351D9" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(value) => [formatTooltipValue(Number(value ?? 0)), 'Revenue']}
              labelStyle={{ color: '#0D1B3E', fontWeight: 600, fontSize: 12 }}
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #E2E8F5',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2351D9"
              strokeWidth={2.5}
              fill="url(#revGrad)"
              dot={<ChartDot />}
              activeDot={{ r: 6, fill: '#2351D9', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
