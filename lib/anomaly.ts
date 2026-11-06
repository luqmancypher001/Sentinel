import type { GeoLocation } from './geoip.ts'
import type { ParsedDeviceInfo } from './fingerprint.ts'
import { checkImpossibleTravel, type TravelCheckResult } from './travel.ts'

export interface RiskFactor {
  code: string
  label: string
  points: number
  detail: string
}

export interface AnomalyEvaluation {
  riskScore: number // 0 to 100
  riskLevel: 'Low' | 'Medium' | 'High'
  decision: 'ALLOW' | 'MFA_CHALLENGE' | 'BLOCK'
  factors: RiskFactor[]
  travelCheck?: TravelCheckResult
  summary: string
}

export interface HistoricalContext {
  lastLogin?: {
    lat: number | null
    lon: number | null
    city: string | null
    country: string | null
    createdAt: Date
  } | null
  knownFingerprints: string[]
  recentFailedCount: number
}

/**
 * Composite Anomaly Detection Engine
 *
 * Evaluates real-time contextual signals against historical user baseline.
 * Produces an explainable, deterministic risk score from 0 to 100.
 */
export function evaluateLoginAnomaly(
  currentLocation: GeoLocation,
  currentDevice: ParsedDeviceInfo,
  history: HistoricalContext,
  currentTime: Date = new Date()
): AnomalyEvaluation {
  const factors: RiskFactor[] = []
  let totalScore = 0

  // 1. Unfamiliar Device Detection
  const isFirstEverDevice = history.knownFingerprints.length === 0
  const isKnownDevice = history.knownFingerprints.includes(
    currentDevice.fingerprint
  )

  if (!isFirstEverDevice && !isKnownDevice) {
    const points = 25
    totalScore += points
    factors.push({
      code: 'UNFAMILIAR_DEVICE',
      label: 'Login from an unfamiliar device',
      points,
      detail: `${currentDevice.name} · ${currentDevice.browser} on ${currentDevice.os}`,
    })
  }

  // 2. Impossible Travel & Geolocation Velocity Check
  let travelResult: TravelCheckResult | undefined
  if (history.lastLogin?.lat && history.lastLogin?.lon) {
    travelResult = checkImpossibleTravel(
      history.lastLogin.lat,
      history.lastLogin.lon,
      new Date(history.lastLogin.createdAt),
      currentLocation.lat,
      currentLocation.lon,
      currentTime
    )

    if (travelResult.isImpossible) {
      const points = 60
      totalScore += points
      factors.push({
        code: 'IMPOSSIBLE_TRAVEL',
        label: 'Impossible travel velocity detected',
        points,
        detail:
          travelResult.reason ||
          `Traveled ${travelResult.distanceKm} km at speed ${travelResult.speedKmH} km/h`,
      })
    }
  }

  // 3. New Geographic Location (Country / City change)
  if (history.lastLogin && (!travelResult || !travelResult.isImpossible)) {
    const isNewCountry =
      history.lastLogin.country &&
      history.lastLogin.country !== currentLocation.country
    const isNewCity =
      history.lastLogin.city && history.lastLogin.city !== currentLocation.city

    if (isNewCountry) {
      const points = 30
      totalScore += points
      factors.push({
        code: 'NEW_COUNTRY',
        label: 'Login from new country',
        points,
        detail: `Attempt originated from ${currentLocation.country} (Previous: ${history.lastLogin.country})`,
      })
    } else if (isNewCity && !isKnownDevice) {
      const points = 15
      totalScore += points
      factors.push({
        code: 'NEW_CITY',
        label: 'Login from new city',
        points,
        detail: `Attempt originated from ${currentLocation.city} (Previous: ${history.lastLogin.city})`,
      })
    }
  }

  // 4. Multiple Recent Failed Attempts (Brute Force Indicator)
  if (history.recentFailedCount >= 3) {
    const points = Math.min(25, history.recentFailedCount * 8)
    totalScore += points
    factors.push({
      code: 'MULTIPLE_FAILED_ATTEMPTS',
      label: 'Multiple prior failed login attempts',
      points,
      detail: `${history.recentFailedCount} failed attempts registered recently from this identity`,
    })
  }

  // 5. Off-Hours / Suspicious Time Anomaly (1:00 AM - 5:00 AM local time on unfamiliar device)
  const currentHour = currentTime.getHours()
  if ((currentHour >= 1 && currentHour <= 4) && !isKnownDevice) {
    const points = 15
    totalScore += points
    factors.push({
      code: 'UNUSUAL_LOGIN_TIME',
      label: 'Suspicious login time detected',
      points,
      detail: `Attempt occurred during off-peak hours (${currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) on unfamiliar device`,
    })
  }

  // Bound score between 0 and 100
  const finalRiskScore = Math.min(100, Math.max(0, totalScore))

  // Determine Risk Level & Adaptive Authentication Decision
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
  let decision: 'ALLOW' | 'MFA_CHALLENGE' | 'BLOCK' = 'ALLOW'

  if (finalRiskScore >= 70) {
    riskLevel = 'High'
    decision = 'BLOCK'
  } else if (finalRiskScore >= 30) {
    riskLevel = 'Medium'
    decision = 'MFA_CHALLENGE'
  } else {
    riskLevel = 'Low'
    decision = 'ALLOW'
  }

  const summary =
    factors.length > 0
      ? `Risk Score ${finalRiskScore}/100 (${riskLevel}) - ${factors.map((f) => f.label).join(', ')}`
      : 'Normal login baseline (Low risk)'

  return {
    riskScore: finalRiskScore,
    riskLevel,
    decision,
    factors,
    travelCheck: travelResult,
    summary,
  }
}
