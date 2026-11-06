import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { clearFailedAttempts } from '@/lib/rate-limiter'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Reset token and new password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Resetting the password invalidates every existing session, in case
      // the account was compromised.
      prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
    ])

    const user = await prisma.user.findUnique({ where: { id: resetToken.userId } })
    if (user) await clearFailedAttempts(user.email)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to reset password' },
      { status: 500 }
    )
  }
}
