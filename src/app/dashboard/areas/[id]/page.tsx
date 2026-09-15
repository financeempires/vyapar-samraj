import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { sql } from '@/lib/db'
import { AreaDetailsClient } from '@/components/dashboard/AreaDetailsClient'

export const metadata: Metadata = {
  title: 'Area Details — Vyapar Samraj',
  description: 'Manage customers and accounts for selected area.',
}

interface AreaPageProps {
  params: Promise<{ id: string }>
}

export default async function AreaPage({ params }: AreaPageProps) {
  const session = await verifySession()

  if (!session) {
    redirect('/login')
  }

  if (session.role === 'SUPER_ADMIN') {
    redirect('/super-admin/dashboard')
  }

  const { id } = await params

  // 1. Fetch area, user areas, and customers for this area concurrently in parallel
  const [areaRows, userAreaRows, customerRows] = await Promise.all([
    sql`
      SELECT id, name, section, is_marked
      FROM areas
      WHERE id = ${id} AND user_id = ${session.id}
    `,
    sql`
      SELECT id, name, section, is_marked
      FROM areas
      WHERE user_id = ${session.id}
      ORDER BY created_at ASC
    `,
    sql`
      SELECT *
      FROM customers
      WHERE user_id = ${session.id} AND area_id = ${id}
      ORDER BY created_at DESC
    `,
  ])

  const area = areaRows[0]
  if (!area) {
    // Area doesn't exist or does not belong to this user
    redirect('/dashboard')
  }

  const initialSection = (
    area.section && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(String(area.section).toUpperCase())
      ? String(area.section).toUpperCase()
      : 'DAILY'
  )

  // Pre-seed customer cache for this area across Daily, Weekly, and Monthly sections
  const initialCache: Record<string, any[]> = {
    [`${id}_DAILY`]: [],
    [`${id}_WEEKLY`]: [],
    [`${id}_MONTHLY`]: [],
  }

  customerRows.forEach((r: any) => {
    const sec = String(r.section || 'DAILY').toUpperCase()
    const key = `${id}_${sec}`
    if (!initialCache[key]) {
      initialCache[key] = []
    }
    initialCache[key].push({
      ...r,
      id: String(r.id),
      user_id: String(r.user_id),
      area_id: String(r.area_id),
      name: String(r.name),
      phone: String(r.phone),
      serial_number: r.serial_number != null ? Number(r.serial_number) : null,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      section: sec,
      is_marked: Boolean(r.is_marked),
      installment_amount: r.installment_amount != null ? Number(r.installment_amount) : null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    })
  })

  const initialCustomers = initialCache[`${id}_${initialSection}`] || []

  return (
    <AreaDetailsClient
      userName={session.fullName || session.username}
      initialArea={{
        id: String(area.id),
        name: String(area.name),
        section: String(area.section),
        is_marked: Boolean(area.is_marked),
      }}
      userAreas={userAreaRows.map((a: any) => ({
        id: String(a.id),
        name: String(a.name),
        section: String(a.section),
        is_marked: Boolean(a.is_marked),
      }))}
      initialCustomers={initialCustomers}
      initialCache={initialCache}
    />
  )
}
