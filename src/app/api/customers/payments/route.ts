import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, ok, err } from '@/lib/api-response'

/**
 * GET /api/customers/payments?customer_id=UUID
 * Returns all payments for a given customer belonging to the authenticated user.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customer_id') || searchParams.get('id')

  if (!customerId) {
    return err('customer_id is required', 400)
  }

  try {
    // Verify customer belongs to authenticated user
    const [customer] = await sql`
      SELECT id
      FROM customers
      WHERE id = ${customerId} AND user_id = ${userId}
    `

    if (!customer) {
      return err('Customer not found or access denied', 404)
    }

    const loanId = searchParams.get('loan_id')

    const payments = loanId
      ? await sql`
          SELECT id, customer_id, loan_id, amount, payment_method, 
                 payment_date::text as payment_date, 
                 remarks,
                 is_edited,
                 created_at
          FROM customer_payments
          WHERE customer_id = ${customerId}
            AND (loan_id = ${loanId} OR (${loanId} = ${customerId} AND loan_id IS NULL))
          ORDER BY created_at ASC, payment_date ASC
        `
      : await sql`
          SELECT id, customer_id, loan_id, amount, payment_method, 
                 payment_date::text as payment_date, 
                 remarks,
                 is_edited,
                 created_at
          FROM customer_payments
          WHERE customer_id = ${customerId}
          ORDER BY created_at ASC, payment_date ASC
        `

    return ok({ payments: payments || [] })
  } catch (error) {
    console.error('GET /api/customers/payments error:', error)
    return err('Failed to fetch payment history', 500)
  }
}

/**
 * POST /api/customers/payments
 * Body: { customer_id: UUID, loan_id?: UUID, amount: number, payment_method: 'Cash' | 'UPI' }
 * Records a new payment, strictly enforcing positive amount and <= remaining balance for the target loan.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const customerId = String(body.customer_id || body.customerId || '').trim()
    const rawLoanId = body.loan_id || body.loanId ? String(body.loan_id || body.loanId).trim() : null
    const rawAmount = body.amount
    const rawMethod = String(body.payment_method || body.paymentMethod || 'cash').trim().toLowerCase()
    const remarks = body.remarks !== undefined && body.remarks !== null ? String(body.remarks).trim() || null : null

    if (!customerId) {
      return err('Customer ID is mandatory', 400)
    }

    const amount = Number(rawAmount)
    if (isNaN(amount) || amount <= 0) {
      return err('Payment amount must be a positive number', 400)
    }

    const cleanMethod = rawMethod === 'upi' ? 'upi' : rawMethod === 'account' ? 'account' : 'cash'

    // Verify customer exists and belongs to authenticated user
    const [customer] = await sql`
      SELECT id, total_amount, user_id
      FROM customers
      WHERE id = ${customerId} AND user_id = ${userId}
    `

    if (!customer) {
      return err('Customer not found or access denied', 404)
    }

    const targetLoanId = rawLoanId || customerId
    let totalAmount = 0
    let currentPaid = 0

    if (targetLoanId !== customerId) {
      // It's an additional loan — verify ownership and fetch total amount
      const [loanRow] = await sql`
        SELECT id, total_amount
        FROM customer_loans
        WHERE id = ${targetLoanId} AND customer_id = ${customerId} AND user_id = ${userId}
      `
      if (!loanRow) {
        return err('Additional loan record not found or access denied', 404)
      }
      totalAmount = Number(loanRow.total_amount) || 0

      const [paidRow] = await sql`
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM customer_payments
        WHERE loan_id = ${targetLoanId}
      `
      currentPaid = Number(paidRow?.total_paid) || 0
    } else {
      // Main loan
      totalAmount = Number(customer.total_amount) || 0

      const [paidRow] = await sql`
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM customer_payments
        WHERE customer_id = ${customerId} AND (loan_id = ${customerId} OR loan_id IS NULL)
      `
      currentPaid = Number(paidRow?.total_paid) || 0
    }

    const remainingBalance = Math.max(0, totalAmount - currentPaid)

    if (remainingBalance <= 0) {
      return err('Loan balance is already fully settled (₹0 remaining)', 400)
    }

    if (amount > remainingBalance) {
      return err(
        `Payment amount (₹${amount.toLocaleString('en-IN')}) cannot exceed remaining balance of ₹${remainingBalance.toLocaleString('en-IN')}`,
        400
      )
    }

    const paymentDate =
      body.payment_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.payment_date).trim())
        ? String(body.payment_date).trim()
        : null

    // Insert into customer_payments with loan_id
    const [inserted] = await sql`
      INSERT INTO customer_payments (
        customer_id,
        loan_id,
        amount,
        payment_method,
        payment_date,
        remarks,
        created_at,
        updated_at
      ) VALUES (
        ${customerId},
        ${targetLoanId},
        ${amount},
        ${cleanMethod},
        COALESCE(${paymentDate}::date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date),
        ${remarks},
        NOW(),
        NOW()
      )
      RETURNING id, customer_id, loan_id, amount, payment_method, payment_date::text as payment_date, remarks, is_edited, created_at
    `

    // Immediately fetch updated payments for the customer
    const allPayments = await sql`
      SELECT id, customer_id, loan_id, amount, payment_method, 
             payment_date::text as payment_date, 
             remarks,
             is_edited,
             created_at
      FROM customer_payments
      WHERE customer_id = ${customerId}
      ORDER BY created_at ASC, id ASC
    `

    const newTotalPaid = currentPaid + amount
    const newBalance = Math.max(0, totalAmount - newTotalPaid)

    return ok({
      payment: {
        ...inserted,
        payment_method: cleanMethod,
      },
      payments: allPayments || [],
      total_paid: newTotalPaid,
      balance: newBalance,
      payment_count: allPayments.length,
    })
  } catch (error: any) {
    console.error('POST /api/customers/payments error:', error)
    return err(error?.message || 'Failed to record payment in database', 500)
  }
}

/**
 * PUT /api/customers/payments
 * Body: {
 *   payment_id: UUID,
 *   customer_id: UUID,
 *   amount: number,
 *   payment_method: 'cash' | 'upi' | 'account',
 *   payment_date?: string ('YYYY-MM-DD'),
 *   created_at?: string (ISO string)
 * }
 * Updates an existing payment record in-place without creating a new record.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json()
    const paymentId = String(body.payment_id || body.paymentId || body.id || '').trim()
    const customerId = String(body.customer_id || body.customerId || '').trim()
    const rawAmount = body.amount
    const rawMethod = String(body.payment_method || body.paymentMethod || 'cash').trim().toLowerCase()

    if (!paymentId) {
      return err('Payment ID is mandatory', 400)
    }
    if (!customerId) {
      return err('Customer ID is mandatory', 400)
    }

    const amount = Number(rawAmount)
    if (isNaN(amount) || amount <= 0) {
      return err('Payment amount must be a positive number', 400)
    }

    const cleanMethod = rawMethod === 'upi' ? 'upi' : rawMethod === 'account' ? 'account' : 'cash'

    // Verify customer exists and belongs to authenticated user
    const [customer] = await sql`
      SELECT id, total_amount, user_id
      FROM customers
      WHERE id = ${customerId} AND user_id = ${userId}
    `

    if (!customer) {
      return err('Customer not found or access denied', 404)
    }

    // Verify payment exists
    const [existingPayment] = await sql`
      SELECT id, customer_id, loan_id, amount
      FROM customer_payments
      WHERE id = ${paymentId} AND customer_id = ${customerId}
    `

    if (!existingPayment) {
      return err('Payment record not found', 404)
    }

    const targetLoanId = existingPayment.loan_id || customerId
    let totalAmount = 0
    let otherPaid = 0

    if (targetLoanId !== customerId) {
      const [loanRow] = await sql`
        SELECT id, total_amount
        FROM customer_loans
        WHERE id = ${targetLoanId} AND customer_id = ${customerId} AND user_id = ${userId}
      `
      totalAmount = Number(loanRow?.total_amount) || 0

      const [otherSumRow] = await sql`
        SELECT COALESCE(SUM(amount), 0) as other_paid
        FROM customer_payments
        WHERE loan_id = ${targetLoanId} AND id != ${paymentId}
      `
      otherPaid = Number(otherSumRow?.other_paid) || 0
    } else {
      totalAmount = Number(customer.total_amount) || 0

      const [otherSumRow] = await sql`
        SELECT COALESCE(SUM(amount), 0) as other_paid
        FROM customer_payments
        WHERE customer_id = ${customerId} AND (loan_id = ${customerId} OR loan_id IS NULL) AND id != ${paymentId}
      `
      otherPaid = Number(otherSumRow?.other_paid) || 0
    }

    const maxAllowed = Math.max(0, totalAmount - otherPaid)

    if (amount > maxAllowed) {
      return err(
        `Payment amount (₹${amount.toLocaleString('en-IN')}) cannot exceed remaining balance limit of ₹${maxAllowed.toLocaleString('en-IN')}`,
        400
      )
    }

    const paymentDate =
      body.payment_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.payment_date).trim())
        ? String(body.payment_date).trim()
        : null

    const remarks =
      body.remarks !== undefined
        ? (body.remarks !== null && String(body.remarks).trim() !== '' ? String(body.remarks).trim() : null)
        : undefined

    // Update the existing record in-place without modifying created_at or record sequence
    const [updated] = await sql`
      UPDATE customer_payments
      SET
        amount = ${amount},
        payment_method = ${cleanMethod},
        payment_date = COALESCE(${paymentDate}::date, payment_date),
        remarks = CASE WHEN ${body.remarks !== undefined} THEN ${remarks ?? null} ELSE remarks END,
        is_edited = TRUE,
        updated_at = NOW()
      WHERE id = ${paymentId} AND customer_id = ${customerId}
      RETURNING id, customer_id, loan_id, amount, payment_method, payment_date::text as payment_date, remarks, is_edited, created_at
    `

    // Immediately fetch all payments and aggregated totals directly from database ordered stably
    const allPayments = await sql`
      SELECT id, customer_id, loan_id, amount, payment_method, 
             payment_date::text as payment_date, 
             remarks,
             is_edited,
             created_at
      FROM customer_payments
      WHERE customer_id = ${customerId}
      ORDER BY created_at ASC, id ASC
    `

    const newTotalPaid = otherPaid + amount
    const newBalance = Math.max(0, totalAmount - newTotalPaid)

    return ok({
      payment: {
        ...updated,
        payment_method: cleanMethod,
      },
      payments: allPayments || [],
      total_paid: newTotalPaid,
      balance: newBalance,
      payment_count: allPayments.length,
    })
  } catch (error: any) {
    console.error('PUT /api/customers/payments error:', error)
    return err(error?.message || 'Failed to update payment in database', 500)
  }
}

export { PUT as PATCH }

