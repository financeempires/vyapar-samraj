import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super_secret_vyapar_samraj_key_2026_safe_auth_token_string'
)

const COOKIE_NAME = 'sa_session'

async function isBackendAvailable(): Promise<boolean> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8085'
  try {
    const res = await fetch(`${backendUrl}/api/auth/super-admin/login`, {
      method: 'OPTIONS',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    return res.ok || res.status < 500
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Read session payload from HttpOnly cookie
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value
  let sessionPayload: any = null

  if (sessionCookie) {
    try {
      const backendRunning = await isBackendAvailable()
      if (backendRunning) {
        const { payload } = await jwtVerify(sessionCookie, SECRET_KEY)
        sessionPayload = payload
      } else {
        sessionPayload = null
      }
    } catch {
      sessionPayload = null
    }
  }

  const isSuperAdmin = sessionPayload?.role === 'SUPER_ADMIN'
  const isNormalUser = sessionPayload?.role === 'USER' || sessionPayload?.role === 'SUB_USER'
  const isAuthenticated = isSuperAdmin || isNormalUser

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/forgot-password', '/api/auth']
  const isPublicRoute = publicRoutes.some((r) => pathname.startsWith(r))
  const isApiRoute = pathname.startsWith('/api/')

  // 1. Protect Super Admin routes
  if (pathname.startsWith('/super-admin')) {
    if (!isSuperAdmin) {
      const targetUrl = isNormalUser ? '/dashboard' : '/login'
      const response = NextResponse.redirect(new URL(targetUrl, request.url))

      if (!isAuthenticated && sessionCookie) {
        response.cookies.set(COOKIE_NAME, '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
        })
      }

      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      return response
    }
  }

  // 2. Protect Normal User Dashboard route
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      return response
    }
    if (isSuperAdmin) {
      return NextResponse.redirect(new URL('/super-admin/dashboard', request.url))
    }
  }

  // 3. Prevent logged-in users from viewing /login
  if (pathname === '/login' && isAuthenticated) {
    if (isSuperAdmin) {
      return NextResponse.redirect(new URL('/super-admin/dashboard', request.url))
    }
    if (isNormalUser) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // 4. Any other non-public page route requires authentication
  const isProtectedPage = !isPublicRoute && !isApiRoute && pathname !== '/'
  if (isProtectedPage && !isAuthenticated) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return response
  }

  const response = NextResponse.next()

  if (pathname.startsWith('/super-admin') || pathname.startsWith('/dashboard')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
