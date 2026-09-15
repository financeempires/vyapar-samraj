'use client'

import { useState, useTransition } from 'react'
import { Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, KeyRound, X, Check } from 'lucide-react'

interface SetPinModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SetPinModal({ isOpen, onClose }: SetPinModalProps) {
  const [previousPin, setPreviousPin] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPreviousPin, setShowPreviousPin] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [showConfirmPin, setShowConfirmPin] = useState(false)
  const [isPreviousPinVerified, setIsPreviousPinVerified] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const handleReset = () => {
    setPreviousPin('')
    setPin('')
    setConfirmPin('')
    setIsPreviousPinVerified(false)
    setServerError(null)
    setSuccessMessage(null)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleVerifyPreviousPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!previousPin) {
      setServerError('Please enter your Previous PIN')
      return
    }

    if (!/^\d{4,6}$/.test(previousPin)) {
      setServerError('Previous PIN must be 4 to 6 numeric digits')
      return
    }

    setServerError(null)
    setSuccessMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/verify-previous-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ previousPin }),
        })

        const result = await response.json()
        const isSuccess = response.ok && (result.success === true || (result.success !== false && !result.error))

        if (isSuccess) {
          setIsPreviousPinVerified(true)
          setSuccessMessage('Previous PIN verified! You may now enter a new PIN.')
          setServerError(null)
        } else {
          setServerError(result.message || (typeof result.data === 'string' ? result.data : 'Incorrect Previous PIN. Please try again.'))
          setIsPreviousPinVerified(false)
        }
      } catch (err) {
        console.error('Verify Previous PIN error:', err)
        setServerError('Failed to verify Previous PIN. Please try again.')
        setIsPreviousPinVerified(false)
      }
    })
  }

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isPreviousPinVerified) {
      handleVerifyPreviousPin()
      return
    }

    if (!pin || !confirmPin) {
      setServerError('Please enter both New PIN and Confirm PIN')
      return
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setServerError('New PIN must be 4 to 6 numeric digits')
      return
    }

    if (pin !== confirmPin) {
      setServerError('New PIN and Confirm PIN do not match')
      return
    }

    setServerError(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/set-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            previousPin,
            pin,
            confirmPin,
          }),
        })

        const result = await response.json()
        const isSuccess = response.ok && (result.success === true || (result.success !== false && !result.error))

        if (isSuccess) {
          setSuccessMessage('Security PIN configured successfully!')
          setServerError(null)
          setTimeout(() => {
            handleClose()
          }, 1500)
        } else {
          setServerError(result.message || 'Failed to set Security PIN')
        }
      } catch (err) {
        console.error('Set PIN error:', err)
        setServerError('Failed to set Security PIN. Please try again.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-[#2351D9]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0D1B3E]">Set Security PIN</h3>
            <p className="text-xs text-slate-500">
              {isPreviousPinVerified ? 'Enter your new 4-6 digit Security PIN' : 'Verify your current PIN to proceed'}
            </p>
          </div>
        </div>

        {serverError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={isPreviousPinVerified ? handleSaveNewPin : handleVerifyPreviousPin} className="space-y-4">
          {/* Stage 1: Previous PIN */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase text-slate-600">Previous PIN</label>
              {isPreviousPinVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPreviousPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={previousPin}
                onChange={(e) => {
                  setPreviousPin(e.target.value)
                  if (isPreviousPinVerified) setIsPreviousPinVerified(false)
                }}
                placeholder="Enter current PIN"
                disabled={isPending || isPreviousPinVerified}
                className={`w-full rounded-xl border py-3 pl-10 pr-10 text-sm font-semibold tracking-wider font-mono text-slate-800 outline-none transition-all ${
                  isPreviousPinVerified
                    ? 'bg-slate-50 border-emerald-200 text-slate-500'
                    : 'border-slate-200 focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPreviousPin(!showPreviousPin)}
                disabled={isPreviousPinVerified}
                className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                {showPreviousPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Stage 1 Action: Verify Button (shown when Previous PIN is not yet verified) */}
          {!isPreviousPinVerified && (
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !previousPin}
                className="flex-1 py-3 text-xs font-bold text-white rounded-xl shadow-md transition-all hover:brightness-110 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
                }}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </span>
                ) : (
                  'Verify Previous PIN'
                )}
              </button>
            </div>
          )}

          {/* Stage 2: New PIN + Confirm PIN (enabled after Previous PIN verification) */}
          {isPreviousPinVerified && (
            <>
              <div className="pt-1 border-t border-slate-100 animate-in fade-in duration-300 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">New PIN</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter 4-6 digit PIN"
                      disabled={isPending}
                      className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-10 text-sm font-semibold tracking-wider font-mono text-slate-800 outline-none focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Confirm PIN</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showConfirmPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Confirm new PIN"
                      disabled={isPending}
                      className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-10 text-sm font-semibold tracking-wider font-mono text-slate-800 outline-none focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPin(!showConfirmPin)}
                      className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3 animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !pin || !confirmPin}
                  className="flex-1 py-3 text-xs font-bold text-white rounded-xl shadow-md transition-all hover:brightness-110 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
                  }}
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </span>
                  ) : (
                    'Save Security PIN'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
