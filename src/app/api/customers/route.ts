import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, ok, err } from '@/lib/api-response'

/**
 * GET /api/customers
 * Query params:
 *   - area_id (required): UUID of the area
 *   - section (optional): DAILY | WEEKLY | MONTHLY
 *
 * Enforces strict ownership:
 * Only returns customers where user_id = session.id AND area_id = area_id.
 */
function calculateDueRemaining(givenDateStr?: string | null, lastDateStr?: string | null, section?: string | null) {
  if (!lastDateStr) return { text: '-', isLate: false, weeks: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastDate = new Date(lastDateStr)
  lastDate.setHours(0, 0, 0, 0)

  const diffTime = lastDate.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  const sec = String(section || 'WEEKLY').toUpperCase()
  const singularUnit = sec === 'DAILY' ? 'day' : sec === 'MONTHLY' ? 'month' : 'week'
  const pluralUnit = sec === 'DAILY' ? 'days' : sec === 'MONTHLY' ? 'months' : 'weeks'

  if (diffDays >= 0) {
    const weeks = Math.max(1, Math.round(diffDays / 7))
    return {
      text: `${weeks} ${weeks === 1 ? singularUnit : pluralUnit} remaining`,
      isLate: false,
      weeks,
    }
  } else {
    const lateDays = Math.abs(diffDays)
    const lateWeeks = Math.max(1, Math.round(lateDays / 7))
    return {
      text: `${lateWeeks} ${lateWeeks === 1 ? singularUnit : pluralUnit} late`,
      isLate: true,
      weeks: lateWeeks,
    }
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id
  const { searchParams } = new URL(request.url)
  const checkSerialParam = searchParams.get('check_serial')
  if (checkSerialParam !== null) {
    const sNum = parseInt(checkSerialParam, 10)
    if (!isNaN(sNum)) {
      const [existing] = await sql`
        SELECT id FROM customers
        WHERE user_id = ${userId} AND serial_number = ${sNum}
        LIMIT 1
      `
      return ok({ exists: Boolean(existing) })
    }
    return ok({ exists: false })
  }

  const customerId = searchParams.get('id') || searchParams.get('customer_id')
  if (customerId) {
    try {
      const [customer] = await sql`
        SELECT c.*, a.name as area_name
        FROM customers c
        LEFT JOIN areas a ON c.area_id = a.id
        WHERE c.id = ${customerId} AND c.user_id = ${userId}
      `
      if (!customer) {
        return err('Customer not found or access denied', 404)
      }

      // Calculate paid from customer_payments table
      let paid = 0
      let payments: any[] = []
      try {
        const [paymentSum] = await sql`
          SELECT COALESCE(SUM(amount), 0) as total_paid
          FROM customer_payments
          WHERE customer_id = ${customerId} AND (loan_id = ${customerId} OR loan_id IS NULL)
        `
        paid = Number(paymentSum?.total_paid) || 0

        payments = await sql`
          SELECT id, customer_id, loan_id, amount, payment_method, 
                 payment_date::text as payment_date, 
                 remarks,
                 is_edited,
                 created_at
          FROM customer_payments
          WHERE customer_id = ${customerId}
          ORDER BY created_at ASC, id ASC
        `
      } catch (e) {
        console.error('Error fetching customer_payments:', e)
        paid = 0
      }

      const totalAmount = Number(customer.total_amount) || 0
      const installmentAmount = Number(customer.installment_amount) || 0
      const dueRemaining = calculateDueRemaining(customer.given_date, customer.last_date, customer.section)

      const finalPaid = paid
      const finalBalance = Math.max(0, totalAmount - paid)

      return ok({
        customer: {
          ...customer,
          latitude: customer.latitude != null ? Number(customer.latitude) : null,
          longitude: customer.longitude != null ? Number(customer.longitude) : null,
          section: String(customer.section || 'DAILY').toUpperCase(),
          status: customer.status || 'ACTIVE',
          paid: finalPaid,
          balance: finalBalance,
          total_amount: totalAmount,
          installment_amount: installmentAmount,
          due_remaining: dueRemaining.text,
          due_remaining_is_late: dueRemaining.isLate,
          payments: payments || [],
        },
      })
    } catch (error) {
      console.error('GET /api/customers by id error:', error)
      return err('Failed to fetch customer details', 500)
    }
  }

  const areaId = searchParams.get('area_id')
  const rawSection = searchParams.get('section')?.toLowerCase()
  const section = rawSection && ['daily', 'weekly', 'monthly'].includes(rawSection)
    ? rawSection
    : null

  if (!areaId) {
    return err('area_id is required', 400)
  }

  try {
    // Run area verification and customers query concurrently in parallel
    const [areaRows, rows] = await Promise.all([
      sql`
        SELECT id
        FROM areas
        WHERE id = ${areaId} AND user_id = ${userId}
      `,
      section
        ? sql`
            SELECT c.*,
                   COALESCE(p.total_paid, 0) as paid,
                   GREATEST(0, COALESCE(c.total_amount, 0) - COALESCE(p.total_paid, 0)) as balance
            FROM customers c
            LEFT JOIN (
              SELECT customer_id, SUM(amount) as total_paid
              FROM customer_payments
              WHERE loan_id = customer_id OR loan_id IS NULL
              GROUP BY customer_id
            ) p ON p.customer_id = c.id
            WHERE c.user_id = ${userId}
              AND c.area_id = ${areaId}
              AND LOWER(c.section) = ${section}
            ORDER BY c.serial_number ASC NULLS LAST, c.created_at ASC
          `
        : sql`
            SELECT c.*,
                   COALESCE(p.total_paid, 0) as paid,
                   GREATEST(0, COALESCE(c.total_amount, 0) - COALESCE(p.total_paid, 0)) as balance
            FROM customers c
            LEFT JOIN (
              SELECT customer_id, SUM(amount) as total_paid
              FROM customer_payments
              WHERE loan_id = customer_id OR loan_id IS NULL
              GROUP BY customer_id
            ) p ON p.customer_id = c.id
            WHERE c.user_id = ${userId}
              AND c.area_id = ${areaId}
            ORDER BY c.serial_number ASC NULLS LAST, c.created_at ASC
          `,
    ])

    if (areaRows.length === 0) {
      return err('Area not found or access denied', 404)
    }

    // Normalize section to uppercase for consistent UI display and parse numbers
    const normalizedRows = rows.map((r: any) => ({
      ...r,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      section: String(r.section || 'DAILY').toUpperCase(),
      paid: Number(r.paid || 0),
      balance: Math.max(0, (Number(r.total_amount) || 0) - (Number(r.paid) || 0)),
    }))

    return ok({ customers: normalizedRows })
  } catch (error) {
    console.error('GET /api/customers error:', error)
    return err('Failed to fetch customers', 500)
  }
}

/**
 * POST /api/customers
 * Creates a customer strictly associated with authenticated user and verified area.
 * Populates verified_by automatically from session.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const name = String(body.name || '').trim()
    const phone = String(body.phone || body.phone_number || '').trim()
    const areaId = String(body.area_id || '').trim()
    const rawSection = String(body.section || 'daily').toLowerCase()
    const section = ['daily', 'weekly', 'monthly'].includes(rawSection) ? rawSection : 'daily'

    if (!name) {
      return err('Customer name is required', 400)
    }
    if (!phone) {
      return err('Phone number is required', 400)
    }
    if (!areaId) {
      return err('Area ID is required', 400)
    }

    // Verify area belongs to this user
    const [area] = await sql`
      SELECT id
      FROM areas
      WHERE id = ${areaId} AND user_id = ${userId}
    `

    if (!area) {
      return err('Area not found or access denied', 403)
    }

    // Extract all fields
    const photoUrl = body.photo_url ? String(body.photo_url) : null
    const serialNumber = body.serial_number !== undefined && body.serial_number !== null && body.serial_number !== ''
      ? parseInt(String(body.serial_number), 10)
      : null

    if (serialNumber !== null && !isNaN(serialNumber)) {
      const [existingCustomer] = await sql`
        SELECT id FROM customers
        WHERE user_id = ${userId} AND serial_number = ${serialNumber}
        LIMIT 1
      `
      if (existingCustomer) {
        return err(`Serial number ${serialNumber} already exists. Please select another number.`, 409)
      }
    }
    const address = body.address ? String(body.address).trim() : null
    const latitude = body.latitude !== undefined && body.latitude !== null && body.latitude !== ''
      ? Number(body.latitude)
      : null
    const longitude = body.longitude !== undefined && body.longitude !== null && body.longitude !== ''
      ? Number(body.longitude)
      : null
    const alternativeNumber = body.alternative_number ? String(body.alternative_number).trim() : null
    const referralName = body.referral_name ? String(body.referral_name).trim() : null
    const referralNumber = body.referral_number ? String(body.referral_number).trim() : null
    const givenAmount = body.given_amount !== undefined && body.given_amount !== null && body.given_amount !== ''
      ? Number(body.given_amount)
      : null
    const interestAmount = body.interest_amount !== undefined && body.interest_amount !== null && body.interest_amount !== ''
      ? Number(body.interest_amount)
      : null
    const totalAmount = body.total_amount !== undefined && body.total_amount !== null && body.total_amount !== ''
      ? Number(body.total_amount)
      : (givenAmount !== null || interestAmount !== null ? (Number(givenAmount || 0) + Number(interestAmount || 0)) : null)
    const installmentAmount = body.installment_amount !== undefined && body.installment_amount !== null && body.installment_amount !== ''
      ? Number(body.installment_amount)
      : null

    if (installmentAmount === null || isNaN(installmentAmount)) {
      return err('Installment amount is required', 400)
    }

    const givenDate = body.given_date ? String(body.given_date).trim() : null
    const lastDate = body.last_date ? String(body.last_date).trim() : null
    const notesTaken = Boolean(body.notes_taken)
    const chequeTaken = Boolean(body.cheque_taken)
    const additionalDetails = body.additional_details ? String(body.additional_details).trim() : null

    // Verified by - strictly from authenticated session
    const verifiedByUserId = userId
    const verifiedByName = auth.session.fullName || auth.session.username || 'Authenticated User'
    const verifiedByEmail = (auth.session as any).email || null
    const verifiedAt = new Date()

    // Insert customer with userId and verified_by derived from session
    const [newCustomer] = await sql`
      INSERT INTO customers (
        user_id,
        area_id,
        section,
        name,
        phone,
        phone_number,
        photo_url,
        serial_number,
        address,
        latitude,
        longitude,
        alternative_number,
        referral_name,
        referral_number,
        given_amount,
        interest_amount,
        total_amount,
        installment_amount,
        given_date,
        last_date,
        notes_taken,
        cheque_taken,
        additional_details,
        verified_by_user_id,
        verified_by_name,
        verified_by_email,
        verified_at
      )
      VALUES (
        ${userId},
        ${areaId},
        ${section},
        ${name},
        ${phone},
        ${phone},
        ${photoUrl},
        ${serialNumber},
        ${address},
        ${latitude},
        ${longitude},
        ${alternativeNumber},
        ${referralName},
        ${referralNumber},
        ${givenAmount},
        ${interestAmount},
        ${totalAmount},
        ${installmentAmount},
        ${givenDate},
        ${lastDate},
        ${notesTaken},
        ${chequeTaken},
        ${additionalDetails},
        ${verifiedByUserId},
        ${verifiedByName},
        ${verifiedByEmail},
        ${verifiedAt}
      )
      RETURNING *
    `

    return ok({
      customer: {
        ...newCustomer,
        latitude: newCustomer.latitude != null ? Number(newCustomer.latitude) : null,
        longitude: newCustomer.longitude != null ? Number(newCustomer.longitude) : null,
        section: String(newCustomer.section || 'DAILY').toUpperCase(),
      },
    }, 201)
  } catch (error) {
    console.error('POST /api/customers error:', error)
    return err('Failed to create customer', 500)
  }
}

/**
 * PATCH /api/customers
 * Toggles or updates is_marked for a customer belonging to the authenticated user.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const customerId = String(body.customer_id || body.id || '').trim()
    if (!customerId) {
      return err('customer_id is required', 400)
    }

    const explicitMarked = typeof body.is_marked === 'boolean' ? body.is_marked : null

    const [updated] = explicitMarked !== null
      ? await sql`
          UPDATE customers
          SET is_marked = ${explicitMarked}, updated_at = NOW()
          WHERE id = ${customerId} AND user_id = ${userId}
          RETURNING *
        `
      : await sql`
          UPDATE customers
          SET is_marked = NOT is_marked, updated_at = NOW()
          WHERE id = ${customerId} AND user_id = ${userId}
          RETURNING *
        `

    if (!updated) {
      return err('Customer not found or access denied', 404)
    }

    return ok({
      customer: {
        ...updated,
        section: String(updated.section || 'DAILY').toUpperCase(),
      },
    })
  } catch (error) {
    console.error('PATCH /api/customers error:', error)
    return err('Failed to update customer', 500)
  }
}

/**
 * PUT /api/customers
 * Updates customer information (S.No, name, phone, section, area_id, alternative_number, referral_name, referral_number, address)
 * strictly for a customer belonging to the authenticated user.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const customerId = String(body.customer_id || body.id || '').trim()

    if (!customerId) {
      return err('Customer ID is required', 400)
    }

    // Verify customer exists and belongs to this user
    const [existingCustomer] = await sql`
      SELECT *
      FROM customers
      WHERE id = ${customerId} AND user_id = ${userId}
    `

    if (!existingCustomer) {
      return err('Customer not found or access denied', 404)
    }

    const name = body.name !== undefined ? String(body.name).trim() : existingCustomer.name
    const phone = body.phone !== undefined || body.phone_number !== undefined
      ? String(body.phone || body.phone_number).trim()
      : (existingCustomer.phone || existingCustomer.phone_number)

    if (!name) {
      return err('Customer name is required', 400)
    }
    if (!phone) {
      return err('Phone number is required', 400)
    }

    let section = existingCustomer.section
    if (body.section !== undefined) {
      const rawSection = String(body.section).toLowerCase()
      section = ['daily', 'weekly', 'monthly'].includes(rawSection) ? rawSection : 'daily'
    }

    let targetAreaId = existingCustomer.area_id
    if (body.area_id) {
      const cleanAreaId = String(body.area_id).trim()
      const [area] = await sql`
        SELECT id FROM areas WHERE id = ${cleanAreaId} AND user_id = ${userId}
      `
      if (area) {
        targetAreaId = area.id
      }
    }

    const serialNumber =
      body.serial_number !== undefined
        ? (body.serial_number !== null && body.serial_number !== '' ? parseInt(String(body.serial_number), 10) : null)
        : existingCustomer.serial_number

    const alternativeNumber =
      body.alternative_number !== undefined
        ? (body.alternative_number ? String(body.alternative_number).trim() : null)
        : existingCustomer.alternative_number

    const referralName =
      body.referral_name !== undefined
        ? (body.referral_name ? String(body.referral_name).trim() : null)
        : existingCustomer.referral_name

    const referralNumber =
      body.referral_number !== undefined
        ? (body.referral_number ? String(body.referral_number).trim() : null)
        : existingCustomer.referral_number

    const address =
      body.address !== undefined
        ? (body.address ? String(body.address).trim() : null)
        : existingCustomer.address

    const latitude =
      body.latitude !== undefined
        ? (body.latitude !== null && body.latitude !== '' ? Number(body.latitude) : null)
        : existingCustomer.latitude

    const longitude =
      body.longitude !== undefined
        ? (body.longitude !== null && body.longitude !== '' ? Number(body.longitude) : null)
        : existingCustomer.longitude

    const givenAmount =
      body.given_amount !== undefined
        ? (body.given_amount !== null && body.given_amount !== '' ? Number(body.given_amount) : null)
        : existingCustomer.given_amount

    const interestAmount =
      body.interest_amount !== undefined
        ? (body.interest_amount !== null && body.interest_amount !== '' ? Number(body.interest_amount) : null)
        : existingCustomer.interest_amount

    const totalAmount =
      body.total_amount !== undefined
        ? (body.total_amount !== null && body.total_amount !== '' ? Number(body.total_amount) : null)
        : existingCustomer.total_amount

    const installmentAmount =
      body.installment_amount !== undefined
        ? (body.installment_amount !== null && body.installment_amount !== '' ? Number(body.installment_amount) : null)
        : existingCustomer.installment_amount

    const givenDate =
      body.given_date !== undefined
        ? (body.given_date ? String(body.given_date).trim() : null)
        : existingCustomer.given_date

    const lastDate =
      body.last_date !== undefined
        ? (body.last_date ? String(body.last_date).trim() : null)
        : existingCustomer.last_date

    const notesTaken =
      body.notes_taken !== undefined
        ? Boolean(body.notes_taken)
        : existingCustomer.notes_taken

    const chequeTaken =
      body.cheque_taken !== undefined
        ? Boolean(body.cheque_taken)
        : existingCustomer.cheque_taken

    const additionalDetails =
      body.additional_details !== undefined
        ? (body.additional_details ? String(body.additional_details).trim() : null)
        : existingCustomer.additional_details

    const photoUrl =
      body.photo_url !== undefined
        ? (body.photo_url ? String(body.photo_url).trim() : null)
        : existingCustomer.photo_url

    const status =
      body.status !== undefined
        ? (body.status ? String(body.status).trim().toUpperCase() : 'ACTIVE')
        : (existingCustomer.status || 'ACTIVE')


    const [updated] = await sql`
      UPDATE customers
      SET
        name = ${name},
        phone = ${phone},
        phone_number = ${phone},
        serial_number = ${serialNumber},
        section = ${section},
        area_id = ${targetAreaId},
        alternative_number = ${alternativeNumber},
        referral_name = ${referralName},
        referral_number = ${referralNumber},
        address = ${address},
        latitude = ${latitude},
        longitude = ${longitude},
        given_amount = ${givenAmount},
        interest_amount = ${interestAmount},
        total_amount = ${totalAmount},
        installment_amount = ${installmentAmount},
        given_date = ${givenDate},
        last_date = ${lastDate},
        notes_taken = ${notesTaken},
        cheque_taken = ${chequeTaken},
        additional_details = ${additionalDetails},
        photo_url = ${photoUrl},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${customerId} AND user_id = ${userId}
      RETURNING *
    `


    if (!updated) {
      return err('Failed to update customer', 500)
    }

    // Fetch area name
    const [areaRow] = await sql`
      SELECT name as area_name
      FROM areas
      WHERE id = ${updated.area_id}
    `

    // Fetch total paid
    const [paidRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM customer_payments
      WHERE customer_id = ${customerId} AND (loan_id = ${customerId} OR loan_id IS NULL)
    `
    const paid = Number(paidRow?.total_paid) || 0
    const finalTotalAmount = Number(updated.total_amount) || 0
    const balance = Math.max(0, finalTotalAmount - paid)

    const dueRemaining = calculateDueRemaining(updated.given_date, updated.last_date, updated.section)

    return ok({
      customer: {
        ...updated,
        latitude: updated.latitude != null ? Number(updated.latitude) : null,
        longitude: updated.longitude != null ? Number(updated.longitude) : null,
        area_name: areaRow?.area_name || null,
        section: String(updated.section || 'DAILY').toUpperCase(),
        paid,
        balance,
        total_amount: finalTotalAmount,
        installment_amount: Number(updated.installment_amount) || 0,
        due_remaining: dueRemaining.text,
        due_remaining_is_late: dueRemaining.isLate,
      },
    })
  } catch (error: any) {
    console.error('PUT /api/customers error:', error)
    return err(error?.message || 'Failed to update customer', 500)
  }
}

/**
 * DELETE /api/customers
 * Query params: ?id=UUID or ?customer_id=UUID
 * Also supports JSON body: { id: UUID } or { customer_id: UUID }
 * Deletes only the selected customer belonging to the authenticated user.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id
  const { searchParams } = new URL(request.url)
  let customerId = searchParams.get('id') || searchParams.get('customer_id')

  if (!customerId) {
    try {
      const body = await request.json()
      customerId = body.id || body.customer_id
    } catch {
      // ignore
    }
  }

  if (!customerId) {
    return err('customer_id is required', 400)
  }

  try {
    const [deleted] = await sql`
      DELETE FROM customers
      WHERE id = ${customerId} AND user_id = ${userId}
      RETURNING id, name, area_id
    `

    if (!deleted) {
      return err('Customer not found or access denied', 404)
    }

    return ok({ deleted: true, customer: deleted })
  } catch (error) {
    console.error('DELETE /api/customers error:', error)
    return err('Failed to delete customer', 500)
  }
}

