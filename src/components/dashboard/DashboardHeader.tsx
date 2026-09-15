'use client'

import Image from 'next/image'
import Link from 'next/link'


interface DashboardHeaderProps {
  userName?: string
}

export function DashboardHeader({ userName = 'Super Admin' }: DashboardHeaderProps) {
  // Get initials from userName
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white">
      {/* Left: Logo + Brand name */}
      <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
        <div className="w-10 h-10 flex-shrink-0">
          <Image
            src="/vs-logo.png"
            alt="Vyapar Samraj"
            width={40}
            height={40}
            className="w-10 h-10 object-contain"
            style={{ mixBlendMode: 'multiply' }}
            priority
          />
        </div>
        <span
          className="text-[17px] font-bold leading-none"
          style={{ color: '#0D1B3E' }}
        >
          Vyapar Samraj
        </span>
      </Link>

      {/* Right: Avatar */}
      <div className="flex items-center gap-3">

        {/* Avatar with online indicator */}
        <Link href="/super-admin/profile" className="relative cursor-pointer" aria-label={`${userName} profile`}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#CBD5E1' }}
          >
            <span style={{ color: '#0D1B3E' }}>{initials}</span>
          </div>
          {/* Green online dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        </Link>
      </div>
    </header>
  )
}
