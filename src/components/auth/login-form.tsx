'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck, ArrowLeft, RefreshCw, KeyRound, CheckCircle2 } from 'lucide-react'
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth'
import { cn } from '@/lib/utils'

interface OtpState {
  challengeId: string
  maskedEmail: string
}

interface PinState {
  challengeId: string
}

interface ForgotPinState {
  step: 'OTP' | 'RESET_PIN'
  challengeId: string
  maskedEmail?: string
}

export function LoginForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [showResetPin, setShowResetPin] = useState(false)
  const [showResetConfirmPin, setShowResetConfirmPin] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [otpState, setOtpState] = useState<OtpState | null>(null)
  const [pinState, setPinState] = useState<PinState | null>(null)
  const [forgotPinState, setForgotPinState] = useState<ForgotPinState | null>(null)
  const [forgotPinSuccessMsg, setForgotPinSuccessMsg] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [resetPinInput, setResetPinInput] = useState('')
  const [resetConfirmPinInput, setResetConfirmPinInput] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [forgotPinOtpDigits, setForgotPinOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [resendTimer, setResendTimer] = useState<number>(30)
  const [forgotPinTimer, setForgotPinTimer] = useState<number>(30)
  const [isPending, startTransition] = useTransition()

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const forgotPinInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  })

  // Timer for resend login OTP countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (otpState && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [otpState, resendTimer])

  // Timer for resend forgot PIN OTP countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (forgotPinState?.step === 'OTP' && forgotPinTimer > 0) {
      interval = setInterval(() => {
        setForgotPinTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [forgotPinState, forgotPinTimer])

  // Step 1: Submit Username + Password
  const onSubmitPassword = (data: LoginFormValues) => {
    setServerError(null)
    setForgotPinSuccessMsg(null)
    startTransition(async () => {
      try {
        const cleanUsername = (data.username || '').trim()
        const cleanPassword = data.password || ''

        const response = await fetch('/api/auth/super-admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: cleanUsername,
            password: cleanPassword,
          }),
        })

        let result: any = {}
        try {
          const text = await response.text()
          result = JSON.parse(text)
        } catch {
          result = { success: false, message: response.ok ? 'Unexpected response format' : `Server connection error (${response.status})` }
        }

        const payload = result.data || result
        const isSuccess = response.ok && result.success !== false && payload.success !== false
        const hasChallenge = !!(payload.challengeId || result.challengeId || payload.requireOtp || result.requireOtp)

        const token = payload.token || result.token
        if (token && typeof token === 'string') {
          localStorage.setItem('auth_token', token)
          sessionStorage.setItem('auth_token', token)
        }

        if (isSuccess && (payload.role === 'USER' || payload.role === 'SUB_USER' || payload.redirectTo === '/dashboard')) {
          router.push(payload.redirectTo || '/dashboard')
        } else if (isSuccess && hasChallenge) {
          setOtpState({
            challengeId: payload.challengeId || result.challengeId,
            maskedEmail: payload.maskedEmail || result.maskedEmail || 'registered email',
          })
          setResendTimer(30)
        } else if (isSuccess && payload.redirectTo) {
          router.push(payload.redirectTo)
        } else {
          setServerError(payload.message || result.message || 'Invalid username or password')
        }
      } catch (err: any) {
        console.error('Login error:', err)
        setServerError(err?.message || 'Login request failed. Please check your connection.')
      }
    })
  }

  // Step 2: Submit OTP Verification
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault()
    const otp = otpDigits.join('')
    if (otp.length !== 6) {
      setServerError('Please enter the full 6-digit OTP code')
      return
    }

    if (!otpState?.challengeId) return

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challengeId: otpState.challengeId,
            otp,
          }),
        })

        let result: any = {}
        try {
          const text = await response.text()
          result = JSON.parse(text)
        } catch {
          result = { success: false, message: response.ok ? 'Unexpected response format' : `Server connection error (${response.status})` }
        }

        const payload = result.data || result

        const token = payload.token || result.token
        if (token && typeof token === 'string') {
          localStorage.setItem('auth_token', token)
          sessionStorage.setItem('auth_token', token)
        }

        if (response.ok && payload.success) {
          if (payload.requirePin) {
            setPinState({ challengeId: payload.challengeId || otpState.challengeId })
            setOtpState(null)
          } else {
            router.push('/super-admin/dashboard')
          }
        } else {
          setServerError(payload.message || 'Invalid OTP code')
        }
      } catch (err: any) {
        console.error('OTP verification error:', err)
        setServerError(err?.message || 'OTP verification failed. Please check your connection.')
      }
    })
  }

  // Step 3: Submit PIN Verification
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinInput.trim()) {
      setServerError('Please enter your Security PIN')
      return
    }

    if (!pinState?.challengeId) return

    setServerError(null)
    setForgotPinSuccessMsg(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/verify-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challengeId: pinState.challengeId,
            pin: pinInput.trim(),
          }),
        })

        let result: any = {}
        try {
          const text = await response.text()
          result = JSON.parse(text)
        } catch {
          result = { success: false, message: response.ok ? 'Unexpected response format' : `Server connection error (${response.status})` }
        }

        const payload = result.data || result

        const token = payload.token || result.token
        if (token && typeof token === 'string') {
          localStorage.setItem('auth_token', token)
          sessionStorage.setItem('auth_token', token)
        }

        if (response.ok && payload.success) {
          router.push('/super-admin/dashboard')
        } else {
          setServerError(payload.message || 'Incorrect PIN. Access denied.')
        }
      } catch (err: any) {
        console.error('PIN verification error:', err)
        setServerError(err?.message || 'PIN verification failed. Please check your connection.')
      }
    })
  }

  // ─── Forgot PIN Flow Handlers ───
  const handleStartForgotPin = () => {
    if (!pinState?.challengeId) return
    setServerError(null)
    setForgotPinSuccessMsg(null)

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/forgot-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challengeId: pinState.challengeId,
          }),
        })

        const result = await response.json()
        const payload = result.data || result

        if (response.ok && (payload.success || result.success !== false)) {
          setForgotPinState({
            step: 'OTP',
            challengeId: payload.challengeId || result.challengeId,
            maskedEmail: payload.maskedEmail || result.maskedEmail || 'registered email',
          })
          setForgotPinTimer(30)
          setForgotPinOtpDigits(['', '', '', '', '', ''])
        } else {
          setServerError(payload.message || result.message || 'Failed to send PIN reset OTP')
        }
      } catch (err) {
        console.error('Forgot PIN error:', err)
        setServerError('Failed to send PIN reset OTP')
      }
    })
  }

  const handleVerifyForgotPinOtp = (e: React.FormEvent) => {
    e.preventDefault()
    const otp = forgotPinOtpDigits.join('')
    if (otp.length !== 6) {
      setServerError('Please enter the full 6-digit OTP code')
      return
    }

    if (!forgotPinState?.challengeId) return

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/verify-pin-reset-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challengeId: forgotPinState.challengeId,
            otp,
          }),
        })

        const result = await response.json()
        const payload = result.data || result

        if (response.ok && (payload.success || result.success !== false)) {
          setForgotPinState({
            step: 'RESET_PIN',
            challengeId: payload.challengeId || result.challengeId || forgotPinState.challengeId,
          })
        } else {
          setServerError(payload.message || result.message || 'Invalid OTP code')
        }
      } catch (err) {
        console.error('PIN reset OTP verification error:', err)
        setServerError('Invalid OTP code')
      }
    })
  }

  const handleResetPinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const pin = resetPinInput.trim()
    const confirmPin = resetConfirmPinInput.trim()

    if (!pin || !confirmPin) {
      setServerError('Please enter both New PIN and Confirm PIN')
      return
    }

    if (pin !== confirmPin) {
      setServerError('New PIN and Confirm PIN do not match')
      return
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setServerError('PIN must be 4 to 6 numeric digits')
      return
    }

    if (!forgotPinState?.challengeId) return

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/reset-pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challengeId: forgotPinState.challengeId,
            pin,
            confirmPin,
          }),
        })

        const result = await response.json()
        const payload = result.data || result

        if (response.ok && (payload.success || result.success !== false)) {
          setForgotPinState(null)
          setResetPinInput('')
          setResetConfirmPinInput('')
          setPinInput('')
          setForgotPinSuccessMsg('Security PIN reset successfully! Please enter your new PIN.')
        } else {
          setServerError(payload.message || result.message || 'Failed to reset Security PIN')
        }
      } catch (err) {
        console.error('Reset PIN error:', err)
        setServerError('Failed to reset Security PIN')
      }
    })
  }

  // Resend login OTP
  const handleResendOtp = () => {
    if (resendTimer > 0 || !otpState?.challengeId || isPending) return

    setServerError(null)
    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/super-admin/resend-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            challengeId: otpState.challengeId,
          }),
        })

        const result = await response.json()
        const payload = result.data || result

        if (response.ok && payload.success) {
          setOtpState({
            challengeId: payload.challengeId,
            maskedEmail: payload.maskedEmail || otpState.maskedEmail,
          })
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

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...otpDigits]
    newDigits[index] = value.slice(-1)
    setOtpDigits(newDigits)

    if (value && index < 5) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleForgotPinDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...forgotPinOtpDigits]
    newDigits[index] = value.slice(-1)
    setForgotPinOtpDigits(newDigits)

    if (value && index < 5) {
      forgotPinInputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handleForgotPinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !forgotPinOtpDigits[index] && index > 0) {
      forgotPinInputRefs[index - 1].current?.focus()
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

  const handleForgotPinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const newDigits = [...forgotPinOtpDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || ''
    }
    setForgotPinOtpDigits(newDigits)
    const nextFocus = Math.min(pasted.length, 5)
    forgotPinInputRefs[nextFocus].current?.focus()
  }

  // ─── Render Forgot PIN Step 1: OTP Verification ───
  if (forgotPinState?.step === 'OTP') {
    return (
      <form onSubmit={handleVerifyForgotPinOtp} noValidate className="space-y-0" aria-label="PIN Reset OTP form">
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
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-[20px] font-bold text-[#0D1B3E]">Reset Security PIN</h2>
          <p className="mt-1 text-xs text-slate-500">
            We sent a PIN reset code to: <strong className="text-slate-800 font-semibold">{forgotPinState.maskedEmail}</strong>
          </p>
        </div>

        {/* 6-Digit OTP Inputs */}
        <div className="mb-6 flex justify-between gap-2">
          {forgotPinOtpDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={forgotPinInputRefs[idx]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isPending}
              onChange={(e) => handleForgotPinDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleForgotPinKeyDown(idx, e)}
              onPaste={handleForgotPinPaste}
              className={cn(
                'h-13 w-12 rounded-xl border text-center text-xl font-bold text-slate-900 outline-none transition-all',
                'focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20',
                digit ? 'border-[#2351D9] bg-blue-50/20' : 'border-[#E2E8F5] bg-white'
              )}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={isPending || forgotPinOtpDigits.join('').length !== 6}
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 mb-4"
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
              setForgotPinState(null)
              setServerError(null)
            }}
            className="flex items-center gap-1 hover:text-[#2351D9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to PIN Screen</span>
          </button>

          <button
            type="button"
            onClick={handleStartForgotPin}
            disabled={forgotPinTimer > 0 || isPending}
            className={cn(
              'flex items-center gap-1 transition-colors',
              forgotPinTimer > 0 ? 'cursor-not-allowed text-slate-400' : 'hover:text-[#2351D9] text-[#2351D9]'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
            <span>{forgotPinTimer > 0 ? `Resend OTP (${forgotPinTimer}s)` : 'Resend OTP'}</span>
          </button>
        </div>
      </form>
    )
  }

  // ─── Render Forgot PIN Step 2: New PIN Form ───
  if (forgotPinState?.step === 'RESET_PIN') {
    return (
      <form onSubmit={handleResetPinSubmit} noValidate className="space-y-0" aria-label="Reset PIN form">
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
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-[20px] font-bold text-[#0D1B3E]">Set New Security PIN</h2>
          <p className="mt-1 text-xs text-slate-500">
            Create a new 4-6 digit Security PIN for your account.
          </p>
        </div>

        <div className="mb-4">
          <label htmlFor="resetPinInput" className="mb-2 block text-[15px] font-semibold" style={{ color: '#0D1B3E' }}>
            New Security PIN
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <Lock className="h-5 w-5" style={{ color: '#9CA3AF' }} strokeWidth={1.6} />
            </span>
            <input
              id="resetPinInput"
              type={showResetPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={resetPinInput}
              onChange={(e) => setResetPinInput(e.target.value)}
              placeholder="Enter New PIN"
              disabled={isPending}
              className="w-full rounded-xl border border-[#E2E8F5] bg-white py-[15px] pl-12 pr-12 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20 tracking-widest text-center font-mono font-bold text-lg"
            />
            <button
              type="button"
              onClick={() => setShowResetPin((v) => !v)}
              className="absolute inset-y-0 right-4 flex items-center"
            >
              {showResetPin ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="resetConfirmPinInput" className="mb-2 block text-[15px] font-semibold" style={{ color: '#0D1B3E' }}>
            Confirm New Security PIN
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <Lock className="h-5 w-5" style={{ color: '#9CA3AF' }} strokeWidth={1.6} />
            </span>
            <input
              id="resetConfirmPinInput"
              type={showResetConfirmPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={resetConfirmPinInput}
              onChange={(e) => setResetConfirmPinInput(e.target.value)}
              placeholder="Confirm New PIN"
              disabled={isPending}
              className="w-full rounded-xl border border-[#E2E8F5] bg-white py-[15px] pl-12 pr-12 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20 tracking-widest text-center font-mono font-bold text-lg"
            />
            <button
              type="button"
              onClick={() => setShowResetConfirmPin((v) => !v)}
              className="absolute inset-y-0 right-4 flex items-center"
            >
              {showResetConfirmPin ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || !resetPinInput.trim() || !resetConfirmPinInput.trim()}
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 mb-4"
          style={{
            background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
            boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Saving New PIN...</span>
            </span>
          ) : (
            'Save Security PIN'
          )}
        </button>

        <div className="flex items-center justify-start text-xs font-medium text-slate-500 pt-2">
          <button
            type="button"
            onClick={() => {
              setForgotPinState(null)
              setServerError(null)
            }}
            className="flex items-center gap-1 hover:text-[#2351D9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to PIN Screen</span>
          </button>
        </div>
      </form>
    )
  }

  // ─── Render PIN Verification Form State ───
  if (pinState) {
    return (
      <form onSubmit={handleVerifyPin} noValidate className="space-y-0" aria-label="PIN verification form">
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

        {forgotPinSuccessMsg && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{forgotPinSuccessMsg}</span>
          </div>
        )}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2351D9]">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-[20px] font-bold text-[#0D1B3E]">Enter Security PIN</h2>
          <p className="mt-1 text-xs text-slate-500">
            Please enter your 4-6 digit Super Admin PIN to continue.
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="pinInput" className="text-[15px] font-semibold" style={{ color: '#0D1B3E' }}>
              Security PIN
            </label>
            <button
              type="button"
              onClick={handleStartForgotPin}
              disabled={isPending}
              className="text-[13px] font-medium transition-colors hover:underline"
              style={{ color: '#2351D9' }}
            >
              Forgot PIN?
            </button>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <Lock className="h-5 w-5" style={{ color: '#9CA3AF' }} strokeWidth={1.6} />
            </span>
            <input
              id="pinInput"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              disabled={isPending}
              className="w-full rounded-xl border border-[#E2E8F5] bg-white py-[15px] pl-12 pr-12 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20 tracking-widest text-center font-mono font-bold text-lg"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute inset-y-0 right-4 flex items-center"
            >
              {showPin ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || !pinInput.trim()}
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 mb-4"
          style={{
            background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
            boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Verifying PIN...</span>
            </span>
          ) : (
            'Verify PIN'
          )}
        </button>

        <div className="flex items-center justify-start text-xs font-medium text-slate-500 pt-2">
          <button
            type="button"
            onClick={() => {
              setPinState(null)
              setOtpState(null)
              setServerError(null)
              setPinInput('')
            }}
            className="flex items-center gap-1 hover:text-[#2351D9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Login</span>
          </button>
        </div>
      </form>
    )
  }

  // ─── Render OTP Verification Form State ───
  if (otpState) {
    return (
      <form onSubmit={handleVerifyOtp} noValidate className="space-y-0" aria-label="OTP verification form">
        {/* Server error */}
        {serverError && (
          <div
            role="alert"
            aria-live="assertive"
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
            We sent a verification code to: <strong className="text-slate-800 font-semibold">{otpState.maskedEmail}</strong>
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

        {/* Verify OTP Submit Button */}
        <button
          type="submit"
          disabled={isPending || otpDigits.join('').length !== 6}
          aria-label="Verify OTP"
          className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 mb-4"
          style={{
            background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
            boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>Verifying OTP...</span>
            </span>
          ) : (
            'Verify OTP'
          )}
        </button>

        {/* Resend & Back controls */}
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 pt-2">
          <button
            type="button"
            onClick={() => {
              setOtpState(null)
              setServerError(null)
            }}
            className="flex items-center gap-1 hover:text-[#2351D9] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Login</span>
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

  // ─── Render Step 1: Username & Password Form State ───
  return (
    <form
      onSubmit={handleSubmit(onSubmitPassword)}
      noValidate
      aria-label="Login form"
      className="space-y-0"
    >
      {/* ── Server error ── */}
      {serverError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm"
          style={{ color: '#DC2626' }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <span>{serverError}</span>
        </div>
      )}

      {/* ── Username ── */}
      <div className="mb-5">
        <label
          htmlFor="username"
          className="mb-2 block text-[15px] font-semibold"
          style={{ color: '#0D1B3E' }}
        >
          Username
        </label>
        <div className="relative">
          {/* Left icon */}
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <User
              className="h-5 w-5"
              style={{ color: '#9CA3AF' }}
              aria-hidden="true"
              strokeWidth={1.6}
            />
          </span>
          <input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Enter your username"
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'username-error' : undefined}
            disabled={isPending}
            className={cn(
              'w-full rounded-xl border bg-white py-[15px] pl-12 pr-4 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all',
              'focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20',
              errors.username
                ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                : 'border-[#E2E8F5]'
            )}
            {...register('username')}
          />
        </div>
        {errors.username && (
          <p
            id="username-error"
            role="alert"
            className="mt-1.5 flex items-center gap-1.5 text-xs"
            style={{ color: '#DC2626' }}
          >
            <AlertCircle className="h-3 w-3" />
            {errors.username.message}
          </p>
        )}
      </div>

      {/* ── Password ── */}
      <div className="mb-4">
        <label
          htmlFor="password"
          className="mb-2 block text-[15px] font-semibold"
          style={{ color: '#0D1B3E' }}
        >
          Password
        </label>
        <div className="relative">
          {/* Left icon */}
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            <Lock
              className="h-5 w-5"
              style={{ color: '#9CA3AF' }}
              aria-hidden="true"
              strokeWidth={1.6}
            />
          </span>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            disabled={isPending}
            className={cn(
              'w-full rounded-xl border bg-white py-[15px] pl-12 pr-12 text-[15px] text-slate-800 placeholder-gray-400 outline-none transition-all',
              'focus:border-[#2351D9] focus:ring-2 focus:ring-[#2351D9]/20',
              errors.password
                ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                : 'border-[#E2E8F5]'
            )}
            {...register('password')}
          />
          {/* Right eye icon */}
          <button
            type="button"
            tabIndex={0}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            disabled={isPending}
            className="absolute inset-y-0 right-4 flex items-center transition-colors focus-visible:outline-none"
          >
            {showPassword ? (
              <EyeOff
                className="h-5 w-5 transition-colors hover:text-slate-600"
                style={{ color: '#9CA3AF' }}
                strokeWidth={1.6}
              />
            ) : (
              <Eye
                className="h-5 w-5 transition-colors hover:text-slate-600"
                style={{ color: '#9CA3AF' }}
                strokeWidth={1.6}
              />
            )}
          </button>
        </div>
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="mt-1.5 flex items-center gap-1.5 text-xs"
            style={{ color: '#DC2626' }}
          >
            <AlertCircle className="h-3 w-3" />
            {errors.password.message}
          </p>
        )}
      </div>

      {/* ── Forgot Password ── */}
      <div className="mb-7 flex justify-end">
        <a
          href="/forgot-password"
          className="text-[14px] font-medium transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:underline"
          style={{ color: '#2351D9' }}
          tabIndex={0}
          aria-label="Forgot password"
        >
          Forgot Password?
        </a>
      </div>

      {/* ── Login button ── */}
      <button
        type="submit"
        id="login-submit-btn"
        disabled={isPending}
        aria-label="Login to your account"
        className="w-full rounded-2xl py-[17px] text-[16px] font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          background: 'linear-gradient(135deg, #2351D9 0%, #1A3FB5 100%)',
          boxShadow: '0 6px 20px rgba(35, 81, 217, 0.30)',
        }}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Logging in...</span>
          </span>
        ) : (
          'Login'
        )}
      </button>
    </form>
  )
}
