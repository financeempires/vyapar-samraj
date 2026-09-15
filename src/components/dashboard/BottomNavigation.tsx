'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Crown, Users, Menu } from 'lucide-react'

const navItems = [
  {
    label: 'Home',
    href: '/super-admin/dashboard',
    icon: Home,
  },
  {
    label: 'Plans',
    href: '/super-admin/plans',
    icon: Crown,
  },
  {
    label: 'Users',
    href: '/super-admin/users',
    icon: Users,
  },
  {
    label: 'Menu',
    href: '/super-admin/menu',
    icon: Menu,
  },
]

export function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white"
      style={{
        boxShadow: '0 -2px 16px rgba(0,0,0,0.08)',
        borderTop: '1px solid #F1F5F9',
      }}
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full py-2 transition-colors"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 1.8}
                style={{ color: isActive ? '#2351D9' : '#9CA3AF' }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: isActive ? '#2351D9' : '#9CA3AF' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
