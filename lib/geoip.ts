export interface GeoLocation {
  ip: string
  city: string
  country: string
  region?: string
  lat: number
  lon: number
  isSimulated?: boolean
}

// Preset simulation locations for final year project defense / testing
export const SIMULATION_LOCATIONS: Record<string, GeoLocation> = {
  london: {
    ip: '81.104.12.24',
    city: 'London',
    country: 'United Kingdom',
    region: 'ENG',
    lat: 51.5074,
    lon: -0.1278,
    isSimulated: true,
  },
  manchester: {
    ip: '92.18.34.117',
    city: 'Manchester',
    country: 'United Kingdom',
    region: 'ENG',
    lat: 53.4808,
    lon: -2.2426,
    isSimulated: true,
  },
  lagos: {
    ip: '102.89.23.4',
    city: 'Lagos',
    country: 'Nigeria',
    region: 'LA',
    lat: 6.5244,
    lon: 3.3792,
    isSimulated: true,
  },
  newyork: {
    ip: '161.185.160.93',
    city: 'New York',
    country: 'United States',
    region: 'NY',
    lat: 40.7128,
    lon: -74.006,
    isSimulated: true,
  },
  tokyo: {
    ip: '133.242.18.1',
    city: 'Tokyo',
    country: 'Japan',
    region: '13',
    lat: 35.6762,
    lon: 139.6503,
    isSimulated: true,
  },
}

/**
 * Resolves an IP address to geolocation coordinates and details.
 * Supports simulation override via simulatedIp parameter or header.
 */
export function resolveGeoLocation(
  clientIp: string,
  simulatedPreset?: string | null
): GeoLocation {
  // If simulation preset is explicitly requested (e.g. from defense demo dropdown)
  if (simulatedPreset && SIMULATION_LOCATIONS[simulatedPreset.toLowerCase()]) {
    return SIMULATION_LOCATIONS[simulatedPreset.toLowerCase()]
  }

  // Handle localhost during development
  const isLocalhost =
    !clientIp ||
    clientIp === '::1' ||
    clientIp === '127.0.0.1' ||
    clientIp === 'localhost' ||
    clientIp.startsWith('192.168.') ||
    clientIp.startsWith('10.')

  if (isLocalhost) {
    // Default localhost to London for realistic demo defaults
    return {
      ip: '127.0.0.1 (Localhost)',
      city: 'London',
      country: 'United Kingdom',
      region: 'ENG',
      lat: 51.5074,
      lon: -0.1278,
      isSimulated: false,
    }
  }

  // Real GeoIP lookup via geoip-lite
  try {
    const geoip = require('geoip-lite')
    const geo = geoip.lookup(clientIp)
    if (geo) {
      return {
        ip: clientIp,
        city: geo.city || 'Unknown City',
        country: geo.country || 'Unknown Country',
        region: geo.region,
        lat: geo.ll ? geo.ll[0] : 0,
        lon: geo.ll ? geo.ll[1] : 0,
        isSimulated: false,
      }
    }
  } catch (err) {
    // fallback if binary dat is unreachable
  }

  // Fallback if IP cannot be resolved
  return {
    ip: clientIp,
    city: 'Unknown City',
    country: 'Unknown Country',
    lat: 0,
    lon: 0,
    isSimulated: false,
  }
}
