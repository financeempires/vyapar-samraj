import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/session'

export async function GET(request: Request) {
  await destroySession()
  const url = new URL('/login', request.url)
  return NextResponse.redirect(url, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}

export async function POST() {
  await destroySession()
  return NextResponse.json({ success: true })
}
