'use client'

import { useRef } from 'react'
import { Calendar, X } from 'lucide-react'

export interface DateInputDMYProps {
  /** Current value in YYYY-MM-DD or DD/MM/YYYY format */
  value: string
  /** Called with the new value in YYYY-MM-DD format — DB/API format is never changed */
  onChange: (isoValue: string) => void
  /** CSS classes forwarded to the visible text input */
  className?: string
  /** CSS classes forwarded to the wrapper div */
  wrapperClassName?: string
  /** Style applied to the outer wrapper div */
  wrapperStyle?: React.CSSProperties
  disabled?: boolean
  required?: boolean
  'aria-label'?: string
  id?: string
  /** Whether to show a visible calendar icon on the right */
  showCalendarIcon?: boolean
  /** Callback when user clicks the clear (X) button */
  onClear?: () => void
  placeholder?: string
}

/** Convert any YYYY-MM-DD or DD/MM/YYYY string to DD/MM/YYYY for user-facing display */
export function toDMY(val: string): string {
  if (!val) return ''
  const trimmed = val.trim()
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed
  }
  return trimmed
}

/** Convert any DD/MM/YYYY or YYYY-MM-DD string to YYYY-MM-DD for native date input */
export function toISO(val: string): string {
  if (!val) return ''
  const trimmed = val.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  }
  return ''
}

/**
 * Date input that shows DD/MM/YYYY to the user while keeping
 * YYYY-MM-DD internally for all database, API, and calculation operations.
 */
export function DateInputDMY({
  value,
  onChange,
  className = '',
  wrapperClassName = '',
  wrapperStyle,
  disabled,
  required,
  'aria-label': ariaLabel,
  id,
  showCalendarIcon = false,
  onClear,
  placeholder = 'DD/MM/YYYY',
}: DateInputDMYProps) {
  const dateRef = useRef<HTMLInputElement>(null)

  const displayValue = toDMY(value)
  const isoValue = toISO(value)

  const handleOpenPicker = () => {
    if (disabled) return
    try {
      if (dateRef.current && typeof dateRef.current.showPicker === 'function') {
        dateRef.current.showPicker()
      } else {
        dateRef.current?.focus()
      }
    } catch {
      // Browser fallback handled by native input click
    }
  }

  return (
    <div
      className={`relative inline-flex items-center ${wrapperClassName}`}
      style={wrapperStyle}
      onClick={handleOpenPicker}
    >
      {/* Visible text showing DD/MM/YYYY — pointer-events disabled so clicks go through */}
      <input
        type="text"
        value={displayValue}
        readOnly
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        id={id}
        tabIndex={-1}
        className={`${className} pointer-events-none select-none w-full h-full`}
        aria-hidden="true"
      />

      {/* Right-side Calendar Icon + Clear Button (if active) */}
      {showCalendarIcon && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
          {Boolean(displayValue && onClear) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClear?.()
              }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Clear date"
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <span
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer pointer-events-none"
            aria-hidden="true"
          >
            <Calendar className="h-3.5 w-3.5" />
          </span>
        </div>
      )}

      {/* Transparent native date picker — sits on top, handles all calendar interactions */}
      <input
        ref={dateRef}
        type="date"
        value={isoValue}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            if (typeof (e.target as HTMLInputElement).showPicker === 'function') {
              (e.target as HTMLInputElement).showPicker()
            }
          } catch {}
        }}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
        style={{ colorScheme: 'light' }}
        tabIndex={0}
      />
    </div>
  )
}

