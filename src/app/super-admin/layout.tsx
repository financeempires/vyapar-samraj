import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()

  if (!session) {
    redirect('/login')
  }

  if (session.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
