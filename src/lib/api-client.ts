/**
 * Unified API Client for Vyapar Samraj
 * Supports both Web Browser (cookies/sessions) and Native Android APK (Bearer JWT + HTTPS).
 */

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://vyapar-samraj.onrender.com'
).replace(/\/+$/, '')

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  )
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('auth_token', token)
  sessionStorage.setItem('auth_token', token)
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_token')
}

export function resolveApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  // If we are on mobile / Capacitor or if path is an absolute URL, resolve to Spring Boot backend
  if (isNativePlatform() || !cleanPath.startsWith('/api')) {
    return `${BACKEND_URL}${cleanPath}`
  }
  // Otherwise on web, call backend directly or via proxy
  return `${BACKEND_URL}${cleanPath}`
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = resolveApiUrl(endpoint)
  const token = getAuthToken()

  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })

  const contentType = response.headers.get('content-type') || ''
  let data: any
  if (contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const errorMsg = data?.message || (typeof data === 'string' ? data : 'API request failed')
    const error: any = new Error(errorMsg)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}
