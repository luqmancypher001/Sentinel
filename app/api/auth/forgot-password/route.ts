import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { checkIpRateLimit } from '@/lib/rate-limiter'
import { sendEmail } from '@/lib/email'

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const ipCheck = await checkIpRateLimit(ip)
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: ipCheck.reason }, { status: 429 })
    }

    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Always return the same response whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    if (user) {
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      })

      const origin = req.headers.get('origin') || req.nextUrl.origin
      const resetLink = `${origin}/?resetToken=${rawToken}`

      await sendEmail({
        to: user.email,
        subject: 'Reset your Sentinel password',
        body: `Click the link below to reset your password. This link expires in 30 minutes and can only be used once.\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process password reset request' },
      { status: 500 }
    )
  }
}
