'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'

export function NativeAppBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isNative =
      Capacitor.isNativePlatform() ||
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      window.location.protocol === 'capacitor:'

    if (!isNative) {
      // In web browser: preserve existing web behavior 100% untouched
      return
    }

    const BACKEND_URL = (
      process.env.NEXT_PUBLIC_BACKEND_URL || 'https://vyapar-samraj.onrender.com'
    ).replace(/\/+$/, '')

    // ── 1. Global Fetch Interceptor for Native Capacitor & API calls ──
    const originalFetch = window.fetch
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      let urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

      // If it's a relative /api call, route directly to the Spring Boot backend
      if (urlStr.startsWith('/api/') || urlStr === '/api') {
        urlStr = `${BACKEND_URL}${urlStr}`
      }

      const options: RequestInit = { ...init }
      const headers = new Headers(options.headers || (typeof input === 'object' && 'headers' in input ? (input as Request).headers : {}))

      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      options.headers = headers
      options.credentials = options.credentials || 'include'

      const response = await originalFetch(urlStr, options)

      // Automatically capture auth token from login/verification responses
      if (urlStr.includes('/api/auth/')) {
        try {
          const clone = response.clone()
          const data = await clone.json()
          const tokenFound = data?.data?.token || data?.token
          if (tokenFound && typeof tokenFound === 'string') {
            localStorage.setItem('auth_token', tokenFound)
            sessionStorage.setItem('auth_token', tokenFound)
          }
          if (urlStr.includes('/logout') || urlStr.includes('/signout')) {
            localStorage.removeItem('auth_token')
            sessionStorage.removeItem('auth_token')
          }
        } catch {
          // Ignore JSON parse errors on non-json responses
        }
      }

      return response
    }

    // ── 2. Hardware Back Button Listener on Android ──
    let backListenerHandle: any = null
    try {
      App.addListener('backButton', (data: { canGoBack: boolean }) => {
        const path = window.location.pathname
        if (path === '/login' || path === '/dashboard' || path === '/super-admin/dashboard' || path === '/' || !data.canGoBack) {
          App.exitApp()
        } else {
          window.history.back()
        }
      }).then((handle) => {
        backListenerHandle = handle
      }).catch(() => {})
    } catch {
      // Ignore if not on native platform
    }

    // ── 3. Hide Splash Screen if plugin is available ──
    try {
      SplashScreen.hide().catch(() => {})
    } catch {
      // Ignore if not on native platform
    }

    return () => {
      if (backListenerHandle && typeof backListenerHandle.remove === 'function') {
        backListenerHandle.remove()
      }
    }
  }, [])

  return null
}
