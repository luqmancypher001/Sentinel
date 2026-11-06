import nodemailer from 'nodemailer'

/**
 * Pluggable email sender.
 *
 * No SMTP server is configured by default, so this logs to the server
 * console — which keeps password reset and security-alert emails fully
 * functional for local dev/demo without requiring any credentials.
 *
 * To send real email, set SMTP_HOST/SMTP_USER/SMTP_PASS (see .env.example) —
 * this works with Gmail (smtp.gmail.com, an "app password", not your normal
 * password), any other mailbox's SMTP, or a free dev inbox like Mailtrap.
 * Nothing else in the app needs to change.
 */
export interface EmailMessage {
  to: string
  subject: string
  body: string
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null
function getTransporter(): ReturnType<typeof nodemailer.createTransport> {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

export async function sendEmail({ to, subject, body }: EmailMessage): Promise<void> {
  if (process.env.SMTP_HOST) {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: body,
    })
    return
  }

  console.log(
    `\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${body}\n`
  )
}
