/**
 * Dual-Layer Rate Limiter (Prisma-backed)
 *
 * Protects against:
 * 1. IP-level credential stuffing & brute force DoS.
 * 2. Targeted account-level brute force attacks.
 *
 * Persisted in the `RateLimitBucket` table (not in-memory) so limits survive
 * server restarts and are shared across multiple server instances, which an
 * in-memory Map cannot do in a serverless/multi-instance deployment.
 *
 * ponytail: fixed-window counters, not a true sliding window — a small burst
 * can slip through right at a window boundary. Upgrade to sliding-window
 * timestamps (or Redis) only if that boundary behavior is ever actually abused.
 */
import { prisma } from './db.ts'

const IP_WINDOW_MS = 60 * 1000 // 1 minute
const IP_MAX_ATTEMPTS = 15 // max 15 attempts/minute

const ACCOUNT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const ACCOUNT_MAX_FAILS = 5 // max 5 failed attempts before temporary lockout
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes lockout

export interface RateLimitCheck {
  allowed: boolean
  remainingAttempts: number
  lockoutRemainingSeconds?: number
  reason?: string
}

function accountKey(identifier: string) {
  return `acct:${identifier.toLowerCase().trim()}`
}

// Fetches a bucket, creating it if absent, and resets its window if expired.
async function getOrResetBucket(key: string, windowMs: number) {
  const now = new Date()
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key },
    create: { key, count: 0, windowStart: now },
    update: {},
  })

  if (now.getTime() - bucket.windowStart.getTime() > windowMs) {
    return prisma.rateLimitBucket.update({
      where: { key },
      data: { count: 0, windowStart: now, lockedUntil: null },
    })
  }

  return bucket
}

/**
 * Checks and records an IP-level attempt against the sliding window.
 */
export async function checkIpRateLimit(ip: string): Promise<RateLimitCheck> {
  const key = `ip:${ip}`
  const bucket = await getOrResetBucket(key, IP_WINDOW_MS)

  if (bucket.count >= IP_MAX_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      reason: 'Too many requests from this IP address. Please wait a minute.',
    }
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: bucket.count + 1 },
  })

  return {
    allowed: true,
    remainingAttempts: IP_MAX_ATTEMPTS - bucket.count - 1,
  }
}

/**
 * Read-only check of account lockout state (does not record an attempt).
 */
export async function checkAccountLockout(identifier: string): Promise<RateLimitCheck> {
  const key = accountKey(identifier)
  const now = new Date()
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } })

  if (!bucket) {
    return { allowed: true, remainingAttempts: ACCOUNT_MAX_FAILS }
  }

  if (bucket.lockedUntil && bucket.lockedUntil > now) {
    const remainingSeconds = Math.ceil(
      (bucket.lockedUntil.getTime() - now.getTime()) / 1000
    )
    return {
      allowed: false,
      remainingAttempts: 0,
      lockoutRemainingSeconds: remainingSeconds,
      reason: `Account temporarily locked due to multiple failed attempts. Try again in ${remainingSeconds}s.`,
    }
  }

  if (now.getTime() - bucket.windowStart.getTime() > ACCOUNT_WINDOW_MS) {
    return { allowed: true, remainingAttempts: ACCOUNT_MAX_FAILS }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, ACCOUNT_MAX_FAILS - bucket.count),
  }
}

/**
 * Records a failed login attempt for an account, locking it out once the
 * threshold is crossed.
 */
export async function recordFailedAttempt(identifier: string): Promise<{
  isNowLocked: boolean
  remainingAttempts: number
}> {
  const key = accountKey(identifier)
  const bucket = await getOrResetBucket(key, ACCOUNT_WINDOW_MS)
  const newCount = bucket.count + 1

  if (newCount >= ACCOUNT_MAX_FAILS) {
    await prisma.rateLimitBucket.update({
      where: { key },
      data: {
        count: newCount,
        lockedUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_MS),
      },
    })
    return { isNowLocked: true, remainingAttempts: 0 }
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: newCount },
  })

  return {
    isNowLocked: false,
    remainingAttempts: ACCOUNT_MAX_FAILS - newCount,
  }
}

/**
 * Current recent-failure count for an account, used as a risk signal by the
 * anomaly engine. Reads the same bucket that drives lockout, so it reflects
 * "failed attempts within the active window" rather than all-time history.
 */
export async function getRecentFailedCount(identifier: string): Promise<number> {
  const key = accountKey(identifier)
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } })
  if (!bucket) return 0
  if (Date.now() - bucket.windowStart.getTime() > ACCOUNT_WINDOW_MS) return 0
  return bucket.count
}

/**
 * Clears failed attempts upon successful authentication.
 */
export async function clearFailedAttempts(identifier: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key: accountKey(identifier) } })
}
