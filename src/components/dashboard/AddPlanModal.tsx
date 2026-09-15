'use client'

import { useState } from 'react'
import { Crown, IndianRupee, Calendar, Users, MapPin, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface AddPlanModalProps {
  isOpen: boolean
  onClose: () => void
  onPlanAdded: () => void
}

export function AddPlanModal({ isOpen, onClose, onPlanAdded }: AddPlanModalProps) {
  const [planName, setPlanName] = useState('')
  const [price, setPrice] = useState('')
  const [days, setDays] = useState('')
  const [subadmins, setSubadmins] = useState('')
  const [areas, setAreas] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleReset = () => {
    setPlanName('')
    setPrice('')
    setDays('')
    setSubadmins('')
    setAreas('')
    setError(null)
    setSuccess(null)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // 1. Plan Name validation
    const trimmedName = planName.trim()
    if (!trimmedName) {
      setError('Plan Name is required.')
      return
    }
    if (trimmedName.length > 100) {
      setError('Plan Name must not exceed 100 characters.')
      return
    }

    // 2. Price validation
    if (!price.trim()) {
      setError('Price is required.')
      return
    }
    const numPrice = Number(price)
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Price must be a valid number greater than 0.')
      return
    }

    // 3. Days validation
    if (!days.trim()) {
      setError('Days is required.')
      return
    }
    const numDays = Number(days)
    if (isNaN(numDays) || !Number.isInteger(numDays) || numDays <= 0) {
      setError('Days must be a positive integer greater than 0.')
      return
    }

    // 4. Sub Admins validation
    if (!subadmins.trim()) {
      setError('Sub Admins is required.')
      return
    }
    const numSubadmins = Number(subadmins)
    if (isNaN(numSubadmins) || !Number.isInteger(numSubadmins) || numSubadmins < 0) {
      setError('Sub Admins must be a non-negative integer (0 or greater).')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: trimmedName,
          price: numPrice,
          days: numDays,
          duration_days: numDays,
          subadmins: numSubadmins,
          areas: areas.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok && data.success !== false) {
        setSuccess('Subscription plan saved successfully!')
        setPlanName('')
        setPrice('')
        setDays('')
        setSubadmins('')
        setAreas('')
        setTimeout(() => {
          onPlanAdded()
          handleClose()
        }, 1200)
      } else {
        setError(data.message || data.error || 'Failed to create plan. Please try again.')
      }
    } catch (err) {
      console.error('Create plan error:', err)
      setError('An internal error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        style={{ color: '#0D1B3E' }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0D1B3E' }}>
              Add Plan
            </h2>
            <p className="text-xs text-slate-400">
              Configure a new subscription plan
            </p>
          </div>
        </div>

        {/* Alert Banners */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div className="font-medium">{success}</div>
          </div>
        )}

        {/* Add Plan Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 1. Plan Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Plan Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Crown className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Professional"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 2. Price */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Price (₹)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <IndianRupee className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="any"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 3. Days */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Days
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="1"
                min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="e.g. 30"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 4. Sub Admins */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Sub Admins
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Users className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="1"
                min="0"
                value={subadmins}
                onChange={(e) => setSubadmins(e.target.value)}
                placeholder="e.g. 10"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 5. Areas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Areas
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={areas}
                onChange={(e) => setAreas(e.target.value)}
                placeholder="e.g. North Zone, South Zone"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Plan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
