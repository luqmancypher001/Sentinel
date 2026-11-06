import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  hashPassword,
  generateTotpSecret,
  generateRecoveryCodes,
  createSessionToken,
  encryptTotpSecret,
} from '@/lib/auth'
import { parseUserAgent } from '@/lib/fingerprint'
import { resolveGeoLocation } from '@/lib/geoip'
import { checkIpRateLimit } from '@/lib/rate-limiter'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'

    // 1. IP Rate Limiting Check
    const ipLimit = await checkIpRateLimit(ip)
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: ipLimit.reason },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { name, email, password, simulateLocation } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password using bcrypt
    const passwordHash = await hashPassword(password)

    // Generate TOTP Secret & QR Code
    const totp = await generateTotpSecret(email)

    // Generate 8 recovery backup codes
    const recovery = await generateRecoveryCodes()

    // Resolve Geolocation & Device info
    const ua = req.headers.get('user-agent') || ''
    const device = parseUserAgent(ua)
    const geo = resolveGeoLocation(ip, simulateLocation)

    // Create User in DB with initial device & recovery codes
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name || email.split('@')[0],
        passwordHash,
        totpSecret: encryptTotpSecret(totp.secret),
        totpEnabled: true, // Enabled by default for project demonstration
        devices: {
          create: {
            fingerprint: device.fingerprint,
            name: device.name,
            browser: device.browser,
            os: device.os,
            lastLocation: `${geo.city}, ${geo.country}`,
            isTrusted: true,
          },
        },
        recoveryCodes: {
          create: recovery.hashedCodes.map((codeHash) => ({
            codeHash,
          })),
        },
        loginLogs: {
          create: {
            identifier: email,
            ip: geo.ip,
            city: geo.city,
            country: geo.country,
            lat: geo.lat,
            lon: geo.lon,
            browser: device.browser,
            os: device.os,
            device: device.name,
            status: 'Success',
            riskScore: 0,
            riskFactors: JSON.stringify(['ACCOUNT_CREATED']),
          },
        },
      },
      include: {
        devices: true,
      },
    })

    // Create session token
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    })

    // Save session in DB
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        ipAddress: geo.ip,
        deviceInfo: `${device.name} · ${device.browser}`,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      },
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        totpEnabled: user.totpEnabled,
      },
      totp: {
        secret: totp.secret,
        qrCodeDataUrl: totp.qrCodeDataUrl,
      },
      recoveryCodes: recovery.rawCodes,
    })

    // Set secure HTTP-only cookie
    response.cookies.set('sentinel_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to register account' },
      { status: 500 }
    )
  }
}

