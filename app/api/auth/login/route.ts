import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, createSessionToken, createMfaChallengeToken } from '@/lib/auth'
import { parseUserAgent } from '@/lib/fingerprint'
import { resolveGeoLocation } from '@/lib/geoip'
import {
  checkIpRateLimit,
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  getRecentFailedCount,
} from '@/lib/rate-limiter'
import { evaluateLoginAnomaly, HistoricalContext } from '@/lib/anomaly'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'

    // 1. IP Rate Limiting Check
    const ipCheck = await checkIpRateLimit(ip)
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: ipCheck.reason, status: 'rate_limited' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { email, password, simulateLocation } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const cleanEmail = email.toLowerCase().trim()

    // 2. Account-Level Lockout Check (Brute-force protection)
    const accountCheck = await checkAccountLockout(cleanEmail)
    if (!accountCheck.allowed) {
      return NextResponse.json(
        {
          error: accountCheck.reason,
          status: 'account_locked',
          lockoutSeconds: accountCheck.lockoutRemainingSeconds,
        },
        { status: 423 } // Locked
      )
    }

    // 3. Resolve Device & GeoLocation Context
    const ua = req.headers.get('user-agent') || ''
    const device = parseUserAgent(ua)
    const geo = resolveGeoLocation(ip, simulateLocation)

    // 4. Find User in DB
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        devices: true,
        loginLogs: {
          where: { status: 'Success' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    // If user does not exist or password fails
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      const failRecord = await recordFailedAttempt(cleanEmail)

      // Log failed attempt in DB if user exists or track anonymously
      if (user) {
        await prisma.loginLog.create({
          data: {
            userId: user.id,
            identifier: cleanEmail,
            ip: geo.ip,
            city: geo.city,
            country: geo.country,
            lat: geo.lat,
            lon: geo.lon,
            browser: device.browser,
            os: device.os,
            device: device.name,
            status: 'Failed',
            riskScore: 40,
            riskFactors: JSON.stringify(['INVALID_CREDENTIALS']),
          },
        })

        // If brute force threshold is crossed, trigger a security alert
        if (failRecord.isNowLocked) {
          await prisma.securityAlert.create({
            data: {
              userId: user.id,
              title: 'Multiple failed login attempts',
              detail: `5 consecutive failed attempts detected from IP ${geo.ip} (${geo.city}, ${geo.country})`,
              level: 'Medium',
              riskScore: 55,
            },
          })

          await sendEmail({
            to: user.email,
            subject: 'Security alert: account temporarily locked',
            body: `Your Sentinel account was locked for 15 minutes after 5 failed login attempts from IP ${geo.ip} (${geo.city}, ${geo.country}). If this wasn't you, consider resetting your password once the lockout clears.`,
          })
        }
      }

      return NextResponse.json(
        {
          error: failRecord.isNowLocked
            ? 'Account locked for 15 minutes due to too many failed attempts'
            : 'Invalid email or password',
          remainingAttempts: failRecord.remainingAttempts,
        },
        { status: 401 }
      )
    }

    // 5. Gather Historical Context for Anomaly Engine
    const historicalContext: HistoricalContext = {
      lastLogin: user.loginLogs[0] || null,
      knownFingerprints: user.devices.map((d) => d.fingerprint),
      recentFailedCount: await getRecentFailedCount(cleanEmail),
    }

    // 6. Execute Anomaly Detection Engine
    const anomaly = evaluateLoginAnomaly(geo, device, historicalContext)

    // CASE A: HIGH RISK (Risk Score >= 70) -> BLOCK ATTEMPT
    if (anomaly.decision === 'BLOCK') {
      // Record Blocked Attempt
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          identifier: cleanEmail,
          ip: geo.ip,
          city: geo.city,
          country: geo.country,
          lat: geo.lat,
          lon: geo.lon,
          browser: device.browser,
          os: device.os,
          device: device.name,
          status: 'Blocked',
          riskScore: anomaly.riskScore,
          riskFactors: JSON.stringify(anomaly.factors.map((f) => f.code)),
        },
      })

      // Generate Critical Security Alert
      const primaryFactor = anomaly.factors[0]
      await prisma.securityAlert.create({
        data: {
          userId: user.id,
          title: primaryFactor?.label || 'Suspicious login blocked',
          detail: `${primaryFactor?.detail || 'High risk activity'} · ${geo.city}, ${geo.country}`,
          level: 'High',
          riskScore: anomaly.riskScore,
        },
      })

      await sendEmail({
        to: user.email,
        subject: 'Security alert: suspicious login blocked',
        body: `A login attempt from ${geo.city}, ${geo.country} (${device.name}) was blocked due to high risk (${anomaly.riskScore}/100): ${anomaly.summary}`,
      })

      return NextResponse.json(
        {
          status: 'blocked',
          error: `Login blocked due to high security risk (${anomaly.riskScore}/100): ${anomaly.summary}`,
          riskScore: anomaly.riskScore,
          riskLevel: anomaly.riskLevel,
          factors: anomaly.factors,
        },
        { status: 403 }
      )
    }

    // CASE B: MEDIUM RISK (30-69) OR USER HAS MFA ENABLED -> STEP-UP MFA
    if (anomaly.decision === 'MFA_CHALLENGE' || user.totpEnabled) {
      // Log MFA Challenge state
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          identifier: cleanEmail,
          ip: geo.ip,
          city: geo.city,
          country: geo.country,
          lat: geo.lat,
          lon: geo.lon,
          browser: device.browser,
          os: device.os,
          device: device.name,
          status: 'MFA_Challenge',
          riskScore: anomaly.riskScore,
          riskFactors: JSON.stringify(anomaly.factors.map((f) => f.code)),
        },
      })

      // If medium risk triggered an alert
      if (anomaly.riskScore >= 30) {
        await prisma.securityAlert.create({
          data: {
            userId: user.id,
            title: anomaly.factors[0]?.label || 'Unusual login context',
            detail: `${device.name} · ${geo.city}, ${geo.country} · Score ${anomaly.riskScore}/100`,
            level: 'Medium',
            riskScore: anomaly.riskScore,
          },
        })

        await sendEmail({
          to: user.email,
          subject: 'Security alert: unusual login context',
          body: `A login from ${device.name} in ${geo.city}, ${geo.country} was flagged (score ${anomaly.riskScore}/100) and required two-factor verification.`,
        })
      }

      // Generate short-lived temp token (valid for 5 minutes) for the MFA step
      const tempToken = await createMfaChallengeToken({
        userId: user.id,
        email: user.email,
        riskScore: anomaly.riskScore,
        geo,
        device,
      })

      return NextResponse.json({
        status: 'mfa_required',
        message: 'Two-factor verification required',
        tempToken,
        riskScore: anomaly.riskScore,
        riskLevel: anomaly.riskLevel,
        factors: anomaly.factors,
      })
    }

    // CASE C: LOW RISK & NO MFA -> DIRECT SUCCESSFUL LOGIN
    await clearFailedAttempts(cleanEmail)

    // Register device if not yet trusted
    await prisma.device.upsert({
      where: {
        userId_fingerprint: {
          userId: user.id,
          fingerprint: device.fingerprint,
        },
      },
      update: {
        lastActive: new Date(),
        lastLocation: `${geo.city}, ${geo.country}`,
      },
      create: {
        userId: user.id,
        fingerprint: device.fingerprint,
        name: device.name,
        browser: device.browser,
        os: device.os,
        lastLocation: `${geo.city}, ${geo.country}`,
        isTrusted: true,
      },
    })

    // Log successful attempt
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        identifier: cleanEmail,
        ip: geo.ip,
        city: geo.city,
        country: geo.country,
        lat: geo.lat,
        lon: geo.lon,
        browser: device.browser,
        os: device.os,
        device: device.name,
        status: 'Success',
        riskScore: anomaly.riskScore,
        riskFactors: JSON.stringify(anomaly.factors.map((f) => f.code)),
      },
    })

    // Create session token + persist the session so it can be revoked later
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    })

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        ipAddress: geo.ip,
        deviceInfo: `${device.name} · ${device.browser}`,
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
      riskScore: anomaly.riskScore,
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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error during login' },
      { status: 500 }
    )
  }
}
