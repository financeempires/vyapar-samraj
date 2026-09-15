/**
 * Email abstraction layer — Vyapar Samraj
 *
 * This module provides a clean interface for sending emails.
 * No email provider is connected yet. When you are ready to integrate
 * (e.g. Resend, SendGrid, AWS SES, Nodemailer), implement the `sendEmail`
 * function below and add the required environment variables.
 *
 * Current behaviour: logs the email payload to the console in development
 * and silently no-ops in production until a provider is connected.
 */

export interface EmailPayload {
  to:      string
  subject: string
  html:    string
  text?:   string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const { to, subject } = payload

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Email] To: ${to} | Subject: ${subject}`)
  }

  // TODO: integrate a provider below.
  //
  // Example — Resend:
  //   import { Resend } from 'resend'
  //   const resend = new Resend(process.env.RESEND_API_KEY)
  //   await resend.emails.send({ from: 'no-reply@vyaparsamraj.com', ...payload })
  //
  // Example — Nodemailer:
  //   const transporter = nodemailer.createTransport({ ... })
  //   await transporter.sendMail({ from: ..., ...payload })
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export async function sendLoginNotification(to: string, name: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'New login to your Vyapar Samraj account',
    html:    `<p>Hello ${name},</p><p>A new login was detected on your Super Admin account.</p>`,
    text:    `Hello ${name}, a new login was detected on your Super Admin account.`,
  })
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your Vyapar Samraj password',
    html:    `<p>Click the link below to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    text:    `Reset your password: ${resetLink}`,
  })
}
