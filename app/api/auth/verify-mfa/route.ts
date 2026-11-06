import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  verifyTotpToken,
  verifyPassword,
  createSessionToken,
  verifyMfaChallengeToken,
  decryptTotpSecret,
} from '@/lib/auth'
import { clearFailedAttempts } from '@/lib/rate-limiter'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tempToken, code, isRecoveryCode } = body

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: 'Verification code and challenge token are required' },
        { status: 400 }
      )
    }

    // 1. Verify Temp Token
    const { valid, payload: challengeData } = await verifyMfaChallengeToken(tempToken)
    if (!valid || !challengeData) {
      return NextResponse.json(
        { error: 'MFA session expired. Please sign in again.' },
        { status: 401 }
      )
    }

    const { userId, geo, device, riskScore } = challengeData as any

    // 2. Fetch User with TOTP secret and recovery codes
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        recoveryCodes: { where: { used: false } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let isCodeValid = false
    let usedRecoveryId: string | null = null

    // Check TOTP code
    if (!isRecoveryCode && user.totpSecret) {
      isCodeValid = verifyTotpToken(code, decryptTotpSecret(user.totpSecret))
    }

    // If TOTP check failed or recovery code was selected, check backup recovery codes
    if (!isCodeValid && user.recoveryCodes.length > 0) {
      for (const rec of user.recoveryCodes) {
        const matches = await verifyPassword(code.trim().toUpperCase(), rec.codeHash)
        if (matches) {
          isCodeValid = true
          usedRecoveryId = rec.id
          break
        }
      }
    }

    if (!isCodeValid) {
      return NextResponse.json(
        { error: 'Invalid 6-digit verification code or recovery code' },
        { status: 401 }
      )
    }

    // If recovery code was used, mark it as consumed
    if (usedRecoveryId) {
      await prisma.recoveryCode.update({
        where: { id: usedRecoveryId },
        data: { used: true, usedAt: new Date() },
      })
    }

    // Clear failed attempts counter
    await clearFailedAttempts(user.email)

    // Register or update device as trusted
    if (device?.fingerprint) {
      await prisma.device.upsert({
        where: {
          userId_fingerprint: {
            userId: user.id,
            fingerprint: device.fingerprint,
          },
        },
        update: {
          lastActive: new Date(),
          lastLocation: `${geo?.city || 'Unknown'}, ${geo?.country || ''}`,
          isTrusted: true,
        },
        create: {
          userId: user.id,
          fingerprint: device.fingerprint,
          name: device.name || 'Personal Device',
          browser: device.browser || 'Browser',
          os: device.os || 'OS',
          lastLocation: `${geo?.city || 'Unknown'}, ${geo?.country || ''}`,
          isTrusted: true,
        },
      })
    }

    // Record successful login in audit log
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        identifier: user.email,
        ip: geo?.ip || '127.0.0.1',
        city: geo?.city,
        country: geo?.country,
        lat: geo?.lat,
        lon: geo?.lon,
        browser: device?.browser,
        os: device?.os,
        device: device?.name,
        status: 'Success',
        riskScore: riskScore || 0,
        riskFactors: JSON.stringify(usedRecoveryId ? ['RECOVERY_CODE_USED'] : ['MFA_VERIFIED']),
      },
    })

    // Issue standard session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    })

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: geo?.ip,
        deviceInfo: `${device?.name || 'Device'} · ${device?.browser || 'Browser'}`,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
    })

    const response = NextResponse.json({
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        totpEnabled: user.totpEnabled,
      },
    })

    response.cookies.set('sentinel_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('MFA verify error:', error)
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    )
  }
}
