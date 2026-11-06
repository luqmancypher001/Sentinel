/**
 * Impossible Travel & Geo-Velocity Calculator
 *
 * Uses the Haversine formula to compute great-circle distance between two
 * geographic coordinates on the globe, then assesses travel velocity
 * between subsequent login events.
 */

export interface TravelCheckResult {
  isImpossible: boolean
  distanceKm: number
  elapsedHours: number
  speedKmH: number
  reason?: string
}

const EARTH_RADIUS_KM = 6371

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calculates distance in kilometers between two latitude/longitude points.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // If coordinates are identical or missing
  if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) return 0
  if (lat1 === lat2 && lon1 === lon2) return 0

  const dLat = degreesToRadians(lat2 - lat1)
  const dLon = degreesToRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_KM * c)
}

/**
 * Checks whether travel between the previous login and current attempt is physically impossible.
 * Standard commercial jet cruising speed: ~800-900 km/h.
 */
export function checkImpossibleTravel(
  prevLat: number | null,
  prevLon: number | null,
  prevTime: Date | null,
  currLat: number,
  currLon: number,
  currTime: Date = new Date(),
  maxCommercialSpeedKmH: number = 850
): TravelCheckResult {
  if (
    prevLat === null ||
    prevLon === null ||
    prevTime === null ||
    (prevLat === 0 && prevLon === 0) ||
    (currLat === 0 && currLon === 0)
  ) {
    return {
      isImpossible: false,
      distanceKm: 0,
      elapsedHours: 0,
      speedKmH: 0,
    }
  }

  const distanceKm = calculateHaversineDistance(
    prevLat,
    prevLon,
    currLat,
    currLon
  )

  // Calculate elapsed time in hours
  const elapsedMs = Math.max(1000, currTime.getTime() - prevTime.getTime())
  const elapsedHours = elapsedMs / (1000 * 60 * 60)

  // Calculate speed
  const speedKmH = Math.round(distanceKm / elapsedHours)

  // Only trigger if distance is meaningful (> 100km) to ignore normal cell tower jitter
  if (distanceKm > 100 && speedKmH > maxCommercialSpeedKmH) {
    return {
      isImpossible: true,
      distanceKm,
      elapsedHours: Number(elapsedHours.toFixed(2)),
      speedKmH,
      reason: `Traveled ${distanceKm} km in ${Math.round(
        elapsedMs / 60000
      )} mins (apparent speed: ${speedKmH} km/h - exceeds flight limit)`,
    }
  }

  return {
    isImpossible: false,
    distanceKm,
    elapsedHours: Number(elapsedHours.toFixed(2)),
    speedKmH,
  }
}

