import bcrypt from 'bcryptjs'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { SignJWT, jwtVerify } from 'jose'
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto'
import type { NextRequest } from 'next/server'
import { prisma } from './db.ts'

const DEV_JWT_SECRET = 'sentinel-secure-authentication-secret-key-2026'

function getJwtSecretString(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET environment variable must be set in production (see .env.example)'
    )
  }

  console.warn(
    '[auth] JWT_SECRET is not set — using an insecure development default. Set JWT_SECRET in .env for anything beyond local dev.'
  )
  return DEV_JWT_SECRET
}

// Computed lazily (not at module load) so that merely importing this file —
// e.g. during `next build`'s page-data collection — can't crash the build
// before any request actually needs the secret.
let cachedJwtSecret: Uint8Array | null = null
function getJwtSecret(): Uint8Array {
  if (!cachedJwtSecret) {
    cachedJwtSecret = new TextEncoder().encode(getJwtSecretString())
  }
  return cachedJwtSecret
}

const SALT_ROUNDS = 12

// Configure TOTP window (drift tolerance: +- 1 step = 30 seconds)
authenticator.options = {
  window: 1,
}

/**
 * Hash a plain text password using bcrypt (with 12 salt rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a plain text password against a bcrypt hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a new Base32 TOTP secret and QR code URI
 */
export async function generateTotpSecret(email: string): Promise<{
  secret: string
  qrCodeDataUrl: string
  otpAuthUrl: string
}> {
  const secret = authenticator.generateSecret()
  const otpAuthUrl = authenticator.keyuri(email, 'Sentinel Auth', secret)
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl)

  return {
    secret,
    qrCodeDataUrl,
    otpAuthUrl,
  }
}

/**
 * Verify a 6-digit TOTP token against a user's secret
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.trim(), secret: secret.trim() })
  } catch (err) {
    return false
  }
}

/**
 * Generate 8 backup recovery codes (returns raw codes and hashed codes)
 */
export async function generateRecoveryCodes(): Promise<{
  rawCodes: string[]
  hashedCodes: string[]
}> {
  const rawCodes: string[] = []
  const hashedCodes: string[] = []

  for (let i = 0; i < 8; i++) {
    // Generate code in format: XXXX-XXXX
    const raw = `${randomBytes(2).toString('hex').toUpperCase()}-${randomBytes(2)
      .toString('hex')
      .toUpperCase()}`
    rawCodes.push(raw)
    const hash = await hashPassword(raw)
    hashedCodes.push(hash)
  }

  return { rawCodes, hashedCodes }
}

/**
 * Creates a signed JWT session token (12 hour expiration)
 */
export async function createSessionToken(payload: {
  userId: string
  email: string
  name?: string | null
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getJwtSecret())
}

/**
 * Verifies a JWT session token's signature and expiry only. Most routes
 * should use `requireSession` instead, which also checks session revocation.
 */
export async function verifySessionToken(token: string): Promise<{
  valid: boolean
  payload?: { userId: string; email: string; name?: string }
}> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return {
      valid: true,
      payload: payload as unknown as {
        userId: string
        email: string
        name?: string
      },
    }
  } catch {
    return { valid: false }
  }
}

export interface SessionUser {
  userId: string
  email: string
  name?: string
}

/**
 * Validates the session cookie against both the JWT signature *and* the
 * Session table. A bare JWT check can't be revoked before it expires, so
 * logout/"sign out this device" would do nothing until the 12h token simply
 * expired on its own. Checking the DB row makes revocation actually work.
 */
export async function requireSession(
  req: Pick<NextRequest, 'cookies'>
): Promise<SessionUser | null> {
  const token = req.cookies.get('sentinel_session')?.value
  if (!token) return null

  const { valid, payload } = await verifySessionToken(token)
  if (!valid || !payload?.userId) return null

  const session = await prisma.session.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) return null

  return { userId: payload.userId, email: payload.email, name: payload.name }
}

interface MfaChallengePayload {
  userId: string
  email: string
  riskScore: number
  geo: unknown
  device: unknown
}

/**
 * Short-lived (5 min) token carrying risk context from the password step to
 * the MFA step, so the final audit log entry can record the same geo/device
 * context the risk engine scored.
 */
export async function createMfaChallengeToken(
  payload: MfaChallengePayload
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getJwtSecret())
}

export async function verifyMfaChallengeToken(token: string): Promise<{
  valid: boolean
  payload?: MfaChallengePayload
}> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return { valid: true, payload: payload as unknown as MfaChallengePayload }
  } catch {
    return { valid: false }
  }
}

// --- TOTP secret encryption at rest ---
// AES-256-GCM, keyed from TOTP_ENC_KEY (falls back to the JWT secret in dev
// so there's no second required env var for local/demo use).
function getTotpEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENC_KEY || getJwtSecretString()
  return createHash('sha256').update(raw).digest()
}

export function encryptTotpSecret(plainSecret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getTotpEncryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plainSecret, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptTotpSecret(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) return stored // pre-encryption plaintext fallback

  const [ivHex, tagHex, dataHex] = parts
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getTotpEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  )
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}
