'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, MapPin, User, Phone, X, ChevronDown, ChevronLeft, Check, Camera, Upload, Trash2, Flag, Eye, Pencil, Filter, Download, ArrowLeft } from 'lucide-react'
import { UserMenu } from '@/components/dashboard/UserMenu'
import { DateInputDMY, toDMY, toISO } from '@/components/dashboard/DateInputDMY'

type SectionType = 'DAILY' | 'WEEKLY' | 'MONTHLY'

interface AreaItem {
  id: string
  name: string
  section?: string
  is_marked?: boolean
}

interface CustomerItem {
  id: string
  user_id: string
  area_id: string
  name: string
  phone: string
  section: SectionType
  is_marked?: boolean
  created_at?: string
  serial_number?: number | null
  photo_url?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  alternative_number?: string | null
  referral_name?: string | null
  referral_number?: string | null
  given_amount?: number | null
  interest_amount?: number | null
  total_amount?: number | null
  installment_amount?: number | null
  given_date?: string | null
  last_date?: string | null
  notes_taken?: boolean
  cheque_taken?: boolean
  additional_details?: string | null
  notes?: string | null
  cheque_details?: string | null
  verified_by_user_id?: string | null
  verified_by_name?: string | null
  verified_by_email?: string | null
  verified_at?: string | null
  paid?: number
  balance?: number
  due_remaining?: string
  due_remaining_is_late?: boolean
  given_payment_method?: string | null
  payments?: PaymentItem[]
  loan_id?: string | null
  loan_number?: number
  is_main_loan?: boolean
  refinanced_from_loan_id?: string | null
  status?: string
}

interface PaymentItem {
  id: string
  customer_id: string
  loan_id?: string | null
  amount: number | string
  payment_method: string
  payment_date: string
  remarks?: string | null
  is_edited?: boolean
  created_at?: string
}

export interface CustomerLoan {
  id: string
  customer_id: string
  user_id: string
  given_amount: number
  interest_amount: number
  total_amount: number
  installment_amount: number
  given_date: string
  last_date: string
  referral_name?: string | null
  referral_number?: string | null
  notes_taken?: boolean
  cheque_taken?: boolean
  additional_details?: string | null
  refinanced_from_loan_id?: string | null
  status?: string
  created_at?: string
  updated_at?: string
}

// Keep references so the Audio object / Web Audio graph isn't GC'd before playback finishes
let _rawSoundData: ArrayBuffer | null = null
let _paymentAudioRef: HTMLAudioElement | null = null
let _audioCtx: AudioContext | null = null
let _audioBuffer: AudioBuffer | null = null
let _currentSource: AudioBufferSourceNode | null = null
let _isPreloading = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (AudioCtx) {
      _audioCtx = new AudioCtx()
    }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {})
  }
  return _audioCtx
}

async function loadSoundData(): Promise<ArrayBuffer | null> {
  if (_rawSoundData) return _rawSoundData
  try {
    const res = await fetch('/sounds/payment-success.wav')
    if (res.ok) {
      _rawSoundData = await res.arrayBuffer()
      return _rawSoundData
    }
  } catch (e) {
    console.warn('Failed to fetch payment sound:', e)
  }
  return null
}

async function getOrDecodeAudioBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (_audioBuffer) return _audioBuffer
  const data = await loadSoundData()
  if (!data) return null
  try {
    // decodeAudioData consumes the passed buffer, so pass a slice to keep cache reusable
    _audioBuffer = await ctx.decodeAudioData(data.slice(0))
    return _audioBuffer
  } catch (e) {
    console.warn('Failed to decode payment sound:', e)
    return null
  }
}

async function preloadPaymentSound() {
  if (typeof window === 'undefined' || _audioBuffer || _isPreloading) return
  _isPreloading = true
  try {
    const ctx = getAudioContext()
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      await getOrDecodeAudioBuffer(ctx)
    } else {
      await loadSoundData()
    }
  } catch {
    // ignore - fallback will handle
  } finally {
    _isPreloading = false
  }
}

// Attach user gesture unlockers once on the client
if (typeof window !== 'undefined') {
  const unlockAndPreload = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    preloadPaymentSound()
  }
  window.addEventListener('pointerdown', unlockAndPreload, { once: true, passive: true })
  window.addEventListener('keydown', unlockAndPreload, { once: true, passive: true })
  window.addEventListener('touchstart', unlockAndPreload, { once: true, passive: true })
}

async function playPaymentSuccessSound() {
  try {
    const ctx = getAudioContext()
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      // Stop previous sound immediately if another payment occurs while playing (prevents overlap)
      if (_currentSource) {
        try {
          _currentSource.stop()
          _currentSource.disconnect()
        } catch {}
        _currentSource = null
      }

      const buffer = await getOrDecodeAudioBuffer(ctx)
      if (buffer) {
        const source = ctx.createBufferSource()
        source.buffer = buffer
        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(0.9, ctx.currentTime)
        source.connect(gainNode)
        gainNode.connect(ctx.destination)
        _currentSource = source
        source.onended = () => {
          if (_currentSource === source) {
            _currentSource = null
          }
        }
        // Sample-accurate start at time 0 (starts from beginning, zero cut-off, zero latency)
        source.start(0)
        return
      }
    }
  } catch (err) {
    console.warn('Web Audio playback failed, falling back:', err)
  }

  // Fallback: HTMLAudioElement with immediate pause/restart to prevent cut-off and overlap
  if (_paymentAudioRef) {
    try {
      _paymentAudioRef.pause()
      _paymentAudioRef.currentTime = 0
    } catch {}
    _paymentAudioRef = null
  }
  try {
    const audio = new Audio('/sounds/payment-success.wav')
    audio.volume = 0.9
    audio.preload = 'auto'
    _paymentAudioRef = audio
    audio.onended = () => { _paymentAudioRef = null }
    audio.onerror = () => { _paymentAudioRef = null }
    const p = audio.play()
    if (p !== undefined) {
      p.catch(() => playSynthesizedPaymentChime())
    }
  } catch {
    playSynthesizedPaymentChime()
  }
}

function playSynthesizedPaymentChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime

    // First tone: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.14)

    // Second chime note: A5 (880.00 Hz) with soft harmonics
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(880.0, now + 0.08)
    gain2.gain.setValueAtTime(0.35, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.55)
  } catch (err) {
    console.warn('Audio chime playback notice:', err)
  }
}

function calculateDueRemaining(givenDateStr?: string | null, lastDateStr?: string | null, section?: string | null) {
  if (!lastDateStr) return { text: '-', isLate: false, weeks: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastDate = new Date(lastDateStr)
  lastDate.setHours(0, 0, 0, 0)

  const diffTime = lastDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  const sec = String(section || 'WEEKLY').toUpperCase()
  const singularUnit = sec === 'DAILY' ? 'day' : sec === 'MONTHLY' ? 'month' : 'week'
  const pluralUnit = sec === 'DAILY' ? 'days' : sec === 'MONTHLY' ? 'months' : 'weeks'

  if (diffDays > 0) {
    const weeks = Math.ceil(diffDays / 7)
    return {
      text: `${weeks} ${weeks === 1 ? singularUnit : pluralUnit} remaining`,
      isLate: false,
      weeks,
    }
  } else if (diffDays === 0) {
    return {
      text: `0 ${pluralUnit} remaining`,
      isLate: false,
      weeks: 0,
    }
  } else {
    const lateDays = Math.abs(diffDays)
    const lateWeeks = Math.max(1, Math.ceil(lateDays / 7))
    return {
      text: `${lateWeeks} ${lateWeeks === 1 ? singularUnit : pluralUnit} late`,
      isLate: true,
      weeks: lateWeeks,
    }
  }
}

function formatDueWithSection(text: string | undefined | null, section?: string | null): string {
  if (!text || text === '-') return text || '-'
  const sec = String(section || 'WEEKLY').toUpperCase()
  const singularUnit = sec === 'DAILY' ? 'day' : sec === 'MONTHLY' ? 'month' : 'week'
  const pluralUnit = sec === 'DAILY' ? 'days' : sec === 'MONTHLY' ? 'months' : 'weeks'

  return text
    .replace(/\b1\s+(?:weeks?|months?|days?)\b/gi, `1 ${singularUnit}`)
    .replace(/\b(\d+)\s+(?:weeks?|months?|days?)\b/gi, (_, num) => {
      const n = parseInt(num, 10)
      return `${n} ${n === 1 ? singularUnit : pluralUnit}`
    })
}

function addWeeksToDate(dateStr: string, weeks: number): string {
  if (!dateStr || isNaN(weeks)) return ''
  try {
    const parts = dateStr.slice(0, 10).split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      d.setDate(d.getDate() + weeks * 7)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    const d = new Date(dateStr)
    d.setDate(d.getDate() + weeks * 7)
    return d.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export function calculateRefinanceDurationLastDate(gDate: string, sec: SectionType, num: number): string {
  if (!gDate || isNaN(num) || num <= 0) return ''
  const parts = gDate.slice(0, 10).split('-')
  if (parts.length !== 3) return ''
  const yr = parseInt(parts[0], 10)
  const mo = parseInt(parts[1], 10) - 1
  const dy = parseInt(parts[2], 10)
  if (isNaN(yr) || isNaN(mo) || isNaN(dy)) return ''

  if (sec === 'DAILY') {
    const d = new Date(yr, mo, dy)
    d.setDate(d.getDate() + num)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } else if (sec === 'WEEKLY') {
    const d = new Date(yr, mo, dy)
    d.setDate(d.getDate() + num * 7)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } else if (sec === 'MONTHLY') {
    const totalMonths = mo + num
    const targetYear = yr + Math.floor(totalMonths / 12)
    const targetMonth = ((totalMonths % 12) + 12) % 12
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate()
    const targetDay = Math.min(dy, maxDay)
    const yyyy = targetYear
    const mm = String(targetMonth + 1).padStart(2, '0')
    const dd = String(targetDay).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return ''
}


function getWeeksBetweenDates(startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 0
  try {
    const s = new Date(startStr.slice(0, 10))
    const e = new Date(endStr.slice(0, 10))
    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, Math.round(diffDays / 7))
  } catch {
    return 0
  }
}

function getElapsedDays(startStr?: string | null, endStr?: string | null): number {
  if (!startStr || !endStr) return 1
  try {
    const sIso = toISO(startStr) || startStr.slice(0, 10)
    const eIso = toISO(endStr) || endStr.slice(0, 10)
    const sParts = sIso.split('-')
    const eParts = eIso.split('-')
    if (sParts.length === 3 && eParts.length === 3) {
      const s = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10))
      const e = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10))
      const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(1, diffDays)
    }
    const s = new Date(startStr)
    const e = new Date(endStr)
    s.setHours(0, 0, 0, 0)
    e.setHours(0, 0, 0, 0)
    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  } catch {
    return 1
  }
}

function calculateLoanBalanceAndPaid(
  loanId: string,
  givenAmount: number | null | undefined,
  totalAmount: number | null | undefined,
  recordedPaymentsSum: number,
  additionalLoansList: CustomerLoan[]
): { paid: number; balance: number; isRefinanced: boolean } {
  const t = Number(totalAmount || 0)
  const p = Number(recordedPaymentsSum || 0)

  const refChild = (additionalLoansList || []).find((al) => al.refinanced_from_loan_id === loanId)
  const isRefinanced = Boolean(refChild)

  return { paid: p, balance: Math.max(0, t - p), isRefinanced }
}

function getCustomerDueStatus(customer: CustomerItem): {
  weeks: number
  isLate: boolean
  isHighRisk: boolean
  statusColor: 'green' | 'orange' | 'red'
  text: string
} {
  // If customer has last_date, compute dynamically based on current date
  const dueInfo = customer.last_date
    ? calculateDueRemaining(customer.given_date, customer.last_date, customer.section)
    : customer.due_remaining
    ? {
        text: formatDueWithSection(customer.due_remaining, customer.section),
        isLate: Boolean(customer.due_remaining_is_late),
        weeks: customer.due_remaining.match(/^(\d+)/)
          ? parseInt(customer.due_remaining.match(/^(\d+)/)![1], 10)
          : 0,
      }
    : { text: '-', isLate: false, weeks: 0 }

  // 1. Overdue / late -> High Risk
  if (dueInfo.isLate) {
    return { weeks: 0, isLate: true, isHighRisk: true, statusColor: 'red', text: dueInfo.text }
  }

  // 2. 0 remaining / due date reached -> High Risk
  const weeksMatch = dueInfo.text?.match(/^(\d+)/)
  const weeksNum = weeksMatch ? parseInt(weeksMatch[1], 10) : dueInfo.weeks

  if (weeksNum === 0 || dueInfo.text?.toLowerCase().includes('0 week') || dueInfo.text?.toLowerCase().includes('0 day') || dueInfo.text?.toLowerCase().includes('0 month')) {
    return { weeks: 0, isLate: false, isHighRisk: true, statusColor: 'red', text: dueInfo.text }
  }

  // 3. 1 or 2 remaining -> Warning / Orange
  if (weeksNum <= 2) {
    return { weeks: weeksNum, isLate: false, isHighRisk: false, statusColor: 'orange', text: dueInfo.text }
  }

  // 4. 3+ remaining -> Normal / Green
  return { weeks: weeksNum, isLate: false, isHighRisk: false, statusColor: 'green', text: dueInfo.text }
}

/**
 * Client-side canvas image compression to ensure photo is <= 50 KB (51,200 bytes)
 */
async function compressImageToMax50KB(file: File): Promise<{ dataUrl: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.onload = (e) => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        const maxDim = 800
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable'))
          return
        }
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        let quality = 0.82
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        const targetBytes = 50 * 1024

        function getApproxBytes(dUrl: string) {
          const b64 = dUrl.split(',')[1] || dUrl
          return Math.round((b64.length * 3) / 4)
        }

        let iterations = 0
        while (getApproxBytes(dataUrl) > targetBytes && iterations < 12) {
          iterations++
          quality = Math.max(0.1, quality - 0.12)
          if (iterations > 3 && (width > 240 || height > 240)) {
            width = Math.round(width * 0.8)
            height = Math.round(height * 0.8)
            canvas.width = width
            canvas.height = height
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, width, height)
          }
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        const finalBytes = getApproxBytes(dataUrl)
        const sizeKb = Math.round((finalBytes / 1024) * 10) / 10
        resolve({ dataUrl, sizeKb })
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

interface AreaDetailsClientProps {
  userName: string
  initialArea: AreaItem
  userAreas: AreaItem[]
  initialCustomers?: CustomerItem[]
  initialCache?: Record<string, CustomerItem[]>
}

function getInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts.map((part) => part[0].toUpperCase()).join('')
}

const sectionDisplayMap: Record<SectionType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
}

const DETERMINISTIC_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
]

function formatDeterministicDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '-'
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim()
    // Match DD-MMM-YYYY, DD/MMM/YYYY, or DD MMM YYYY (e.g. 08-Sept-2026 -> 08 Sept 2026)
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]+)[-/\s](\d{4})$/)
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0')
      let month = dmyMatch[2]
      const monthLower = month.toLowerCase()
      const foundMonth = DETERMINISTIC_MONTHS.find((m) => m.toLowerCase().startsWith(monthLower.slice(0, 3)))
      if (foundMonth) month = foundMonth
      return `${day} ${month} ${dmyMatch[3]}`
    }
    // Match YYYY-MM-DD or ISO strings starting with YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      const year = isoMatch[1]
      const monthIndex = parseInt(isoMatch[2], 10) - 1
      const day = isoMatch[3].padStart(2, '0')
      return `${day} ${DETERMINISTIC_MONTHS[monthIndex] || isoMatch[2]} ${year}`
    }
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (!d || isNaN(d.getTime())) return '-'
  const day = String(d.getDate()).padStart(2, '0')
  const month = DETERMINISTIC_MONTHS[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

function formatPaymentDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-'

  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (!d || isNaN(d.getTime())) {
    return typeof dateInput === 'string' ? dateInput : '-'
  }

  // Format explicitly using Asia/Kolkata (IST, UTC+5:30)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const parts = formatter.formatToParts(d)
  const partMap: Record<string, string> = {}
  for (const p of parts) {
    partMap[p.type] = p.value
  }

  let month = partMap.month || ''
  if (month.toLowerCase().startsWith('sep')) {
    month = 'Sept'
  }

  const day = (partMap.day || '').padStart(2, '0')
  const year = partMap.year || ''
  const hour = (partMap.hour || '').padStart(2, '0')
  const minute = (partMap.minute || '').padStart(2, '0')
  const dayPeriod = (partMap.dayPeriod || 'AM').toUpperCase()

  const hasTime =
    typeof dateInput === 'string'
      ? dateInput.includes('T') || dateInput.includes(':')
      : true

  if (hasTime) {
    return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`
  }

  return `${day} ${month} ${year}`
}

function parseFilterDate(filterStr: string): { year: number; month: number; day: number } | null {
  if (!filterStr) return null
  const trimmed = filterStr.trim()

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmyMatch) {
    return {
      day: parseInt(dmyMatch[1], 10),
      month: parseInt(dmyMatch[2], 10),
      year: parseInt(dmyMatch[3], 10),
    }
  }

  return null
}

function paymentMatchesDateFilter(
  payment: { payment_date?: string | Date | null; created_at?: string | Date | null },
  filterStr: string
): boolean {
  if (!filterStr) return true
  const filter = parseFilterDate(filterStr)
  if (!filter) return true

  // 1. Match payment_date (stored business payment date)
  if (payment.payment_date) {
    const raw = String(payment.payment_date).trim()
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10)
      const m = parseInt(isoMatch[2], 10)
      const d = parseInt(isoMatch[3], 10)
      if (y === filter.year && m === filter.month && d === filter.day) {
        return true
      }
    }
    const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10)
      const m = parseInt(dmyMatch[2], 10)
      const y = parseInt(dmyMatch[3], 10)
      if (y === filter.year && m === filter.month && d === filter.day) {
        return true
      }
    }
  }

  // 2. Match created_at timestamp explicitly in Asia/Kolkata (IST) timezone
  const timestamp = payment.created_at || payment.payment_date
  if (timestamp) {
    const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    if (d && !isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d)
      let y = 0, m = 0, dayVal = 0
      for (const p of parts) {
        if (p.type === 'year') y = parseInt(p.value, 10)
        if (p.type === 'month') m = parseInt(p.value, 10)
        if (p.type === 'day') dayVal = parseInt(p.value, 10)
      }
      if (y === filter.year && m === filter.month && dayVal === filter.day) {
        return true
      }
    }
  }

  return false
}

function getPaymentDateAndTime(payment: PaymentItem): { date: string; time: string } {
  const raw = payment.created_at || payment.payment_date
  if (!raw) {
    const now = new Date()
    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
    return { date: dStr, time: '12:00' }
  }

  const d = typeof raw === 'string' ? new Date(raw) : raw
  if (isNaN(d.getTime())) {
    return {
      date: payment.payment_date || '',
      time: '12:00',
    }
  }

  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const h = timeParts.find((p) => p.type === 'hour')?.value || '12'
  const m = timeParts.find((p) => p.type === 'minute')?.value || '00'

  return {
    date: dateStr,
    time: `${h.padStart(2, '0')}:${m.padStart(2, '0')}`,
  }
}

/**
 * Format a numeric value for display as money.
 * - Strips trailing ".00" (e.g. 120.00 → "120", 10000.00 → "10,000").
 * - Preserves meaningful decimals (e.g. 120.50 → "120.50", 120.25 → "120.25").
 * - Returns the en-IN thousands-separated integer if no decimal or decimal is ".0" / ".00".
 */
function formatCleanMoney(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return ''
  let s = String(val).trim()
  // Strip currency symbol or commas if already formatted
  s = s.replace(/^[₹\s]+/, '').replace(/,/g, '')
  if (!s) return ''
  const dotIdx = s.indexOf('.')
  if (dotIdx === -1) {
    // No decimal — just format with thousands separator
    const n = Number(s)
    if (isNaN(n)) return s
    return n.toLocaleString('en-IN')
  }
  const intPart = Number(s.slice(0, dotIdx))
  const decPart = s.slice(dotIdx + 1)
  if (isNaN(intPart)) return s
  const intFormatted = intPart.toLocaleString('en-IN')
  // Drop .00 or .0
  if (decPart === '00' || decPart === '0') {
    return intFormatted
  }
  // Pad single trailing digit to two decimal places for clarity (e.g. .5 → .50)
  const decDisplay = decPart.length === 1 ? decPart + '0' : decPart
  return intFormatted + '.' + decDisplay
}

/**
 * Format a numeric value for an <input type="number"> defaultValue / value.
 * - Strips trailing ".00" (e.g. "120.00" → "120").
 * - Preserves meaningful decimals (e.g. "120.50" stays "120.50").
 */
function formatInputClean(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return ''
  const s = String(val).trim()
  if (/\.00$/.test(s)) {
    return s.slice(0, -3)
  }
  // Also handle ".0" at end
  if (/\.0$/.test(s)) {
    return s.slice(0, -2)
  }
  return s
}

interface PaymentHistorySectionProps {
  customer: CustomerItem
  paymentInputAmount: string
  setPaymentInputAmount: (val: string) => void
  paymentRemarks?: string
  setPaymentRemarks?: (val: string) => void
  paymentMethod: 'Cash' | 'UPI' | 'Account'
  setPaymentMethod: (val: 'Cash' | 'UPI' | 'Account') => void
  isRecordingPayment: boolean
  paymentFormError: string
  setPaymentFormError: (val: string) => void
  handleRecordPayment: (
    e?: React.FormEvent,
    methodOverride?: 'Cash' | 'UPI' | 'Account',
    amountOverride?: number
  ) => void
  handleUpdatePayment?: (
    paymentId: string,
    updatedData: {
      amount: number
      payment_method: 'Cash' | 'UPI' | 'Account'
      payment_date: string
      created_at: string
      remarks?: string | null
    }
  ) => Promise<{ success: boolean; error?: string }>
  isDetailsExpanded: boolean
  setIsDetailsExpanded: React.Dispatch<React.SetStateAction<boolean>>
  showManualPayment?: boolean
  showInstallmentButtons?: boolean
  showEyeIcon?: boolean
  additionalLoansCount?: number
  selectedLoanIndex?: number
  onSelectLoanIndex?: (idx: number) => void
}

function PaymentHistorySection({
  customer,
  paymentInputAmount,
  setPaymentInputAmount,
  paymentRemarks = '',
  setPaymentRemarks,
  paymentMethod,
  setPaymentMethod,
  isRecordingPayment,
  paymentFormError,
  setPaymentFormError,
  handleRecordPayment,
  handleUpdatePayment,
  isDetailsExpanded,
  setIsDetailsExpanded,
  showManualPayment = false,
  showInstallmentButtons = true,
  showEyeIcon = true,
  additionalLoansCount = 0,
  selectedLoanIndex = 0,
  onSelectLoanIndex,
}: PaymentHistorySectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevPaymentsCountRef = useRef<number | null>(null)

  // Date filter state — empty string means no filter (show all)
  const [dateFilter, setDateFilter] = useState<string>('')

  // Edit payment state
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null)
  const [editAmount, setEditAmount] = useState<string>('')
  const [editMethod, setEditMethod] = useState<'Cash' | 'UPI' | 'Account'>('Cash')
  const [editDate, setEditDate] = useState<string>('')
  const [editTime, setEditTime] = useState<string>('')
  const [editRemarks, setEditRemarks] = useState<string>('')
  const [editError, setEditError] = useState<string>('')
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false)

  const openEditPayment = (payment: PaymentItem) => {
    setEditingPayment(payment)
    setEditAmount(formatInputClean(payment.amount))
    const m = String(payment.payment_method || 'cash').toUpperCase()
    setEditMethod(m === 'UPI' ? 'UPI' : m === 'ACCOUNT' ? 'Account' : 'Cash')
    const dt = getPaymentDateAndTime(payment)
    setEditDate(dt.date)
    setEditTime(dt.time)
    setEditRemarks(payment.remarks || '')
    setEditError('')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPayment || !handleUpdatePayment) return

    const num = parseFloat(editAmount)
    if (!num || isNaN(num) || num <= 0) {
      setEditError('Please enter a valid amount greater than 0.')
      return
    }

    if (!editDate) {
      setEditError('Please select a payment date.')
      return
    }

    // Check balance limit: total loan amount minus other payments
    const otherPaid = (customer.payments || [])
      .filter((p) => p.id !== editingPayment.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const totalAmount = Number(customer.total_amount || 0)
    const maxAllowed = Math.max(0, totalAmount - otherPaid)

    if (num > maxAllowed) {
      setEditError(
        `Amount (₹${num.toLocaleString('en-IN')}) cannot exceed remaining balance limit of ₹${maxAllowed.toLocaleString('en-IN')}.`
      )
      return
    }

    setIsSavingEdit(true)
    setEditError('')

    // Construct local timestamp in IST (+05:30)
    const timeStr = editTime || '12:00'
    const isoCandidate = `${editDate}T${timeStr}:00+05:30`
    const d = new Date(isoCandidate)
    const createdAtIso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()

    const result = await handleUpdatePayment(editingPayment.id, {
      amount: num,
      payment_method: editMethod,
      payment_date: editDate,
      created_at: createdAtIso,
      remarks: editRemarks.trim() || null,
    })

    setIsSavingEdit(false)

    if (!result.success) {
      setEditError(result.error || 'Failed to update payment.')
      return
    }

    playPaymentSuccessSound();
    setEditingPayment(null)
  }

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [customer.id])

  useEffect(() => {
    const currentCount = customer.payments?.length || 0
    // Only auto-scroll when a new payment is added during the session
    if (prevPaymentsCountRef.current !== null && currentCount > prevPaymentsCountRef.current) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      }
    }
    prevPaymentsCountRef.current = currentCount
  }, [customer.payments?.length])

  const givenDateFormatted = formatDeterministicDate(customer.given_date)

  const givenMethod =
    (customer as any).given_payment_method?.toUpperCase() === 'UPI'
      ? 'UPI'
      : (customer as any).given_payment_method?.toUpperCase() === 'ACCOUNT'
      ? 'Account'
      : 'Cash'

  const remainingBalance = Number(customer.balance ?? (customer.total_amount || 0))

  // Filter payments by selected date. If no date selected, show all.
  const filteredPayments = dateFilter
    ? (customer.payments || []).filter((p) => {
        return paymentMatchesDateFilter(p, dateFilter)
      })
    : (customer.payments || [])

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] w-full flex-1 min-h-0 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-5 pt-3.5 sm:pt-4 pb-2.5 sm:pb-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <h3
            onClick={() => {
              if (selectedLoanIndex !== 0 && onSelectLoanIndex) {
                onSelectLoanIndex(0)
              }
            }}
            className={`text-xs sm:text-sm font-bold uppercase tracking-wider shrink-0 transition-colors ${
              additionalLoansCount > 0 && selectedLoanIndex !== 0
                ? 'text-slate-500 hover:text-[#1B52E8] cursor-pointer'
                : 'text-[#0D1B3E]'
            }`}
            title={selectedLoanIndex !== 0 ? 'Click to view Main Loan' : undefined}
          >
            Payment History
          </h3>

          {/* Loan Indicator Buttons beside PAYMENT HISTORY */}
          {additionalLoansCount > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* If not on Main Loan, show button "1" to switch back to Main Loan */}
              {selectedLoanIndex !== 0 && (
                <button
                  type="button"
                  id="btn-loan-indicator-1"
                  onClick={() => onSelectLoanIndex?.(0)}
                  title="Main Loan Payment History"
                  className="inline-flex items-center justify-center w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full text-[11px] font-bold bg-[#EBF3FF] text-[#1B52E8] border border-[#1B52E8]/30 hover:bg-blue-100/80 active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  1
                </button>
              )}

              {/* Additional Loan Indicators: 2, 3, etc. */}
              {Array.from({ length: additionalLoansCount }, (_, i) => {
                const loanNum = i + 2
                const isSelected = selectedLoanIndex === i + 1
                return (
                  <button
                    key={loanNum}
                    type="button"
                    id={`btn-loan-indicator-${loanNum}`}
                    onClick={() => onSelectLoanIndex?.(i + 1)}
                    title={`Additional Loan #${loanNum - 1} Payment History`}
                    className={`inline-flex items-center justify-center w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      isSelected
                        ? 'bg-[#1B52E8] text-white border border-[#1B52E8] shadow-xs'
                        : 'bg-[#EBF3FF] text-[#1B52E8] border border-[#1B52E8]/30 hover:bg-blue-100/80'
                    }`}
                  >
                    {loanNum}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {/* Right side: Eye Icon (optional) + Date Filter */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Eye Icon — toggles customer details */}
          {showEyeIcon && (
            <button
              type="button"
              aria-label="Toggle customer details"
              onClick={() => setIsDetailsExpanded((prev) => !prev)}
              className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all cursor-pointer border shadow-2xs shrink-0 ${
                isDetailsExpanded
                  ? 'bg-[#EBF3FF] text-[#1B52E8] border-[#1B52E8]/30'
                  : 'bg-white text-slate-500 border-slate-200/80 hover:text-[#1B52E8] hover:border-[#1B52E8]/40'
              }`}
              title="Toggle customer details"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}

          {/* Date Filter: [ DD/MM/YYYY + Calendar Icon ] */}
            <DateInputDMY
            value={dateFilter}
            onChange={setDateFilter}
            onClear={() => setDateFilter('')}
            showCalendarIcon={true}
            aria-label="Filter payments by date"
            className="h-8 rounded-lg border border-slate-200 bg-white pl-2.5 pr-8 text-[11px] font-semibold text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-1 focus:ring-[#1B52E8]/20 outline-none transition-all cursor-pointer"
            wrapperClassName="h-8 w-[130px] sm:w-[135px] shrink-0"
          />
        </div>
      </div>

      {/* ── Scrollable Ledger Cards (occupies the full space between header and manual payment) ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 sm:py-3.5 space-y-3 sm:space-y-3.5 overscroll-contain"
      >
        {/* 1. TOTAL AMOUNT — LEFT SIDE (BLUE) */}
        <div className="flex justify-start w-full">
          <div className="w-[85%] sm:w-[70%] max-w-[340px] rounded-2xl bg-blue-50/90 border border-blue-200/90 p-3.5 sm:p-4 shadow-2xs">
            <div suppressHydrationWarning className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">
              {givenDateFormatted}
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#1B52E8] tracking-tight">
              ₹{formatCleanMoney(customer.total_amount || 0)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1B52E8]">
              <span>Given ↑</span>
              <span className="font-semibold text-slate-600">{givenMethod}</span>
            </div>
          </div>
        </div>

        {/* 2. PAYMENT RECEIVED — RIGHT SIDE (GREEN) — filtered by date if selected */}
        {filteredPayments.length > 0 ? (
          <>
            {filteredPayments.map((payment) => {
              const dateFormatted = formatPaymentDateTime(payment.created_at || payment.payment_date)
              const methodRaw = String(payment.payment_method || 'cash').toLowerCase()
              const methodLabel = methodRaw === 'upi' ? 'UPI' : methodRaw === 'account' ? 'Account' : 'Cash'

              return (
                <div
                  key={payment.id}
                  className="flex justify-end w-full animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <div className="w-[85%] sm:w-[70%] max-w-[340px] rounded-2xl bg-emerald-50/90 border border-emerald-200/90 p-3.5 sm:p-4 shadow-2xs text-right">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => openEditPayment(payment)}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200/90 px-2 py-0.5 rounded-lg border border-emerald-300/60 transition-all cursor-pointer shadow-2xs shrink-0"
                        title="Edit payment"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {Boolean(payment.is_edited) && (
                          <span className="text-[11px] font-semibold text-emerald-700/80 italic">
                            Edited
                          </span>
                        )}
                        <span suppressHydrationWarning className="text-[11px] sm:text-xs font-semibold text-slate-500">
                          {dateFormatted}
                        </span>
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                      ₹{formatCleanMoney(payment.amount)}
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1.5 text-xs sm:text-sm font-bold text-emerald-600">
                      <span>Received ↓</span>
                      <span className="font-semibold text-slate-600">{methodLabel}</span>
                    </div>
                    {Boolean(payment.remarks && payment.remarks.trim()) && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-200/70 text-left">
                        <div className="text-[10px] sm:text-[11px] font-bold text-emerald-800 tracking-wide uppercase">
                          Remarks
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-[#0D1B3E] break-words whitespace-pre-wrap mt-0.5">
                          {payment.remarks!.trim()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        ) : dateFilter && (customer.payments || []).length > 0 ? (
          <div className="py-6 text-center text-xs font-semibold text-slate-400">
            No payments on {toDMY(dateFilter) || formatDeterministicDate(dateFilter)}
          </div>
        ) : null}
      </div>

      {/* ── Payment Section — sticky at bottom of card ── */}
      {(showInstallmentButtons || showManualPayment) && (
        <div className="shrink-0 bg-white border-t border-slate-100 px-4 sm:px-5 pt-2.5 sm:pt-3 pb-3 sm:pb-3.5 space-y-2.5">
          {/* 1. Installment Options Section (Above manual payment section) */}
          {showInstallmentButtons && (
            <div>
              {/* Installment Amount header row */}
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#0D1B3E] mb-1.5">
                <span>Installment Amount</span>
                <span>
                  ₹{customer.installment_amount != null ? formatCleanMoney(customer.installment_amount) : '0'}
                </span>
              </div>


              {/* Two options side by side: [Installment with Cash] [Installment with UPI] */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleRecordPayment(
                      undefined,
                      'Cash',
                      Number(customer.installment_amount || 0)
                    )
                  }
                  disabled={
                    isRecordingPayment ||
                    remainingBalance <= 0 ||
                    !customer.installment_amount ||
                    Number(customer.installment_amount) <= 0
                  }
                  className="py-2 px-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] active:scale-[0.98] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs flex items-center justify-center text-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isRecordingPayment && paymentMethod === 'Cash' && !paymentInputAmount
                    ? '...'
                    : 'Installment with Cash'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRecordPayment(
                      undefined,
                      'UPI',
                      Number(customer.installment_amount || 0)
                    )
                  }
                  disabled={
                    isRecordingPayment ||
                    remainingBalance <= 0 ||
                    !customer.installment_amount ||
                    Number(customer.installment_amount) <= 0
                  }
                  className="py-2 px-2.5 rounded-xl bg-[#1B52E8] hover:bg-[#1542C2] active:scale-[0.98] text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs flex items-center justify-center text-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isRecordingPayment && paymentMethod === 'UPI' && !paymentInputAmount
                    ? '...'
                    : 'Installment with UPI'}
                </button>
              </div>
            </div>
          )}

          {/* 2. Manual Payment Section (Shown ONLY on First / Main page) */}
          {showManualPayment && (
            <form onSubmit={(e) => handleRecordPayment(e)}>
              <div className="text-xs sm:text-sm font-bold text-[#0D1B3E] mb-1.5">
                Enter Amount Manually
              </div>

              {/* Single row: [ ₹ Amount | Method dropdown ▾ | Add ] */}
              <div className="flex items-center gap-2">
                {/* Amount Input */}
                <div className="relative flex-1 min-w-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={remainingBalance > 0 ? remainingBalance : undefined}
                    step="any"
                    value={paymentInputAmount}
                    onChange={(e) => {
                      setPaymentInputAmount(e.target.value)
                      if (paymentFormError) setPaymentFormError('')
                    }}
                    placeholder="Enter amount"
                    disabled={isRecordingPayment || remainingBalance <= 0}
                    className="w-full pl-7 pr-2.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-[#0D1B3E] placeholder:text-slate-400 placeholder:font-normal focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                {/* Payment Method dropdown: Cash / UPI / Account */}
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'UPI' | 'Account')}
                  disabled={isRecordingPayment || remainingBalance <= 0}
                  className="shrink-0 h-[38px] sm:h-[42px] px-2 sm:px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Account">Account</option>
                </select>

                {/* Add Button */}
                <button
                  type="submit"
                  disabled={
                    isRecordingPayment ||
                    !paymentInputAmount ||
                    parseFloat(paymentInputAmount) <= 0 ||
                    parseFloat(paymentInputAmount) > remainingBalance ||
                    remainingBalance <= 0
                  }
                  className="py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-xl bg-[#1B52E8] text-white font-bold text-xs sm:text-sm hover:bg-[#1542C2] active:scale-[0.98] transition-all cursor-pointer shadow-2xs shrink-0 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isRecordingPayment && paymentInputAmount ? '...' : 'Add'}
                </button>
              </div>

              {/* Remarks Field (Shown ONLY when user has entered an amount) */}
              {Boolean(paymentInputAmount && paymentInputAmount.trim() !== '') && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={paymentRemarks || ''}
                    onChange={(e) => setPaymentRemarks?.(e.target.value)}
                    placeholder="Remarks (optional)"
                    disabled={isRecordingPayment}
                    className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-[#0D1B3E] placeholder:text-slate-400 focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              )}
            </form>
          )}

          {paymentFormError && (
            <div className="mt-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 animate-in fade-in duration-150">
              {paymentFormError}
            </div>
          )}

          {remainingBalance <= 0 && (
            <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
              All payments settled! Balance is ₹0.
            </div>
          )}
        </div>
      )}

      {/* ── Edit Payment Modal ── */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Pencil className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-[#0D1B3E]">Edit Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPayment(null)
                  setEditError('')
                }}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 flex flex-col">
              {editError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-xs font-semibold text-rose-600 animate-in fade-in">
                  {editError}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-[#0D1B3E] mb-1">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={editAmount}
                    onChange={(e) => {
                      setEditAmount(e.target.value)
                      if (editError) setEditError('')
                    }}
                    placeholder="Enter amount"
                    disabled={isSavingEdit}
                    required
                    className="w-full pl-7 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-[#0D1B3E] mb-1">
                  Payment Method
                </label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value as 'Cash' | 'UPI' | 'Account')}
                  disabled={isSavingEdit}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Account">Account</option>
                </select>
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#0D1B3E] mb-1">
                    Date
                  </label>
                  <DateInputDMY
                    value={editDate}
                    onChange={(v) => {
                      setEditDate(v)
                      if (editError) setEditError('')
                    }}
                    disabled={isSavingEdit}
                    required
                    className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0D1B3E] mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => {
                      setEditTime(e.target.value)
                      if (editError) setEditError('')
                    }}
                    disabled={isSavingEdit}
                    required
                    className="w-full px-2.5 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all cursor-pointer"
                    style={{ colorScheme: 'light' }}
                  />
                </div>
              </div>

              {/* Remarks (optional) */}
              <div>
                <label className="block text-xs font-bold text-[#0D1B3E] mb-1">
                  Remarks (optional)
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Remarks (optional)"
                  disabled={isSavingEdit}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-[#0D1B3E] placeholder:text-slate-400 focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/10 outline-none transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPayment(null)
                    setEditError('')
                  }}
                  disabled={isSavingEdit}
                  className="px-3.5 sm:px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editAmount || parseFloat(editAmount) <= 0}
                  className="px-4 sm:px-5 py-2 rounded-xl bg-[#1B52E8] hover:bg-[#1542C2] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function AreaDetailsClient({
  userName,
  initialArea,
  userAreas,
  initialCustomers = [],
  initialCache = {},
}: AreaDetailsClientProps) {
  const router = useRouter()

  const initialSection = (
    initialArea?.section && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(initialArea.section.toUpperCase())
      ? initialArea.section.toUpperCase()
      : 'DAILY'
  ) as SectionType

  const [activeSection, setActiveSection] = useState<SectionType>(initialSection)
  const [areasList, setAreasList] = useState<AreaItem[]>(userAreas)
  const [selectedArea, setSelectedArea] = useState<AreaItem | null>(initialArea)
  const [isFlagFilterActive, setIsFlagFilterActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customerRiskFilter, setCustomerRiskFilter] = useState<'ALL' | 'HIGH_RISK'>('ALL')
  const [isRiskFilterOpen, setIsRiskFilterOpen] = useState(false)
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsRiskFilterOpen(false)
      }
    }
    if (isRiskFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isRiskFilterOpen])
  const [customers, setCustomers] = useState<CustomerItem[]>(initialCustomers)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setAreasList(userAreas)
  }, [userAreas])

  useEffect(() => {
    preloadPaymentSound()
  }, [])

  // In-memory cache to reuse already fetched customer lists across areas & sections (0ms switch)
  const customerCacheRef = useRef<Record<string, CustomerItem[]>>({
    ...initialCache,
    [`${initialArea?.id}_${initialSection}`]: initialCustomers,
  })

  // AbortController ref to cancel obsolete in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Section dropdown state
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false)

  // Area dropdown state
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false)

  // Add Customer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newCustomerSection, setNewCustomerSection] = useState<SectionType>(initialSection)
  const [modalAreaId, setModalAreaId] = useState<string>(initialArea?.id || '')
  const [isModalSectionOpen, setIsModalSectionOpen] = useState(false)
  const [isModalAreaOpen, setIsModalAreaOpen] = useState(false)

  // 1. Upload Photo state
  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null)
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // 2. S.no*
  const [serialNumber, setSerialNumber] = useState<string>('')
  const [serialNumberError, setSerialNumberError] = useState<string>('')

  // 3. Name*
  const [newCustomerName, setNewCustomerName] = useState('')

  // 4. Phone Number*
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  // 5. Address (with location icon & geocoding)
  const [address, setAddress] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')

  // 6. Alternative Number
  const [alternativeNumber, setAlternativeNumber] = useState('')

  // 7. Referral Name
  const [referralName, setReferralName] = useState('')

  // 8. Referral Number
  const [referralNumber, setReferralNumber] = useState('')

  // 9. Given Amount*
  const [givenAmount, setGivenAmount] = useState('')

  // 10. Interest Amount*
  const [interestAmount, setInterestAmount] = useState('')

  // 11. Total Amount*
  const [totalAmount, setTotalAmount] = useState('')
  const [isTotalOverridden, setIsTotalOverridden] = useState(false)

  // Installment Amount*
  const [installmentAmount, setInstallmentAmount] = useState('')

  // 12. Given Date*
  const [givenDate, setGivenDate] = useState('')

  // 13. Last Date*
  const [lastDate, setLastDate] = useState('')

  // Duration picker (beside Last Date): driven dynamically by newCustomerSection ('DAILY' -> Days, 'WEEKLY' -> Weeks, 'MONTHLY' -> Months)
  const [addFormDuration, setAddFormDuration] = useState('')

  // Additional Info: Checkboxes
  const [notesTaken, setNotesTaken] = useState(false)
  const [chequeTaken, setChequeTaken] = useState(false)

  // Additional Info: Single multiline field
  const [additionalDetails, setAdditionalDetails] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Preload payment sound on mount and on first user interaction so the first payment doesn't cut off
  useEffect(() => {
    preloadPaymentSound()
    const handleFirstInteraction = () => {
      getAudioContext()
      preloadPaymentSound()
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
    document.addEventListener('click', handleFirstInteraction, { once: true, passive: true })
    document.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true })
    document.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true })
    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [])

  // Lock body scroll when Add Customer modal is open
  useEffect(() => {
    if (isAddModalOpen) {
      const orig = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = orig
      }
    }
  }, [isAddModalOpen])

  // Customer Details tab/page state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<CustomerItem | null>(
    initialCustomers.length > 0 ? initialCustomers[0] : null
  )
  const [isFullDetailsPage, setIsFullDetailsPage] = useState(false)
  const [isLoadingCustomerDetails, setIsLoadingCustomerDetails] = useState(false)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)

  // Payment recording state
  const [paymentInputAmount, setPaymentInputAmount] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Account'>('Cash')
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [paymentFormError, setPaymentFormError] = useState('')

  // Additional Loans & Loan Selector state
  const [additionalLoans, setAdditionalLoans] = useState<CustomerLoan[]>([])
  const [isLoadingAdditionalLoans, setIsLoadingAdditionalLoans] = useState(false)
  const [selectedPaymentLoanIndex, setSelectedPaymentLoanIndex] = useState<number>(0)
  const [selectedLoanView, setSelectedLoanView] = useState<string>('view-details')
  const [selectedAdditionalLoanDetailId, setSelectedAdditionalLoanDetailId] = useState<string | null>(null)
  const [isAdditionalLoanMenuOpen, setIsAdditionalLoanMenuOpen] = useState(false)

  // Additional Loan Edit state (in View Details)
  const [isEditingAdditionalLoan, setIsEditingAdditionalLoan] = useState(false)
  const [isSavingAdditionalLoanEdit, setIsSavingAdditionalLoanEdit] = useState(false)
  const [additionalLoanEditError, setAdditionalLoanEditError] = useState('')
  const [editAddLoanGivenAmount, setEditAddLoanGivenAmount] = useState('')
  const [editAddLoanInterestAmount, setEditAddLoanInterestAmount] = useState('')
  const [editAddLoanTotalAmount, setEditAddLoanTotalAmount] = useState('')
  const [editAddLoanInstallmentAmount, setEditAddLoanInstallmentAmount] = useState('')
  const [editAddLoanGivenDate, setEditAddLoanGivenDate] = useState('')
  const [editAddLoanLastDate, setEditAddLoanLastDate] = useState('')
  const [editAddLoanNotesTaken, setEditAddLoanNotesTaken] = useState(false)
  const [editAddLoanChequeTaken, setEditAddLoanChequeTaken] = useState(false)
  const [editAddLoanAdditionalDetails, setEditAddLoanAdditionalDetails] = useState('')
  const [editAddLoanReferralName, setEditAddLoanReferralName] = useState('')
  const [editAddLoanReferralNumber, setEditAddLoanReferralNumber] = useState('')

  // Refinance state
  const [isRefinancePage, setIsRefinancePage] = useState(false)
  const [isRefinanceEditable, setIsRefinanceEditable] = useState(false)
  const [refinanceTargetLoan, setRefinanceTargetLoan] = useState<CustomerItem | null>(null)
  const [refinanceGivenAmount, setRefinanceGivenAmount] = useState('')
  const [refinanceRefinanceAmount, setRefinanceRefinanceAmount] = useState('')
  const [refinanceTotalAmount, setRefinanceTotalAmount] = useState('')
  const [refinanceInstallmentAmount, setRefinanceInstallmentAmount] = useState('')
  const [refinanceSection, setRefinanceSection] = useState<SectionType>('WEEKLY')
  const [refinanceDuration, setRefinanceDuration] = useState<number>(10)
  const [refinanceWeeks, setRefinanceWeeks] = useState<number>(10)
  const [refinanceGivenDate, setRefinanceGivenDate] = useState('')
  const [refinanceLastDate, setRefinanceLastDate] = useState('')
  const [refinanceNotesTaken, setRefinanceNotesTaken] = useState(false)
  const [refinanceChequeTaken, setRefinanceChequeTaken] = useState(false)
  const [refinanceAdditionalDetails, setRefinanceAdditionalDetails] = useState('')
  const [isSavingRefinance, setIsSavingRefinance] = useState(false)
  const [refinanceError, setRefinanceError] = useState('')

  // Override flags to preserve user manual edits
  const [isRefinanceTotalOverridden, setIsRefinanceTotalOverridden] = useState(false)
  const [isRefinanceInstallmentOverridden, setIsRefinanceInstallmentOverridden] = useState(false)
  const [isRefinanceLastDateOverridden, setIsRefinanceLastDateOverridden] = useState(false)

  const fetchAdditionalLoans = async (customerId: string) => {
    setIsLoadingAdditionalLoans(true)
    try {
      const res = await fetch(`/api/customers/loans?customer_id=${customerId}`)
      if (res.ok) {
        const json = await res.json()
        if (json?.data?.loans) {
          setAdditionalLoans(json.data.loans)
        }
      }
    } catch (err) {
      console.error('Failed to fetch additional loans:', err)
    } finally {
      setIsLoadingAdditionalLoans(false)
    }
  }

  const chronologicalAdditionalLoans = useMemo(() => {
    return [...additionalLoans].sort(
      (a, b) =>
        new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
    )
  }, [additionalLoans])

  const activeLoansCount = useMemo(() => {
    if (!selectedCustomerDetails) return 0

    let count = 0

    // 1. Check Main Loan (Loan #1)
    const mainCust = selectedCustomerDetails as any
    const mainStatus = mainCust.status ? String(mainCust.status).trim().toUpperCase() : null
    const mainTotal = Number(mainCust.total_amount || 0)
    const mainPaid = Number(mainCust.paid || 0)
    const mainBalance = mainCust.balance !== undefined ? Number(mainCust.balance) : Math.max(0, mainTotal - mainPaid)

    if (mainStatus) {
      if (mainStatus === 'ACTIVE') {
        count += 1
      }
    } else if (mainTotal > 0) {
      // If customer has a loan record and it is not settled/closed
      const isSettled = mainBalance <= 0 && mainPaid > 0
      if (!isSettled) {
        count += 1
      }
    }

    // 2. Check Additional Loans (Loan #2, #3, ...)
    additionalLoans.forEach((loan) => {
      const statusStr = String(loan.status || 'ACTIVE').trim().toUpperCase()
      const isStatusActive = statusStr === 'ACTIVE'
      const isExplicitlyNonActive =
        statusStr === 'CLOSED' ||
        statusStr === 'UNDER REVIEW' ||
        statusStr === 'UNDER_REVIEW' ||
        statusStr === 'SETTLED' ||
        statusStr === 'INACTIVE'

      if (isExplicitlyNonActive || !isStatusActive) {
        return
      }

      // Check if settled by payments
      const loanPayments = (selectedCustomerDetails.payments || []).filter(
        (p) => p.loan_id === loan.id
      )
      const paid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const total = Number(loan.total_amount || 0)
      const isSettled = total > 0 && paid >= total

      if (!isSettled) {
        count += 1
      }
    })

    return count
  }, [selectedCustomerDetails, additionalLoans])

  const activePaymentLoan = useMemo(() => {
    if (!selectedCustomerDetails) return null

    const mainStatus = (selectedCustomerDetails as any).status
      ? String((selectedCustomerDetails as any).status).trim().toUpperCase()
      : 'ACTIVE'
    const isMainClosed = mainStatus === 'CLOSED'

    // Index 0 = Main Loan (or first active additional loan if main loan is closed)
    if (selectedPaymentLoanIndex === 0) {
      if (!isMainClosed || chronologicalAdditionalLoans.length === 0) {
        const mainPayments = (selectedCustomerDetails.payments || []).filter(
          (p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id
        )
        const recordedPaid = mainPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        const calc = calculateLoanBalanceAndPaid(
          selectedCustomerDetails.id,
          selectedCustomerDetails.given_amount,
          selectedCustomerDetails.total_amount,
          recordedPaid,
          chronologicalAdditionalLoans
        )
        const totalAmount = Number(selectedCustomerDetails.total_amount || 0)
        const dueInfo = calculateDueRemaining(
          selectedCustomerDetails.given_date,
          selectedCustomerDetails.last_date,
          selectedCustomerDetails.section
        )

        return {
          ...selectedCustomerDetails,
          id: selectedCustomerDetails.id,
          loan_id: selectedCustomerDetails.id,
          loan_number: 1,
          is_main_loan: true,
          total_amount: totalAmount,
          paid: calc.paid,
          balance: calc.balance,
          installment_amount: selectedCustomerDetails.installment_amount,
          given_date: selectedCustomerDetails.given_date,
          last_date: selectedCustomerDetails.last_date,
          given_payment_method: (selectedCustomerDetails as any).given_payment_method || 'Cash',
          payments: mainPayments,
          due_remaining: dueInfo.text,
          due_remaining_is_late: dueInfo.isLate,
        }
      } else {
        const activeAdd =
          chronologicalAdditionalLoans.find(
            (l) => String(l.status || 'ACTIVE').trim().toUpperCase() === 'ACTIVE'
          ) || chronologicalAdditionalLoans[0]

        if (activeAdd) {
          const chronoIdx = chronologicalAdditionalLoans.findIndex((l) => l.id === activeAdd.id)
          const loanPayments = (selectedCustomerDetails.payments || []).filter(
            (p) => p.loan_id === activeAdd.id
          )
          const recordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
          const calc = calculateLoanBalanceAndPaid(
            activeAdd.id,
            activeAdd.given_amount,
            activeAdd.total_amount,
            recordedPaid,
            chronologicalAdditionalLoans
          )
          const totalAmount = Number(activeAdd.total_amount || 0)
          const dueInfo = calculateDueRemaining(
            activeAdd.given_date,
            activeAdd.last_date,
            (activeAdd as any).section || selectedCustomerDetails.section
          )

          return {
            ...selectedCustomerDetails,
            id: selectedCustomerDetails.id,
            loan_id: activeAdd.id,
            loan_number: chronoIdx + 2,
            is_main_loan: false,
            total_amount: totalAmount,
            paid: calc.paid,
            balance: calc.balance,
            installment_amount: activeAdd.installment_amount,
            given_date: activeAdd.given_date,
            last_date: activeAdd.last_date,
            given_payment_method: (activeAdd as any).given_payment_method || 'Cash',
            payments: loanPayments,
            due_remaining: dueInfo.text,
            due_remaining_is_late: dueInfo.isLate,
          }
        }
      }
    }

    // Index > 0 = Additional Loan
    const addLoan = chronologicalAdditionalLoans[selectedPaymentLoanIndex - 1]
    if (!addLoan) {
      const mainPayments = (selectedCustomerDetails.payments || []).filter(
        (p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id
      )
      const recordedPaid = mainPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const calc = calculateLoanBalanceAndPaid(
        selectedCustomerDetails.id,
        selectedCustomerDetails.given_amount,
        selectedCustomerDetails.total_amount,
        recordedPaid,
        chronologicalAdditionalLoans
      )
      const totalAmount = Number(selectedCustomerDetails.total_amount || 0)
      const dueInfo = calculateDueRemaining(
        selectedCustomerDetails.given_date,
        selectedCustomerDetails.last_date,
        selectedCustomerDetails.section
      )
      return {
        ...selectedCustomerDetails,
        id: selectedCustomerDetails.id,
        loan_id: selectedCustomerDetails.id,
        loan_number: 1,
        is_main_loan: true,
        total_amount: totalAmount,
        paid: calc.paid,
        balance: calc.balance,
        installment_amount: selectedCustomerDetails.installment_amount,
        given_date: selectedCustomerDetails.given_date,
        last_date: selectedCustomerDetails.last_date,
        given_payment_method: (selectedCustomerDetails as any).given_payment_method || 'Cash',
        payments: mainPayments,
        due_remaining: dueInfo.text,
        due_remaining_is_late: dueInfo.isLate,
      }
    }

    const loanPayments = (selectedCustomerDetails.payments || []).filter(
      (p) => p.loan_id === addLoan.id
    )
    const recordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const calc = calculateLoanBalanceAndPaid(
      addLoan.id,
      addLoan.given_amount,
      addLoan.total_amount,
      recordedPaid,
      chronologicalAdditionalLoans
    )
    const totalAmount = Number(addLoan.total_amount || 0)
    const dueInfo = calculateDueRemaining(
      addLoan.given_date,
      addLoan.last_date,
      (addLoan as any).section || selectedCustomerDetails.section
    )

    return {
      ...selectedCustomerDetails,
      id: selectedCustomerDetails.id,
      loan_id: addLoan.id,
      loan_number: selectedPaymentLoanIndex + 1,
      is_main_loan: false,
      total_amount: totalAmount,
      paid: calc.paid,
      balance: calc.balance,
      installment_amount: addLoan.installment_amount,
      given_date: addLoan.given_date,
      last_date: addLoan.last_date,
      given_payment_method: (addLoan as any).given_payment_method || 'Cash',
      payments: loanPayments,
      due_remaining: dueInfo.text,
      due_remaining_is_late: dueInfo.isLate,
    }
  }, [selectedCustomerDetails, selectedPaymentLoanIndex, chronologicalAdditionalLoans])

  // Full Details page loan scoping: Synchronized with the dropdown selection (selectedLoanView)
  const fullDetailsSelectedLoan = useMemo(() => {
    if (!selectedCustomerDetails) return null

    const getMainLoan = () => {
      const mainPayments = (selectedCustomerDetails.payments || []).filter(
        (p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id
      )
      const recordedPaid = mainPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const calc = calculateLoanBalanceAndPaid(
        selectedCustomerDetails.id,
        selectedCustomerDetails.given_amount,
        selectedCustomerDetails.total_amount,
        recordedPaid,
        chronologicalAdditionalLoans
      )
      const totalAmount = Number(selectedCustomerDetails.total_amount || 0)
      const dueInfo = calculateDueRemaining(
        selectedCustomerDetails.given_date,
        selectedCustomerDetails.last_date,
        selectedCustomerDetails.section
      )
      return {
        ...selectedCustomerDetails,
        id: selectedCustomerDetails.id,
        loan_id: selectedCustomerDetails.id,
        loan_number: 1,
        is_main_loan: true,
        given_amount: selectedCustomerDetails.given_amount,
        interest_amount: selectedCustomerDetails.interest_amount,
        total_amount: totalAmount,
        paid: calc.paid,
        balance: calc.balance,
        installment_amount: selectedCustomerDetails.installment_amount,
        given_date: selectedCustomerDetails.given_date,
        last_date: selectedCustomerDetails.last_date,
        given_payment_method: (selectedCustomerDetails as any).given_payment_method || 'Cash',
        payments: mainPayments,
        due_remaining: dueInfo.text,
        due_remaining_is_late: dueInfo.isLate,
      }
    }

    if (selectedLoanView === 'view-details' || selectedLoanView === 'active-loan') {
      const mainStatus = (selectedCustomerDetails as any).status
        ? String((selectedCustomerDetails as any).status).trim().toUpperCase()
        : 'ACTIVE'
      if (mainStatus === 'CLOSED' && chronologicalAdditionalLoans.length > 0) {
        const activeAdd =
          chronologicalAdditionalLoans.find(
            (l) => String(l.status || 'ACTIVE').trim().toUpperCase() === 'ACTIVE'
          ) || chronologicalAdditionalLoans[0]
        if (activeAdd) {
          const chronoIdx = chronologicalAdditionalLoans.findIndex((l) => l.id === activeAdd.id)
          const loanPayments = (selectedCustomerDetails.payments || []).filter(
            (p) => p.loan_id === activeAdd.id
          )
          const recordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
          const calc = calculateLoanBalanceAndPaid(
            activeAdd.id,
            activeAdd.given_amount,
            activeAdd.total_amount,
            recordedPaid,
            chronologicalAdditionalLoans
          )
          const totalAmount = Number(activeAdd.total_amount || 0)
          const dueInfo = calculateDueRemaining(
            activeAdd.given_date,
            activeAdd.last_date,
            (activeAdd as any).section || selectedCustomerDetails.section
          )
          return {
            ...selectedCustomerDetails,
            id: selectedCustomerDetails.id,
            loan_id: activeAdd.id,
            loan_number: chronoIdx + 2,
            is_main_loan: false,
            given_amount: activeAdd.given_amount,
            interest_amount: activeAdd.interest_amount,
            total_amount: totalAmount,
            paid: calc.paid,
            balance: calc.balance,
            installment_amount: activeAdd.installment_amount,
            given_date: activeAdd.given_date,
            last_date: activeAdd.last_date,
            referral_name: activeAdd.referral_name || null,
            referral_number: activeAdd.referral_number || null,
            notes_taken: activeAdd.notes_taken,
            cheque_taken: activeAdd.cheque_taken,
            additional_details: activeAdd.additional_details,
            given_payment_method: (activeAdd as any).given_payment_method || 'Cash',
            payments: loanPayments,
            due_remaining: dueInfo.text,
            due_remaining_is_late: dueInfo.isLate,
          }
        }
      }
      return getMainLoan()
    }

    if (selectedLoanView.startsWith('additional-loan')) {
      let addLoanIndex = 0
      if (selectedAdditionalLoanDetailId) {
        const foundIdx = chronologicalAdditionalLoans.findIndex((l) => l.id === selectedAdditionalLoanDetailId)
        if (foundIdx !== -1) {
          addLoanIndex = foundIdx
        }
      } else if (selectedLoanView.startsWith('additional-loan-')) {
        const parsed = parseInt(selectedLoanView.replace('additional-loan-', ''), 10)
        if (!isNaN(parsed) && parsed >= 0) {
          addLoanIndex = parsed
        }
      }

      const addLoan = selectedAdditionalLoanDetailId
        ? (chronologicalAdditionalLoans.find((l) => l.id === selectedAdditionalLoanDetailId) || chronologicalAdditionalLoans[addLoanIndex])
        : chronologicalAdditionalLoans[addLoanIndex]
      if (!addLoan) {
        return getMainLoan()
      }

      const loanPayments = (selectedCustomerDetails.payments || []).filter(
        (p) => p.loan_id === addLoan.id
      )
      const recordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const calc = calculateLoanBalanceAndPaid(
        addLoan.id,
        addLoan.given_amount,
        addLoan.total_amount,
        recordedPaid,
        chronologicalAdditionalLoans
      )
      const totalAmount = Number(addLoan.total_amount || 0)
      const dueInfo = calculateDueRemaining(
        addLoan.given_date,
        addLoan.last_date,
        (addLoan as any).section || selectedCustomerDetails.section
      )

      return {
        ...selectedCustomerDetails,
        id: selectedCustomerDetails.id,
        loan_id: addLoan.id,
        loan_number: addLoanIndex + 2,
        is_main_loan: false,
        given_amount: addLoan.given_amount,
        interest_amount: addLoan.interest_amount,
        total_amount: totalAmount,
        paid: calc.paid,
        balance: calc.balance,
        installment_amount: addLoan.installment_amount,
        given_date: addLoan.given_date,
        last_date: addLoan.last_date,
        referral_name: addLoan.referral_name || null,
        referral_number: addLoan.referral_number || null,
        notes_taken: addLoan.notes_taken,
        cheque_taken: addLoan.cheque_taken,
        additional_details: addLoan.additional_details,
        given_payment_method: (addLoan as any).given_payment_method || 'Cash',
        payments: loanPayments,
        due_remaining: dueInfo.text,
        due_remaining_is_late: dueInfo.isLate,
      }
    }

    return getMainLoan()
  }, [selectedCustomerDetails, selectedLoanView, chronologicalAdditionalLoans, selectedAdditionalLoanDetailId])


  // Active refinance loan: Keeps the refinance loan object dynamically in sync with live payments and balance
  const activeRefinanceLoan = useMemo(() => {
    if (!refinanceTargetLoan) return null
    const targetId = refinanceTargetLoan.loan_id || refinanceTargetLoan.id
    if (fullDetailsSelectedLoan && (fullDetailsSelectedLoan.id === targetId || fullDetailsSelectedLoan.loan_id === targetId)) {
      return fullDetailsSelectedLoan
    }
    const foundAddLoan = (additionalLoans || []).find((l) => l.id === targetId)
    if (foundAddLoan) {
      const loanPayments = (selectedCustomerDetails?.payments || []).filter((p) => p.loan_id === foundAddLoan.id)
      const recordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const calc = calculateLoanBalanceAndPaid(
        foundAddLoan.id,
        foundAddLoan.given_amount,
        foundAddLoan.total_amount,
        recordedPaid,
        chronologicalAdditionalLoans
      )
      return {
        ...selectedCustomerDetails,
        id: foundAddLoan.id,
        loan_id: foundAddLoan.id,
        given_amount: foundAddLoan.given_amount,
        total_amount: foundAddLoan.total_amount,
        paid: calc.paid,
        balance: calc.balance,
        installment_amount: foundAddLoan.installment_amount,
        given_date: foundAddLoan.given_date,
        last_date: foundAddLoan.last_date,
      } as CustomerItem
    }
    return fullDetailsSelectedLoan || selectedCustomerDetails || refinanceTargetLoan
  }, [refinanceTargetLoan, fullDetailsSelectedLoan, selectedCustomerDetails, additionalLoans, chronologicalAdditionalLoans])

  // Synchronize refinance amount with live loan balance whenever on refinance page
  useEffect(() => {
    if (isRefinancePage) {
      const targetLoan = activeRefinanceLoan || refinanceTargetLoan || fullDetailsSelectedLoan || selectedCustomerDetails
      if (targetLoan) {
        const curTotal = Number(targetLoan.total_amount || 0)
        const curPaid = Number(targetLoan.paid || 0)
        const currentBalance = targetLoan.balance !== undefined && targetLoan.balance !== null
          ? Number(targetLoan.balance)
          : Math.max(0, curTotal - curPaid)
        const origGiven = Number(targetLoan.given_amount || 0)
        const val = currentBalance > origGiven
          ? 'Not for Refinance'
          : origGiven === currentBalance
          ? '0'
          : String(origGiven - currentBalance)
        setRefinanceRefinanceAmount(val)
      }
    }
  }, [isRefinancePage, activeRefinanceLoan, refinanceTargetLoan, fullDetailsSelectedLoan, selectedCustomerDetails])

  // Synchronize selected customer with customers list (default to first customer)
  useEffect(() => {
    if (customers.length > 0) {
      setSelectedCustomerDetails((prev) => {
        if (!prev) return customers[0]
        const stillExists = customers.find((c) => c.id === prev.id)
        if (!stillExists) return customers[0]
        return {
          ...stillExists,
          payments: prev.payments || stillExists.payments || [],
        }
      })
    } else {
      setSelectedCustomerDetails(null)
    }
  }, [customers])

  // Ensure latest payments and additional loans are fetched whenever selected customer changes
  useEffect(() => {
    if (selectedCustomerDetails?.id) {
      setPaymentInputAmount('')
      setPaymentRemarks('')
      setPaymentFormError('')
      setPaymentMethod('Cash')
      setSelectedPaymentLoanIndex(0)
      setSelectedAdditionalLoanDetailId(null)
      fetchAdditionalLoans(selectedCustomerDetails.id)

      fetch(`/api/customers/payments?customer_id=${selectedCustomerDetails.id}`)
        .then((r) => r.json())
        .then((json) => {
          if ((json?.success || json?.ok) && json?.data?.payments) {
            setSelectedCustomerDetails((prev) => {
              if (!prev || prev.id !== selectedCustomerDetails.id) return prev
              return { ...prev, payments: json.data.payments }
            })
          }
        })
        .catch((e) => console.error('Error fetching payments:', e))
    } else {
      setAdditionalLoans([])
      setSelectedPaymentLoanIndex(0)
      setSelectedAdditionalLoanDetailId(null)
    }
  }, [selectedCustomerDetails?.id])

  const handleRecordPayment = async (
    e?: React.FormEvent,
    methodOverride?: 'Cash' | 'UPI' | 'Account',
    amountOverride?: number
  ) => {
    if (e) e.preventDefault()
    if (!selectedCustomerDetails || isRecordingPayment) return

    setPaymentFormError('')
    const targetMethod = methodOverride || paymentMethod
    if (methodOverride) {
      setPaymentMethod(methodOverride)
    }

    const numAmount =
      amountOverride !== undefined && amountOverride > 0
        ? amountOverride
        : parseFloat(paymentInputAmount)

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setPaymentFormError(
        amountOverride !== undefined
          ? 'Installment amount must be greater than 0.'
          : 'Payment amount is mandatory and must be greater than 0.'
      )
      return
    }

    const currentLoan = isFullDetailsPage
      ? (fullDetailsSelectedLoan || selectedCustomerDetails)
      : (activePaymentLoan || selectedCustomerDetails)
    const targetLoanId = currentLoan.loan_id || selectedCustomerDetails.id
    const currentBalance = Number(
      currentLoan.balance ?? (currentLoan.total_amount || 0)
    )

    if (currentBalance <= 0) {
      setPaymentFormError('Loan balance is already fully settled (₹0 remaining).')
      return
    }

    if (numAmount > currentBalance) {
      setPaymentFormError(
        `Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed remaining balance of ₹${currentBalance.toLocaleString('en-IN')}.`
      )
      return
    }

    setIsRecordingPayment(true)

    // Immediately wake up audio context in direct user gesture thread
    const audioCtx = getAudioContext()
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }

    try {
      // Derive the client's local calendar date (YYYY-MM-DD) to avoid UTC date shift.
      const now = new Date()
      const localDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)

      const res = await fetch('/api/customers/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerDetails.id,
          loan_id: targetLoanId,
          amount: numAmount,
          payment_method: targetMethod.toLowerCase(),
          payment_date: localDateStr,
          remarks: amountOverride !== undefined ? null : (paymentRemarks.trim() || null),
        }),
      })

      const json = await res.json()

      if (!res.ok || json?.success === false) {
        setPaymentFormError(json?.message || json?.error || 'Failed to save payment.')
        return
      }

      // Play pleasant payment-success sound ONLY after backend confirms payment saved
      await playPaymentSuccessSound()

      const freshPayments: PaymentItem[] =
        json.data?.payments ||
        (json.data?.payment
          ? [...(selectedCustomerDetails.payments || []), json.data.payment]
          : selectedCustomerDetails.payments || [])

      // Calculate main loan totals for customer-level state
      const mainLoanPayments = freshPayments.filter(
        (p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id
      )
      const mainLoanPaid = mainLoanPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
      const mainLoanBalance = Math.max(
        0,
        Number(selectedCustomerDetails.total_amount || 0) - mainLoanPaid
      )

      // Update selected customer details state immediately with fresh database payments
      setSelectedCustomerDetails((prev) => {
        if (!prev) return null
        return {
          ...prev,
          paid: mainLoanPaid,
          balance: mainLoanBalance,
          payments: freshPayments,
        }
      })

      // Update customers list state so area view updates live
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomerDetails.id
            ? { ...c, paid: mainLoanPaid, balance: mainLoanBalance, payments: freshPayments }
            : c
        )
      )

      customerCacheRef.current = {}
      setPaymentInputAmount('')
      setPaymentRemarks('')
      setPaymentFormError('')
    } catch (err: any) {
      console.error('Record payment error:', err)
      setPaymentFormError('Failed to record payment. Please check your connection.')
    } finally {
      setIsRecordingPayment(false)
    }
  }

  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)

  const handleUpdatePayment = async (
    paymentId: string,
    updatedData: {
      amount: number
      payment_method: 'Cash' | 'UPI' | 'Account'
      payment_date: string
      created_at: string
      remarks?: string | null
    }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!selectedCustomerDetails || isUpdatingPayment) {
      return { success: false, error: 'Cannot update payment right now.' }
    }

    setIsUpdatingPayment(true)
    try {
      const res = await fetch('/api/customers/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          customer_id: selectedCustomerDetails.id,
          amount: updatedData.amount,
          payment_method: updatedData.payment_method.toLowerCase(),
          payment_date: updatedData.payment_date,
          created_at: updatedData.created_at,
          remarks: updatedData.remarks !== undefined ? (updatedData.remarks ? updatedData.remarks.trim() : null) : null,
        }),
      })

      const json = await res.json()

      if (!res.ok || json?.success === false) {
        return { success: false, error: json?.message || json?.error || 'Failed to update payment.' }
      }

      const freshPayments: PaymentItem[] = json.data?.payments || []
      const mainLoanPayments = freshPayments.filter(
        (p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id
      )
      const mainLoanPaid = mainLoanPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
      const mainLoanBalance = Math.max(
        0,
        Number(selectedCustomerDetails.total_amount || 0) - mainLoanPaid
      )

      // Update selected customer details state immediately with fresh database payments
      setSelectedCustomerDetails((prev) => {
        if (!prev) return null
        return {
          ...prev,
          paid: mainLoanPaid,
          balance: mainLoanBalance,
          payments: freshPayments,
        }
      })

      // Update customers list state so area view updates live
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomerDetails.id
            ? { ...c, paid: mainLoanPaid, balance: mainLoanBalance, payments: freshPayments }
            : c
        )
      )

      customerCacheRef.current = {}
      return { success: true }
    } catch (err: any) {
      console.error('Update payment error:', err)
      return { success: false, error: 'Failed to update payment. Please check your connection.' }
    } finally {
      setIsUpdatingPayment(false)
    }
  }

  // Unified Common Edit state (Customer Info, Financial, Date, Additional Details)
  const [isEditingCustomerInfo, setIsEditingCustomerInfo] = useState(false)
  const [isSavingCustomerInfo, setIsSavingCustomerInfo] = useState(false)
  const [customerInfoError, setCustomerInfoError] = useState('')

  // 1. Customer Information fields
  const [editInfoSno, setEditInfoSno] = useState('')
  const [editInfoName, setEditInfoName] = useState('')
  const [editInfoPhone, setEditInfoPhone] = useState('')
  const [editInfoSection, setEditInfoSection] = useState<SectionType>('DAILY')
  const [editInfoAreaId, setEditInfoAreaId] = useState('')
  const [editInfoAltPhone, setEditInfoAltPhone] = useState('')
  const [editInfoRefName, setEditInfoRefName] = useState('')
  const [editInfoRefPhone, setEditInfoRefPhone] = useState('')
  const [editInfoAddress, setEditInfoAddress] = useState('')
  const [editInfoLat, setEditInfoLat] = useState<number | null>(null)
  const [editInfoLng, setEditInfoLng] = useState<number | null>(null)
  const [isDetectingEditLocation, setIsDetectingEditLocation] = useState(false)
  const [editGeoError, setEditGeoError] = useState('')

  // 2. Financial Details fields
  const [editGivenAmount, setEditGivenAmount] = useState('')
  const [editInterestAmount, setEditInterestAmount] = useState('')
  const [editTotalAmount, setEditTotalAmount] = useState('')
  const [editInstallmentAmount, setEditInstallmentAmount] = useState('')

  // 3. Date Details fields
  const [editGivenDate, setEditGivenDate] = useState('')
  const [editLastDate, setEditLastDate] = useState('')

  // 4. Additional Information fields
  const [editNotesTaken, setEditNotesTaken] = useState(false)
  const [editChequeTaken, setEditChequeTaken] = useState(false)
  const [editAdditionalDetails, setEditAdditionalDetails] = useState('')

  // Customer Image Upload & Preview Modal state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState('')
  const [isPreviewImageModalOpen, setIsPreviewImageModalOpen] = useState(false)
  const [imageToPreview, setImageToPreview] = useState('')

  // Additional Loan Form state
  const [isAddAnotherLoanFormOpen, setIsAddAnotherLoanFormOpen] = useState(false)
  const [addLoanGivenAmount, setAddLoanGivenAmount] = useState('')
  const [addLoanInterestAmount, setAddLoanInterestAmount] = useState('')
  const [addLoanTotalAmount, setAddLoanTotalAmount] = useState('')
  const [addLoanInstallmentAmount, setAddLoanInstallmentAmount] = useState('')
  const [addLoanGivenDate, setAddLoanGivenDate] = useState('')
  const [addLoanLastDate, setAddLoanLastDate] = useState('')
  const [addLoanReferralName, setAddLoanReferralName] = useState('')
  const [addLoanReferralNumber, setAddLoanReferralNumber] = useState('')
  const [addLoanNotesTaken, setAddLoanNotesTaken] = useState(false)
  const [addLoanChequeTaken, setAddLoanChequeTaken] = useState(false)
  const [addLoanAdditionalDetails, setAddLoanAdditionalDetails] = useState('')
  const [isSavingAdditionalLoan, setIsSavingAdditionalLoan] = useState(false)
  const [addLoanFormError, setAddLoanFormError] = useState('')

  const handleAddLoanGivenAmountChange = (val: string) => {
    setAddLoanGivenAmount(val)
    const g = parseFloat(val) || 0
    const i = parseFloat(addLoanInterestAmount) || 0
    if (g > 0 || i > 0) {
      setAddLoanTotalAmount(String(g + i))
    }
  }

  const handleAddLoanInterestAmountChange = (val: string) => {
    setAddLoanInterestAmount(val)
    const g = parseFloat(addLoanGivenAmount) || 0
    const i = parseFloat(val) || 0
    if (g > 0 || i > 0) {
      setAddLoanTotalAmount(String(g + i))
    }
  }

  const resetAddLoanForm = () => {
    setAddLoanGivenAmount('')
    setAddLoanInterestAmount('')
    setAddLoanTotalAmount('')
    setAddLoanInstallmentAmount('')
    setAddLoanGivenDate('')
    setAddLoanLastDate('')
    setAddLoanReferralName('')
    setAddLoanReferralNumber('')
    setAddLoanNotesTaken(false)
    setAddLoanChequeTaken(false)
    setAddLoanAdditionalDetails('')
    setAddLoanFormError('')
    setIsAddAnotherLoanFormOpen(false)
  }

  const handleSaveAdditionalLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomerDetails?.id) return

    if (!addLoanGivenAmount.trim() || Number(addLoanGivenAmount) <= 0) {
      setAddLoanFormError('Given Amount is required and must be greater than 0')
      return
    }
    if (!addLoanTotalAmount.trim() || Number(addLoanTotalAmount) <= 0) {
      setAddLoanFormError('Total Amount is required and must be greater than 0')
      return
    }
    if (!addLoanInstallmentAmount.trim() || Number(addLoanInstallmentAmount) <= 0) {
      setAddLoanFormError('Installment Amount is required and must be greater than 0')
      return
    }
    if (!addLoanGivenDate.trim()) {
      setAddLoanFormError('Given Date is required')
      return
    }
    if (!addLoanLastDate.trim()) {
      setAddLoanFormError('Last Date is required')
      return
    }

    setIsSavingAdditionalLoan(true)
    setAddLoanFormError('')

    try {
      const res = await fetch('/api/customers/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerDetails.id,
          given_amount: Number(addLoanGivenAmount),
          interest_amount: addLoanInterestAmount ? Number(addLoanInterestAmount) : 0,
          total_amount: Number(addLoanTotalAmount),
          installment_amount: Number(addLoanInstallmentAmount),
          given_date: addLoanGivenDate,
          last_date: addLoanLastDate,
          referral_name: addLoanReferralName.trim() || null,
          referral_number: addLoanReferralNumber.trim() || null,
          notes_taken: addLoanNotesTaken,
          cheque_taken: addLoanChequeTaken,
          additional_details: addLoanAdditionalDetails.trim() || null,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const newLoan = json?.data?.loan
        if (newLoan) {
          setAdditionalLoans((prev) => [newLoan, ...prev])
        }
        resetAddLoanForm()
      } else {
        const errJson = await res.json().catch(() => ({}))
        setAddLoanFormError(errJson?.message || 'Failed to save additional loan')
      }
    } catch (err) {
      console.error('Error saving additional loan:', err)
      setAddLoanFormError('An unexpected error occurred while saving the loan')
    } finally {
      setIsSavingAdditionalLoan(false)
    }
  }

  const formatDateForDateInput = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return dateStr.slice(0, 10)
      }
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return `${yr}-${mo}-${da}`
    } catch {
      return ''
    }
  }

  useEffect(() => {
    setIsEditingCustomerInfo(false)
    setCustomerInfoError('')
    setEditGeoError('')
    setIsDetectingEditLocation(false)
    setIsAdditionalLoanMenuOpen(false)
    setSelectedLoanView('view-details')
    setSelectedAdditionalLoanDetailId(null)
    setIsEditingAdditionalLoan(false)
    setAdditionalLoanEditError('')
    setIsAddAnotherLoanFormOpen(false)
    setAddLoanFormError('')
  }, [selectedCustomerId, isFullDetailsPage])

  const handleStartEditCustomerInfo = () => {
    if (!selectedCustomerDetails) return
    setEditInfoSno(selectedCustomerDetails.serial_number != null ? String(selectedCustomerDetails.serial_number) : '')
    setEditInfoName(selectedCustomerDetails.name || '')
    setEditInfoPhone(selectedCustomerDetails.phone || (selectedCustomerDetails as any).phone_number || '')
    const sec = (selectedCustomerDetails.section || 'DAILY').toUpperCase() as SectionType
    setEditInfoSection(['DAILY', 'WEEKLY', 'MONTHLY'].includes(sec) ? sec : 'DAILY')
    setEditInfoAreaId(selectedCustomerDetails.area_id || selectedArea?.id || '')
    setEditInfoAltPhone(selectedCustomerDetails.alternative_number || '')
    setEditInfoRefName(selectedCustomerDetails.referral_name || '')
    setEditInfoRefPhone(selectedCustomerDetails.referral_number || '')
    setEditInfoAddress(selectedCustomerDetails.address || '')
    setEditInfoLat(selectedCustomerDetails.latitude != null ? Number(selectedCustomerDetails.latitude) : null)
    setEditInfoLng(selectedCustomerDetails.longitude != null ? Number(selectedCustomerDetails.longitude) : null)
    setEditGeoError('')
    setIsDetectingEditLocation(false)
    setCustomerInfoError('')

    // Financial Details
    setEditGivenAmount(selectedCustomerDetails.given_amount != null ? formatInputClean(selectedCustomerDetails.given_amount) : '')
    setEditInterestAmount(selectedCustomerDetails.interest_amount != null ? formatInputClean(selectedCustomerDetails.interest_amount) : '')
    setEditTotalAmount(selectedCustomerDetails.total_amount != null ? formatInputClean(selectedCustomerDetails.total_amount) : '')
    setEditInstallmentAmount(selectedCustomerDetails.installment_amount != null ? formatInputClean(selectedCustomerDetails.installment_amount) : '')

    // Date Details
    setEditGivenDate(formatDateForDateInput(selectedCustomerDetails.given_date))
    setEditLastDate(formatDateForDateInput(selectedCustomerDetails.last_date))

    // Additional Details
    setEditNotesTaken(Boolean(selectedCustomerDetails.notes_taken))
    setEditChequeTaken(Boolean(selectedCustomerDetails.cheque_taken))
    setEditAdditionalDetails(selectedCustomerDetails.additional_details || '')

    setIsEditingCustomerInfo(true)
  }

  const handleCancelEditCustomerInfo = () => {
    if (selectedCustomerDetails) {
      setEditInfoSno(selectedCustomerDetails.serial_number != null ? String(selectedCustomerDetails.serial_number) : '')
      setEditInfoName(selectedCustomerDetails.name || '')
      setEditInfoPhone(selectedCustomerDetails.phone || (selectedCustomerDetails as any).phone_number || '')
      const sec = (selectedCustomerDetails.section || 'DAILY').toUpperCase() as SectionType
      setEditInfoSection(['DAILY', 'WEEKLY', 'MONTHLY'].includes(sec) ? sec : 'DAILY')
      setEditInfoAreaId(selectedCustomerDetails.area_id || selectedArea?.id || '')
      setEditInfoAltPhone(selectedCustomerDetails.alternative_number || '')
      setEditInfoRefName(selectedCustomerDetails.referral_name || '')
      setEditInfoRefPhone(selectedCustomerDetails.referral_number || '')
      setEditInfoAddress(selectedCustomerDetails.address || '')
      setEditInfoLat(selectedCustomerDetails.latitude != null ? Number(selectedCustomerDetails.latitude) : null)
      setEditInfoLng(selectedCustomerDetails.longitude != null ? Number(selectedCustomerDetails.longitude) : null)

      setEditGivenAmount(selectedCustomerDetails.given_amount != null ? formatInputClean(selectedCustomerDetails.given_amount) : '')
      setEditInterestAmount(selectedCustomerDetails.interest_amount != null ? formatInputClean(selectedCustomerDetails.interest_amount) : '')
      setEditTotalAmount(selectedCustomerDetails.total_amount != null ? formatInputClean(selectedCustomerDetails.total_amount) : '')
      setEditInstallmentAmount(selectedCustomerDetails.installment_amount != null ? formatInputClean(selectedCustomerDetails.installment_amount) : '')

      setEditGivenDate(formatDateForDateInput(selectedCustomerDetails.given_date))
      setEditLastDate(formatDateForDateInput(selectedCustomerDetails.last_date))

      setEditNotesTaken(Boolean(selectedCustomerDetails.notes_taken))
      setEditChequeTaken(Boolean(selectedCustomerDetails.cheque_taken))
      setEditAdditionalDetails(selectedCustomerDetails.additional_details || '')
    }
    setIsEditingCustomerInfo(false)
    setCustomerInfoError('')
    setEditGeoError('')
    setIsDetectingEditLocation(false)
  }

  const handleDetectEditLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setEditGeoError('Geolocation is not supported by your browser.')
      return
    }

    setIsDetectingEditLocation(true)
    setEditGeoError('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Capture EXACT GPS coordinates directly from the device Geolocation API
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        setEditInfoLat(lat)
        setEditInfoLng(lon)

        try {
          // Reverse geocoding for human-readable display only - NEVER overwrites coordinates
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
            headers: { 'Accept-Language': 'en' },
          })
          const data = await res.json()
          if (data && data.display_name) {
            setEditInfoAddress(data.display_name)
          } else {
            setEditInfoAddress(`Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`)
          }
        } catch (e) {
          console.error('Reverse geocode error:', e)
          setEditInfoAddress(`Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`)
        } finally {
          setIsDetectingEditLocation(false)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
        setIsDetectingEditLocation(false)
        // If geolocation permission is denied or high accuracy fails, show error and DO NOT overwrite existing location
        if (error.code === error.PERMISSION_DENIED) {
          setEditGeoError('Location permission denied. Precise GPS location was not captured.')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setEditGeoError('High-accuracy GPS location is unavailable on this device.')
        } else if (error.code === error.TIMEOUT) {
          setEditGeoError('Location request timed out. Precise GPS location could not be determined.')
        } else {
          setEditGeoError('Failed to capture precise GPS location.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handleSaveCustomerInfo = async () => {
    if (!selectedCustomerDetails || isSavingCustomerInfo) return

    const trimmedName = editInfoName.trim()
    const trimmedPhone = editInfoPhone.trim()

    if (!trimmedName) {
      setCustomerInfoError('Customer name is required.')
      return
    }

    if (!trimmedPhone) {
      setCustomerInfoError('Phone number is required.')
      return
    }

    const gAmount = editGivenAmount.trim() ? parseFloat(editGivenAmount.trim()) : null
    const iAmount = editInterestAmount.trim() ? parseFloat(editInterestAmount.trim()) : null
    const tAmount = editTotalAmount.trim() ? parseFloat(editTotalAmount.trim()) : null
    const instAmount = editInstallmentAmount.trim() ? parseFloat(editInstallmentAmount.trim()) : null

    if (tAmount !== null && (isNaN(tAmount) || tAmount < 0)) {
      setCustomerInfoError('Please enter a valid Total Amount.')
      return
    }

    if (instAmount !== null && (isNaN(instAmount) || instAmount <= 0)) {
      setCustomerInfoError('Please enter a valid Installment Amount greater than 0.')
      return
    }

    setIsSavingCustomerInfo(true)
    setCustomerInfoError('')

    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomerDetails.id,
          name: trimmedName,
          phone: trimmedPhone,
          phone_number: trimmedPhone,
          serial_number: editInfoSno.trim() ? parseInt(editInfoSno.trim(), 10) : null,
          section: editInfoSection.toLowerCase(),
          area_id: editInfoAreaId || selectedCustomerDetails.area_id,
          alternative_number: editInfoAltPhone.trim() || null,
          referral_name: editInfoRefName.trim() || null,
          referral_number: editInfoRefPhone.trim() || null,
          address: editInfoAddress.trim() || null,
          latitude: editInfoLat != null ? Number(editInfoLat) : null,
          longitude: editInfoLng != null ? Number(editInfoLng) : null,
          given_amount: gAmount,
          interest_amount: iAmount,
          total_amount: tAmount,
          installment_amount: instAmount,
          given_date: editGivenDate || null,
          last_date: editLastDate || null,
          notes_taken: editNotesTaken,
          cheque_taken: editChequeTaken,
          additional_details: editAdditionalDetails.trim() || null,
        }),
      })

      const json = await res.json()

      if (!res.ok || json?.success === false) {
        setCustomerInfoError(json?.message || json?.error || 'Failed to update customer details.')
        return
      }

      const updatedCustomer = json.data.customer

      // Update selectedCustomerDetails state immediately
      setSelectedCustomerDetails((prev) => {
        if (!prev) return null
        return {
          ...prev,
          ...updatedCustomer,
          latitude: updatedCustomer?.latitude != null ? Number(updatedCustomer.latitude) : editInfoLat,
          longitude: updatedCustomer?.longitude != null ? Number(updatedCustomer.longitude) : editInfoLng,
          payments: prev.payments, // preserve payments
        }
      })

      // Update customers list state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomerDetails.id
            ? {
                ...c,
                ...updatedCustomer,
                latitude: updatedCustomer?.latitude != null ? Number(updatedCustomer.latitude) : editInfoLat,
                longitude: updatedCustomer?.longitude != null ? Number(updatedCustomer.longitude) : editInfoLng,
                payments: c.payments || prev.find((p) => p.id === c.id)?.payments,
              }
            : c
        )
      )

      customerCacheRef.current = {}
      setIsEditingCustomerInfo(false)
    } catch (err: any) {
      console.error('Error saving customer info:', err)
      setCustomerInfoError('Failed to save customer details. Please check your connection.')
    } finally {
      setIsSavingCustomerInfo(false)
    }
  }

  // ── Additional Loan Edit handlers ──
  const handleStartEditAdditionalLoan = (loan: CustomerLoan) => {
    setEditAddLoanGivenAmount(loan.given_amount != null ? formatInputClean(loan.given_amount) : '')
    setEditAddLoanInterestAmount(loan.interest_amount != null ? formatInputClean(loan.interest_amount) : '')
    setEditAddLoanTotalAmount(loan.total_amount != null ? formatInputClean(loan.total_amount) : '')
    setEditAddLoanInstallmentAmount(loan.installment_amount != null ? formatInputClean(loan.installment_amount) : '')
    setEditAddLoanGivenDate(formatDateForDateInput(loan.given_date))
    setEditAddLoanLastDate(formatDateForDateInput(loan.last_date))
    setEditAddLoanNotesTaken(Boolean(loan.notes_taken))
    setEditAddLoanChequeTaken(Boolean(loan.cheque_taken))
    setEditAddLoanAdditionalDetails(loan.additional_details || '')
    setEditAddLoanReferralName(loan.referral_name || '')
    setEditAddLoanReferralNumber(loan.referral_number || '')
    setAdditionalLoanEditError('')
    setIsEditingAdditionalLoan(true)
  }

  const handleCancelEditAdditionalLoan = () => {
    setIsEditingAdditionalLoan(false)
    setAdditionalLoanEditError('')
  }

  const handleSaveAdditionalLoanEdit = async (loanId: string) => {
    if (!loanId || isSavingAdditionalLoanEdit) return

    const gAmount = editAddLoanGivenAmount.trim() ? parseFloat(editAddLoanGivenAmount.trim()) : 0
    const iAmount = editAddLoanInterestAmount.trim() ? parseFloat(editAddLoanInterestAmount.trim()) : 0
    const tAmount = editAddLoanTotalAmount.trim() ? parseFloat(editAddLoanTotalAmount.trim()) : 0
    const instAmount = editAddLoanInstallmentAmount.trim() ? parseFloat(editAddLoanInstallmentAmount.trim()) : 0

    if (!editAddLoanGivenAmount.trim() || isNaN(gAmount) || gAmount <= 0) {
      setAdditionalLoanEditError('Given Amount is required and must be greater than 0.')
      return
    }

    if (isNaN(iAmount) || iAmount < 0) {
      setAdditionalLoanEditError('Interest Amount must be a valid non-negative number.')
      return
    }

    if (!editAddLoanTotalAmount.trim() || isNaN(tAmount) || tAmount <= 0) {
      setAdditionalLoanEditError('Total Amount is required and must be greater than 0.')
      return
    }

    if (!editAddLoanInstallmentAmount.trim() || isNaN(instAmount) || instAmount <= 0) {
      setAdditionalLoanEditError('Installment Amount is required and must be greater than 0.')
      return
    }

    if (!editAddLoanGivenDate.trim()) {
      setAdditionalLoanEditError('Given Date is required.')
      return
    }

    if (!editAddLoanLastDate.trim()) {
      setAdditionalLoanEditError('Last Date is required.')
      return
    }

    setIsSavingAdditionalLoanEdit(true)
    setAdditionalLoanEditError('')

    try {
      const res = await fetch('/api/customers/loans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: loanId,
          given_amount: gAmount,
          interest_amount: iAmount,
          total_amount: tAmount,
          installment_amount: instAmount,
          given_date: editAddLoanGivenDate,
          last_date: editAddLoanLastDate,
          notes_taken: editAddLoanNotesTaken,
          cheque_taken: editAddLoanChequeTaken,
          additional_details: editAddLoanAdditionalDetails.trim() || null,
          referral_name: editAddLoanReferralName.trim() || null,
          referral_number: editAddLoanReferralNumber.trim() || null,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.success === false) {
        setAdditionalLoanEditError(json?.message || json?.error || 'Failed to update additional loan.')
        return
      }

      const updatedLoan = json?.data?.loan
      if (updatedLoan) {
        setAdditionalLoans((prev) =>
          prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l))
        )
      }

      customerCacheRef.current = {}
      setIsEditingAdditionalLoan(false)
    } catch (err) {
      console.error('Error updating additional loan:', err)
      setAdditionalLoanEditError('Failed to save additional loan. Please check your connection.')
    } finally {
      setIsSavingAdditionalLoanEdit(false)
    }
  }

  // ── Refinance handlers ──
  const handleOpenRefinancePage = () => {
    if (!selectedCustomerDetails) return
    const targetLoan = activeRefinanceLoan || fullDetailsSelectedLoan || selectedCustomerDetails
    setRefinanceTargetLoan(targetLoan)

    const origGiven = Number(targetLoan.given_amount || 0)
    const curTotal = Number(targetLoan.total_amount || 0)
    const curPaid = Number(targetLoan.paid || 0)
    const currentBalance = targetLoan.balance !== undefined && targetLoan.balance !== null
      ? Number(targetLoan.balance)
      : Math.max(0, curTotal - curPaid)

    // Formula: Refinance Amount = Original Given Amount - Current Balance Amount
    let newRefinanceAmount: string
    let refAmountNum: number

    if (currentBalance > origGiven) {
      newRefinanceAmount = 'Not for Refinance'
      refAmountNum = 0
    } else if (origGiven === currentBalance) {
      newRefinanceAmount = '0'
      refAmountNum = 0
    } else {
      refAmountNum = origGiven - currentBalance
      newRefinanceAmount = String(refAmountNum)
    }

    // 1. Read existing original loan Section
    const loanSection: SectionType = (
      targetLoan?.section ||
      selectedCustomerDetails?.section ||
      selectedArea?.section ||
      activeSection ||
      'WEEKLY'
    ).toUpperCase() as SectionType

    // 2. Read the original loan's existing duration value
    let origDuration = 10
    const explicitDuration = Number((targetLoan as any).duration)
    if (!isNaN(explicitDuration) && explicitDuration > 0) {
      origDuration = explicitDuration
    } else if (targetLoan.given_date && targetLoan.last_date) {
      if (loanSection === 'DAILY') {
        const elapsed = getElapsedDays(targetLoan.given_date, targetLoan.last_date)
        origDuration = elapsed > 0 ? elapsed : 100
      } else if (loanSection === 'MONTHLY') {
        const sIso = toISO(targetLoan.given_date) || targetLoan.given_date.slice(0, 10)
        const eIso = toISO(targetLoan.last_date) || targetLoan.last_date.slice(0, 10)
        const sParts = sIso.split('-')
        const eParts = eIso.split('-')
        if (sParts.length === 3 && eParts.length === 3) {
          const sy = parseInt(sParts[0], 10)
          const sm = parseInt(sParts[1], 10) - 1
          const ey = parseInt(eParts[0], 10)
          const em = parseInt(eParts[1], 10) - 1
          const mDiff = (ey - sy) * 12 + (em - sm)
          origDuration = mDiff > 0 ? mDiff : 3
        } else {
          origDuration = 3
        }
      } else {
        // WEEKLY
        const wks = getWeeksBetweenDates(targetLoan.given_date, targetLoan.last_date)
        origDuration = wks > 0 ? wks : 10
      }
    } else {
      origDuration = loanSection === 'DAILY' ? 100 : loanSection === 'MONTHLY' ? 3 : 10
    }

    // Reuse existing original loan's interest structure/rate
    const origInterest = targetLoan.interest_amount != null && !isNaN(Number(targetLoan.interest_amount)) && Number(targetLoan.interest_amount) > 0
      ? Number(targetLoan.interest_amount)
      : (curTotal > origGiven ? curTotal - origGiven : 0)
    const interestRate = origGiven > 0 ? origInterest / origGiven : 0

    const newGiven = origGiven
    const newInterest = Math.round(newGiven * interestRate)
    const newTotal = newGiven + newInterest

    const todayDate = new Date()
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
    const calculatedLastDate = calculateRefinanceDurationLastDate(todayStr, loanSection, origDuration)

    const origInstallment = targetLoan.installment_amount != null
      ? String(targetLoan.installment_amount)
      : (selectedCustomerDetails.installment_amount != null ? String(selectedCustomerDetails.installment_amount) : '0')

    setRefinanceSection(loanSection)
    setRefinanceDuration(origDuration)
    setRefinanceWeeks(origDuration)
    setRefinanceGivenAmount(String(newGiven))
    setRefinanceRefinanceAmount(newRefinanceAmount)
    setRefinanceTotalAmount(String(newTotal))
    setRefinanceInstallmentAmount(origInstallment)
    setRefinanceGivenDate(todayStr)
    setRefinanceLastDate(calculatedLastDate)
    setRefinanceNotesTaken(false)
    setRefinanceChequeTaken(false)
    setRefinanceAdditionalDetails('')
    setRefinanceError('')

    setIsRefinanceTotalOverridden(false)
    setIsRefinanceInstallmentOverridden(false)
    setIsRefinanceLastDateOverridden(false)
    setIsRefinanceEditable(false)

    setIsRefinancePage(true)
  }

  const handleRefinanceGivenAmountChange = (val: string) => {
    setRefinanceGivenAmount(val)
    const g = parseFloat(val) || 0
    const targetLoan = activeRefinanceLoan || refinanceTargetLoan || fullDetailsSelectedLoan || selectedCustomerDetails
    const origGiven = Number(targetLoan?.given_amount || 0)
    const curTotal = Number(targetLoan?.total_amount || 0)
    const curPaid = Number(targetLoan?.paid || 0)
    const currentBalance = targetLoan?.balance !== undefined && targetLoan?.balance !== null
      ? Number(targetLoan.balance)
      : (targetLoan ? Math.max(0, curTotal - curPaid) : 0)

    const origInterest = targetLoan?.interest_amount != null && !isNaN(Number(targetLoan.interest_amount)) && Number(targetLoan.interest_amount) > 0
      ? Number(targetLoan.interest_amount)
      : (curTotal > origGiven ? curTotal - origGiven : 0)
    const interestRate = origGiven > 0 ? origInterest / origGiven : 0

    const refAmountNum = currentBalance > g ? 0 : Math.max(0, g - currentBalance)
    const newRefinanceAmount = currentBalance > g ? 'Not for Refinance' : (g === currentBalance ? '0' : String(refAmountNum))
    setRefinanceRefinanceAmount(newRefinanceAmount)

    if (!isRefinanceTotalOverridden) {
      const newInterest = Math.round(g * interestRate)
      const newTotal = g + newInterest
      setRefinanceTotalAmount(String(newTotal))
    }
  }

  const handleRefinanceRefinanceAmountChange = (val: string) => {
    setRefinanceRefinanceAmount(val)
    if (val === 'Not for Refinance') return
    const g = parseFloat(refinanceGivenAmount) || 0
    const targetLoan = activeRefinanceLoan || refinanceTargetLoan || fullDetailsSelectedLoan || selectedCustomerDetails
    const origGiven = Number(targetLoan?.given_amount || 0)
    const curTotal = Number(targetLoan?.total_amount || 0)
    const origInterest = targetLoan?.interest_amount != null && !isNaN(Number(targetLoan.interest_amount)) && Number(targetLoan.interest_amount) > 0
      ? Number(targetLoan.interest_amount)
      : (curTotal > origGiven ? curTotal - origGiven : 0)
    const interestRate = origGiven > 0 ? origInterest / origGiven : 0

    if (!isRefinanceTotalOverridden) {
      const newInterest = Math.round(g * interestRate)
      const newTotal = g + newInterest
      setRefinanceTotalAmount(String(newTotal))
    }
  }

  const handleRefinanceTotalAmountChange = (val: string) => {
    setRefinanceTotalAmount(val)
    setIsRefinanceTotalOverridden(true)
  }

  const handleRefinanceDurationChange = (d: number) => {
    setRefinanceDuration(d)
    setRefinanceWeeks(d)
    if (!isRefinanceLastDateOverridden && refinanceGivenDate) {
      setRefinanceLastDate(calculateRefinanceDurationLastDate(refinanceGivenDate, refinanceSection, d))
    }
  }

  const handleRefinanceWeeksChange = (w: number) => {
    handleRefinanceDurationChange(w)
  }

  const handleRefinanceGivenDateChange = (val: string) => {
    setRefinanceGivenDate(val)
    if (!isRefinanceLastDateOverridden && refinanceDuration > 0) {
      setRefinanceLastDate(calculateRefinanceDurationLastDate(val, refinanceSection, refinanceDuration))
    }
  }

  const handleRefinanceLastDateChange = (val: string) => {
    setRefinanceLastDate(val)
    setIsRefinanceLastDateOverridden(true)
  }

  const handleRefinanceInstallmentAmountChange = (val: string) => {
    setRefinanceInstallmentAmount(val)
    setIsRefinanceInstallmentOverridden(true)
  }

  const handleSaveRefinance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomerDetails?.id || !refinanceTargetLoan) return

    const targetLoan = activeRefinanceLoan || refinanceTargetLoan || fullDetailsSelectedLoan || selectedCustomerDetails
    const origGiven = Number(targetLoan?.given_amount || 0)
    const curTotal = Number(targetLoan?.total_amount || 0)
    const curPaid = Number(targetLoan?.paid || 0)
    const currentBalance = targetLoan?.balance !== undefined && targetLoan?.balance !== null
      ? Number(targetLoan.balance)
      : Math.max(0, curTotal - curPaid)

    if (currentBalance > origGiven || refinanceRefinanceAmount === 'Not for Refinance') {
      setRefinanceError('This loan is not eligible for refinance because Balance Amount exceeds Given Amount.')
      return
    }

    const rNum = parseFloat(refinanceRefinanceAmount)
    if (isNaN(rNum) || rNum < 0) {
      setRefinanceError('Refinance Amount cannot be negative.')
      return
    }

    const gNum = parseFloat(refinanceGivenAmount)
    if (isNaN(gNum) || gNum <= 0) {
      setRefinanceError('Given Amount is required and must be greater than 0.')
      return
    }

    const tNum = parseFloat(refinanceTotalAmount)
    if (isNaN(tNum) || tNum <= 0) {
      setRefinanceError('Total Amount is required and must be greater than 0.')
      return
    }

    const instNum = parseFloat(refinanceInstallmentAmount)
    if (isNaN(instNum) || instNum <= 0) {
      setRefinanceError('Installment Amount is required and must be greater than 0.')
      return
    }

    if (!refinanceGivenDate.trim()) {
      setRefinanceError('Given Date is required.')
      return
    }

    if (!refinanceLastDate.trim()) {
      setRefinanceError('Last Date is required.')
      return
    }

    setIsSavingRefinance(true)
    setRefinanceError('')

    try {
      const targetLoanId = refinanceTargetLoan.loan_id || refinanceTargetLoan.id
      const res = await fetch('/api/customers/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerDetails.id,
          given_amount: gNum,
          interest_amount: Math.max(0, tNum - gNum),
          total_amount: tNum,
          installment_amount: instNum,
          given_date: refinanceGivenDate,
          last_date: refinanceLastDate,
          referral_name: refinanceTargetLoan.referral_name || null,
          referral_number: refinanceTargetLoan.referral_number || null,
          notes_taken: false,
          cheque_taken: false,
          additional_details: null,
          refinanced_from_loan_id: targetLoanId,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const newLoan = json?.data?.loan
        if (newLoan) {
          if (targetLoanId === selectedCustomerDetails.id) {
            setSelectedCustomerDetails((prev) => (prev ? { ...prev, status: 'CLOSED' } : null))
            setCustomers((prev) =>
              prev.map((c) => (c.id === selectedCustomerDetails.id ? { ...c, status: 'CLOSED' } : c))
            )
          } else {
            setAdditionalLoans((prev) =>
              prev.map((l) => (l.id === targetLoanId ? { ...l, status: 'CLOSED' } : l))
            )
          }

          setAdditionalLoans((prev) => [newLoan, ...prev.filter((l) => l.id !== newLoan.id)])
          fetchAdditionalLoans(selectedCustomerDetails.id)
          setSelectedAdditionalLoanDetailId(newLoan.id)
          setSelectedLoanView('additional-loan')
          setSelectedPaymentLoanIndex(chronologicalAdditionalLoans.length + 1)
        }

        customerCacheRef.current = {}
        setIsRefinanceEditable(false)
        setIsRefinancePage(false)
        setIsFullDetailsPage(true)
      } else {
        const errJson = await res.json().catch(() => ({}))
        setRefinanceError(errJson?.message || 'Failed to save refinanced loan.')
      }
    } catch (err) {
      console.error('Error saving refinanced loan:', err)
      setRefinanceError('An unexpected error occurred while saving the refinanced loan.')
    } finally {
      setIsSavingRefinance(false)
    }
  }


  // ── Customer Image Upload & Modal handlers ──
  const handleOpenImageModal = (imageUrl: string) => {
    if (!imageUrl) return
    setImageToPreview(imageUrl)
    setIsPreviewImageModalOpen(true)
  }

  const handleCloseImageModal = () => {
    setIsPreviewImageModalOpen(false)
    setImageToPreview('')
  }

  const handleDownloadPhoto = async () => {
    const photoUrl = imageToPreview || selectedCustomerDetails?.photo_url
    if (!photoUrl) return

    try {
      let extension = 'jpg'
      if (photoUrl.startsWith('data:image/')) {
        const mimeMatch = photoUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);/)
        if (mimeMatch && mimeMatch[1]) {
          const sub = mimeMatch[1].toLowerCase()
          if (sub === 'jpeg' || sub === 'jpg') extension = 'jpg'
          else if (sub === 'png') extension = 'png'
          else if (sub === 'webp') extension = 'webp'
          else extension = sub
        }
      } else {
        try {
          const urlObj = new URL(photoUrl, window.location.href)
          const parts = urlObj.pathname.split('.')
          if (parts.length > 1) {
            const ext = parts.pop()?.toLowerCase()
            if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
              extension = ext === 'jpeg' ? 'jpg' : ext
            }
          }
        } catch {
          // ignore url parse error
        }
      }

      const safeName = (selectedCustomerDetails?.name || 'customer')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')

      // Fetch blob to download original file without navigating or opening a new tab
      const res = await fetch(photoUrl)
      const blob = await res.blob()
      if (blob.type) {
        if (blob.type.includes('png')) extension = 'png'
        else if (blob.type.includes('webp')) extension = 'webp'
        else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) extension = 'jpg'
      }
      const finalFileName = `${safeName || 'customer'}_photo.${extension}`
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = finalFileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      // Fallback direct anchor download
      const safeName = (selectedCustomerDetails?.name || 'customer')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
      const link = document.createElement('a')
      link.href = photoUrl
      link.download = `${safeName || 'customer'}_photo.jpg`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleUploadPhoto = async (file: File) => {
    if (!selectedCustomerDetails || isUploadingPhoto) return

    // Limit to reasonable image types
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.')
      return
    }

    setIsUploadingPhoto(true)
    setPhotoUploadError('')

    try {
      // Read and compress image client-side to maximum 1000px dimension
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = document.createElement('img')
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const maxDim = 1000
            let width = img.width
            let height = img.height
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width)
                width = maxDim
              } else {
                width = Math.round((width * maxDim) / height)
                height = maxDim
              }
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', 0.85))
          }
          img.onerror = () => resolve(e.target?.result as string)
          img.src = e.target?.result as string
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomerDetails.id,
          photo_url: dataUrl,
        }),
      })

      const json = await res.json()
      if (!res.ok || json?.success === false) {
        setPhotoUploadError(json?.message || 'Failed to save customer image.')
        alert(json?.message || 'Failed to save customer image.')
        return
      }

      const updated = json.data.customer
      setSelectedCustomerDetails((prev) => (prev ? { ...prev, photo_url: updated.photo_url } : null))
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomerDetails.id ? { ...c, photo_url: updated.photo_url } : c))
      )
      customerCacheRef.current = {}
      if (isPreviewImageModalOpen) {
        setImageToPreview(updated.photo_url)
      }
    } catch (err) {
      console.error('Photo upload error:', err)
      setPhotoUploadError('Failed to upload image. Please try again.')
      alert('Failed to upload image. Please try again.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Listen to popstate for browser back button support
  useEffect(() => {
    const handlePopState = () => {
      if (isRefinancePage) {
        setIsRefinancePage(false)
      } else if (isFullDetailsPage) {
        setIsFullDetailsPage(false)
      } else if (selectedCustomerId) {
        setSelectedCustomerId(null)
        setIsDetailsExpanded(false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isRefinancePage, isFullDetailsPage, selectedCustomerId])

  // Lock document scrolling strictly to prevent page-level vertical scroll when viewing customer details
  useEffect(() => {
    if (selectedCustomerId && !isFullDetailsPage) {
      const origBodyOverflow = document.body.style.overflow
      const origHtmlOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = origBodyOverflow
        document.documentElement.style.overflow = origHtmlOverflow
      }
    }
  }, [selectedCustomerId, isFullDetailsPage])

  const handleOpenCustomerDetails = async (customerId: string) => {
    setSelectedCustomerId(customerId)
    setIsDetailsExpanded(false)
    setIsFullDetailsPage(false)
    setIsRefinancePage(false)
    setSelectedLoanView('view-details')
    setSelectedAdditionalLoanDetailId(null)
    setIsAdditionalLoanMenuOpen(false)
    if (typeof window !== 'undefined') {
      window.history.pushState({ customerDetails: customerId }, '', window.location.href)
    }

    const existing = customers.find((c) => c.id === customerId) || null
    setSelectedCustomerDetails(existing)
    setIsLoadingCustomerDetails(true)

    try {
      const res = await fetch(`/api/customers?id=${customerId}`)
      if (res.ok) {
        const json = await res.json()
        const cust = json?.data?.customer
        if (cust) {
          setSelectedCustomerDetails(cust)
        }
      }
    } catch (err) {
      console.error('Failed to load customer details:', err)
    } finally {
      setIsLoadingCustomerDetails(false)
    }
  }

  const handleOpenViewDetailsPage = () => {
    setSelectedLoanView('view-details')
    setSelectedAdditionalLoanDetailId(null)
    setIsFullDetailsPage(true)
    setIsRefinancePage(false)
    if (typeof window !== 'undefined') {
      window.history.pushState({ viewKycFullPage: true }, '', window.location.href)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && customers.length > 0) {
      const params = new URLSearchParams(window.location.search)
      const targetId = params.get('customerId') || params.get('customer')
      const targetFull = params.get('fullDetails') === 'true' || params.get('viewDetails') === 'true'
      if (targetId) {
        const found = customers.find(
          (c) => c.id === targetId || c.name.toLowerCase() === targetId.toLowerCase()
        )
        if (found) {
          handleOpenCustomerDetails(found.id)
          if (targetFull) {
            setIsFullDetailsPage(true)
            setIsRefinancePage(false)
            setSelectedLoanView('view-details')
          }
        }
      }
    }
  }, [customers])

  const handleDeleteCustomer = async () => {
    if (!selectedCustomerDetails || isDeletingCustomer) return
    if (!window.confirm(`Are you sure you want to delete ${selectedCustomerDetails.name}?`)) {
      return
    }

    setIsDeletingCustomer(true)
    try {
      const res = await fetch(`/api/customers?id=${selectedCustomerDetails.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        const deletedId = selectedCustomerDetails.id
        setCustomers((prev) => prev.filter((c) => c.id !== deletedId))
        customerCacheRef.current = {}
        setIsFullDetailsPage(false)
        setIsRefinancePage(false)
        setSelectedCustomerId(null)
        setSelectedCustomerDetails(null)
      } else {
        const json = await res.json()
        alert(json?.error || 'Failed to delete customer')
      }
    } catch (err) {
      console.error('Delete customer error:', err)
      alert('Failed to delete customer. Please try again.')
    } finally {
      setIsDeletingCustomer(false)
    }
  }

  const handleBackToCustomerList = () => {
    if (typeof window !== 'undefined' && window.history.state?.customerDetails) {
      window.history.back()
    } else {
      setSelectedCustomerId(null)
      setIsFullDetailsPage(false)
      setIsRefinancePage(false)
    }
  }

  // Filter user areas by currently active section (for top page filter)
  const sectionAreas = useMemo(() => {
    return areasList.filter((a) => {
      const sec = (a.section || 'DAILY').toUpperCase()
      return sec === activeSection
    })
  }, [areasList, activeSection])

  // Filter user areas for Add Customer modal based on modal's newCustomerSection
  const modalSectionAreas = useMemo(() => {
    return areasList.filter((a) => {
      const sec = (a.section || 'DAILY').toUpperCase()
      return sec === newCustomerSection
    })
  }, [areasList, newCustomerSection])

  const selectedModalArea = useMemo(() => {
    return modalSectionAreas.find((a) => a.id === modalAreaId) || null
  }, [modalSectionAreas, modalAreaId])

  // Handle section switch with automatic area sync & clearing (on page)
  const handleSectionChange = (sec: SectionType) => {
    setSelectedCustomerId(null)
    setIsFullDetailsPage(false)
    setActiveSection(sec)
    setIsSectionDropdownOpen(false)

    // If currently selected area does not belong to the newly selected section, clear it
    if (selectedArea) {
      const areaSection = (selectedArea.section || 'DAILY').toUpperCase()
      if (areaSection !== sec) {
        setSelectedArea(null)
      }
    }
  }

  // Handle section switch inside Add Customer modal
  const handleModalSectionChange = (sec: SectionType) => {
    setNewCustomerSection(sec)
    setIsModalSectionOpen(false)
    setIsModalAreaOpen(false)

    // Automatically update available area in the modal
    const available = areasList.filter(
      (a) => (a.section || 'DAILY').toUpperCase() === sec
    )
    const newAreaId = available.some((a) => a.id === modalAreaId)
      ? modalAreaId
      : (available[0]?.id || '')
    setModalAreaId(newAreaId)

    // Re-estimate S.no for the new area & section
    const targetKey = `${newAreaId}_${sec}`
    const existing = customerCacheRef.current[targetKey] || []
    const maxSno = existing.reduce((max, c: any) => Math.max(max, Number(c.serial_number) || 0), 0)
    setSerialNumber(String(maxSno > 0 ? maxSno + 1 : (existing.length + 1)))

    // Automatically recalculate Last Date for the new Section
    recalcLastDate(givenDate, sec, addFormDuration)
  }

  // Load customers whenever selectedArea or activeSection changes
  useEffect(() => {
    if (!selectedArea) {
      setCustomers([])
      setIsLoading(false)
      return
    }

    const cacheKey = `${selectedArea.id}_${activeSection}`

    // 1. If data is already cached, reuse it immediately (0ms delay, no network request)
    if (customerCacheRef.current[cacheKey]) {
      setCustomers(customerCacheRef.current[cacheKey])
      setIsLoading(false)
      return
    }

    // 2. Abort any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)

    async function loadCustomers() {
      try {
        const res = await fetch(
          `/api/customers?area_id=${encodeURIComponent(selectedArea!.id)}&section=${activeSection}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const json = await res.json()
          const list: CustomerItem[] = json?.data?.customers || []
          customerCacheRef.current[cacheKey] = list
          if (!controller.signal.aborted) {
            setCustomers(list)
          }
        } else {
          if (!controller.signal.aborted) {
            setCustomers([])
          }
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Failed to load customers:', err)
          setCustomers([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadCustomers()

    return () => {
      controller.abort()
    }
  }, [selectedArea?.id, activeSection])

  const handleOpenAddModal = () => {
    const defaultSec = activeSection
    const availableForSec = areasList.filter(
      (a) => (a.section || 'DAILY').toUpperCase() === defaultSec
    )

    let defaultAreaId = ''
    if (selectedArea && (selectedArea.section || 'DAILY').toUpperCase() === defaultSec) {
      defaultAreaId = selectedArea.id
    } else if (availableForSec.length > 0) {
      defaultAreaId = availableForSec[0].id
    }

    // Calculate default S.no based on existing customers for this area & section
    const cacheKey = `${defaultAreaId}_${defaultSec}`
    const existing = customerCacheRef.current[cacheKey] || (selectedArea?.id === defaultAreaId ? customers : [])
    const maxSno = existing.reduce((max, c: any) => Math.max(max, Number(c.serial_number) || 0), 0)
    const defaultSno = maxSno > 0 ? maxSno + 1 : (existing.length + 1)

    const todayStr = new Date().toISOString().split('T')[0]

    setNewCustomerSection(defaultSec)
    setModalAreaId(defaultAreaId)
    setPhotoUrl('')
    setPhotoSizeKb(null)
    setSerialNumber(String(defaultSno))
    setNewCustomerName('')
    setNewCustomerPhone('')
    setAddress('')
    setLatitude(null)
    setLongitude(null)
    setLocationMessage('')
    setAlternativeNumber('')
    setReferralName('')
    setReferralNumber('')
    setGivenAmount('')
    setInterestAmount('')
    setTotalAmount('')
    setIsTotalOverridden(false)
    setInstallmentAmount('')
    setGivenDate(todayStr)
    setLastDate('')
    setAddFormDuration('')
    setNotesTaken(false)
    setChequeTaken(false)
    setAdditionalDetails('')
    setFormError('')
    setSerialNumberError('')
    setIsModalSectionOpen(false)
    setIsModalAreaOpen(false)
    setIsAddModalOpen(true)
  }

  const checkSerialNumberDuplicate = async (sno: string): Promise<boolean> => {
    const trimmed = sno.trim()
    if (!trimmed) return false
    const num = parseInt(trimmed, 10)
    if (isNaN(num)) return false
    try {
      const res = await fetch(`/api/customers?check_serial=${num}`)
      if (res.ok) {
        const json = await res.json()
        if (json?.data?.exists) {
          setSerialNumberError(`Serial number ${trimmed} already exists. Please select another number.`)
          return true
        }
      }
    } catch (err) {
      console.error('Error checking serial number duplicate:', err)
    }
    return false
  }

  // Handle Photo File Selection & Client-Side Compression (< 50 KB)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCompressingPhoto(true)
    setFormError('')
    try {
      const { dataUrl, sizeKb } = await compressImageToMax50KB(file)
      setPhotoUrl(dataUrl)
      setPhotoSizeKb(sizeKb)
    } catch (err) {
      console.error('Photo compression error:', err)
      setFormError('Failed to process photo. Please choose another image file.')
    } finally {
      setIsCompressingPhoto(false)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoUrl('')
    setPhotoSizeKb(null)
    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
  }

  // Handle Location Detection on Location Icon Click Only
  const handleDetectLocation = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationMessage('Geolocation is not supported by your browser.')
      return
    }

    setIsDetectingLocation(true)
    setLocationMessage('Detecting current location...')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Capture EXACT GPS coordinates directly from device Geolocation API
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setLatitude(lat)
        setLongitude(lon)

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { Accept: 'application/json' } }
          )
          if (res.ok) {
            const data = await res.json()
            if (data && data.display_name) {
              setAddress(data.display_name)
              setLocationMessage('Exact GPS location detected.')
            } else {
              setAddress(`${lat.toFixed(6)}, ${lon.toFixed(6)}`)
              setLocationMessage('Exact GPS coordinates detected.')
            }
          } else {
            setAddress(`${lat.toFixed(6)}, ${lon.toFixed(6)}`)
            setLocationMessage('Exact GPS coordinates detected.')
          }
        } catch {
          setAddress(`${lat.toFixed(6)}, ${lon.toFixed(6)}`)
          setLocationMessage('Exact GPS coordinates detected.')
        } finally {
          setIsDetectingLocation(false)
        }
      },
      (error) => {
        setIsDetectingLocation(false)
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage('Location permission denied. Precise GPS location was not captured.')
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationMessage('High-accuracy GPS location is unavailable on this device.')
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage('Location request timed out. Precise GPS location could not be determined.')
        } else {
          setLocationMessage('Failed to capture precise GPS location.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // Recalculate Last Date from Given Date + Section + current duration selection
  const recalcLastDate = (gDate: string, sec: SectionType, durVal: string) => {
    const num = parseInt(durVal, 10)
    if (!gDate || isNaN(num) || num <= 0) return
    const parts = gDate.slice(0, 10).split('-')
    if (parts.length !== 3) return
    const yr = parseInt(parts[0], 10)
    const mo = parseInt(parts[1], 10) - 1
    const dy = parseInt(parts[2], 10)
    if (isNaN(yr) || isNaN(mo) || isNaN(dy)) return

    if (sec === 'DAILY') {
      const d = new Date(yr, mo, dy)
      d.setDate(d.getDate() + num)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      setLastDate(`${yyyy}-${mm}-${dd}`)
    } else if (sec === 'WEEKLY') {
      const d = new Date(yr, mo, dy)
      d.setDate(d.getDate() + num * 7)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      setLastDate(`${yyyy}-${mm}-${dd}`)
    } else if (sec === 'MONTHLY') {
      // Calendar-month addition preserving day-of-month whenever possible
      const totalMonths = mo + num
      const targetYear = yr + Math.floor(totalMonths / 12)
      const targetMonth = ((totalMonths % 12) + 12) % 12
      // Last valid day of target month (day 0 of targetMonth + 1)
      const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate()
      const targetDay = Math.min(dy, maxDay)
      const yyyy = targetYear
      const mm = String(targetMonth + 1).padStart(2, '0')
      const dd = String(targetDay).padStart(2, '0')
      setLastDate(`${yyyy}-${mm}-${dd}`)
    }
  }

  // When Given Date changes, keep Last Date in sync if a duration is set
  const handleAddFormGivenDateChange = (val: string) => {
    setGivenDate(val)
    recalcLastDate(val, newCustomerSection, addFormDuration)
  }

  // When duration number changes, recalculate Last Date
  const handleAddFormDurValueChange = (val: string) => {
    setAddFormDuration(val)
    recalcLastDate(givenDate, newCustomerSection, val)
  }

  // Handle Given Amount Change
  const handleGivenAmountChange = (val: string) => {
    setGivenAmount(val)
    if (!isTotalOverridden) {
      const g = parseFloat(val) || 0
      const i = parseFloat(interestAmount) || 0
      setTotalAmount(val || interestAmount ? String(g + i) : '')
    }
  }

  // Handle Interest Amount Change
  const handleInterestAmountChange = (val: string) => {
    setInterestAmount(val)
    if (!isTotalOverridden) {
      const g = parseFloat(givenAmount) || 0
      const i = parseFloat(val) || 0
      setTotalAmount(givenAmount || val ? String(g + i) : '')
    }
  }

  // Handle Manual Total Amount Override
  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val)
    setIsTotalOverridden(true)
  }

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomerName.trim() || !newCustomerPhone.trim() || isSubmitting) return

    if (!modalAreaId) {
      setFormError(`Please select an area under ${sectionDisplayMap[newCustomerSection]}`)
      return
    }

    if (!serialNumber.trim()) {
      setFormError('S.no is required')
      return
    }

    setSerialNumberError('')
    const isDuplicate = await checkSerialNumberDuplicate(serialNumber)
    if (isDuplicate) {
      return
    }
    if (!givenAmount.trim()) {
      setFormError('Given Amount is required')
      return
    }
    if (!interestAmount.trim()) {
      setFormError('Interest Amount is required')
      return
    }
    if (!totalAmount.trim()) {
      setFormError('Total Amount is required')
      return
    }
    if (!installmentAmount.trim()) {
      setFormError('Installment Amount is required')
      return
    }
    if (!givenDate.trim()) {
      setFormError('Given Date is required')
      return
    }
    if (!lastDate.trim()) {
      setFormError('Last Date is required')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          phone_number: newCustomerPhone.trim(),
          area_id: modalAreaId,
          section: newCustomerSection,
          photo_url: photoUrl || null,
          serial_number: serialNumber ? parseInt(serialNumber, 10) : null,
          address: address.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          alternative_number: alternativeNumber.trim() || null,
          referral_name: referralName.trim() || null,
          referral_number: referralNumber.trim() || null,
          given_amount: givenAmount ? Number(givenAmount) : null,
          interest_amount: interestAmount ? Number(interestAmount) : null,
          total_amount: totalAmount ? Number(totalAmount) : null,
          installment_amount: installmentAmount ? Number(installmentAmount) : null,
          given_date: givenDate || null,
          last_date: lastDate || null,
          notes_taken: notesTaken,
          cheque_taken: chequeTaken,
          additional_details: additionalDetails.trim() || null,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const added = json?.data?.customer
        if (added) {
          const targetArea = areasList.find((a) => a.id === modalAreaId) || null
          const targetKey = `${modalAreaId}_${added.section}`

          // Update cache with the newly created customer
          const existingList = customerCacheRef.current[targetKey] || []
          customerCacheRef.current[targetKey] = [
            added,
            ...existingList.filter((c) => c.id !== added.id),
          ]

          if (added.section === activeSection && selectedArea?.id === modalAreaId) {
            setCustomers(customerCacheRef.current[targetKey])
          } else {
            if (targetArea) {
              setSelectedArea(targetArea)
              setActiveSection(added.section)
              router.replace(`/dashboard/areas/${targetArea.id}`)
            }
          }
          setIsAddModalOpen(false)
        }
      } else {
        const errJson = await res.json().catch(() => ({}))
        const errMsg = errJson?.message || 'Failed to add customer'
        if (res.status === 409 || errMsg.toLowerCase().includes('serial number')) {
          setSerialNumberError(errMsg)
        } else {
          setFormError(errMsg)
        }
      }
    } catch (err) {
      console.error('Error adding customer:', err)
      setFormError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle Area Mark/Unmark
  const handleToggleAreaMark = async (areaId: string) => {
    setAreasList((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, is_marked: !a.is_marked } : a))
    )
    if (selectedArea?.id === areaId) {
      setSelectedArea((prev) => (prev ? { ...prev, is_marked: !prev.is_marked } : null))
    }

    try {
      const res = await fetch('/api/areas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: areaId }),
      })
      if (!res.ok) {
        throw new Error('Failed to update area mark status')
      }
      const json = await res.json()
      const updatedArea = json?.data?.area
      if (updatedArea) {
        setAreasList((prev) =>
          prev.map((a) => (a.id === areaId ? { ...a, is_marked: Boolean(updatedArea.is_marked) } : a))
        )
        if (selectedArea?.id === areaId) {
          setSelectedArea((prev) => (prev ? { ...prev, is_marked: Boolean(updatedArea.is_marked) } : null))
        }
      }
    } catch (err) {
      console.error('Error toggling area mark:', err)
      setAreasList((prev) =>
        prev.map((a) => (a.id === areaId ? { ...a, is_marked: !a.is_marked } : a))
      )
      if (selectedArea?.id === areaId) {
        setSelectedArea((prev) => (prev ? { ...prev, is_marked: !prev.is_marked } : null))
      }
    }
  }

  // Toggle Customer Mark/Unmark
  const handleToggleCustomerMark = async (customerId: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, is_marked: !c.is_marked } : c))
    )
    Object.keys(customerCacheRef.current).forEach((key) => {
      customerCacheRef.current[key] = customerCacheRef.current[key].map((c) =>
        c.id === customerId ? { ...c, is_marked: !c.is_marked } : c
      )
    })

    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      })
      if (!res.ok) {
        throw new Error('Failed to update customer mark status')
      }
      const json = await res.json()
      const updatedCustomer = json?.data?.customer
      if (updatedCustomer) {
        const markedVal = Boolean(updatedCustomer.is_marked)
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, is_marked: markedVal } : c))
        )
        Object.keys(customerCacheRef.current).forEach((key) => {
          customerCacheRef.current[key] = customerCacheRef.current[key].map((c) =>
            c.id === customerId ? { ...c, is_marked: markedVal } : c
          )
        })
      }
    } catch (err) {
      console.error('Error toggling customer mark:', err)
      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, is_marked: !c.is_marked } : c))
      )
      Object.keys(customerCacheRef.current).forEach((key) => {
        customerCacheRef.current[key] = customerCacheRef.current[key].map((c) =>
          c.id === customerId ? { ...c, is_marked: !c.is_marked } : c
        )
      })
    }
  }

  // Filter customers by exact serial number or name, flagged filter, and high-risk filter, sorted in serial number ascending order
  const filteredCustomers = useMemo(() => {
    let list = customers
    if (isFlagFilterActive) {
      list = list.filter((c) => Boolean(c.is_marked))
    }

    if (customerRiskFilter === 'HIGH_RISK') {
      list = list.filter((c) => getCustomerDueStatus(c).isHighRisk)
    }

    const getSerialNum = (c: CustomerItem) => {
      if (c.serial_number != null) {
        const n = Number(c.serial_number)
        if (!isNaN(n)) return n
      }
      return Infinity
    }

    const sortAscending = (items: CustomerItem[]) => {
      return [...items].sort((a, b) => {
        const aNum = getSerialNum(a)
        const bNum = getSerialNum(b)
        if (aNum !== bNum) return aNum - bNum
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
        return aDate - bDate
      })
    }

    const q = searchQuery.toLowerCase().trim()
    if (!q) {
      return sortAscending(list)
    }

    const cleanQ = q.replace(/^(s\.?no\.?|#)\s*[:#-]?\s*/i, '').trim()
    const isNumeric = /^\d+$/.test(cleanQ)

    const filtered = list.filter((c) => {
      if (isNumeric) {
        // Numeric input: match the FULL serial number exactly (exact equality, no partial/contains)
        const snoStr = c.serial_number != null ? String(c.serial_number).trim() : ''
        return snoStr === cleanQ
      } else {
        // Name input: search customer name only (no phone, area, section, address, etc.)
        return c.name ? c.name.toLowerCase().includes(q) : false
      }
    })

    return sortAscending(filtered)
  }, [customers, searchQuery, isFlagFilterActive, customerRiskFilter])

  const renderLoanViewDropdown = () => {
    const getDropdownLabel = () => {
      if (selectedLoanView === 'view-details') return 'View Details'
      if (selectedLoanView === 'active-loan') return 'Active Loan'
      if (selectedLoanView === 'under-review') return 'Under Review'
      if (selectedLoanView === 'closed-loan') return 'Closed Loan'
      return 'Additional Loan'
    }

    return (
      <div className="relative">
        <button
          type="button"
          id="btn-additional-loan"
          onClick={() => setIsAdditionalLoanMenuOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100/80 border border-[#1B52E8]/30 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap"
        >
          {getDropdownLabel()}
        </button>

        {isAdditionalLoanMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsAdditionalLoanMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1.5 w-36 sm:w-44 rounded-xl bg-white p-1 shadow-lg border border-slate-200/90 z-40 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedLoanView('view-details')
                  setSelectedAdditionalLoanDetailId(null)
                  setIsAdditionalLoanMenuOpen(false)
                  handleOpenViewDetailsPage()
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedLoanView === 'view-details'
                    ? 'bg-[#EBF3FF] text-[#1B52E8] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#1B52E8]'
                }`}
              >
                <span>View Details</span>
                {selectedLoanView === 'view-details' && (
                  <Check className="h-3.5 w-3.5 text-[#1B52E8]" />
                )}
              </button>

              {/* Additional Loan */}
              <button
                type="button"
                onClick={() => {
                  setSelectedLoanView('additional-loan')
                  setSelectedAdditionalLoanDetailId(null)
                  setIsAdditionalLoanMenuOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedLoanView === 'additional-loan' || selectedLoanView.startsWith('additional-loan') || selectedAdditionalLoanDetailId
                    ? 'bg-[#EBF3FF] text-[#1B52E8] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#1B52E8]'
                }`}
              >
                <span>Additional Loan</span>
                {(selectedLoanView === 'additional-loan' || selectedLoanView.startsWith('additional-loan') || selectedAdditionalLoanDetailId) && (
                  <Check className="h-3.5 w-3.5 text-[#1B52E8]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedLoanView('active-loan')
                  setSelectedAdditionalLoanDetailId(null)
                  setIsAdditionalLoanMenuOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedLoanView === 'active-loan'
                    ? 'bg-[#EBF3FF] text-[#1B52E8] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#1B52E8]'
                }`}
              >
                <span>Active Loan</span>
                {selectedLoanView === 'active-loan' && (
                  <Check className="h-3.5 w-3.5 text-[#1B52E8]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedLoanView('under-review')
                  setSelectedAdditionalLoanDetailId(null)
                  setIsAdditionalLoanMenuOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedLoanView === 'under-review'
                    ? 'bg-[#EBF3FF] text-[#1B52E8] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#1B52E8]'
                }`}
              >
                <span>Under Review</span>
                {selectedLoanView === 'under-review' && (
                  <Check className="h-3.5 w-3.5 text-[#1B52E8]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedLoanView('closed-loan')
                  setSelectedAdditionalLoanDetailId(null)
                  setIsAdditionalLoanMenuOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedLoanView === 'closed-loan'
                    ? 'bg-[#EBF3FF] text-[#1B52E8] font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-[#1B52E8]'
                }`}
              >
                <span>Closed Loan</span>
                {selectedLoanView === 'closed-loan' && (
                  <Check className="h-3.5 w-3.5 text-[#1B52E8]" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderSelectedAdditionalLoanDetailsView = (loan: CustomerLoan) => {
    const chronoIdx = chronologicalAdditionalLoans.findIndex((l) => l.id === loan.id)
    const loanNum = chronoIdx !== -1 ? chronoIdx + 2 : 2

    const loanPayments = (selectedCustomerDetails?.payments || []).filter(
      (p) => p.loan_id === loan.id
    )
    const recordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const calc = calculateLoanBalanceAndPaid(
      loan.id,
      loan.given_amount,
      loan.total_amount,
      recordedPaid,
      additionalLoans
    )
    const paid = calc.paid
    const totalAmount = Number(loan.total_amount || 0)
    const balance = calc.balance
    const dueInfo = calculateDueRemaining(
      loan.given_date,
      loan.last_date,
      (loan as any).section || selectedCustomerDetails?.section || activeSection
    )

    const weeksMatch = dueInfo.text.match(/^(\d+)/)
    const weeksNum = weeksMatch ? parseInt(weeksMatch[1], 10) : 0
    const dueColor = dueInfo.isLate
      ? 'text-rose-600'
      : weeksNum === 0
      ? 'text-rose-600'
      : weeksNum <= 2
      ? 'text-orange-500'
      : 'text-emerald-600'

    const additionalLoanCustomer: CustomerItem = {
      ...(selectedCustomerDetails as CustomerItem),
      loan_id: loan.id,
      loan_number: loanNum,
      is_main_loan: false,
      total_amount: totalAmount,
      paid,
      balance,
      installment_amount: loan.installment_amount,
      given_date: loan.given_date,
      last_date: loan.last_date,
      given_payment_method: (loan as any).given_payment_method || 'Cash',
      payments: loanPayments,
      due_remaining: dueInfo.text,
      due_remaining_is_late: dueInfo.isLate,
    }

    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        {/* Top Header Card */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-back-additional-loans"
                onClick={() => {
                  setSelectedAdditionalLoanDetailId(null)
                  setIsEditingAdditionalLoan(false)
                  setAdditionalLoanEditError('')
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100 border border-[#1B52E8]/30 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
                ADDITIONAL LOAN #{loanNum}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isEditingAdditionalLoan && renderLoanViewDropdown()}

              {!isEditingAdditionalLoan ? (
                <button
                  type="button"
                  id="btn-edit-additional-loan"
                  onClick={() => handleStartEditAdditionalLoan(loan)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100/80 border border-[#1B52E8]/30 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-cancel-edit-additional-loan"
                    onClick={handleCancelEditAdditionalLoan}
                    disabled={isSavingAdditionalLoanEdit}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-save-edit-additional-loan"
                    onClick={() => handleSaveAdditionalLoanEdit(loan.id)}
                    disabled={isSavingAdditionalLoanEdit}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-[#1B52E8] hover:bg-[#1542C2] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                  >
                    {isSavingAdditionalLoanEdit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {additionalLoanEditError && (
            <div className="p-2.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl">
              {additionalLoanEditError}
            </div>
          )}

          {/* Customer Identification Context Bar: S.No, Customer Name, Area, Section */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs sm:text-sm">
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">S.No</span>
              <span className="font-bold text-[#0D1B3E] mt-0.5">
                {selectedCustomerDetails?.serial_number != null ? selectedCustomerDetails.serial_number : '-'}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Customer Name</span>
              <span className="font-bold text-[#0D1B3E] mt-0.5 truncate">
                {selectedCustomerDetails?.name}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Area</span>
              <span className="font-bold text-[#0D1B3E] mt-0.5 truncate">
                {(selectedCustomerDetails as any)?.area_name || selectedArea?.name || '-'}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Section</span>
              <span className="font-bold text-[#0D1B3E] mt-0.5">
                {selectedCustomerDetails?.section ? (sectionDisplayMap[selectedCustomerDetails.section] || selectedCustomerDetails.section) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* 1. Financial Details */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
            <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
              Financial Details
            </h3>
          </div>
          {!isEditingAdditionalLoan ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Given Amount</div>
                <div className="mt-1 text-sm sm:text-base font-bold text-[#0D1B3E]">
                  ₹{loan.given_amount != null ? formatCleanMoney(loan.given_amount) : '-'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Interest Amount</div>
                <div className="mt-1 text-sm sm:text-base font-bold text-emerald-600">
                  ₹{loan.interest_amount != null ? formatCleanMoney(loan.interest_amount) : '-'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Total Amount</div>
                <div className="mt-1 text-sm sm:text-base font-bold text-[#1B52E8]">
                  ₹{loan.total_amount != null ? formatCleanMoney(loan.total_amount) : '-'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-500">Installment Amount</div>
                <div className="mt-1 text-sm sm:text-base font-bold text-[#0D1B3E]">
                  ₹{loan.installment_amount != null ? formatCleanMoney(loan.installment_amount) : '-'}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Given Amount</span>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={editAddLoanGivenAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      setEditAddLoanGivenAmount(val)
                      const g = parseFloat(val) || 0
                      const i = parseFloat(editAddLoanInterestAmount) || 0
                      if (g > 0 || i > 0) {
                        setEditAddLoanTotalAmount(String(g + i))
                      }
                    }}
                    placeholder="0"
                    className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                  />
                </div>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Interest Amount</span>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={editAddLoanInterestAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      setEditAddLoanInterestAmount(val)
                      const g = parseFloat(editAddLoanGivenAmount) || 0
                      const i = parseFloat(val) || 0
                      if (g > 0 || i > 0) {
                        setEditAddLoanTotalAmount(String(g + i))
                      }
                    }}
                    placeholder="0"
                    className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-emerald-600 rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                  />
                </div>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Total Amount *</span>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={editAddLoanTotalAmount}
                    onChange={(e) => setEditAddLoanTotalAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-[#1B52E8] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                  />
                </div>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Installment *</span>
                <div className="relative flex items-center">
                  <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    value={editAddLoanInstallmentAmount}
                    onChange={(e) => setEditAddLoanInstallmentAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Payment Summary */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
          <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider mb-3.5 pb-2 border-b border-slate-100">
            Payment Summary
          </h3>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500">Paid Amount</div>
              <div className="mt-1 text-sm sm:text-base font-bold text-emerald-600">
                ₹{formatCleanMoney(paid)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500">Balance Amount</div>
              <div className="mt-1 text-sm sm:text-base font-bold text-[#1B52E8]">
                ₹{formatCleanMoney(balance)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-500">Due Remaining</div>
              <div
                suppressHydrationWarning
                className={`mt-1 text-xs sm:text-sm font-bold ${dueColor}`}
              >
                {dueInfo.text}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Date Details */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
            <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
              Date Details
            </h3>
          </div>
          {!isEditingAdditionalLoan ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs sm:text-sm font-medium text-slate-500">Given Date</span>
                <span suppressHydrationWarning className="text-xs sm:text-sm font-bold text-[#0D1B3E]">
                  {formatDeterministicDate(loan.given_date)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs sm:text-sm font-medium text-slate-500">Last Date</span>
                <span suppressHydrationWarning className="text-xs sm:text-sm font-bold text-[#0D1B3E]">
                  {formatDeterministicDate(loan.last_date)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Given Date</span>
                <DateInputDMY
                  value={editAddLoanGivenDate}
                  onChange={setEditAddLoanGivenDate}
                  className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] cursor-pointer"
                />
              </div>
              <div className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Last Date</span>
                <DateInputDMY
                  value={editAddLoanLastDate}
                  onChange={setEditAddLoanLastDate}
                  className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. VIEW DETAILS */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
            <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
              VIEW DETAILS
            </h3>
          </div>
          {!isEditingAdditionalLoan ? (
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                <span className="text-slate-500 font-medium">Notes Taken</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${loan.notes_taken ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {loan.notes_taken ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                <span className="text-slate-500 font-medium">Cheque Taken</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${loan.cheque_taken ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {loan.cheque_taken ? 'Yes' : 'No'}
                </span>
              </div>
              {(loan.referral_name || loan.referral_number) && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                  <span className="text-slate-500 font-medium">Referral</span>
                  <span className="font-semibold text-[#0D1B3E]">
                    {loan.referral_name || '-'} {loan.referral_number ? `(${loan.referral_number})` : ''}
                  </span>
                </div>
              )}
              <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70">
                <span className="text-slate-500 font-medium mb-1">Additional Details</span>
                <p className="font-semibold text-[#0D1B3E] text-xs whitespace-pre-wrap">
                  {loan.additional_details || '-'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-semibold text-xs sm:text-sm">Notes Taken</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAddLoanNotesTaken(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      editAddLoanNotesTaken
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAddLoanNotesTaken(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      !editAddLoanNotesTaken
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-semibold text-xs sm:text-sm">Cheque Taken</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAddLoanChequeTaken(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      editAddLoanChequeTaken
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAddLoanChequeTaken(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      !editAddLoanChequeTaken
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                <span className="text-slate-500 font-semibold text-[11px] mb-1">Additional Details</span>
                <textarea
                  rows={3}
                  value={editAddLoanAdditionalDetails}
                  onChange={(e) => setEditAddLoanAdditionalDetails(e.target.value)}
                  placeholder="Enter additional details..."
                  className="bg-white px-2.5 py-1.5 text-xs leading-relaxed font-medium text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 5. Payment History Section for this specific Additional Loan */}
        <PaymentHistorySection
          customer={additionalLoanCustomer}
          paymentInputAmount={paymentInputAmount}
          setPaymentInputAmount={setPaymentInputAmount}
          paymentRemarks={paymentRemarks}
          setPaymentRemarks={setPaymentRemarks}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          isRecordingPayment={isRecordingPayment}
          paymentFormError={paymentFormError}
          setPaymentFormError={setPaymentFormError}
          handleRecordPayment={handleRecordPayment}
          handleUpdatePayment={handleUpdatePayment}
          isDetailsExpanded={isDetailsExpanded}
          setIsDetailsExpanded={setIsDetailsExpanded}
          showManualPayment={false}
          showInstallmentButtons={false}
          showEyeIcon={false}
          additionalLoansCount={0}
        />
      </div>
    )
  }

  const renderAdditionalLoanView = () => {
    if (selectedAdditionalLoanDetailId) {
      const selectedLoan = additionalLoans.find((l) => l.id === selectedAdditionalLoanDetailId)
      if (selectedLoan) {
        return renderSelectedAdditionalLoanDetailsView(selectedLoan)
      }
    }
    const additionalLoanTitle = selectedLoanView.startsWith('additional-loan-')
      ? (() => {
          const idx = parseInt(selectedLoanView.replace('additional-loan-', ''), 10) || 0
          return idx === 0 ? 'ADDITIONAL LOAN' : `ADDITIONAL LOAN #${idx + 1}`
        })()
      : 'ADDITIONAL LOAN'

    return (
      <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-4 animate-in fade-in duration-150">
        {/* Section Title & Dropdown */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
            {additionalLoanTitle}
          </h3>
          {renderLoanViewDropdown()}
        </div>

      {/* Customer Identification Context Bar: S.No, Customer Name, Area, Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs sm:text-sm">
        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500">S.No</span>
          <span className="font-bold text-[#0D1B3E] mt-0.5">
            {selectedCustomerDetails?.serial_number != null ? selectedCustomerDetails.serial_number : '-'}
          </span>
        </div>
        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500">Customer Name</span>
          <span className="font-bold text-[#0D1B3E] mt-0.5 truncate">
            {selectedCustomerDetails?.name}
          </span>
        </div>
        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500">Area</span>
          <span className="font-bold text-[#0D1B3E] mt-0.5 truncate">
            {(selectedCustomerDetails as any)?.area_name || selectedArea?.name || '-'}
          </span>
        </div>
        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
          <span className="text-[11px] font-medium text-slate-500">Section</span>
          <span className="font-bold text-[#0D1B3E] mt-0.5">
            {selectedCustomerDetails?.section ? (sectionDisplayMap[selectedCustomerDetails.section] || selectedCustomerDetails.section) : '-'}
          </span>
        </div>
      </div>

      {/* Action Bar: + Add Another Loan Button */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            setIsAddAnotherLoanFormOpen((prev) => !prev)
            setAddLoanFormError('')
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1B52E8] hover:bg-[#1542C2] active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <span>{isAddAnotherLoanFormOpen ? 'Close Loan Form' : '+ Add Another Loan'}</span>
        </button>
      </div>

      {/* Add Another Loan Collapsible Form */}
      {isAddAnotherLoanFormOpen && (
        <form
          onSubmit={handleSaveAdditionalLoan}
          className="rounded-xl p-4 sm:p-5 bg-slate-50/80 border border-slate-200/80 space-y-4 animate-in fade-in zoom-in-98 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-xs sm:text-sm font-bold text-[#0D1B3E]">
              New Additional Loan Details
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">
              * Required fields
            </span>
          </div>

          {addLoanFormError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              {addLoanFormError}
            </div>
          )}

          {/* Financial Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Given Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={addLoanGivenAmount}
                onChange={(e) => handleAddLoanGivenAmountChange(e.target.value)}
                placeholder="Enter given amount"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Interest Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={addLoanInterestAmount}
                onChange={(e) => handleAddLoanInterestAmountChange(e.target.value)}
                placeholder="Enter interest amount"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Total Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={addLoanTotalAmount}
                onChange={(e) => setAddLoanTotalAmount(e.target.value)}
                placeholder="Enter total amount"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all font-semibold text-[#0D1B3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Installment Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={addLoanInstallmentAmount}
                onChange={(e) => setAddLoanInstallmentAmount(e.target.value)}
                placeholder="Enter installment amount"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
              />
            </div>
          </div>

          {/* Date Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Given Date <span className="text-red-500">*</span>
              </label>
              <DateInputDMY
                value={addLoanGivenDate}
                onChange={setAddLoanGivenDate}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1B52E8] transition-all cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Last Date <span className="text-red-500">*</span>
              </label>
              <DateInputDMY
                value={addLoanLastDate}
                onChange={setAddLoanLastDate}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1B52E8] transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Verification (Notes Taken & Cheque Taken) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Notes Taken</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddLoanNotesTaken(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    addLoanNotesTaken
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setAddLoanNotesTaken(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !addLoanNotesTaken
                      ? 'bg-slate-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Cheque Taken</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddLoanChequeTaken(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    addLoanChequeTaken
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setAddLoanChequeTaken(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !addLoanChequeTaken
                      ? 'bg-slate-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Additional Details / Remarks
            </label>
            <textarea
              rows={2}
              value={addLoanAdditionalDetails}
              onChange={(e) => setAddLoanAdditionalDetails(e.target.value)}
              placeholder="Enter any additional remarks or notes for this loan"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddAnotherLoanFormOpen(false)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingAdditionalLoan}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1B52E8] hover:bg-[#1542C2] active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSavingAdditionalLoan ? 'Saving Loan...' : 'Save Loan'}
            </button>
          </div>
        </form>
      )}

      {/* Existing Additional Loans List */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold text-[#0D1B3E] uppercase tracking-wider">
          Existing Additional Loans ({additionalLoans.length})
        </h4>

        {isLoadingAdditionalLoans ? (
          <div className="p-6 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
            Loading additional loans...
          </div>
        ) : additionalLoans.length === 0 ? (
          <div className="p-6 text-center text-xs font-medium text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            No additional loans recorded yet for this customer. Click{' '}
            <span className="font-semibold text-[#1B52E8]">+ Add Another Loan</span> above to disburse one.
          </div>
        ) : (
          additionalLoans.map((loan, idx) => (
            <div
              key={loan.id}
              className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:border-[#1B52E8]/30 transition-all space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0D1B3E]">
                    Loan #{additionalLoans.length - idx}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({loan.id.slice(0, 8)})
                  </span>
                </div>
                <button
                  type="button"
                  id={`btn-view-details-additional-loan-${loan.id}`}
                  onClick={() => setSelectedAdditionalLoanDetailId(loan.id)}
                  className="rounded-xl border border-[#1B52E8]/30 bg-[#EBF3FF] px-2.5 sm:px-3 py-1 text-xs font-bold text-[#1B52E8] hover:bg-[#1B52E8] hover:text-white active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
                >
                  View Details
                </button>
              </div>

              {/* Amounts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500 block text-[11px]">Given Amount</span>
                  <span className="font-bold text-[#0D1B3E]">
                    ₹{formatCleanMoney(loan.given_amount)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500 block text-[11px]">Interest Amount</span>
                  <span className="font-bold text-emerald-600">
                    ₹{formatCleanMoney(loan.interest_amount)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500 block text-[11px]">Total Amount</span>
                  <span className="font-bold text-[#1B52E8]">
                    ₹{formatCleanMoney(loan.total_amount)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500 block text-[11px]">Installment</span>
                  <span className="font-bold text-[#0D1B3E]">
                    ₹{formatCleanMoney(loan.installment_amount)}
                  </span>
                </div>
              </div>

              {/* Dates & Details */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500 block text-[11px]">Given Date</span>
                  <span className="font-semibold text-[#0D1B3E]">
                    {formatDeterministicDate(loan.given_date)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500 block text-[11px]">Last Date</span>
                  <span className="font-semibold text-[#0D1B3E]">
                    {formatDeterministicDate(loan.last_date)}
                  </span>
                </div>
              </div>

              {(loan.referral_name || loan.referral_number || loan.additional_details) && (
                <div className="pt-1 text-xs space-y-1">
                  {(loan.referral_name || loan.referral_number) && (
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-500">Referral: </span>
                      <span className="font-semibold text-[#0D1B3E]">
                        {loan.referral_name || '-'} {loan.referral_number ? `(${loan.referral_number})` : ''}
                      </span>
                    </div>
                  )}
                  {loan.additional_details && (
                    <div className="text-xs">
                      <span className="font-medium text-slate-500 block mb-0.5">Details:</span>
                      <p className="text-slate-700 whitespace-pre-wrap font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {loan.additional_details}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

  const renderActiveLoanView = () => {
    if (!selectedCustomerDetails) return null

    // ── Build a flat list of ALL active loans ──────────────────────────────
    type ActiveLoanEntry = {
      id: string
      given_amount: number | null
      interest_amount: number | null
      total_amount: number | null
      installment_amount: number | null
      paid: number
      balance: number
      given_date: string | null | undefined
      last_date: string | null | undefined
    }

    const entries: ActiveLoanEntry[] = []

    // 1. Main Loan
    const mainStatus = (selectedCustomerDetails as any).status
      ? String((selectedCustomerDetails as any).status).trim().toUpperCase()
      : null
    const mainTotal = Number(selectedCustomerDetails.total_amount || 0)
    const mainRecordedPaid = (selectedCustomerDetails.payments || [])
      .filter((p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const mainCalc = calculateLoanBalanceAndPaid(
      selectedCustomerDetails.id,
      selectedCustomerDetails.given_amount,
      selectedCustomerDetails.total_amount,
      mainRecordedPaid,
      additionalLoans
    )
    const mainPaid = mainCalc.paid
    const mainBalance = mainCalc.balance
    const mainIsSettled = mainBalance <= 0 && mainPaid > 0
    const mainIsActive = mainStatus
      ? mainStatus === 'ACTIVE'
      : mainTotal > 0 && !mainIsSettled

    if (mainIsActive) {
      entries.push({
        id: selectedCustomerDetails.id,
        given_amount: selectedCustomerDetails.given_amount ?? null,
        interest_amount: selectedCustomerDetails.interest_amount ?? null,
        total_amount: selectedCustomerDetails.total_amount ?? null,
        installment_amount: selectedCustomerDetails.installment_amount ?? null,
        paid: mainPaid,
        balance: mainBalance,
        given_date: selectedCustomerDetails.given_date,
        last_date: selectedCustomerDetails.last_date,
      })
    }

    // 2. Active Additional Loans sorted chronologically
    const activeAdditional = [...additionalLoans]
      .sort(
        (a, b) =>
          new Date(a.created_at || '').getTime() -
          new Date(b.created_at || '').getTime()
      )
      .filter((loan) => {
        const s = String(loan.status || 'ACTIVE').trim().toUpperCase()
        if (s !== 'ACTIVE') return false
        const loanRecordedPaid = (selectedCustomerDetails.payments || [])
          .filter((p) => p.loan_id === loan.id)
          .reduce((sum, p) => sum + Number(p.amount || 0), 0)
        const loanCalc = calculateLoanBalanceAndPaid(
          loan.id,
          loan.given_amount,
          loan.total_amount,
          loanRecordedPaid,
          additionalLoans
        )
        return !(loanCalc.balance <= 0 && loanCalc.paid > 0)
      })

    activeAdditional.forEach((loan) => {
      const loanRecordedPaid = (selectedCustomerDetails.payments || [])
        .filter((p) => p.loan_id === loan.id)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const loanCalc = calculateLoanBalanceAndPaid(
        loan.id,
        loan.given_amount,
        loan.total_amount,
        loanRecordedPaid,
        additionalLoans
      )
      entries.push({
        id: loan.id,
        given_amount: loan.given_amount,
        interest_amount: loan.interest_amount,
        total_amount: loan.total_amount,
        installment_amount: loan.installment_amount,
        paid: loanCalc.paid,
        balance: loanCalc.balance,
        given_date: loan.given_date,
        last_date: loan.last_date,
      })
    })

    return (
      <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
            ACTIVE LOAN ({activeLoansCount})
          </h3>
          {renderLoanViewDropdown()}
        </div>

        {entries.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="text-xs font-bold text-[#0D1B3E] mb-1">No Active Loans</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This customer currently has no active loans on file.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {entries.map((loan, idx) => (
              <div key={loan.id}>
                {entries.length > 1 && (
                  <div className="text-[11px] font-bold text-[#1B52E8] uppercase tracking-wider pb-1.5 mb-3 border-b border-slate-100">
                    ACTIVE LOAN #{idx + 1}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">Given Amount</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-[#0D1B3E]">
                        ₹{loan.given_amount != null ? formatCleanMoney(loan.given_amount) : '-'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">Interest Amount</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-emerald-600">
                        ₹{loan.interest_amount != null ? formatCleanMoney(loan.interest_amount) : '-'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">Total Loan</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-[#1B52E8]">
                        ₹{loan.total_amount != null ? formatCleanMoney(loan.total_amount) : '-'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">Installment</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-[#0D1B3E]">
                        ₹{loan.installment_amount != null ? formatCleanMoney(loan.installment_amount) : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">Paid So Far</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-emerald-600">
                        ₹{formatCleanMoney(loan.paid)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">Balance Remaining</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-[#1B52E8]">
                        ₹{formatCleanMoney(loan.balance)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-500">Given Date</span>
                      <span className="font-bold text-[#0D1B3E]">{formatDeterministicDate(loan.given_date)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-500">Last Date</span>
                      <span className="font-bold text-[#0D1B3E]">{formatDeterministicDate(loan.last_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderUnderReviewView = () => (
    <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
          UNDER REVIEW
        </h3>
        {renderLoanViewDropdown()}
      </div>

      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 mb-4">
          <div className="text-xs font-bold text-amber-800 mb-1">
            Application Status: Under Review
          </div>
          <p className="text-xs text-amber-900/80 leading-relaxed">
            The additional loan application for <span className="font-semibold">{selectedCustomerDetails?.name}</span> is currently being assessed. Verification of repayments and documents is in progress.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-3.5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-medium text-slate-500">Applicant</span>
            <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails?.name}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-medium text-slate-500">Phone Number</span>
            <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails?.phone}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-medium text-slate-500">Notes Taken</span>
            <span className={`font-bold ${selectedCustomerDetails?.notes_taken ? 'text-emerald-600' : 'text-slate-500'}`}>
              {selectedCustomerDetails?.notes_taken ? 'Verified ✓' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-medium text-slate-500">Cheque Taken</span>
            <span className={`font-bold ${selectedCustomerDetails?.cheque_taken ? 'text-emerald-600' : 'text-slate-500'}`}>
              {selectedCustomerDetails?.cheque_taken ? 'Verified ✓' : 'None'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
          <span className="font-medium text-slate-500 block mb-1">Reviewing Officer Note</span>
          <p className="font-semibold text-[#0D1B3E]">
            {selectedCustomerDetails?.additional_details?.trim() || 'All standard KYC verified. Awaiting supervisor approval before disbursal.'}
          </p>
        </div>
      </div>
    </div>
  )

  const renderClosedLoanView = () => {
    if (!selectedCustomerDetails) return null

    type ClosedLoanEntry = {
      id: string
      loan_id: string
      loan_number: number
      title: string
      is_main_loan: boolean
      given_amount: number | null
      interest_amount: number | null
      total_amount: number | null
      installment_amount: number | null
      paid: number
      balance: number
      given_date: string | null | undefined
      last_date: string | null | undefined
      referral_name?: string | null
      referral_number?: string | null
      notes_taken?: boolean
      cheque_taken?: boolean
      additional_details?: string | null
      status: string
      refinanced_from_loan_id?: string | null
      is_refinanced: boolean
      payments: PaymentItem[]
    }

    const closedEntries: ClosedLoanEntry[] = []

    // 1. Check Main Loan
    const mainStatus = (selectedCustomerDetails as any).status
      ? String((selectedCustomerDetails as any).status).trim().toUpperCase()
      : null
    const mainPayments = (selectedCustomerDetails.payments || []).filter(
      (p) => !p.loan_id || p.loan_id === selectedCustomerDetails.id
    )
    const mainRecordedPaid = mainPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const mainCalc = calculateLoanBalanceAndPaid(
      selectedCustomerDetails.id,
      selectedCustomerDetails.given_amount,
      selectedCustomerDetails.total_amount,
      mainRecordedPaid,
      additionalLoans
    )
    const mainTotal = Number(selectedCustomerDetails.total_amount || 0)
    const mainPaid = mainCalc.paid
    const mainBalance = mainCalc.balance
    const mainIsSettled = mainTotal > 0 && mainBalance <= 0 && mainPaid > 0
    const mainIsRefinanced = additionalLoans.some(
      (al) => al.refinanced_from_loan_id === selectedCustomerDetails.id
    )
    const isMainClosed = mainStatus === 'CLOSED' || mainIsRefinanced || mainIsSettled

    if (isMainClosed) {
      closedEntries.push({
        id: selectedCustomerDetails.id,
        loan_id: selectedCustomerDetails.id,
        loan_number: 1,
        title: mainIsRefinanced ? 'Main Loan (Refinanced - Closed)' : 'Main Loan (Closed)',
        is_main_loan: true,
        given_amount: selectedCustomerDetails.given_amount ?? null,
        interest_amount: selectedCustomerDetails.interest_amount ?? null,
        total_amount: selectedCustomerDetails.total_amount ?? null,
        installment_amount: selectedCustomerDetails.installment_amount ?? null,
        paid: mainPaid,
        balance: mainBalance,
        given_date: selectedCustomerDetails.given_date,
        last_date: selectedCustomerDetails.last_date,
        referral_name: selectedCustomerDetails.referral_name,
        referral_number: selectedCustomerDetails.referral_number,
        notes_taken: selectedCustomerDetails.notes_taken,
        cheque_taken: selectedCustomerDetails.cheque_taken,
        additional_details: selectedCustomerDetails.additional_details,
        status: 'CLOSED',
        is_refinanced: mainIsRefinanced,
        payments: mainPayments,
      })
    }

    // 2. Check Additional Loans
    chronologicalAdditionalLoans.forEach((loan, chronoIdx) => {
      const statusStr = String(loan.status || 'ACTIVE').trim().toUpperCase()
      const loanPayments = (selectedCustomerDetails.payments || []).filter(
        (p) => p.loan_id === loan.id
      )
      const loanRecordedPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const loanCalc = calculateLoanBalanceAndPaid(
        loan.id,
        loan.given_amount,
        loan.total_amount,
        loanRecordedPaid,
        additionalLoans
      )
      const loanTotal = Number(loan.total_amount || 0)
      const isSettled = loanTotal > 0 && loanCalc.balance <= 0 && loanCalc.paid > 0
      const isRefinanced = additionalLoans.some((al) => al.refinanced_from_loan_id === loan.id)
      const isClosed = statusStr === 'CLOSED' || statusStr === 'SETTLED' || isRefinanced || isSettled

      if (isClosed) {
        const loanNum = chronoIdx + 2
        closedEntries.push({
          id: loan.id,
          loan_id: loan.id,
          loan_number: loanNum,
          title: isRefinanced ? `Loan #${loanNum} (Refinanced - Closed)` : `Loan #${loanNum} (Closed)`,
          is_main_loan: false,
          given_amount: loan.given_amount,
          interest_amount: loan.interest_amount,
          total_amount: loan.total_amount,
          installment_amount: loan.installment_amount,
          paid: loanCalc.paid,
          balance: loanCalc.balance,
          given_date: loan.given_date,
          last_date: loan.last_date,
          referral_name: loan.referral_name,
          referral_number: loan.referral_number,
          notes_taken: loan.notes_taken,
          cheque_taken: loan.cheque_taken,
          additional_details: loan.additional_details,
          status: loan.status || 'CLOSED',
          refinanced_from_loan_id: loan.refinanced_from_loan_id,
          is_refinanced: isRefinanced,
          payments: loanPayments,
        })
      }
    })

    return (
      <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-4 animate-in fade-in duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
            CLOSED LOANS ({closedEntries.length})
          </h3>
          {renderLoanViewDropdown()}
        </div>

        {closedEntries.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 mb-4">
            <div className="text-xs font-bold text-[#0D1B3E] mb-1">
              No Closed Loans On File
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Customer currently has an active balance of <span className="font-bold text-[#1B52E8]">₹{selectedCustomerDetails ? formatCleanMoney(selectedCustomerDetails.balance ?? (selectedCustomerDetails.total_amount || 0)) : '0'}</span>. Once a loan is fully repaid or refinanced, it will be catalogued in Closed Loans.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {closedEntries.map((cl) => (
              <div key={cl.id} className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 space-y-4">
                {/* Loan Title & Badges */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-[#0D1B3E]">
                      {cl.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      CLOSED
                    </span>
                  </div>
                  {cl.is_refinanced && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#1B52E8] border border-blue-200">
                      Refinanced into New Active Loan
                    </span>
                  )}
                </div>

                {/* 4-grid Financial Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">Given Amount</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold text-[#0D1B3E]">
                      ₹{cl.given_amount != null ? formatCleanMoney(cl.given_amount) : '-'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">Interest Amount</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-600">
                      ₹{cl.interest_amount != null ? formatCleanMoney(cl.interest_amount) : '-'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">Total Amount</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold text-[#1B52E8]">
                      ₹{cl.total_amount != null ? formatCleanMoney(cl.total_amount) : '-'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">Installment</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold text-[#0D1B3E]">
                      ₹{cl.installment_amount != null ? formatCleanMoney(cl.installment_amount) : '-'}
                    </div>
                  </div>
                </div>

                {/* Paid & Balance */}
                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">Total Paid Before Closing</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-600">
                      ₹{formatCleanMoney(cl.paid)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">Balance at Closing</div>
                    <div className="mt-0.5 text-xs sm:text-sm font-bold text-[#1B52E8]">
                      ₹{formatCleanMoney(cl.balance)}
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <span className="font-medium text-slate-500">Given Date</span>
                    <span className="font-bold text-[#0D1B3E]">{formatDeterministicDate(cl.given_date)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <span className="font-medium text-slate-500">Last Date</span>
                    <span className="font-bold text-[#0D1B3E]">{formatDeterministicDate(cl.last_date)}</span>
                  </div>
                </div>

                {/* Referral Details if available */}
                {(cl.referral_name || cl.referral_number) && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs text-xs">
                    <span className="font-medium text-slate-500">Referral</span>
                    <span className="font-bold text-[#0D1B3E]">
                      {cl.referral_name || ''} {cl.referral_number ? `(${cl.referral_number})` : ''}
                    </span>
                  </div>
                )}

                {/* Preserved Payment History */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Preserved Payment History ({cl.payments.length} Payments)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Read-Only</span>
                  </div>

                  {cl.payments.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic bg-white rounded-xl border border-slate-100">
                      No payments were recorded for this loan.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {cl.payments.map((p, pIdx) => {
                        const dt = getPaymentDateAndTime(p)
                        const pMethod = String(p.payment_method || 'cash').toUpperCase()
                        return (
                          <div
                            key={p.id || pIdx}
                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100 text-xs shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {pIdx + 1}
                              </span>
                              <div>
                                <div className="font-semibold text-slate-800">
                                  {formatDeterministicDate(dt.date)} <span className="text-[10px] text-slate-400">{dt.time}</span>
                                </div>
                                {p.remarks && (
                                  <div className="text-[10px] text-slate-500 italic truncate max-w-[150px] sm:max-w-xs">
                                    {p.remarks}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  pMethod === 'UPI'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                    : pMethod === 'ACCOUNT'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}
                              >
                                {pMethod === 'UPI' ? 'UPI' : pMethod === 'ACCOUNT' ? 'Account' : 'Cash'}
                              </span>
                              <span className="font-bold text-emerald-600">
                                ₹{formatCleanMoney(p.amount)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }


  const renderRefinancePage = () => {
    const targetLoan = activeRefinanceLoan || refinanceTargetLoan || fullDetailsSelectedLoan || selectedCustomerDetails
    if (!targetLoan || !selectedCustomerDetails) return null

    const curTotal = Number(targetLoan.total_amount || 0)
    const curPaid = Number(targetLoan.paid || 0)
    const curBalance = targetLoan.balance !== undefined && targetLoan.balance !== null
      ? Number(targetLoan.balance)
      : Math.max(0, curTotal - curPaid)
    const origGiven = Number(targetLoan.given_amount || 0)

    // Second field (Balance Amount): directly shows curBalance — same value as top card.
    const liveRefinanceAmount = String(curBalance)

    // Third field (Refinance Amount): Given Amount - Balance Amount
    const currentGiven = refinanceGivenAmount !== '' ? (parseFloat(refinanceGivenAmount) || 0) : origGiven
    const liveRefinanceCalc = curBalance > currentGiven
      ? 'Not for Refinance'
      : String(currentGiven - curBalance)

    return (
      <div className="w-full flex-1 flex flex-col space-y-4 animate-in fade-in duration-150 pb-10">
        {/* Top Header with Back Navigation */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-back-from-refinance"
              onClick={() => {
                setIsRefinancePage(false)
                setIsRefinanceEditable(false)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100 border border-[#1B52E8]/30 rounded-xl transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Details</span>
            </button>
            <h2 className="text-sm sm:text-base font-bold text-[#0D1B3E] uppercase tracking-wider">
              REFINANCE LOAN
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1B52E8] border border-blue-100">
            {targetLoan.loan_number ? `Loan #${targetLoan.loan_number}` : 'Main Loan'}
          </span>
        </div>

        {/* 1. REFINANCE LOAN SUMMARY CARD */}
        <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
              REFINANCE LOAN
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {selectedCustomerDetails.name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs sm:text-sm">
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500">Total Amount</span>
              <span className="font-bold text-[#1B52E8] mt-0.5">₹{formatCleanMoney(curTotal)}</span>
            </div>
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500">Paid Amount</span>
              <span className="font-bold text-emerald-600 mt-0.5">₹{formatCleanMoney(curPaid)}</span>
            </div>
            <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500">Balance Amount</span>
              <span className="font-bold text-[#1B52E8] mt-0.5">₹{formatCleanMoney(curBalance)}</span>
            </div>
          </div>
        </div>

        {/* 2. NEW REFINANCED LOAN DETAILS FORM */}
        <form onSubmit={handleSaveRefinance} className="space-y-4">
          <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
                NEW REFINANCED LOAN DETAILS
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">
                  All fields editable
                </span>
                {!isRefinanceEditable ? (
                  <button
                    type="button"
                    id="btn-edit-refinance-details"
                    onClick={() => setIsRefinanceEditable(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100/80 border border-[#1B52E8]/30 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-done-edit-refinance"
                    onClick={() => setIsRefinanceEditable(false)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>

            {refinanceError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {refinanceError}
              </div>
            )}

            {/* Amounts Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Given Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Given Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  readOnly={!isRefinanceEditable}
                  value={refinanceGivenAmount}
                  onChange={(e) => handleRefinanceGivenAmountChange(e.target.value)}
                  placeholder="Enter given amount"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all font-semibold ${
                    !isRefinanceEditable
                      ? 'border-slate-200 bg-slate-50/60 text-slate-700 cursor-default'
                      : 'border-slate-200 bg-white text-slate-800 focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Original Loan Given Amount
                </span>
              </div>

              {/* Balance Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Balance Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  required
                  value={liveRefinanceAmount}
                  placeholder="Enter refinance amount"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all font-semibold cursor-default ${
                    liveRefinanceAmount === 'Not for Refinance'
                      ? 'border-rose-300 bg-rose-50/60 text-rose-600 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-200 bg-slate-50/60 text-emerald-600'
                  }`}
                />
                <span className={`text-[10px] mt-1 block ${liveRefinanceAmount === 'Not for Refinance' ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
                  {liveRefinanceAmount === 'Not for Refinance' ? 'Balance Amount exceeds Given Amount' : 'Calculated Refinance Amount'}
                </span>
              </div>

              {/* Refinance Amount (Given Amount - Balance Amount) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Refinance Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  readOnly
                  required
                  value={liveRefinanceCalc}
                  placeholder="Refinance amount"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all font-bold cursor-default ${
                    liveRefinanceCalc === 'Not for Refinance'
                      ? 'border-rose-300 bg-rose-50/60 text-rose-600'
                      : 'border-slate-200 bg-slate-50/60 text-emerald-600'
                  }`}
                />
                <span className={`text-[10px] mt-1 block ${
                  liveRefinanceCalc === 'Not for Refinance' ? 'text-rose-500 font-medium' : 'text-slate-400'
                }`}>
                  {liveRefinanceCalc === 'Not for Refinance' ? 'Balance exceeds Given Amount' : '= Given Amount − Balance Amount'}
                </span>
              </div>
            </div>

            {/* Duration Selection (Dynamic based on Section) */}
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  {refinanceSection === 'DAILY'
                    ? 'Days / Duration'
                    : refinanceSection === 'WEEKLY'
                    ? 'Weeks / Duration'
                    : 'Months / Duration'} <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-bold text-[#1B52E8]">
                  {refinanceDuration}{' '}
                  {refinanceSection === 'DAILY'
                    ? refinanceDuration === 1 ? 'Day' : 'Days'
                    : refinanceSection === 'WEEKLY'
                    ? refinanceDuration === 1 ? 'Week' : 'Weeks'
                    : refinanceDuration === 1 ? 'Month' : 'Months'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Custom:</span>
                <input
                  type="number"
                  min="1"
                  max={refinanceSection === 'DAILY' ? 1000 : refinanceSection === 'WEEKLY' ? 104 : 120}
                  disabled={!isRefinanceEditable}
                  value={refinanceDuration || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val > 0) {
                      handleRefinanceDurationChange(val)
                    } else {
                      handleRefinanceDurationChange(0)
                    }
                  }}
                  className={`w-16 rounded-lg border px-2 py-1 text-xs font-bold text-center outline-none ${
                    !isRefinanceEditable
                      ? 'border-slate-200 bg-slate-50/60 text-slate-700 cursor-default'
                      : 'border-slate-200 bg-white text-slate-800 focus:border-[#1B52E8]'
                  }`}
                />
                <span className="text-xs text-slate-500">
                  {refinanceSection === 'DAILY' ? 'days' : refinanceSection === 'WEEKLY' ? 'weeks' : 'months'}
                </span>
              </div>
            </div>

            {/* Total Amount & Installment Amount Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Total Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  readOnly={!isRefinanceEditable}
                  value={refinanceTotalAmount}
                  onChange={(e) => handleRefinanceTotalAmountChange(e.target.value)}
                  placeholder="Enter total amount"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all font-bold ${
                    !isRefinanceEditable
                      ? 'border-slate-200 bg-slate-50/60 text-[#1B52E8] cursor-default'
                      : 'border-slate-200 bg-white text-[#1B52E8] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Original Loan Total Amount
                </span>
              </div>

              {/* Installment Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Installment Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  readOnly={!isRefinanceEditable}
                  value={refinanceInstallmentAmount}
                  onChange={(e) => handleRefinanceInstallmentAmountChange(e.target.value)}
                  placeholder="Enter installment amount"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm outline-none transition-all font-bold ${
                    !isRefinanceEditable
                      ? 'border-slate-200 bg-slate-50/60 text-[#0D1B3E] cursor-default'
                      : 'border-slate-200 bg-white text-[#0D1B3E] focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20'
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Original Loan Installment Amount
                </span>
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Given Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Given Date <span className="text-red-500">*</span>
                </label>
                <DateInputDMY
                  value={refinanceGivenDate}
                  onChange={handleRefinanceGivenDateChange}
                  disabled={!isRefinanceEditable}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all font-medium cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Defaults to refinance transaction date
                </span>
              </div>

              {/* Last Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Last Date <span className="text-red-500">*</span>
                </label>
                <DateInputDMY
                  value={refinanceLastDate}
                  onChange={handleRefinanceLastDateChange}
                  disabled={!isRefinanceEditable}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all font-medium cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Auto-calculated from Given Date + {refinanceSection === 'DAILY' ? 'Days' : refinanceSection === 'WEEKLY' ? 'Weeks' : 'Months'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsRefinancePage(false)
                  setIsRefinanceEditable(false)
                }}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRefinance || liveRefinanceCalc === 'Not for Refinance'}
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#1B52E8] hover:bg-[#1542C2] active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSavingRefinance ? 'Saving Refinance...' : 'Confirm & Save Refinance'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  return (
    <main
      className={`bg-[#F8FAFC] flex flex-col relative ${
        selectedCustomerId && !isFullDetailsPage
          ? 'h-[100dvh] max-h-[100dvh] overflow-hidden pb-2.5 sm:pb-3'
          : 'min-h-screen pb-20 sm:pb-24'
      }`}
    >
      {/* ── Top Header Bar (Identical to Dashboard) ── */}
      <header className="w-full bg-white border-b border-slate-100 py-3 sm:py-3.5 px-4 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-40 shadow-2xs">
        <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer">
          <Image
            src="/vs-logo.png"
            alt="Vyapar Samraj logo"
            width={160}
            height={160}
            priority
            unoptimized
            className="h-8 sm:h-10 w-auto select-none object-contain shrink-0"
            style={{ mixBlendMode: 'multiply' }}
          />
          <span className="text-lg sm:text-[22px] font-bold tracking-tight text-[#0D1B3E] truncate">
            Vyapar Samraj
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* User Profile Circle with Dropdown */}
          <UserMenu userName={userName} />
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <div
        className={`w-full max-w-xl mx-auto px-4 sm:px-0 flex-1 flex flex-col pt-2.5 sm:pt-3.5 ${
          selectedCustomerId && !isFullDetailsPage ? 'min-h-0 overflow-hidden' : ''
        }`}
      >
        {isRefinancePage && (refinanceTargetLoan || fullDetailsSelectedLoan || selectedCustomerDetails) ? (
          renderRefinancePage()
        ) : isFullDetailsPage && selectedCustomerDetails ? (
          /* FULL-PAGE CUSTOMER DETAILS SCREEN */
          <div className="w-full flex-1 flex flex-col animate-in fade-in duration-150">
            {/* TOP ACTIONS: Side-by-side Delete User and Refinance buttons */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-full mb-4">
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isDeletingCustomer}
                className="flex-1 py-2.5 sm:py-3 px-4 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 font-bold text-xs sm:text-sm hover:bg-rose-100 hover:border-rose-300 active:scale-[0.98] transition-all cursor-pointer shadow-2xs text-center disabled:opacity-50"
              >
                {isDeletingCustomer ? 'Deleting...' : 'Delete User'}
              </button>
              <button
                type="button"
                id="btn-refinance-loan"
                onClick={handleOpenRefinancePage}
                className="flex-1 py-2.5 sm:py-3 px-4 rounded-2xl bg-[#1B52E8] text-white border border-[#1B52E8] font-bold text-xs sm:text-sm hover:bg-[#1542C2] active:scale-[0.98] transition-all cursor-pointer shadow-2xs text-center"
              >
                Refinance
              </button>
            </div>

            {/* DETAILS ORDER: Controlled by selectedLoanView */}
            <div className="space-y-4">
              {selectedLoanView === 'view-details' ? (
                <>
                  {/* 1. Customer Information */}
                  <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                  <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
                    Customer Information
                  </h3>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Location / Google Maps button */}
                    <button
                      type="button"
                      id="btn-customer-location"
                      onClick={() => {
                        const hasCoords =
                          selectedCustomerDetails.latitude != null &&
                          selectedCustomerDetails.longitude != null &&
                          !isNaN(Number(selectedCustomerDetails.latitude)) &&
                          !isNaN(Number(selectedCustomerDetails.longitude))
                        if (hasCoords) {
                          const url = `https://www.google.com/maps?q=${selectedCustomerDetails.latitude},${selectedCustomerDetails.longitude}`
                          window.open(url, '_blank', 'noopener,noreferrer')
                        } else if (selectedCustomerDetails.address?.trim()) {
                          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            selectedCustomerDetails.address.trim()
                          )}`
                          window.open(url, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      title={
                        selectedCustomerDetails.latitude != null &&
                        selectedCustomerDetails.longitude != null &&
                        !isNaN(Number(selectedCustomerDetails.latitude)) &&
                        !isNaN(Number(selectedCustomerDetails.longitude))
                          ? `Open exact GPS location in Google Maps (${selectedCustomerDetails.latitude}, ${selectedCustomerDetails.longitude})`
                          : selectedCustomerDetails.address?.trim()
                          ? `Open in Google Maps: ${selectedCustomerDetails.address.trim()}`
                          : 'No location available'
                      }
                      disabled={
                        (selectedCustomerDetails.latitude == null || isNaN(Number(selectedCustomerDetails.latitude))) &&
                        (selectedCustomerDetails.longitude == null || isNaN(Number(selectedCustomerDetails.longitude))) &&
                        !selectedCustomerDetails.address?.trim()
                      }
                      className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all shadow-2xs ${
                        (selectedCustomerDetails.latitude != null && !isNaN(Number(selectedCustomerDetails.latitude))) ||
                        selectedCustomerDetails.address?.trim()
                          ? 'bg-[#EBF3FF] text-[#1B52E8] border-[#1B52E8]/30 hover:bg-blue-100/80 active:scale-95 cursor-pointer'
                          : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      }`}
                      aria-label="Open location in Google Maps"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </button>

                    {!isEditingCustomerInfo && renderLoanViewDropdown()}

                    {!isEditingCustomerInfo ? (
                      <button
                        type="button"
                        id="btn-edit-all-details"
                        onClick={handleStartEditCustomerInfo}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100/80 border border-[#1B52E8]/30 rounded-lg transition-colors cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="btn-header-cancel-details"
                          onClick={handleCancelEditCustomerInfo}
                          disabled={isSavingCustomerInfo}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          id="btn-header-save-details"
                          onClick={handleSaveCustomerInfo}
                          disabled={isSavingCustomerInfo}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-[#1B52E8] hover:bg-[#1542C2] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                        >
                          {isSavingCustomerInfo ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {customerInfoError && (
                  <div className="mb-3.5 p-2.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl">
                    {customerInfoError}
                  </div>
                )}

                {/* Photo & S.No Avatar */}
                <div className="flex items-center gap-3.5 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  {selectedCustomerDetails.photo_url ? (
                    <img
                      src={selectedCustomerDetails.photo_url}
                      alt={selectedCustomerDetails.name}
                      onClick={() => handleOpenImageModal(selectedCustomerDetails.photo_url!)}
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0 cursor-pointer hover:opacity-95 transition-opacity"
                      title="Click to view image"
                    />
                  ) : (
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl bg-[#EBF3FF] text-[#1B52E8] font-bold text-base sm:text-lg border border-blue-100">
                      {isEditingCustomerInfo
                        ? (editInfoSno.trim() || selectedCustomerDetails.serial_number != null ? (editInfoSno.trim() || selectedCustomerDetails.serial_number) : '-')
                        : (selectedCustomerDetails.serial_number != null ? selectedCustomerDetails.serial_number : '-')}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-bold text-[#0D1B3E] truncate">
                        {isEditingCustomerInfo ? (editInfoName.trim() || selectedCustomerDetails.name) : selectedCustomerDetails.name}
                      </span>
                      {/* Customer Photo Upload/Replace Icon */}
                      <label
                        className="inline-flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-[#1B52E8] hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                        title={selectedCustomerDetails.photo_url ? "Replace customer photo" : "Upload customer photo"}
                        aria-label={selectedCustomerDetails.photo_url ? "Replace customer photo" : "Upload customer photo"}
                      >
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadPhoto(file)
                            e.target.value = ''
                          }}
                          disabled={isUploadingPhoto}
                        />
                      </label>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 mt-0.5">
                      S.No: {isEditingCustomerInfo
                        ? (editInfoSno.trim() || selectedCustomerDetails.serial_number != null ? (editInfoSno.trim() || selectedCustomerDetails.serial_number) : '-')
                        : (selectedCustomerDetails.serial_number != null ? selectedCustomerDetails.serial_number : '-')}
                    </div>
                  </div>
                </div>

                {!isEditingCustomerInfo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-sm">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">S.No</span>
                      <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails.serial_number != null ? selectedCustomerDetails.serial_number : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Customer Name</span>
                      <span className="font-bold text-[#0D1B3E] truncate ml-2">{selectedCustomerDetails.name}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Phone Number</span>
                      <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails.phone || (selectedCustomerDetails as any).phone_number || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Section</span>
                      <span className="font-bold text-[#0D1B3E]">{sectionDisplayMap[selectedCustomerDetails.section] || selectedCustomerDetails.section}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Area</span>
                      <span className="font-bold text-[#0D1B3E]">{(selectedCustomerDetails as any).area_name || selectedArea?.name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Alternative Number</span>
                      <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails.alternative_number || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Referral Name</span>
                      <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails.referral_name || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium">Referral Number</span>
                      <span className="font-bold text-[#0D1B3E]">{selectedCustomerDetails.referral_number || '-'}</span>
                    </div>
                    <div className="sm:col-span-2 flex flex-col p-2.5 rounded-xl bg-slate-50/70">
                      <span className="text-slate-500 font-medium mb-1">Address</span>
                      <span className="font-bold text-[#0D1B3E] text-xs leading-relaxed">{selectedCustomerDetails.address || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleSaveCustomerInfo()
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-sm"
                  >
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">S.No</span>
                      <input
                        type="number"
                        value={editInfoSno}
                        onChange={(e) => setEditInfoSno(e.target.value)}
                        placeholder="S.No"
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                      />
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Customer Name *</span>
                      <input
                        type="text"
                        value={editInfoName}
                        onChange={(e) => setEditInfoName(e.target.value)}
                        placeholder="Customer Name"
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                        required
                      />
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Phone Number *</span>
                      <input
                        type="tel"
                        value={editInfoPhone}
                        onChange={(e) => setEditInfoPhone(e.target.value)}
                        placeholder="Phone Number"
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                        required
                      />
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Section</span>
                      <select
                        value={editInfoSection}
                        onChange={(e) => setEditInfoSection(e.target.value as SectionType)}
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] cursor-pointer"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Area</span>
                      <select
                        value={editInfoAreaId}
                        onChange={(e) => setEditInfoAreaId(e.target.value)}
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] cursor-pointer"
                      >
                        {areasList.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Alternative Number</span>
                      <input
                        type="tel"
                        value={editInfoAltPhone}
                        onChange={(e) => setEditInfoAltPhone(e.target.value)}
                        placeholder="Alternative Number"
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                      />
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Referral Name</span>
                      <input
                        type="text"
                        value={editInfoRefName}
                        onChange={(e) => setEditInfoRefName(e.target.value)}
                        placeholder="Referral Name"
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                      />
                    </div>
                    <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <span className="text-slate-500 font-medium text-[11px] mb-1">Referral Number</span>
                      <input
                        type="tel"
                        value={editInfoRefPhone}
                        onChange={(e) => setEditInfoRefPhone(e.target.value)}
                        placeholder="Referral Number"
                        className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                      />
                    </div>
                    <div className="sm:col-span-2 flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-500 font-medium text-[11px]">Address</span>
                        <button
                          type="button"
                          onClick={handleDetectEditLocation}
                          disabled={isDetectingEditLocation}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100 rounded-md transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                          title="Detect current location"
                        >
                          <MapPin className="w-3 h-3 text-[#1B52E8]" />
                          <span>{isDetectingEditLocation ? 'Detecting...' : 'Detect Location'}</span>
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={editInfoAddress}
                        onChange={(e) => {
                          setEditInfoAddress(e.target.value)
                          if (editGeoError) setEditGeoError('')
                        }}
                        placeholder="Address"
                        className="bg-white px-2.5 py-1.5 text-xs leading-relaxed font-medium text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] resize-none"
                      />
                      {editGeoError && (
                        <span className="text-[11px] font-semibold text-rose-500 mt-1">
                          {editGeoError}
                        </span>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* 2. Financial Details */}
                  <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
                    <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                      <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
                        Financial Details
                      </h3>
                    </div>

                    {!isEditingCustomerInfo ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="text-[11px] font-semibold text-slate-500">Given Amount</div>
                          <div className="mt-1 text-sm sm:text-base font-bold text-[#0D1B3E]">
                            ₹{selectedCustomerDetails.given_amount != null ? formatCleanMoney(selectedCustomerDetails.given_amount) : '-'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="text-[11px] font-semibold text-slate-500">Interest Amount</div>
                          <div className="mt-1 text-sm sm:text-base font-bold text-emerald-600">
                            ₹{selectedCustomerDetails.interest_amount != null ? formatCleanMoney(selectedCustomerDetails.interest_amount) : '-'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="text-[11px] font-semibold text-slate-500">Total Amount</div>
                          <div className="mt-1 text-sm sm:text-base font-bold text-[#1B52E8]">
                            ₹{selectedCustomerDetails.total_amount != null ? formatCleanMoney(selectedCustomerDetails.total_amount) : '-'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="text-[11px] font-semibold text-slate-500">Installment Amount</div>
                          <div className="mt-1 text-sm sm:text-base font-bold text-[#0D1B3E]">
                            ₹{selectedCustomerDetails.installment_amount != null ? formatCleanMoney(selectedCustomerDetails.installment_amount) : '-'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Given Amount</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              value={editGivenAmount}
                              onChange={(e) => {
                                const val = e.target.value
                                setEditGivenAmount(val)
                                const g = parseFloat(val) || 0
                                const i = parseFloat(editInterestAmount) || 0
                                if (g > 0 || i > 0) {
                                  setEditTotalAmount(String(g + i))
                                }
                              }}
                              placeholder="0"
                              className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Interest Amount</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              value={editInterestAmount}
                              onChange={(e) => {
                                const val = e.target.value
                                setEditInterestAmount(val)
                                const g = parseFloat(editGivenAmount) || 0
                                const i = parseFloat(val) || 0
                                if (g > 0 || i > 0) {
                                  setEditTotalAmount(String(g + i))
                                }
                              }}
                              placeholder="0"
                              className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-emerald-600 rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Total Amount *</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              value={editTotalAmount}
                              onChange={(e) => setEditTotalAmount(e.target.value)}
                              placeholder="0"
                              required
                              className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-[#1B52E8] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col p-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Installment *</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              value={editInstallmentAmount}
                              onChange={(e) => setEditInstallmentAmount(e.target.value)}
                              placeholder="0"
                              required
                              className="w-full bg-white pl-5 pr-2 py-1 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Payment Summary */}
                  <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
                    <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider mb-3.5 pb-2 border-b border-slate-100">
                      Payment Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-500">Paid Amount</div>
                        <div className="mt-1 text-sm sm:text-base font-bold text-emerald-600">
                          ₹{formatCleanMoney(fullDetailsSelectedLoan ? fullDetailsSelectedLoan.paid : (selectedCustomerDetails.paid || 0))}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-500">Balance Amount</div>
                        <div className="mt-1 text-sm sm:text-base font-bold text-[#1B52E8]">
                          ₹{formatCleanMoney(fullDetailsSelectedLoan ? fullDetailsSelectedLoan.balance : (selectedCustomerDetails.balance ?? (selectedCustomerDetails.total_amount || 0)))}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-500">Due Remaining</div>
                        {(() => {
                          const dueSection = (fullDetailsSelectedLoan as any)?.section || selectedCustomerDetails.section
                          const dueInfo = selectedCustomerDetails.due_remaining
                            ? {
                                text: formatDueWithSection(selectedCustomerDetails.due_remaining, dueSection),
                                isLate: Boolean(selectedCustomerDetails.due_remaining_is_late),
                              }
                            : calculateDueRemaining(
                                selectedCustomerDetails.given_date,
                                selectedCustomerDetails.last_date,
                                dueSection
                              )
                          // Extract the count from the text (e.g. "2 weeks remaining" → 2)
                          const weeksMatch = dueInfo.text.match(/^(\d+)/)
                          const weeksNum = weeksMatch ? parseInt(weeksMatch[1], 10) : 0
                          // ≥3 remaining = green; 1–2 = orange; 0 or late = red
                          const dueColor = dueInfo.isLate
                            ? 'text-rose-600'
                            : weeksNum === 0
                            ? 'text-rose-600'
                            : weeksNum <= 2
                            ? 'text-orange-500'
                            : 'text-emerald-600'
                          return (
                            <div
                              suppressHydrationWarning
                              className={`mt-1 text-xs sm:text-sm font-bold ${dueColor}`}
                            >
                              {dueInfo.text}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 4. Date Details */}
                  <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
                    <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                      <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
                        Date Details
                      </h3>
                    </div>

                    {!isEditingCustomerInfo ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs sm:text-sm font-medium text-slate-500">Given Date</span>
                          <span suppressHydrationWarning className="text-xs sm:text-sm font-bold text-[#0D1B3E]">
                            {formatDeterministicDate(selectedCustomerDetails.given_date)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs sm:text-sm font-medium text-slate-500">Last Date</span>
                          <span suppressHydrationWarning className="text-xs sm:text-sm font-bold text-[#0D1B3E]">
                            {formatDeterministicDate(selectedCustomerDetails.last_date)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Given Date</span>
                          <DateInputDMY
                            value={editGivenDate}
                            onChange={setEditGivenDate}
                            className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] cursor-pointer"
                          />
                        </div>
                        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Last Date</span>
                          <DateInputDMY
                            value={editLastDate}
                            onChange={setEditLastDate}
                            className="bg-white px-2.5 py-1.5 text-xs sm:text-sm font-bold text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. View Details Section */}
                  <div className="rounded-2xl bg-white p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)]">
                    <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                      <h3 className="text-xs sm:text-sm font-bold text-[#0D1B3E] uppercase tracking-wider">
                        VIEW DETAILS
                      </h3>
                    </div>

                    {!isEditingCustomerInfo ? (
                      <div className="space-y-3 text-xs sm:text-sm">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                          <span className="text-slate-500 font-medium">Notes Taken</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${selectedCustomerDetails.notes_taken ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {selectedCustomerDetails.notes_taken ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70">
                          <span className="text-slate-500 font-medium">Cheque Taken</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${selectedCustomerDetails.cheque_taken ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {selectedCustomerDetails.cheque_taken ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50/70">
                          <span className="text-slate-500 font-medium mb-1">Additional Details</span>
                          <p className="font-semibold text-[#0D1B3E] text-xs whitespace-pre-wrap">
                            {selectedCustomerDetails.additional_details || '-'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs sm:text-sm">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-600 font-semibold text-xs sm:text-sm">Notes Taken</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditNotesTaken(true)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                editNotesTaken
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditNotesTaken(false)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                !editNotesTaken
                                  ? 'bg-slate-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-600 font-semibold text-xs sm:text-sm">Cheque Taken</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditChequeTaken(true)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                editChequeTaken
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditChequeTaken(false)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                !editChequeTaken
                                  ? 'bg-slate-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#1B52E8] focus-within:ring-1 focus-within:ring-[#1B52E8]/20 transition-all">
                          <span className="text-slate-500 font-semibold text-[11px] mb-1">Additional Details</span>
                          <textarea
                            rows={3}
                            value={editAdditionalDetails}
                            onChange={(e) => setEditAdditionalDetails(e.target.value)}
                            placeholder="Enter additional details..."
                            className="bg-white px-2.5 py-1.5 text-xs leading-relaxed font-medium text-[#0D1B3E] rounded-lg border border-slate-200 focus:outline-none focus:border-[#1B52E8] resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PAYMENT HISTORY: Main Loan View Details */}
                  {fullDetailsSelectedLoan && (
                    <PaymentHistorySection
                      customer={fullDetailsSelectedLoan}
                      paymentInputAmount={paymentInputAmount}
                      setPaymentInputAmount={setPaymentInputAmount}
                      paymentRemarks={paymentRemarks}
                      setPaymentRemarks={setPaymentRemarks}
                      paymentMethod={paymentMethod}
                      setPaymentMethod={setPaymentMethod}
                      isRecordingPayment={isRecordingPayment}
                      paymentFormError={paymentFormError}
                      setPaymentFormError={setPaymentFormError}
                      handleRecordPayment={handleRecordPayment}
                      handleUpdatePayment={handleUpdatePayment}
                      isDetailsExpanded={isDetailsExpanded}
                      setIsDetailsExpanded={setIsDetailsExpanded}
                      showManualPayment={false}
                      showInstallmentButtons={false}
                      showEyeIcon={false}
                      additionalLoansCount={0}
                    />
                  )}
                </>
              ) : selectedLoanView.startsWith('additional-loan') ? (
                renderAdditionalLoanView()
              ) : selectedLoanView === 'active-loan' ? (
                renderActiveLoanView()
              ) : selectedLoanView === 'under-review' ? (
                renderUnderReviewView()
              ) : (
                renderClosedLoanView()
              )}
            </div>
          </div>
        ) : selectedCustomerId ? (
          <div className="w-full flex-1 min-h-0 flex flex-col animate-in fade-in duration-150 overflow-hidden">
            {/* Customer Details Section: Opened only when Eye icon is clicked (toggle moved to Payment History header) */}
            {isDetailsExpanded && selectedCustomerDetails && (
              <div className="space-y-2.5 sm:space-y-3 shrink-0 animate-in fade-in duration-150">
                {/* Customer Header: [ S.No inside circle ] Customer Name [ View Details ] */}
                <div className="flex items-center justify-between rounded-2xl bg-white p-3 sm:p-3.5 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] border border-slate-100">
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    {selectedCustomerDetails.photo_url ? (
                      <img
                        src={selectedCustomerDetails.photo_url}
                        alt={selectedCustomerDetails.name}
                        onClick={() => handleOpenImageModal(selectedCustomerDetails.photo_url!)}
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border border-blue-200 cursor-pointer shadow-2xs shrink-0 hover:opacity-90 transition-opacity"
                        title="Click to view image"
                      />
                    ) : (
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#EBF3FF] text-[#1B52E8] font-bold text-xs sm:text-sm">
                        {selectedCustomerDetails.serial_number != null ? selectedCustomerDetails.serial_number : '-'}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                      <span className="text-[15px] sm:text-[17px] font-bold text-[#0D1B3E] truncate leading-tight">
                        {selectedCustomerDetails.name}
                      </span>
                      {/* Customer Photo Upload/Replace Icon next to customer name */}
                      <label
                        className="inline-flex items-center justify-center p-1 rounded-lg text-slate-400 hover:text-[#1B52E8] hover:bg-blue-50 transition-colors cursor-pointer shrink-0"
                        title={selectedCustomerDetails.photo_url ? "Replace photo" : "Upload customer photo"}
                        aria-label={selectedCustomerDetails.photo_url ? "Replace photo" : "Upload customer photo"}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadPhoto(file)
                            e.target.value = ''
                          }}
                          disabled={isUploadingPhoto}
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-view-details"
                    onClick={handleOpenViewDetailsPage}
                    className="rounded-xl border border-[#1B52E8]/30 bg-[#EBF3FF] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-[#1B52E8] hover:bg-[#1B52E8] hover:text-white transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap ml-2"
                  >
                    View Details
                  </button>
                </div>

                {/* AMOUNT CARDS — SINGLE ROW: [ Total Amount ] [ Paid ] [ Balance ] [ Due Remaining ] */}
                {(() => {
                  const displayLoan = activePaymentLoan || selectedCustomerDetails
                  return (
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-3 w-full">
                      {/* 1. Total Amount */}
                      <div className="rounded-xl sm:rounded-2xl bg-white p-2 sm:p-3 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] flex flex-col justify-between min-w-0">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                          Total Amount
                        </span>
                        <div
                          className="mt-0.5 sm:mt-1 text-xs sm:text-base font-bold text-[#0D1B3E] truncate"
                          title={`₹${formatCleanMoney(displayLoan.total_amount || 0)}`}
                        >
                          ₹{formatCleanMoney(displayLoan.total_amount || 0)}
                        </div>
                      </div>

                      {/* 2. Paid */}
                      <div className="rounded-xl sm:rounded-2xl bg-white p-2 sm:p-3 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] flex flex-col justify-between min-w-0">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                          Paid
                        </span>
                        <div
                          className="mt-0.5 sm:mt-1 text-xs sm:text-base font-bold text-emerald-600 truncate"
                          title={`₹${formatCleanMoney(displayLoan.paid || 0)}`}
                        >
                          ₹{formatCleanMoney(displayLoan.paid || 0)}
                        </div>
                      </div>

                      {/* 3. Balance */}
                      <div className="rounded-xl sm:rounded-2xl bg-white p-2 sm:p-3 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] flex flex-col justify-between min-w-0">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                          Balance
                        </span>
                        <div
                          className="mt-0.5 sm:mt-1 text-xs sm:text-base font-bold text-[#1B52E8] truncate"
                          title={`₹${formatCleanMoney(displayLoan.balance ?? (displayLoan.total_amount || 0))}`}
                        >
                          ₹{formatCleanMoney(displayLoan.balance ?? (displayLoan.total_amount || 0))}
                        </div>
                      </div>

                      {/* 4. Due Remaining */}
                      <div className="rounded-xl sm:rounded-2xl bg-white p-2 sm:p-3 border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] flex flex-col justify-between min-w-0">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate leading-tight">
                          Due Remaining
                        </span>
                        {(() => {
                          const dueSection = (displayLoan as any)?.section || selectedCustomerDetails?.section || activeSection
                          const dueInfo = displayLoan.due_remaining
                            ? {
                                text: formatDueWithSection(displayLoan.due_remaining, dueSection),
                                isLate: Boolean(displayLoan.due_remaining_is_late),
                              }
                            : calculateDueRemaining(
                                displayLoan.given_date,
                                displayLoan.last_date,
                                dueSection
                              )
                          // Extract the count from the text (e.g. "2 weeks remaining" → 2)
                          const weeksMatch = dueInfo.text.match(/^(\d+)/)
                          const weeksNum = weeksMatch ? parseInt(weeksMatch[1], 10) : 0
                          // ≥3 remaining = green; 1–2 = orange; 0 or late = red
                          const dueColor = dueInfo.isLate
                            ? 'text-rose-600'
                            : weeksNum === 0
                            ? 'text-rose-600'
                            : weeksNum <= 2
                            ? 'text-orange-500'
                            : 'text-emerald-600'
                          return (
                            <div
                              suppressHydrationWarning
                              className={`mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-bold truncate leading-tight ${dueColor}`}
                              title={dueInfo.text}
                            >
                              {dueInfo.text}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* PAYMENT HISTORY: Always visible. Eye icon is now inside the header. */}
            <div className={`${isDetailsExpanded ? "mt-2 sm:mt-2.5" : "mt-0"} w-full flex-1 min-h-0 flex flex-col overflow-hidden`}>
              {selectedCustomerDetails && (
                <PaymentHistorySection
                  customer={activePaymentLoan || selectedCustomerDetails}
                  paymentInputAmount={paymentInputAmount}
                  setPaymentInputAmount={setPaymentInputAmount}
                  paymentRemarks={paymentRemarks}
                  setPaymentRemarks={setPaymentRemarks}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  isRecordingPayment={isRecordingPayment}
                  paymentFormError={paymentFormError}
                  setPaymentFormError={setPaymentFormError}
                  handleRecordPayment={handleRecordPayment}
                  handleUpdatePayment={handleUpdatePayment}
                  isDetailsExpanded={isDetailsExpanded}
                  setIsDetailsExpanded={setIsDetailsExpanded}
                  showManualPayment={true}
                  showInstallmentButtons={true}
                  additionalLoansCount={chronologicalAdditionalLoans.length}
                  selectedLoanIndex={selectedPaymentLoanIndex}
                  onSelectLoanIndex={setSelectedPaymentLoanIndex}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── Top Filter Row: Section Filter (Left) & Area Filter (Right) ── */}
            <div className="flex items-center gap-3 sm:gap-4 w-full">
          {/* LEFT: Section Filter Dropdown (Daily / Weekly / Monthly) */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                setIsSectionDropdownOpen((prev) => !prev)
                setIsAreaDropdownOpen(false)
              }}
              className="w-full flex items-center justify-between gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-[#0D1B3E] shadow-2xs hover:border-[#1B52E8]/60 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="truncate">{sectionDisplayMap[activeSection]}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isSectionDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Section Dropdown Menu */}
            {isSectionDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsSectionDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-full rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-40 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Section
                  </div>
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((sec) => {
                    const isCurrent = activeSection === sec
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleSectionChange(sec)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#EBF3FF] text-[#1B52E8]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{sectionDisplayMap[sec]}</span>
                        {isCurrent && <Check className="h-4 w-4 text-[#1B52E8] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Area Filter + Flag Filter Button */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setIsAreaDropdownOpen((prev) => !prev)
                  setIsSectionDropdownOpen(false)
                }}
                className="w-full flex items-center justify-between gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-[#0D1B3E] shadow-2xs hover:border-[#1B52E8]/60 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <MapPin className="h-4 w-4 text-[#1B52E8] shrink-0" />
                  <span className="truncate">{selectedArea ? selectedArea.name : 'Select Area'}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isAreaDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Area Dropdown (Shows only areas belonging to activeSection) */}
              {isAreaDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsAreaDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-full rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 z-40 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {sectionDisplayMap[activeSection]} Areas
                    </div>
                    {sectionAreas.length > 0 ? (
                      sectionAreas.map((area) => {
                        const isCurrent = selectedArea?.id === area.id
                        return (
                          <div
                            key={area.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedCustomerId(null)
                              setSelectedArea(area)
                              setIsAreaDropdownOpen(false)
                              router.replace(`/dashboard/areas/${area.id}`)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setSelectedCustomerId(null)
                                setSelectedArea(area)
                                setIsAreaDropdownOpen(false)
                                router.replace(`/dashboard/areas/${area.id}`)
                              }
                            }}
                            className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-left transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#EBF3FF] text-[#1B52E8]'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{area.name}</span>
                            {isCurrent && <Check className="h-4 w-4 text-[#1B52E8] shrink-0" />}
                          </div>
                        )
                      })
                    ) : (
                      <div className="px-3 py-2.5 text-xs text-slate-400 italic text-center">
                        No areas in {sectionDisplayMap[activeSection]}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Flag Filter Toggle Button (Immediately next to Area Dropdown) */}
            <button
              type="button"
              aria-label={isFlagFilterActive ? 'Show all customers' : 'Filter flagged customers only'}
              title={isFlagFilterActive ? 'Flagged Customers Only (Active)' : 'Filter flagged customers'}
              onClick={() => setIsFlagFilterActive((prev) => !prev)}
              className={`flex items-center justify-center shrink-0 self-stretch px-3 sm:px-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                isFlagFilterActive
                  ? 'bg-amber-100 text-amber-600 border-amber-300 ring-2 ring-amber-400/50'
                  : 'bg-white text-slate-400 border-slate-200/80 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50/30'
              }`}
            >
              <Flag
                className={`h-4 w-4 sm:h-4.5 sm:w-4.5 transition-all ${
                  isFlagFilterActive ? 'fill-amber-500 text-amber-500' : 'stroke-[2]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* ── Search + Filter + Add Customer Row ── */}
        <div className="mt-3.5 sm:mt-4 flex items-center gap-2.5 sm:gap-3 w-full">
          {/* LEFT: Search input (Name or Number) */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or number..."
              className="w-full rounded-2xl border border-slate-200/80 bg-white py-2.5 sm:py-3 pl-10 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/15 shadow-2xs transition-all"
            />
          </div>

          {/* Filter button next to Search */}
          <div className="relative shrink-0" ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsRiskFilterOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-2xl border px-3 sm:px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                customerRiskFilter === 'HIGH_RISK'
                  ? 'bg-rose-50 border-rose-300 text-rose-600 ring-2 ring-rose-400/40'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:text-[#1B52E8] hover:border-[#1B52E8]/40'
              }`}
              title="Filter customers"
              aria-label="Filter customers"
            >
              <Filter className={`h-4 w-4 ${customerRiskFilter === 'HIGH_RISK' ? 'text-rose-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">
                {customerRiskFilter === 'HIGH_RISK' ? 'High Risk' : 'Filter'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>

            {isRiskFilterOpen && (
              <div className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-48 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-100 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerRiskFilter('ALL')
                    setIsRiskFilterOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    customerRiskFilter === 'ALL'
                      ? 'bg-[#EBF3FF] text-[#1B52E8]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>All Customers</span>
                  {customerRiskFilter === 'ALL' && <Check className="h-3.5 w-3.5 text-[#1B52E8]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerRiskFilter('HIGH_RISK')
                    setIsRiskFilterOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    customerRiskFilter === 'HIGH_RISK'
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                    High Risk Customers
                  </span>
                  {customerRiskFilter === 'HIGH_RISK' && <Check className="h-3.5 w-3.5 text-rose-600" />}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: + Add Customer button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-2xl bg-[#1B52E8] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#1542C2] active:scale-[0.98] transition-all shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* ── Customers List Section ── */}
        <div className="mt-3.5 sm:mt-4 space-y-2.5 sm:space-y-3 w-full">
          {isLoading ? (
            <div className="py-10 text-center rounded-2xl bg-white border border-slate-100 shadow-2xs">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[#1B52E8] border-r-transparent" />
              <p className="mt-2 text-xs font-medium text-slate-500">Loading customers...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => {
              const dueStatus = getCustomerDueStatus(customer)
              const isHighRisk = dueStatus.isHighRisk

              return (
                <div
                  key={customer.id}
                  id={`customer-card-${customer.id}`}
                  onClick={() => handleOpenCustomerDetails(customer.id)}
                  className={`flex items-center justify-between rounded-2xl p-3.5 sm:p-4 transition-all cursor-pointer ${
                    isHighRisk
                      ? 'bg-rose-50/70 border border-rose-200 shadow-[0_2px_12px_-3px_rgba(225,29,72,0.1)] hover:shadow-[0_4px_16px_-3px_rgba(225,29,72,0.15)]'
                      : 'bg-white border border-slate-100 shadow-[0_2px_12px_-3px_rgba(13,27,62,0.06)] hover:shadow-[0_4px_16px_-3px_rgba(13,27,62,0.1)]'
                  }`}
                >
                  {/* Left: Avatar & Customer Name */}
                  <div className="flex items-center gap-3 sm:gap-3.5 flex-1 min-w-0">
                    <div
                      className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full font-bold text-xs sm:text-sm ${
                        isHighRisk
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-[#EBF3FF] text-[#1B52E8]'
                      }`}
                    >
                      {customer.serial_number != null ? customer.serial_number : '-'}
                    </div>
                    <span className="text-[15px] sm:text-[16px] font-bold text-[#0D1B3E] truncate leading-tight">
                      {customer.name}
                    </span>
                  </div>

                  {/* Right: Flag Mark/Unmark Icon + Phone/Call Action Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={customer.is_marked ? `Unmark ${customer.name}` : `Mark ${customer.name}`}
                      title={customer.is_marked ? `Unmark ${customer.name}` : `Mark ${customer.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleCustomerMark(customer.id)
                      }}
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full transition-all cursor-pointer shadow-2xs active:scale-95 ${
                        customer.is_marked
                          ? 'bg-amber-50 text-amber-500 border border-amber-200 hover:bg-amber-100'
                          : 'bg-slate-50 text-slate-400 border border-slate-200/70 hover:text-amber-500 hover:bg-amber-50/50'
                      }`}
                    >
                      <Flag
                        className={`h-4 w-4 ${
                          customer.is_marked ? 'fill-amber-500 text-amber-500' : 'stroke-[2]'
                        }`}
                      />
                    </button>

                    <a
                      href={`tel:${customer.phone}`}
                      aria-label={`Call ${customer.name}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/70 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Phone className="h-4 w-4 stroke-[2]" />
                    </a>
                  </div>
                </div>
              )
            })
          ) : !selectedArea ? (
            <div className="py-8 sm:py-12 text-center rounded-2xl bg-white border border-dashed border-slate-200 px-4">
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                {sectionAreas.length > 0
                  ? `Please select an area from the Area dropdown above to view ${sectionDisplayMap[activeSection]} customers.`
                  : `No areas found in ${sectionDisplayMap[activeSection]}.`}
              </p>
            </div>
          ) : (
            <div className="py-8 sm:py-12 text-center rounded-2xl bg-white border border-dashed border-slate-200 px-4">
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                {searchQuery
                  ? `No customers found matching "${searchQuery}"`
                  : customerRiskFilter === 'HIGH_RISK'
                  ? `No high risk customers in ${sectionDisplayMap[activeSection]} for ${selectedArea.name}`
                  : isFlagFilterActive
                  ? `No flagged customers in ${sectionDisplayMap[activeSection]} for ${selectedArea.name}`
                  : `No customers in ${sectionDisplayMap[activeSection]} for ${selectedArea.name}`}
              </p>
              {!isFlagFilterActive && customerRiskFilter !== 'HIGH_RISK' && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#1B52E8] hover:underline cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add first customer</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Payment History is shown ONLY inside the selected customer details panel, not here */}
          </>
        )}

      </div>

      {/* ── Add Customer Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] sm:max-h-[90vh] flex flex-col my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3.5 border-b border-slate-100 shrink-0 bg-white">
              <h3 className="text-base sm:text-lg font-bold text-[#0D1B3E]">Add New Customer</h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false)
                  setIsModalSectionOpen(false)
                  setIsModalAreaOpen(false)
                }}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleAddCustomer} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 flex-1 overscroll-contain">
                {formError && (
                  <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
                    {formError}
                  </div>
                )}

                {/* ── Side-by-Side Common Top Row: Section Dropdown (Left) & Area Dropdown (Right) ── */}
                <div className="flex items-start gap-2.5 sm:gap-3 w-full">
                  {/* LEFT: Section Dropdown */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Section
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        id="modal-section-dropdown-trigger"
                        onClick={() => {
                          setIsModalSectionOpen((prev) => !prev)
                          setIsModalAreaOpen(false)
                        }}
                        className="w-full flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#0D1B3E] shadow-2xs hover:border-[#1B52E8]/60 focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all cursor-pointer h-[38px] sm:h-[42px]"
                      >
                        <span className="truncate">{sectionDisplayMap[newCustomerSection]}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isModalSectionOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Section Dropdown Menu */}
                      {isModalSectionOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsModalSectionOpen(false)}
                          />
                          <div className="absolute left-0 top-full mt-1 w-full rounded-xl bg-white p-1 shadow-xl border border-slate-200 z-40 animate-in fade-in zoom-in-95 duration-100">
                            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((sec) => {
                              const isCurrent = newCustomerSection === sec
                              return (
                                <button
                                  key={sec}
                                  type="button"
                                  onClick={() => handleModalSectionChange(sec)}
                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-semibold text-left transition-colors cursor-pointer ${
                                    isCurrent
                                      ? 'bg-[#EBF3FF] text-[#1B52E8]'
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{sectionDisplayMap[sec]}</span>
                                  {isCurrent && <Check className="h-3.5 w-3.5 text-[#1B52E8] shrink-0" />}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Area Dropdown */}
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Area
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        id="modal-area-dropdown-trigger"
                        onClick={() => {
                          setIsModalAreaOpen((prev) => !prev)
                          setIsModalSectionOpen(false)
                        }}
                        className="w-full flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 bg-white px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#0D1B3E] shadow-2xs hover:border-[#1B52E8]/60 focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all cursor-pointer h-[38px] sm:h-[42px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <MapPin className={`h-3.5 w-3.5 shrink-0 ${selectedModalArea ? 'text-[#1B52E8]' : 'text-slate-400'}`} />
                          <span className={`truncate ${selectedModalArea ? 'text-[#0D1B3E]' : 'text-slate-400 font-normal'}`}>
                            {selectedModalArea ? selectedModalArea.name : 'Select Area'}
                          </span>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isModalAreaOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* Area Dropdown Menu */}
                      {isModalAreaOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsModalAreaOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-full rounded-xl bg-white p-1 shadow-xl border border-slate-200 z-40 animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto">
                            {modalSectionAreas.length > 0 ? (
                              modalSectionAreas.map((area) => {
                                const isCurrent = modalAreaId === area.id
                                return (
                                  <button
                                    key={area.id}
                                    type="button"
                                    onClick={() => {
                                      setModalAreaId(area.id)
                                      setIsModalAreaOpen(false)
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-semibold text-left transition-colors cursor-pointer ${
                                      isCurrent
                                        ? 'bg-[#EBF3FF] text-[#1B52E8]'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span className="truncate">{area.name}</span>
                                    {isCurrent && <Check className="h-3.5 w-3.5 text-[#1B52E8] shrink-0" />}
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-2.5 py-2 text-xs text-slate-400 italic text-center">
                                No areas in {sectionDisplayMap[newCustomerSection]}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── FIELD 1: Upload Photo ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Upload Photo
                  </label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    id="customer-photo-upload"
                  />

                  {photoUrl ? (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                      <img
                        src={photoUrl}
                        alt="Customer preview"
                        className="h-12 w-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-700">Photo Compressed</span>
                        </div>
                        {photoSizeKb !== null && (
                          <span className="text-[11px] text-emerald-700 font-medium block">
                            Size: {photoSizeKb} KB (max 50 KB)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="px-2.5 py-1 text-xs font-semibold text-[#1B52E8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          title="Remove photo"
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isCompressingPhoto}
                      className="w-full flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl border border-dashed border-slate-200 hover:border-[#1B52E8]/60 bg-slate-50/50 hover:bg-[#EBF3FF]/40 transition-all cursor-pointer group"
                    >
                      {isCompressingPhoto ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#1B52E8]">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-[#1B52E8] border-r-transparent" />
                          <span>Compressing photo to &lt; 50 KB...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 group-hover:text-[#1B52E8]">
                          <Camera className="h-4 w-4 text-slate-400 group-hover:text-[#1B52E8]" />
                          <span>Choose Photo (auto-compressed to max 50 KB)</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>

                {/* ── FIELD 2: S.no* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    S.no <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={serialNumber}
                    onChange={(e) => {
                      setSerialNumber(e.target.value)
                      if (serialNumberError) setSerialNumberError('')
                    }}
                    onBlur={() => {
                      if (serialNumber.trim()) {
                        checkSerialNumberDuplicate(serialNumber)
                      }
                    }}
                    placeholder="Enter serial number"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all ${
                      serialNumberError
                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-slate-200 focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20'
                    }`}
                  />
                  {serialNumberError && (
                    <p className="mt-1 text-xs font-medium text-red-500">
                      {serialNumberError}
                    </p>
                  )}
                </div>

                {/* ── FIELD 3: Name* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 4: Phone Number* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Enter primary phone number"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 5: Address ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Address
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter address manually or click location icon"
                      className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isDetectingLocation}
                      title="Detect current location"
                      aria-label="Detect current location"
                      className="flex items-center justify-center h-[38px] sm:h-[42px] px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#EBF3FF] hover:border-[#1B52E8]/60 text-slate-600 hover:text-[#1B52E8] transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isDetectingLocation ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-[#1B52E8] border-r-transparent" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {locationMessage && (
                    <p className="mt-1 text-[11px] text-slate-500 font-medium">
                      {locationMessage}
                    </p>
                  )}
                </div>

                {/* ── FIELD 6: Alternative Number ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Alternative Number
                  </label>
                  <input
                    type="tel"
                    value={alternativeNumber}
                    onChange={(e) => setAlternativeNumber(e.target.value)}
                    placeholder="Enter alternative phone number (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 7: Referral Name ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Referral Name
                  </label>
                  <input
                    type="text"
                    value={referralName}
                    onChange={(e) => setReferralName(e.target.value)}
                    placeholder="Enter referral person name (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 8: Referral Number ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Referral Number
                  </label>
                  <input
                    type="tel"
                    value={referralNumber}
                    onChange={(e) => setReferralNumber(e.target.value)}
                    placeholder="Enter referral phone number (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 9: Given Amount* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Given Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={givenAmount}
                    onChange={(e) => handleGivenAmountChange(e.target.value)}
                    placeholder="Enter given amount"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 10: Interest Amount* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Interest Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={interestAmount}
                    onChange={(e) => handleInterestAmountChange(e.target.value)}
                    placeholder="Enter interest amount"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 11: Total Amount* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Total Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={totalAmount}
                    onChange={(e) => handleTotalAmountChange(e.target.value)}
                    placeholder="Enter total amount"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all font-semibold text-[#0D1B3E]"
                  />
                </div>

                {/* ── FIELD 12: Installment Amount* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Installment Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    placeholder="Enter installment amount"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all font-semibold text-[#0D1B3E]"
                  />
                </div>

                {/* ── FIELD 12: Given Date* ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Given Date <span className="text-red-500">*</span>
                  </label>
                  <DateInputDMY
                    value={givenDate}
                    onChange={handleAddFormGivenDateChange}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                </div>

                {/* ── FIELD 13: Last Date* + Duration Picker ── */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Last Date <span className="text-red-500">*</span>
                  </label>
                  <DateInputDMY
                    value={lastDate}
                    onChange={setLastDate}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all"
                  />
                  {/* Duration picker — dynamic label and calculation driven by Section */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 shrink-0">
                      {newCustomerSection === 'DAILY' ? 'Days' : newCustomerSection === 'WEEKLY' ? 'Weeks' : 'Months'}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={addFormDuration}
                      onChange={(e) => handleAddFormDurValueChange(e.target.value)}
                      placeholder={newCustomerSection === 'DAILY' ? 'Days' : newCustomerSection === 'WEEKLY' ? 'Weeks' : 'Months'}
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-[#1B52E8] focus:ring-1 focus:ring-[#1B52E8]/20 transition-all"
                    />
                    {addFormDuration && parseInt(addFormDuration, 10) > 0 && (
                      <span className="text-[11px] text-slate-400">
                        {newCustomerSection === 'DAILY'
                          ? `${addFormDuration} days`
                          : newCustomerSection === 'WEEKLY'
                          ? `${addFormDuration}w = ${Number(addFormDuration) * 7}d`
                          : `${addFormDuration} month${Number(addFormDuration) > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── ADDITIONAL INFO ── */}
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs sm:text-sm font-bold text-[#0D1B3E] mb-2.5">
                    Additional Info
                  </h4>

                  {/* Two checkboxes: Notes Taken & Cheque Taken */}
                  <div className="flex items-center gap-6 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={notesTaken}
                        onChange={(e) => setNotesTaken(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1B52E8] focus:ring-[#1B52E8]"
                      />
                      <span>Notes Taken</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={chequeTaken}
                        onChange={(e) => setChequeTaken(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#1B52E8] focus:ring-[#1B52E8]"
                      />
                      <span>Cheque Taken</span>
                    </label>
                  </div>

                  {/* Single multiline textarea for additional details */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Additional Details
                    </label>
                    <textarea
                      rows={3}
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      placeholder="Enter additional details..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#1B52E8] focus:ring-2 focus:ring-[#1B52E8]/20 transition-all resize-none"
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="shrink-0 px-5 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setIsModalSectionOpen(false)
                    setIsModalAreaOpen(false)
                  }}
                  className="rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !newCustomerName.trim() ||
                    !newCustomerPhone.trim() ||
                    !modalAreaId ||
                    !serialNumber.trim() ||
                    !givenAmount.trim() ||
                    !interestAmount.trim() ||
                    !totalAmount.trim() ||
                    !installmentAmount.trim() ||
                    !givenDate.trim() ||
                    !lastDate.trim() ||
                    isSubmitting
                  }
                  className="rounded-xl bg-[#1B52E8] px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1542C2] disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Adding...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {isPreviewImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={handleCloseImageModal}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm sm:text-base font-bold text-[#0D1B3E] truncate">
                  {selectedCustomerDetails?.name}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                  Customer Photo
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Download photo"
                  aria-label="Download photo"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleCloseImageModal}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="p-3 sm:p-4 flex-1 flex items-center justify-center bg-slate-900/5 overflow-auto min-h-[200px]">
              <img
                src={imageToPreview}
                alt={selectedCustomerDetails?.name || 'Customer Photo'}
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <label
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#1B52E8] bg-[#EBF3FF] hover:bg-blue-100 transition-colors cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingPhoto ? 'Uploading...' : 'Change Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUploadPhoto(file)
                      e.target.value = ''
                    }}
                    disabled={isUploadingPhoto}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                  title="Download photo"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleCloseImageModal}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
