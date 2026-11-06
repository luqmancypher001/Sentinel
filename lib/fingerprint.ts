import { createHash } from 'crypto'

export interface ParsedDeviceInfo {
  name: string
  browser: string
  os: string
  fingerprint: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
}

/**
 * Parses user-agent string into human-readable device, browser, and OS names.
 */
export function parseUserAgent(
  userAgent: string,
  clientEntropy: string = ''
): ParsedDeviceInfo {
  const ua = userAgent || ''

  // Browser detection
  let browser = 'Unknown Browser'
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/([0-9]+)/)
    browser = `Edge ${match ? match[1] : ''}`.trim()
  } else if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/([0-9]+)/)
    browser = `Chrome ${match ? match[1] : ''}`.trim()
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/([0-9]+)/)
    browser = `Safari ${match ? match[1] : ''}`.trim()
  } else if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/([0-9]+)/)
    browser = `Firefox ${match ? match[1] : ''}`.trim()
  }

  // OS & Device detection
  let os = 'Unknown OS'
  let name = 'Unknown Device'
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'

  if (ua.includes('iPhone')) {
    os = 'iOS 17'
    name = 'iPhone 15 Pro'
    deviceType = 'mobile'
    if (browser.startsWith('Safari')) browser = 'Safari Mobile'
  } else if (ua.includes('iPad')) {
    os = 'iPadOS 17'
    name = 'iPad Pro'
    deviceType = 'tablet'
  } else if (ua.includes('Android')) {
    os = 'Android 14'
    name = 'Samsung Galaxy'
    deviceType = 'mobile'
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    os = 'macOS 14.5'
    name = 'MacBook Pro 14"'
    deviceType = 'desktop'
  } else if (ua.includes('Windows NT 10.0') || ua.includes('Windows')) {
    os = 'Windows 11'
    name = 'Windows PC'
    deviceType = 'desktop'
  } else if (ua.includes('Linux')) {
    os = 'Linux'
    name = 'Linux Workstation'
    deviceType = 'desktop'
  }

  // Generate deterministic unique fingerprint hash
  const rawFingerprint = `${ua}|${clientEntropy}|${os}|${browser}`
  const fingerprint = createHash('sha256')
    .update(rawFingerprint)
    .digest('hex')
    .substring(0, 32)

  return {
    name,
    browser,
    os,
    fingerprint,
    deviceType,
  }
}

