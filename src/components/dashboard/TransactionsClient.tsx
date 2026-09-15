'use client'

import { useState, useEffect } from 'react'
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  Receipt,
  ChevronDown,
} from 'lucide-react'
import { DateInputDMY } from '@/components/dashboard/DateInputDMY'

export type TxStatus = 'completed' | 'pending' | 'failed' | 'refunded'
export type TxType = 'payment' | 'refund' | 'adjustment'

export interface TransactionItem {
  id: string
  user_id: string
  customer_name?: string
  customer_email?: string
  amount: number
  currency: string
  type: TxType
  status: TxStatus
  description?: string
  reference_id?: string
  created_at: string
}

export interface TransactionsData {
  period: 'Today' | 'This Week' | 'This Month'
  selectedDate?: string
  totalRevenue: number
  monthRevenue: number
  yearRevenue: number
  successCount: number
  pendingCount: number
  failedCount: number
  refundCount: number
  refundAmount: number
  transactions: TransactionItem[]
}

const STATUS_STYLES: Record<
  TxStatus,
  { bg: string; color: string; label: string; icon: React.ElementType }
> = {
  completed: { bg: '#DCFCE7', color: '#15803D', label: 'Successful', icon: CheckCircle2 },
  pending:   { bg: '#FEF9C3', color: '#92400E', label: 'Pending',    icon: Clock },
  failed:    { bg: '#FEE2E2', color: '#DC2626', label: 'Failed',     icon: XCircle },
  refunded:  { bg: '#F3E8FF', color: '#9333EA', label: 'Refunded',   icon: RotateCcw },
}

function formatCurrency(amount: number, currency: string = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function TransactionRow({ tx }: { tx: TransactionItem }) {
  const statusInfo = STATUS_STYLES[tx.status] ?? STATUS_STYLES.pending
  const StatusIcon = statusInfo.icon
  const dateStr = new Date(tx.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className="bg-white flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
      style={{ borderColor: '#F1F5F9' }}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: tx.type === 'refund' ? '#F3E8FF' : '#EEF2FF',
            color: tx.type === 'refund' ? '#9333EA' : '#2351D9',
          }}
        >
          {tx.type === 'refund' ? <RotateCcw className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold truncate" style={{ color: '#0D1B3E' }}>
              {tx.customer_name || 'System Transaction'}
            </span>
            {tx.reference_id && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                #{tx.reference_id}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 truncate mt-0.5">
            {tx.description || (tx.customer_email ? tx.customer_email : 'No description')}
          </p>

          <p className="text-[11px] text-slate-400 mt-1">Start Date: {dateStr}</p>
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-3">
        <div
          className="text-base font-bold"
          style={{ color: tx.type === 'refund' || tx.status === 'refunded' ? '#DC2626' : '#0D1B3E' }}
        >
          {tx.type === 'refund' ? '-' : '+'}{formatCurrency(Number(tx.amount), tx.currency)}
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
          style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
        >
          <StatusIcon className="w-3 h-3" />
          {statusInfo.label}
        </span>
      </div>
    </div>
  )
}

export function TransactionsClient({
  initialData,
}: {
  initialData: TransactionsData
}) {
  const [period, setPeriod] = useState<'Today' | 'This Week' | 'This Month'>(
    initialData.period || 'This Month'
  )
  const [selectedDate, setSelectedDate] = useState<string>(initialData.selectedDate || '')
  const [data, setData] = useState<TransactionsData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  // Sync state if initialData props change (e.g. on server navigation)
  useEffect(() => {
    setPeriod(initialData.period || 'This Month')
    setSelectedDate(initialData.selectedDate || '')
    setData(initialData)
  }, [initialData])

  const fetchFilteredData = async (targetPeriod: 'Today' | 'This Week' | 'This Month', targetDate: string) => {
    setIsLoading(true)
    setFetchError(false)

    // Update browser URL search params for refresh persistence
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('period', targetPeriod)
      if (targetDate) {
        url.searchParams.set('date', targetDate)
      } else {
        url.searchParams.delete('date')
      }
      window.history.pushState({}, '', url.toString())
    }

    try {
      const queryStr = targetDate 
        ? `period=${encodeURIComponent(targetPeriod)}&date=${encodeURIComponent(targetDate)}`
        : `period=${encodeURIComponent(targetPeriod)}`

      const res = await fetch(`/api/transactions?${queryStr}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setData(json.data)
        } else if (json.transactions) {
          setData(json)
        }
      } else {
        setFetchError(true)
      }
    } catch (err) {
      console.error('Failed to fetch transactions for period/date:', err)
      setFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePeriodChange = (newPeriod: 'Today' | 'This Week' | 'This Month') => {
    setPeriod(newPeriod)
    fetchFilteredData(newPeriod, selectedDate)
  }

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    fetchFilteredData(period, newDate)
  }

  const transactions = data.transactions || []

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4">
      {/* Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: '#0D1B3E' }}>
            Transactions & Revenue
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: '#7B8BB2' }}>
            Database-authoritative financial metrics & history
          </p>
        </div>

        {/* Filter Controls: Period Selector & Date Picker */}
        <div className="flex items-center gap-2 z-10 flex-shrink-0">
          {/* Existing Period Dropdown */}
          <div className="relative flex-shrink-0">
            <select
              value={period}
              onChange={(e) =>
                handlePeriodChange(e.target.value as 'Today' | 'This Week' | 'This Month')
              }
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium outline-none cursor-pointer appearance-none pr-8 transition-all disabled:opacity-50"
              style={{
                color: '#5B6B8A',
                border: '1px solid #E2E8F5',
                backgroundColor: '#F8FAFF',
              }}
              aria-label="Filter transactions by period"
            >
              <option value="Today" className="bg-white text-slate-700">
                Today
              </option>
              <option value="This Week" className="bg-white text-slate-700">
                This Week
              </option>
              <option value="This Month" className="bg-white text-slate-700">
                This Month
              </option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Additional Date Selector Input */}
          <div className="relative flex items-center flex-shrink-0">
            <DateInputDMY
              value={selectedDate}
              onChange={handleDateChange}
              disabled={isLoading}
              aria-label="Select specific subscription start date"
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium outline-none cursor-pointer border transition-all disabled:opacity-50 text-slate-700 bg-[#F8FAFF] border-[#E2E8F5]"
            />
            {selectedDate && (
              <button
                onClick={() => handleDateChange('')}
                title="Clear date filter"
                className="ml-1 text-slate-400 hover:text-slate-600 font-bold text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Revenue Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div
          className="bg-white rounded-2xl p-3.5 text-center"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2351D9] flex items-center justify-center mx-auto mb-1.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-[15px] font-bold truncate" style={{ color: '#2351D9' }}>
            {formatCurrency(data.totalRevenue)}
          </div>
          <div className="text-[10px] font-medium mt-0.5 text-slate-500">Total Revenue</div>
        </div>

        <div
          className="bg-white rounded-2xl p-3.5 text-center"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-1.5">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-[15px] font-bold truncate text-emerald-700">
            {formatCurrency(data.monthRevenue)}
          </div>
          <div className="text-[10px] font-medium mt-0.5 text-slate-500">This Month</div>
        </div>

        <div
          className="bg-white rounded-2xl p-3.5 text-center"
          style={{ border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-1.5">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-[15px] font-bold truncate text-indigo-700">
            {formatCurrency(data.yearRevenue)}
          </div>
          <div className="text-[10px] font-medium mt-0.5 text-slate-500">This Year</div>
        </div>
      </div>

      {/* Secondary Transaction Status Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white rounded-xl p-2 text-center border border-slate-100">
          <div className="text-sm font-bold text-emerald-600">{data.successCount}</div>
          <div className="text-[10px] text-slate-500">Successful</div>
        </div>
        <div className="bg-white rounded-xl p-2 text-center border border-slate-100">
          <div className="text-sm font-bold text-amber-600">{data.pendingCount}</div>
          <div className="text-[10px] text-slate-500">Pending</div>
        </div>
        <div className="bg-white rounded-xl p-2 text-center border border-slate-100">
          <div className="text-sm font-bold text-red-600">{data.failedCount}</div>
          <div className="text-[10px] text-slate-500">Failed</div>
        </div>
        <div className="bg-white rounded-xl p-2 text-center border border-slate-100">
          <div className="text-sm font-bold text-purple-600">{data.refundCount}</div>
          <div className="text-[10px] text-slate-500">Refunds</div>
        </div>
      </div>

      {/* Transactions History Header & Count */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-[#0D1B3E]">Payment History</h2>
        <span className="text-xs text-slate-400 font-medium">{transactions.length} records</span>
      </div>

      {/* Transaction Content List / Clean Empty State */}
      {fetchError ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-red-200">
          <p className="text-sm font-medium text-red-600">Failed to load transaction records from database.</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <h3 className="text-base font-bold text-[#0D1B3E]">No transactions yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Payment records and plan subscriptions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}
