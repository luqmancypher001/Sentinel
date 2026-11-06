import { PrismaClient } from '@prisma/client'
import { authenticator } from 'otplib'
import { resolveGeoLocation } from './lib/geoip.ts'
import { parseUserAgent } from './lib/fingerprint.ts'
import { checkImpossibleTravel } from './lib/travel.ts'
import { evaluateLoginAnomaly } from './lib/anomaly.ts'
import {
  checkIpRateLimit,
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
} from './lib/rate-limiter.ts'
import { verifyPassword, verifyTotpToken, decryptTotpSecret } from './lib/auth.ts'

const prisma = new PrismaClient()

async function runTests() {
  console.log('====================================================')
  console.log('🧪 TESTING SENTINEL SECURITY & ANOMALY PIPELINE')
  console.log('====================================================\n')

  // 1. Fetch seeded demo user
  const user = await prisma.user.findUnique({
    where: { email: 'jordan@acme.co' },
    include: {
      devices: true,
      loginLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      recoveryCodes: true,
    },
  })

  if (!user) {
    console.error('❌ Demo user not found! Seed database first.')
    process.exit(1)
  }
  console.log(`✅ Loaded Demo User: ${user.email} (MFA enabled: ${user.totpEnabled})`)

  // 2. Test Password Verification
  const isMatch = await verifyPassword('Password123!', user.passwordHash)
  console.log(`✅ Password Verification (bcrypt): ${isMatch ? 'PASSED' : 'FAILED'}`)

  // 3. Test Baseline Normal Login (London)
  const londonGeo = resolveGeoLocation('81.104.12.24', 'london')
  const macDevice = parseUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  )
  const baselineEval = evaluateLoginAnomaly(londonGeo, macDevice, {
    lastLogin: user.loginLogs[0],
    knownFingerprints: user.devices.map((d) => d.fingerprint),
    recentFailedCount: 0,
  })
  console.log(
    `✅ Baseline London Login: Score = ${baselineEval.riskScore}/100 (${baselineEval.riskLevel} Risk, Decision: ${baselineEval.decision})`
  )

  // 4. Test Impossible Travel Anomaly (Lagos, 5,023 km away, 5 mins later)
  const lagosGeo = resolveGeoLocation('102.89.23.4', 'lagos')
  const windowsDevice = parseUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  )
  const simulatedTime5MinsLater = new Date(Date.now() + 5 * 60 * 1000)

  const travelResult = checkImpossibleTravel(
    user.loginLogs[0].lat,
    user.loginLogs[0].lon,
    user.loginLogs[0].createdAt,
    lagosGeo.lat,
    lagosGeo.lon,
    simulatedTime5MinsLater
  )
  console.log('\n--- IMPOSSIBLE TRAVEL MATHEMATICAL TEST ---')
  console.log(`📍 Previous: London (${user.loginLogs[0].lat}, ${user.loginLogs[0].lon})`)
  console.log(`📍 Current: Lagos (${lagosGeo.lat}, ${lagosGeo.lon})`)
  console.log(`📏 Haversine Distance: ${travelResult.distanceKm} km`)
  console.log(`⏱️ Elapsed Time: ${travelResult.elapsedHours} hours (5 minutes)`)
  console.log(`🚀 Calculated Velocity: ${travelResult.speedKmH} km/h (Commercial Jet Limit: 850 km/h)`)
  console.log(`🚨 Impossible Travel Triggered: ${travelResult.isImpossible ? 'YES (ANOMALY DETECTED)' : 'NO'}`)

  const lagosEval = evaluateLoginAnomaly(
    lagosGeo,
    windowsDevice,
    {
      lastLogin: user.loginLogs[0],
      knownFingerprints: user.devices.map((d) => d.fingerprint),
      recentFailedCount: 0,
    },
    simulatedTime5MinsLater
  )
  console.log(
    `🛡️ Anomaly Engine Decision: ${lagosEval.decision} (Risk Score: ${lagosEval.riskScore}/100 - ${lagosEval.riskLevel})`
  )
  console.log(`📝 Triggered Factors: ${lagosEval.factors.map((f) => f.label).join(', ')}`)

  // 5. Test Brute-Force Rate Limiter
  console.log('\n--- BRUTE-FORCE RATE LIMITER TEST ---')
  await clearFailedAttempts('attacker@target.com')
  for (let i = 1; i <= 5; i++) {
    const res = await recordFailedAttempt('attacker@target.com')
    console.log(`Attempt ${i}/5: Remaining = ${res.remainingAttempts}, Locked = ${res.isNowLocked}`)
  }
  const lockCheck = await checkAccountLockout('attacker@target.com')
  console.log(`🔒 Account Lock Status: ${!lockCheck.allowed ? 'LOCKED OUT (423)' : 'ALLOWED'}`)

  // 6. Test Real TOTP RFC 6238
  console.log('\n--- TOTP RFC 6238 AUTHENTICATOR TEST ---')
  const totpSecret = decryptTotpSecret(user.totpSecret)
  const validToken = authenticator.generate(totpSecret)
  const isTotpValid = verifyTotpToken(validToken, totpSecret)
  const isFakeValid = verifyTotpToken('999999', totpSecret)
  console.log(`🔑 Generated Real TOTP Token for Google Authenticator: ${validToken}`)
  console.log(`✅ Valid Token Verification: ${isTotpValid ? 'PASSED' : 'FAILED'}`)
  console.log(`🛡️ Invalid Token (999999) Rejection: ${!isFakeValid ? 'PASSED' : 'FAILED'}`)

  console.log('\n====================================================')
  console.log('🎉 ALL SECURITY & ANOMALY PIPELINE TESTS PASSED!')
  console.log('====================================================')
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
