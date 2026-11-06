import { describe, it, expect } from 'vitest'
import { calculateHaversineDistance, checkImpossibleTravel } from './travel'

describe('calculateHaversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateHaversineDistance(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0)
  })

  it('computes London to Lagos as roughly 5000km', () => {
    const km = calculateHaversineDistance(51.5074, -0.1278, 6.5244, 3.3792)
    expect(km).toBeGreaterThan(4900)
    expect(km).toBeLessThan(5100)
  })
})

describe('checkImpossibleTravel', () => {
  it('flags nothing when there is no prior location', () => {
    const result = checkImpossibleTravel(null, null, null, 51.5074, -0.1278)
    expect(result.isImpossible).toBe(false)
  })

  it('flags London -> Lagos in 5 minutes as impossible', () => {
    const prevTime = new Date('2026-01-01T00:00:00Z')
    const currTime = new Date('2026-01-01T00:05:00Z')
    const result = checkImpossibleTravel(51.5074, -0.1278, prevTime, 6.5244, 3.3792, currTime)
    expect(result.isImpossible).toBe(true)
    expect(result.speedKmH).toBeGreaterThan(850)
  })

  it('allows a short local hop at normal speed', () => {
    const prevTime = new Date('2026-01-01T00:00:00Z')
    const currTime = new Date('2026-01-01T01:00:00Z')
    // London -> Manchester (~260km) in an hour: ~260 km/h, under the limit
    const result = checkImpossibleTravel(51.5074, -0.1278, prevTime, 53.4808, -2.2426, currTime)
    expect(result.isImpossible).toBe(false)
  })
})
