'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)

    try {
      // Call backend logout endpoint via Next.js proxy
      const response = await fetch('/api/auth/super-admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Logout error, status:', response.status)
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear session state and force navigation to /login
      window.location.href = '/login'
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
      style={{
        backgroundColor: '#FEF2F2',
        color: '#DC2626',
        border: '1px solid #FCA5A5',
      }}
      aria-label="Logout"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-[#DC2626]" />
          <span>Logging out...</span>
        </>
      ) : (
        <>
          <LogOut className="w-4 h-4 text-[#DC2626]" strokeWidth={2} />
          <span>Logout</span>
        </>
      )}
    </button>
  )
}
