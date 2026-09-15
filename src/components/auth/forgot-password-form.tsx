'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepState {
  step: 'USERNAME' | 'OTP' | 'RESET' | 'SUCCESS'
  challengeId?: string
  maskedEmail?: string
  username?: string
  verifiedOtp?: string
}

async function safeParseJson(response: Response) {
  try {
    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    if (!text || !text.trim()) {
      return { success: false, message: 'Server returned an empty response. Please try again.' }
    }
    if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return JSON.parse(text)
    }
    return { success: false, message: 'Invalid response format from server.' }
  } catch (err) {
    console.error('Safe JSON parse error:', err)
    return { success: false, message: 'Unable to parse server response.' }
  }
}

export function ForgotPasswordForm() {
  const router = useRouter()
  const [stepState, setStepState] = useState<StepState>({ step: 'USERNAME' })
  const [usernameInput, setUsernameInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [resendTimer, setResendTimer] = useState<number>(30)
  const [isPending, startTransition] = useTransition()

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  // Timer for resend OTP countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (stepState.step === 'OTP' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [stepState.step, resendTimer])

  // ─── Step 1: Submit Username ───
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!usernameInput.trim()) {
      setServerError('Please enter your username')
      return
    }

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameInput.trim() }),
        })

        const result = await safeParseJson(response)
        const payload = result.data || result

        if (response.ok && result.success !== false && payload.success !== false) {
          setStepState({
            step: 'OTP',
            username: usernameInput.trim(),
            challengeId: payload.challengeId || result.challengeId,
            maskedEmail: payload.maskedEmail || result.maskedEmail || 'registered email',
          })
          setResendTimer(30)
        } else {
          setServerError(payload.message || result.message || 'Username not found')
        }
      } catch (err) {
        console.error('Forgot password error:', err)
        setServerError('Unable to process request. Please check username.')
      }
    })
  }

  // ─── Step 2: Verify OTP Code ───
  const handleVerifyOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const otp = otpDigits.join('')
    if (otp.length !== 6) {
      setServerError('Please enter the full 6-digit OTP code')
      return
    }

    if (!stepState.challengeId) return

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/verify-reset-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: stepState.challengeId,
            otp,
          }),
        })

        const result = await safeParseJson(response)
        const payload = result.data || result

        if (response.ok && payload.success !== false) {
          setStepState((prev) => ({
            ...prev,
            step: 'RESET',
            verifiedOtp: otp,
          }))
        } else {
          setServerError(payload.message || 'Invalid or expired OTP code')
        }
      } catch (err) {
        console.error('OTP verification error:', err)
        setServerError('Invalid OTP code')
      }
    })
  }

  // Resend OTP
  const handleResendOtp = () => {
    if (resendTimer > 0 || !stepState.username || isPending) return

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: stepState.username }),
        })

        const result = await safeParseJson(response)
        const payload = result.data || result

        if (response.ok && payload.success !== false) {
          setStepState((prev) => ({
            ...prev,
            challengeId: payload.challengeId || result.challengeId,
            maskedEmail: payload.maskedEmail || result.maskedEmail || prev.maskedEmail,
          }))
          setResendTimer(30)
          setOtpDigits(['', '', '', '', '', ''])
          inputRefs[0].current?.focus()
        } else {
          setServerError(payload.message || 'Failed to resend OTP')
        }
      } catch (err) {
        console.error('Resend OTP error:', err)
        setServerError('Failed to resend OTP')
      }
    })
  }

  // ─── Step 3: Reset Password ───
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setServerError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setServerError('Passwords do not match')
      return
    }

    if (!stepState.challengeId || !stepState.verifiedOtp) {
      setServerError('Session expired. Please restart the forgot password process.')
      return
    }

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: stepState.challengeId,
            otp: stepState.verifiedOtp,
            newPassword,
          }),
        })

        const result = await safeParseJson(response)
        const payload = result.data || result

        if (response.ok && payload.success !== false) {
          setStepState({ step: 'SUCCESS' })
          setSuccessMessage('Password reset successfully! Redirecting to login...')
          setTimeout(() => {
            router.push('/login')
          }, 2000)
        } else {
          setServerError(payload.message || 'Failed to reset password')
        }
      } catch (err) {
        console.error('Reset password error:', err)
        setServerError('Failed to reset password')
      }
    })
  }

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...otpDigits]
    newDigits[index] = value.slice(-1)
    setOtpDigits(newDigits)
    if (value && index < 5) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || ''
    }
    setOtpDigits(newDigits)
    const nextFocus = Math.min(pasted.length, 5)
    inputRefs[nextFocus].current?.focus()
  }

  // ─── Render SUCCESS State ───
  if (stepState.step === 'SUCCESS') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-[20px] font-bold text-[#0D1B3E]">Password Updated!</h2>
        <p className="text-sm text-slate-600">
          {successMessage || 'Your password has been reset. You can now log in with your new credentials.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 mt-4"
          style={{
            background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
            boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
          }}
        >
          Proceed to Login
        </button>
      </div>
    )
  }

  // ─── Render Step 3: RESET Password State ───
  if (stepState.step === 'RESET') {
    return (
      <form onSubmit={handleResetPasswordSubmit} noValidate className="space-y-0" aria-label="Reset password form">
        {serverError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm"
            style={{ color: '#DC2626' }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="mb-6 text-center">
          <h2 className="text-[20px] font-bold text-[#0D1B3E]">Set New Password</h2>
          <p className="mt-1 text-xs text-slate-500">
            Please enter your new Super Admin password below.
          </p>
        </div>

        {/* New Password */}
        <div className="mb-4">
          <label htmlFor="newPassword" className="mb-2 block text-[15px] font-semibold" style={{ color: '#0D1B3E' }}>
            New Password
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <Lock className="h-5 w-5" style={{ color: '#9CA3AF' }} strokeWidth={1.6} />
            </span>
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={isPending}
              className="w-full rounded-xl border border-[#E2E8F5] bg-white py-[15px] pl-12 pr-12 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute inset-y-0 right-4 flex items-center"
            >
              {showNewPassword ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="mb-6">
          <label htmlFor="confirmPassword" className="mb-2 block text-[15px] font-semibold" style={{ color: '#0D1B3E' }}>
            Confirm New Password
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <Lock className="h-5 w-5" style={{ color: '#9CA3AF' }} strokeWidth={1.6} />
            </span>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={isPending}
              className="w-full rounded-xl border border-[#E2E8F5] bg-white py-[15px] pl-12 pr-12 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute inset-y-0 right-4 flex items-center"
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Submit Reset Button */}
        <button
          type="submit"
          disabled={isPending || !newPassword || !confirmPassword}
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-70 mb-4"
          style={{
            background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
            boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Updating Password...</span>
            </span>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    )
  }

  // ─── Render Step 2: OTP State ───
  if (stepState.step === 'OTP') {
    return (
      <form onSubmit={handleVerifyOtpSubmit} noValidate className="space-y-0" aria-label="OTP verification form">
        {serverError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm"
            style={{ color: '#DC2626' }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2351D9]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-[20px] font-bold text-[#0D1B3E]">Verify Your Email</h2>
          <p className="mt-1 text-xs text-slate-500">
            We sent a verification code to: <strong className="text-slate-800 font-semibold">{stepState.maskedEmail}</strong>
          </p>
        </div>

        {/* 6-Digit OTP Inputs */}
        <div className="mb-6 flex justify-between gap-2">
          {otpDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={inputRefs[idx]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isPending}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              className={cn(
                'h-13 w-12 rounded-xl border text-center text-xl font-bold text-slate-900 outline-none transition-all',
                'focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20',
                digit ? 'border-[#2351D9] bg-blue-50/20' : 'border-[#E2E8F5] bg-white'
              )}
            />
          ))}
        </div>

        {/* Verify OTP Button */}
        <button
          type="submit"
          disabled={isPending || otpDigits.join('').length !== 6}
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-70 mb-4"
          style={{
            background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
            boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verifying OTP...</span>
            </span>
          ) : (
            'Verify OTP'
          )}
        </button>

        <div className="flex items-center justify-between text-xs font-medium text-slate-500 pt-2">
          <button
            type="button"
            onClick={() => {
              setStepState({ step: 'USERNAME' })
              setServerError(null)
            }}
            className="flex items-center gap-1 hover:text-[#2351D9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendTimer > 0 || isPending}
            className={cn(
              'flex items-center gap-1 transition-colors',
              resendTimer > 0 ? 'cursor-not-allowed text-slate-400' : 'hover:text-[#2351D9] text-[#2351D9]'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            <span>{resendTimer > 0 ? `Resend OTP (${resendTimer}s)` : 'Resend OTP'}</span>
          </button>
        </div>
      </form>
    )
  }

  // ─── Render Step 1: Username State ───
  return (
    <form onSubmit={handleUsernameSubmit} noValidate className="space-y-0" aria-label="Forgot password username form">
      {serverError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm"
          style={{ color: '#DC2626' }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="mb-6 text-center">
        <h2 className="text-[20px] font-bold text-[#0D1B3E]">Reset Password</h2>
        <p className="mt-1 text-xs text-slate-500">
          Enter your Super Admin username to receive a password reset code.
        </p>
      </div>

      <div className="mb-6">
        <label htmlFor="username" className="mb-2 block text-[15px] font-semibold" style={{ color: '#0D1B3E' }}>
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <User className="h-5 w-5" style={{ color: '#9CA3AF' }} strokeWidth={1.6} />
          </span>
          <input
            id="username"
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            disabled={isPending}
            className="w-full rounded-xl border border-[#E2E8F5] bg-white py-[15px] pl-12 pr-4 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || !usernameInput.trim()}
        className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:opacity-70 mb-5"
        style={{
          background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
          boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
        }}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Sending Code...</span>
          </span>
        ) : (
          'Send OTP Code'
        )}
      </button>

      <div className="text-center">
        <a
          href="/login"
          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: '#2351D9' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Login</span>
        </a>
      </div>
    </form>
  )
}
