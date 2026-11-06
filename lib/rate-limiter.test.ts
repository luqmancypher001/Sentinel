import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from './db'
import {
  checkIpRateLimit,
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  getRecentFailedCount,
} from './rate-limiter'

// Runs against the real dev database (no separate test DB is configured),
// so every key is namespaced per test run to avoid colliding with seed data.
const runId = randomUUID()
const testIp = `203.0.113.${runId.slice(0, 2)}`
const testAccount = `vitest-${runId}@example.com`

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany({
    where: { key: { in: [`ip:${testIp}`, `acct:${testAccount}`] } },
  })
  await prisma.$disconnect()
})

describe('checkIpRateLimit', () => {
  it('allows up to 15 requests per minute then blocks the 16th', async () => {
    let last
    for (let i = 0; i < 15; i++) {
      last = await checkIpRateLimit(testIp)
      expect(last.allowed).toBe(true)
    }
    const blocked = await checkIpRateLimit(testIp)
    expect(blocked.allowed).toBe(false)
  })
})

describe('account lockout', () => {
  it('locks the account after 5 failed attempts and unlocks after clearing', async () => {
    expect((await checkAccountLockout(testAccount)).allowed).toBe(true)

    let last
    for (let i = 0; i < 5; i++) {
      last = await recordFailedAttempt(testAccount)
    }
    expect(last!.isNowLocked).toBe(true)

    const lockedCheck = await checkAccountLockout(testAccount)
    expect(lockedCheck.allowed).toBe(false)
    expect(lockedCheck.lockoutRemainingSeconds).toBeGreaterThan(0)

    await clearFailedAttempts(testAccount)
    expect((await checkAccountLockout(testAccount)).allowed).toBe(true)
    expect(await getRecentFailedCount(testAccount)).toBe(0)
  })
})
