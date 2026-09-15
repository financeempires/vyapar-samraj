import { type NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireAuth, ok, err } from '@/lib/api-response'

/**
 * GET /api/customers/loans?customer_id=<uuid>
 * Fetches all additional loan records for a specific customer.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customer_id') || searchParams.get('id')

  if (!customerId) {
    return err('customer_id query parameter is required', 400)
  }

  try {
    // Verify customer ownership
    const [customer] = await sql`
      SELECT id FROM customers 
      WHERE id = ${customerId} AND user_id = ${userId}
    `
    if (!customer) {
      return err('Customer not found or access denied', 404)
    }

    const loans = await sql`
      SELECT * FROM customer_loans
      WHERE customer_id = ${customerId} AND user_id = ${userId}
      ORDER BY created_at DESC
    `

    const formattedLoans = loans.map((loan) => ({
      id: loan.id,
      customer_id: loan.customer_id,
      user_id: loan.user_id,
      given_amount: Number(loan.given_amount) || 0,
      interest_amount: Number(loan.interest_amount) || 0,
      total_amount: Number(loan.total_amount) || 0,
      installment_amount: Number(loan.installment_amount) || 0,
      given_date: loan.given_date,
      last_date: loan.last_date,
      referral_name: loan.referral_name,
      referral_number: loan.referral_number,
      notes_taken: Boolean(loan.notes_taken),
      cheque_taken: Boolean(loan.cheque_taken),
      additional_details: loan.additional_details,
      refinanced_from_loan_id: loan.refinanced_from_loan_id || null,
      status: loan.status || 'ACTIVE',
      created_at: loan.created_at,
      updated_at: loan.updated_at,
    }))

    return ok({ loans: formattedLoans })
  } catch (error: any) {
    console.error('Error fetching customer loans:', error)
    return err('Failed to fetch customer loans', 500)
  }
}

/**
 * POST /api/customers/loans
 * Creates a new additional loan record linked to an existing customer.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json().catch(() => ({}))
    const {
      customer_id,
      given_amount,
      interest_amount,
      total_amount,
      installment_amount,
      given_date,
      last_date,
      referral_name,
      referral_number,
      notes_taken,
      cheque_taken,
      additional_details,
      refinanced_from_loan_id,
    } = body

    if (!customer_id) {
      return err('customer_id is required', 400)
    }

    const numGiven = Number(given_amount)
    if (given_amount === undefined || given_amount === null || given_amount === '' || isNaN(numGiven) || numGiven <= 0) {
      return err('Given Amount is required and must be greater than 0', 400)
    }

    const numInterest = interest_amount !== undefined && interest_amount !== null && interest_amount !== '' ? Number(interest_amount) : 0
    if (isNaN(numInterest) || numInterest < 0) {
      return err('Interest Amount must be a valid non-negative number', 400)
    }

    const numTotal = Number(total_amount)
    if (total_amount === undefined || total_amount === null || total_amount === '' || isNaN(numTotal) || numTotal <= 0) {
      return err('Total Amount is required and must be greater than 0', 400)
    }

    const numInstallment = Number(installment_amount)
    if (installment_amount === undefined || installment_amount === null || installment_amount === '' || isNaN(numInstallment) || numInstallment <= 0) {
      return err('Installment Amount is required and must be greater than 0', 400)
    }

    if (!given_date) {
      return err('Given Date is required', 400)
    }

    if (!last_date) {
      return err('Last Date is required', 400)
    }

    // Verify customer ownership
    const [customer] = await sql`
      SELECT id FROM customers 
      WHERE id = ${customer_id} AND user_id = ${userId}
    `
    if (!customer) {
      return err('Customer not found or access denied', 404)
    }

    // If this is a refinanced loan, mark the original loan as CLOSED
    if (refinanced_from_loan_id) {
      if (refinanced_from_loan_id === customer_id) {
        await sql`
          UPDATE customers
          SET status = 'CLOSED', updated_at = NOW()
          WHERE id = ${customer_id} AND user_id = ${userId}
        `
      } else {
        await sql`
          UPDATE customer_loans
          SET status = 'CLOSED', updated_at = NOW()
          WHERE id = ${refinanced_from_loan_id} AND user_id = ${userId}
        `
      }
    }


    const [newLoan] = await sql`
      INSERT INTO customer_loans (
        customer_id,
        user_id,
        given_amount,
        interest_amount,
        total_amount,
        installment_amount,
        given_date,
        last_date,
        referral_name,
        referral_number,
        notes_taken,
        cheque_taken,
        additional_details,
        refinanced_from_loan_id,
        status
      ) VALUES (
        ${customer_id},
        ${userId},
        ${numGiven},
        ${numInterest},
        ${numTotal},
        ${numInstallment},
        ${given_date},
        ${last_date},
        ${referral_name ? String(referral_name).trim() : null},
        ${referral_number ? String(referral_number).trim() : null},
        ${Boolean(notes_taken)},
        ${Boolean(cheque_taken)},
        ${additional_details ? String(additional_details).trim() : null},
        ${refinanced_from_loan_id || null},
        'ACTIVE'
      )
      RETURNING *
    `

    const formattedLoan = {
      id: newLoan.id,
      customer_id: newLoan.customer_id,
      user_id: newLoan.user_id,
      given_amount: Number(newLoan.given_amount) || 0,
      interest_amount: Number(newLoan.interest_amount) || 0,
      total_amount: Number(newLoan.total_amount) || 0,
      installment_amount: Number(newLoan.installment_amount) || 0,
      given_date: newLoan.given_date,
      last_date: newLoan.last_date,
      referral_name: newLoan.referral_name,
      referral_number: newLoan.referral_number,
      notes_taken: Boolean(newLoan.notes_taken),
      cheque_taken: Boolean(newLoan.cheque_taken),
      additional_details: newLoan.additional_details,
      refinanced_from_loan_id: newLoan.refinanced_from_loan_id || null,
      status: newLoan.status || 'ACTIVE',
      created_at: newLoan.created_at,
      updated_at: newLoan.updated_at,
    }

    return ok({ loan: formattedLoan }, 201)
  } catch (error: any) {
    console.error('Error creating customer loan:', error)
    return err('Failed to create customer loan', 500)
  }
}

/**
 * PUT /api/customers/loans
 * Updates an existing additional loan record.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('status' in auth) return auth

  const userId = auth.session.id

  try {
    const body = await request.json().catch(() => ({}))
    const {
      id,
      loan_id,
      customer_id,
      given_amount,
      interest_amount,
      total_amount,
      installment_amount,
      given_date,
      last_date,
      referral_name,
      referral_number,
      notes_taken,
      cheque_taken,
      additional_details,
    } = body

    const targetLoanId = String(id || loan_id || '').trim()
    if (!targetLoanId) {
      return err('Loan ID is required', 400)
    }

    // Verify loan exists and belongs to this user
    const [existingLoan] = await sql`
      SELECT * FROM customer_loans
      WHERE id = ${targetLoanId} AND user_id = ${userId}
    `
    if (!existingLoan) {
      return err('Loan not found or access denied', 404)
    }

    const numGiven = given_amount !== undefined ? Number(given_amount) : Number(existingLoan.given_amount)
    if (isNaN(numGiven) || numGiven <= 0) {
      return err('Given Amount is required and must be greater than 0', 400)
    }

    const numInterest = interest_amount !== undefined ? Number(interest_amount) : Number(existingLoan.interest_amount)
    if (isNaN(numInterest) || numInterest < 0) {
      return err('Interest Amount must be a valid non-negative number', 400)
    }

    const numTotal = total_amount !== undefined ? Number(total_amount) : Number(existingLoan.total_amount)
    if (isNaN(numTotal) || numTotal <= 0) {
      return err('Total Amount is required and must be greater than 0', 400)
    }

    const numInstallment = installment_amount !== undefined ? Number(installment_amount) : Number(existingLoan.installment_amount)
    if (isNaN(numInstallment) || numInstallment <= 0) {
      return err('Installment Amount is required and must be greater than 0', 400)
    }

    const finalGivenDate = given_date || existingLoan.given_date
    if (!finalGivenDate) {
      return err('Given Date is required', 400)
    }

    const finalLastDate = last_date || existingLoan.last_date
    if (!finalLastDate) {
      return err('Last Date is required', 400)
    }

    const finalNotesTaken = notes_taken !== undefined ? Boolean(notes_taken) : Boolean(existingLoan.notes_taken)
    const finalChequeTaken = cheque_taken !== undefined ? Boolean(cheque_taken) : Boolean(existingLoan.cheque_taken)
    const finalRefName = referral_name !== undefined ? (referral_name ? String(referral_name).trim() : null) : existingLoan.referral_name
    const finalRefPhone = referral_number !== undefined ? (referral_number ? String(referral_number).trim() : null) : existingLoan.referral_number
    const finalDetails = additional_details !== undefined ? (additional_details ? String(additional_details).trim() : null) : existingLoan.additional_details

    const [updatedLoan] = await sql`
      UPDATE customer_loans
      SET
        given_amount = ${numGiven},
        interest_amount = ${numInterest},
        total_amount = ${numTotal},
        installment_amount = ${numInstallment},
        given_date = ${finalGivenDate},
        last_date = ${finalLastDate},
        notes_taken = ${finalNotesTaken},
        cheque_taken = ${finalChequeTaken},
        referral_name = ${finalRefName},
        referral_number = ${finalRefPhone},
        additional_details = ${finalDetails},
        updated_at = NOW()
      WHERE id = ${targetLoanId} AND user_id = ${userId}
      RETURNING *
    `

    const formattedLoan = {
      id: updatedLoan.id,
      customer_id: updatedLoan.customer_id,
      user_id: updatedLoan.user_id,
      given_amount: Number(updatedLoan.given_amount) || 0,
      interest_amount: Number(updatedLoan.interest_amount) || 0,
      total_amount: Number(updatedLoan.total_amount) || 0,
      installment_amount: Number(updatedLoan.installment_amount) || 0,
      given_date: updatedLoan.given_date,
      last_date: updatedLoan.last_date,
      referral_name: updatedLoan.referral_name,
      referral_number: updatedLoan.referral_number,
      notes_taken: Boolean(updatedLoan.notes_taken),
      cheque_taken: Boolean(updatedLoan.cheque_taken),
      additional_details: updatedLoan.additional_details,
      refinanced_from_loan_id: updatedLoan.refinanced_from_loan_id || null,
      status: updatedLoan.status || 'ACTIVE',
      created_at: updatedLoan.created_at,
      updated_at: updatedLoan.updated_at,
    }

    return ok({ loan: formattedLoan })
  } catch (error: any) {
    console.error('Error updating customer loan:', error)
    return err('Failed to update customer loan', 500)
  }
}
