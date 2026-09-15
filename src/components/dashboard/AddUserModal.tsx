'use client'

import { useState, useEffect } from 'react'
import { X, User, Mail, Phone, Lock, Eye, EyeOff, Calendar, Layers, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import { DateInputDMY } from '@/components/dashboard/DateInputDMY'

export interface PlanOption {
  id: string
  name: string
  price: number
  duration_days: number
  max_sub_users: number
  currency?: string
}

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserAdded: () => void
}

export function AddUserModal({ isOpen, onClose, onUserAdded }: AddUserModalProps) {
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 9 Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [subAdmins, setSubAdmins] = useState<number>(1)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Initialize today's date when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0]
      setStartDate(today)
      setErrorMessage(null)
      fetchPlans(today)
    }
  }, [isOpen])

  async function fetchPlans(currentStartDate: string) {
    setIsLoadingPlans(true)
    try {
      const res = await fetch('/api/plans')
      const data = await res.json()
      const fetchedPlans: PlanOption[] = data.data?.plans || (Array.isArray(data.data) ? data.data : [])
      setPlans(fetchedPlans)

      if (fetchedPlans.length > 0) {
        const firstPlan = fetchedPlans[0]
        setSelectedPlanId(firstPlan.id)
        setSubAdmins(firstPlan.max_sub_users ?? 1)
        calcEndDate(currentStartDate, firstPlan.duration_days)
      }
    } catch (err) {
      console.error('Failed to load plans:', err)
      setErrorMessage('Failed to load plans from database.')
    } finally {
      setIsLoadingPlans(false)
    }
  }

  function calcEndDate(startStr: string, durationDays: number) {
    if (!startStr || !durationDays) return
    const start = new Date(startStr)
    if (isNaN(start.getTime())) return
    const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000)
    const yyyy = end.getFullYear()
    const mm = String(end.getMonth() + 1).padStart(2, '0')
    const dd = String(end.getDate()).padStart(2, '0')
    setEndDate(`${yyyy}-${mm}-${dd}`)
  }

  function handlePlanSelect(planId: string) {
    setSelectedPlanId(planId)
    const plan = plans.find((p) => p.id === planId)
    if (plan) {
      setSubAdmins(plan.max_sub_users ?? 1)
      calcEndDate(startDate, plan.duration_days)
    }
  }

  function handleStartDateChange(newStartDate: string) {
    setStartDate(newStartDate)
    const plan = plans.find((p) => p.id === selectedPlanId)
    if (plan) {
      calcEndDate(newStartDate, plan.duration_days)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!fullName.trim()) return setErrorMessage('Name is required.')
    if (!email.trim()) return setErrorMessage('Email is required.')
    if (!phone.trim()) return setErrorMessage('Phone is required.')
    if (!username.trim()) return setErrorMessage('Username is required.')
    if (!password) return setErrorMessage('Password is required.')
    if (subAdmins === undefined || subAdmins === null || isNaN(Number(subAdmins))) return setErrorMessage('Sub Admins is required.')
    if (!selectedPlanId) return setErrorMessage('Please select a plan.')
    if (!startDate) return setErrorMessage('Start Date is required.')
    if (!endDate) return setErrorMessage('End Date is required.')

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          username: username.trim(),
          password: password,
          sub_admins: Number(subAdmins) || 1,
          plan_id: selectedPlanId,
          start_date: startDate,
          end_date: endDate,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create user')
      }

      // Reset & notify parent
      setFullName('')
      setEmail('')
      setPhone('')
      setUsername('')
      setPassword('')
      onUserAdded()
      onClose()
    } catch (err: any) {
      console.error('Create user error:', err)
      setErrorMessage(err.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
        style={{ border: '1px solid #E2E8F0' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add New User</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create an application user and assign a subscription plan.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2.5 text-xs text-red-600 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 1. Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          {/* 2. Email & 3. Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* 4. Username & 5. Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* 6. Sub Admins & 7. Plan Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sub Admins <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  required
                  value={subAdmins}
                  onChange={(e) => setSubAdmins(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  required
                  disabled={isLoadingPlans}
                  value={selectedPlanId}
                  onChange={(e) => handlePlanSelect(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800 appearance-none"
                >
                  {isLoadingPlans ? (
                    <option value="">Loading plans...</option>
                  ) : plans.length === 0 ? (
                    <option value="">No active plans found</option>
                  ) : (
                    plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{Number(p.price)?.toLocaleString('en-IN')} - {p.duration_days} days)
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* 8. Start Date & 9. End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <DateInputDMY
                  value={startDate}
                  onChange={handleStartDateChange}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <DateInputDMY
                  value={endDate}
                  onChange={setEndDate}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-md"
              style={{
                background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
                boxShadow: '0 4px 14px rgba(35,81,217,0.25)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save User'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
