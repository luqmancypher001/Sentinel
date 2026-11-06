import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { authenticator } from 'otplib'
import { createCipheriv, createHash, randomBytes } from 'crypto'

const prisma = new PrismaClient()

// Mirrors lib/auth.ts's encryptTotpSecret — kept in sync manually since this
// script runs outside the Next.js/TS build.
function encryptTotpSecret(plainSecret) {
  const key = createHash('sha256')
    .update(process.env.TOTP_ENC_KEY || process.env.JWT_SECRET || 'sentinel-secure-authentication-secret-key-2026')
    .digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

async function main() {
  console.log('Seeding demo security data...')

  const demoEmail = 'jordan@acme.co'
  const passwordHash = await bcrypt.hash('Password123!', 12)
  const totpSecret = authenticator.generateSecret()
  const encryptedTotpSecret = encryptTotpSecret(totpSecret)

  // Clean existing demo user if present
  await prisma.user.deleteMany({
    where: { email: demoEmail },
  })

  // Create demo user
  const user = await prisma.user.create({
    data: {
      email: demoEmail,
      name: 'Jordan Davis',
      passwordHash,
      totpSecret: encryptedTotpSecret,
      totpEnabled: true,
      devices: {
        create: [
          {
            fingerprint: 'fp-macbook-pro-14-london',
            name: 'MacBook Pro 14"',
            browser: 'Chrome 126',
            os: 'macOS 14.5',
            lastLocation: 'London, United Kingdom',
            isTrusted: true,
            lastActive: new Date(),
          },
          {
            fingerprint: 'fp-iphone-15-pro-london',
            name: 'iPhone 15 Pro',
            browser: 'Safari Mobile',
            os: 'iOS 17.5',
            lastLocation: 'London, United Kingdom',
            isTrusted: true,
            lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            fingerprint: 'fp-windows-pc-manchester',
            name: 'Windows PC',
            browser: 'Edge 125',
            os: 'Windows 11',
            lastLocation: 'Manchester, United Kingdom',
            isTrusted: false,
            lastActive: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      loginLogs: {
        create: [
          {
            identifier: demoEmail,
            ip: '81.104.12.24',
            city: 'London',
            country: 'United Kingdom',
            lat: 51.5074,
            lon: -0.1278,
            browser: 'Chrome 126',
            os: 'macOS 14.5',
            device: 'MacBook Pro 14"',
            status: 'Success',
            riskScore: 12,
            riskFactors: JSON.stringify(['KNOWN_DEVICE']),
            createdAt: new Date(),
          },
          {
            identifier: demoEmail,
            ip: '81.104.12.24',
            city: 'London',
            country: 'United Kingdom',
            lat: 51.5074,
            lon: -0.1278,
            browser: 'Safari Mobile',
            os: 'iOS 17.5',
            device: 'iPhone 15 Pro',
            status: 'Success',
            riskScore: 15,
            riskFactors: JSON.stringify(['KNOWN_DEVICE']),
            createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
          },
          {
            identifier: demoEmail,
            ip: '92.18.34.117',
            city: 'Manchester',
            country: 'United Kingdom',
            lat: 53.4808,
            lon: -2.2426,
            browser: 'Edge 125',
            os: 'Windows 11',
            device: 'Windows PC',
            status: 'Blocked',
            riskScore: 82,
            riskFactors: JSON.stringify(['UNFAMILIAR_DEVICE', 'UNUSUAL_LOGIN_TIME']),
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      alerts: {
        create: [
          {
            title: 'Login from an unfamiliar device',
            detail: 'Windows PC · Manchester, United Kingdom',
            level: 'High',
            riskScore: 82,
            isResolved: false,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            title: 'Multiple failed login attempts',
            detail: '5 attempts from IP 92.18.34.117 (Manchester, UK)',
            level: 'Medium',
            riskScore: 54,
            isResolved: false,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            title: 'New device added to account',
            detail: 'iPhone 15 Pro · London, United Kingdom',
            level: 'Low',
            riskScore: 20,
            isResolved: true,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      recoveryCodes: {
        create: [
          { codeHash: await bcrypt.hash('A1B2-C3D4', 12) },
          { codeHash: await bcrypt.hash('E5F6-G7H8', 12) },
          { codeHash: await bcrypt.hash('J9K0-L1M2', 12) },
          { codeHash: await bcrypt.hash('N3P4-Q5R6', 12) },
        ],
      },
    },
  })

  console.log(`Demo account seeded successfully: ${user.email} (Password: Password123!)`)
  console.log(`TOTP secret (for manual authenticator setup): ${totpSecret}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

