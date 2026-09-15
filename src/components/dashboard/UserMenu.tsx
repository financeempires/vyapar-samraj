'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { LogOut } from 'lucide-react'

interface UserMenuProps {
  userName?: string
}

function getInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts.map((part) => part[0].toUpperCase()).join('')
}

export function UserMenu({ userName = '' }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const closeProfile = useCallback(() => {
    setIsOpen(false)
    if (typeof window !== 'undefined' && window.history.state?.profileOpen) {
      window.history.back()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    // Push history state so browser back button returns to the previous page
    window.history.pushState({ profileOpen: true }, '')

    const handlePopState = () => {
      setIsOpen(false)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeProfile()
      }
    }

    // Lock background scroll when full-page profile screen is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeProfile])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <>
      {/* Existing Header Profile Icon Button */}
      <button
        type="button"
        id="profile-dropdown-trigger"
        onClick={() => setIsOpen(true)}
        aria-label="User Profile"
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#EBF3FF] border border-blue-100 text-[#1B52E8] font-extrabold text-xs sm:text-sm select-none cursor-pointer shadow-2xs hover:opacity-95 transition-all"
      >
        {getInitials(userName)}
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#10B981] ring-2 ring-white" />
      </button>

      {/* FULL-PAGE Profile Screen */}
      {isOpen && (
        <div
          id="fullpage-profile-screen"
          className="fixed inset-0 z-50 flex flex-col bg-[#F4F7FC] animate-in fade-in duration-150"
        >
          {/* Exact Existing Vyapar Samraj Header Design */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-8 py-3.5 backdrop-blur-md shrink-0">
            {/* Logo & Brand Name (navigates to starting page) */}
            <Link
              href="/dashboard"
              id="profile-brand-link"
              onClick={() => closeProfile()}
              className="flex items-center gap-2.5 sm:gap-3 transition-opacity hover:opacity-90 cursor-pointer"
            >
              <Image
                src="/vs-logo.png"
                alt="Vyapar Samraj Logo"
                width={34}
                height={34}
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 object-contain"
                style={{ mixBlendMode: 'multiply' }}
              />
              <span className="text-lg sm:text-[22px] font-bold tracking-tight text-[#0D1B3E] truncate">
                Vyapar Samraj
              </span>
            </Link>

            {/* Profile Icon in Header (clicking returns to previous page) */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              <button
                type="button"
                id="profile-screen-close-trigger"
                onClick={() => closeProfile()}
                aria-label="Close Profile Screen"
                className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#EBF3FF] border border-blue-100 text-[#1B52E8] font-extrabold text-xs sm:text-sm select-none cursor-pointer shadow-2xs hover:opacity-95 transition-all"
              >
                {getInitials(userName)}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#10B981] ring-2 ring-white" />
              </button>
            </div>
          </header>

          {/* Full-Page Profile Screen Body */}
          <main className="w-full max-w-xl mx-auto px-4 sm:px-0 flex-1 flex flex-col justify-between pt-4 sm:pt-6 pb-6 sm:pb-8">
            {/* Top: Existing Logged-in User's Name */}
            <div className="w-full rounded-2xl bg-white p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
              <span className="text-base sm:text-lg font-bold text-[#0D1B3E] block truncate">
                {userName || 'User'}
              </span>
            </div>

            {/* Middle: Completely EMPTY */}
            <div className="flex-1" aria-hidden="true" />

            {/* Bottom: ONLY the existing Logout Option */}
            <div className="w-full pt-4">
              <button
                type="button"
                id="profile-screen-logout-button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-white border border-red-200/80 hover:bg-red-50/70 transition-colors px-4 py-3.5 sm:py-4 text-sm sm:text-base font-semibold text-red-600 shadow-2xs disabled:opacity-50 cursor-pointer select-none"
              >
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.2] text-red-600 shrink-0" />
                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </main>
        </div>
      )}
    </>
  )
}
