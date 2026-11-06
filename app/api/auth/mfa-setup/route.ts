import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  generateTotpSecret,
  verifyTotpToken,
  generateRecoveryCodes,
  requireSession,
  encryptTotpSecret,
} from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, totpEnabled: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const totp = await generateTotpSecret(user.email)

    return NextResponse.json({
      secret: totp.secret,
      qrCodeDataUrl: totp.qrCodeDataUrl,
      totpEnabled: user.totpEnabled,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'MFA setup initialization failed' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { secret, code } = body

    if (!secret || !code) {
      return NextResponse.json(
        { error: 'Secret and verification code are required' },
        { status: 400 }
      )
    }

    // Verify token with secret
    const isValid = verifyTotpToken(code, secret)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      )
    }

    // Generate fresh backup recovery codes
    const recovery = await generateRecoveryCodes()

    // Delete existing unused recovery codes and add new ones
    await prisma.recoveryCode.deleteMany({
      where: { userId: session.userId },
    })

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        totpSecret: encryptTotpSecret(secret),
        totpEnabled: true,
        recoveryCodes: {
          create: recovery.hashedCodes.map((codeHash) => ({ codeHash })),
        },
      },
    })

    return NextResponse.json({
      success: true,
      recoveryCodes: recovery.rawCodes,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to enable MFA' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        totpEnabled: false,
      },
    })

    return NextResponse.json({ success: true, totpEnabled: false })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to disable MFA' },
      { status: 500 }
    )
  }
}
