'use client'

import { useState, useEffect } from 'react'
import { X, User, Mail, Phone, Lock, Eye, EyeOff, Calendar, Layers, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import { DateInputDMY } from '@/components/dashboard/DateInputDMY'
import type { Profile } from './UsersClient'

export interface PlanOption {
  id: string
  name: string
  price: number
  duration_days: number
  max_sub_users: number
  currency?: string
}

interface EditUserModalProps {
  isOpen: boolean
  user: Profile | null
  onClose: () => void
  onUserUpdated: () => void
}

export function EditUserModal({ isOpen, user, onClose, onUserUpdated }: EditUserModalProps) {
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [subAdmins, setSubAdmins] = useState<number>(1)
  const [hasManualSubAdmins, setHasManualSubAdmins] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (isOpen && user) {
      setErrorMessage(null)
      setFullName(user.full_name || '')
      setEmail(user.email || '')
      setUsername(user.username || '')
      setPhone(user.phone || '')
      if (user.plan_id) setSelectedPlanId(user.plan_id)
      setPassword('')
      setShowPassword(true)
      setHasManualSubAdmins(false)
      fetchUserDataAndPlans(user.id)
    }
  }, [isOpen, user])

  async function fetchUserDataAndPlans(userId: string) {
    setIsLoadingPlans(true)
    try {
      const [plansRes, userRes] = await Promise.all([
        fetch('/api/plans'),
        fetch(`/api/users/${userId}`)
      ])

      const plansData = await plansRes.json()
      let fetchedPlans: PlanOption[] = []
      if (Array.isArray(plansData)) {
        fetchedPlans = plansData
      } else if (Array.isArray(plansData.data)) {
        fetchedPlans = plansData.data
      } else if (Array.isArray(plansData.data?.plans)) {
        fetchedPlans = plansData.data.plans
      } else if (Array.isArray(plansData.plans)) {
        fetchedPlans = plansData.plans
      }
      setPlans(fetchedPlans)

      const userData = await userRes.json()
      const u = userData.data || userData || user

      if (u) {
        if (u.phone !== undefined && u.phone !== null && u.phone !== '') {
          setPhone(u.phone)
        }

        if (u.password !== undefined && u.password !== null && u.password !== '') {
          setPassword(u.password)
        }

        if (u.is_custom_sub_admins) {
          setHasManualSubAdmins(true)
        }

        if (u.sub_admins !== undefined && u.sub_admins !== null) {
          setSubAdmins(u.sub_admins)
        }

        const assignedPlanId = u.plan_id || user?.plan_id
        if (assignedPlanId) {
          setSelectedPlanId(assignedPlanId)
        } else if (fetchedPlans.length > 0) {
          setSelectedPlanId(fetchedPlans[0].id)
        }

        if (u.start_date) setStartDate(u.start_date.split('T')[0])
        if (u.end_date) setEndDate(u.end_date.split('T')[0])

        const sDate = u.start_date ? u.start_date.split('T')[0] : new Date().toISOString().split('T')[0]
        if (!u.start_date) setStartDate(sDate)

        const targetPlanId = assignedPlanId || (fetchedPlans.length > 0 ? fetchedPlans[0].id : '')
        const planToUse = fetchedPlans.find((p) => p.id === targetPlanId)
        if (planToUse) {
          if (!u.sub_admins && planToUse.max_sub_users) setSubAdmins(planToUse.max_sub_users)
          if (!u.end_date && planToUse.duration_days) calcEndDate(sDate, planToUse.duration_days)
        }
      }
    } catch (err) {
      console.error('Failed to load user edit data:', err)
      setErrorMessage('Failed to load user data from server.')
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
      if (!hasManualSubAdmins) {
        setSubAdmins(plan.max_sub_users ?? 1)
      }
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
    if (!user) return
    setErrorMessage(null)

    if (!fullName.trim()) return setErrorMessage('Name is required.')
    if (!email.trim()) return setErrorMessage('Email is required.')
    if (!phone.trim()) return setErrorMessage('Phone is required.')
    if (!username.trim()) return setErrorMessage('Username is required.')
    if (!password.trim()) return setErrorMessage('Password is required.')
    if (subAdmins === undefined || subAdmins === null || isNaN(Number(subAdmins)) || Number(subAdmins) < 0) {
      return setErrorMessage('Sub Admins must be a valid non-negative number.')
    }
    if (!selectedPlanId) return setErrorMessage('Please select a plan.')
    if (!startDate) return setErrorMessage('Start Date is required.')
    if (!endDate) return setErrorMessage('End Date is required.')

    setIsSubmitting(true)
    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        username: username.trim(),
        password: password.trim(),
        sub_admins: Math.max(0, Number(subAdmins)),
        plan_id: selectedPlanId,
        start_date: startDate,
        end_date: endDate,
      }

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update user')
      }

      onUserUpdated()
      onClose()
    } catch (err: any) {
      console.error('Update user error:', err)
      setErrorMessage(err.message || 'Failed to update user')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
        style={{ border: '1px solid #E2E8F0' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit User</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update user details, credentials, and plan subscription.
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

          {/* 4. Username & 5. Password (Optional) */}
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
                Update Password (Optional)
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
                  onChange={(e) => {
                    setSubAdmins(Number(e.target.value))
                    setHasManualSubAdmins(true)
                  }}
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
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
