import { describe, it, expect } from 'vitest'
import { evaluateLoginAnomaly, type HistoricalContext } from './anomaly'
import type { GeoLocation } from './geoip'
import type { ParsedDeviceInfo } from './fingerprint'

const LONDON: GeoLocation = { ip: '1.1.1.1', city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 }
const LAGOS: GeoLocation = { ip: '2.2.2.2', city: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 }

const DEVICE: ParsedDeviceInfo = {
  name: 'MacBook Pro',
  browser: 'Chrome 126',
  os: 'macOS',
  fingerprint: 'fp-known',
  deviceType: 'desktop',
}

// Constructed from local components (not an ISO/UTC string) so `getHours()`
// — which the off-hours rule reads in local time — is always noon,
// regardless of the machine's timezone running this test.
const NOON = new Date(2026, 5, 15, 12, 0, 0)

function baseHistory(overrides: Partial<HistoricalContext> = {}): HistoricalContext {
  return {
    lastLogin: null,
    knownFingerprints: [DEVICE.fingerprint],
    recentFailedCount: 0,
    ...overrides,
  }
}

describe('evaluateLoginAnomaly', () => {
  it('allows a known device with no history as low risk', () => {
    const result = evaluateLoginAnomaly(LONDON, DEVICE, baseHistory(), NOON)
    expect(result.decision).toBe('ALLOW')
    expect(result.riskScore).toBe(0)
  })

  it('flags an unfamiliar device (not the first-ever device) at +25', () => {
    const history = baseHistory({ knownFingerprints: ['fp-some-other-device'] })
    const result = evaluateLoginAnomaly(LONDON, { ...DEVICE, fingerprint: 'fp-new' }, history, NOON)
    expect(result.factors.map((f) => f.code)).toContain('UNFAMILIAR_DEVICE')
    expect(result.riskScore).toBeGreaterThanOrEqual(25)
  })

  it('scores impossible travel alone as a 60-point MFA challenge, not an outright block', () => {
    // Impossible travel alone (60 pts) sits below the 70-point BLOCK
    // threshold by design — it still forces a step-up challenge.
    const history = baseHistory({
      lastLogin: { lat: LONDON.lat, lon: LONDON.lon, city: LONDON.city, country: LONDON.country, createdAt: new Date(NOON.getTime() - 5 * 60 * 1000) },
    })
    const result = evaluateLoginAnomaly(LAGOS, DEVICE, history, NOON)
    expect(result.factors.map((f) => f.code)).toContain('IMPOSSIBLE_TRAVEL')
    expect(result.riskScore).toBe(60)
    expect(result.decision).toBe('MFA_CHALLENGE')
  })

  it('blocks when impossible travel stacks with an unfamiliar device', () => {
    const history = baseHistory({
      knownFingerprints: ['fp-some-other-device'],
      lastLogin: { lat: LONDON.lat, lon: LONDON.lon, city: LONDON.city, country: LONDON.country, createdAt: new Date(NOON.getTime() - 5 * 60 * 1000) },
    })
    const result = evaluateLoginAnomaly(LAGOS, { ...DEVICE, fingerprint: 'fp-new' }, history, NOON)
    expect(result.decision).toBe('BLOCK')
  })

  it('caps the multiple-failed-attempts factor at 25 points, below the challenge threshold alone', () => {
    const history = baseHistory({ recentFailedCount: 5 })
    const result = evaluateLoginAnomaly(LONDON, DEVICE, history, NOON)
    const factor = result.factors.find((f) => f.code === 'MULTIPLE_FAILED_ATTEMPTS')
    expect(factor?.points).toBe(25)
    expect(result.decision).toBe('ALLOW')
  })

  it('challenges once failed attempts stack with an unfamiliar device', () => {
    const history = baseHistory({ knownFingerprints: ['fp-some-other-device'], recentFailedCount: 5 })
    const result = evaluateLoginAnomaly(LONDON, { ...DEVICE, fingerprint: 'fp-new' }, history, NOON)
    expect(result.decision).toBe('MFA_CHALLENGE')
  })

  it('flags a new country without triggering impossible travel for a slow move', () => {
    const history = baseHistory({
      lastLogin: { lat: LONDON.lat, lon: LONDON.lon, city: LONDON.city, country: LONDON.country, createdAt: new Date(NOON.getTime() - 24 * 60 * 60 * 1000) },
    })
    const result = evaluateLoginAnomaly(LAGOS, DEVICE, history, NOON)
    expect(result.factors.map((f) => f.code)).toContain('NEW_COUNTRY')
    expect(result.factors.map((f) => f.code)).not.toContain('IMPOSSIBLE_TRAVEL')
  })

  it('caps risk score at 100', () => {
    const history = baseHistory({
      knownFingerprints: ['fp-some-other-device'],
      recentFailedCount: 10,
      lastLogin: { lat: LONDON.lat, lon: LONDON.lon, city: LONDON.city, country: LONDON.country, createdAt: new Date(NOON.getTime() - 5 * 60 * 1000) },
    })
    const result = evaluateLoginAnomaly(LAGOS, { ...DEVICE, fingerprint: 'fp-new' }, history, NOON)
    expect(result.riskScore).toBeLessThanOrEqual(100)
    expect(result.decision).toBe('BLOCK')
  })
})
