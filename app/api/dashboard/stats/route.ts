import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { parseUserAgent } from '@/lib/fingerprint'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId

    // Current user device fingerprint
    const ua = req.headers.get('user-agent') || ''
    const currentDevice = parseUserAgent(ua)

    // Aggregate statistics
    const [
      totalAttempts,
      successfulLogins,
      failedAttempts,
      blockedAttempts,
      rawLogs,
      rawAlerts,
      rawDevices,
    ] = await Promise.all([
      prisma.loginLog.count({ where: { userId } }),
      prisma.loginLog.count({ where: { userId, status: 'Success' } }),
      prisma.loginLog.count({ where: { userId, status: 'Failed' } }),
      prisma.loginLog.count({
        where: {
          userId,
          status: { in: ['Blocked', 'MFA_Challenge'] },
        },
      }),
      prisma.loginLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.securityAlert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.device.findMany({
        where: { userId },
        orderBy: { lastActive: 'desc' },
      }),
    ])

    // Format 7-Day Activity Chart from real log data only
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const last7Days: { day: string; successful: number; failed: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      last7Days.push({ day: days[d.getDay()], successful: 0, failed: 0 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentLogs = await prisma.loginLog.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      select: { status: true, createdAt: true },
    })

    recentLogs.forEach((log) => {
      const logDay = days[new Date(log.createdAt).getDay()]
      const match = last7Days.find((d) => d.day === logDay)
      if (match) {
        if (log.status === 'Success') match.successful++
        else match.failed++
      }
    })

    // Format Logins table rows
    const logins = rawLogs.map((log) => ({
      id: log.id,
      device: log.device || 'Workstation',
      browser: `${log.browser || 'Browser'} · ${log.os || 'OS'}`,
      location:
        log.city && log.country ? `${log.city}, ${log.country}` : 'Localhost',
      ip: log.ip,
      time: new Date(log.createdAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: log.status,
      risk: log.riskScore >= 70 ? 'High' : log.riskScore >= 30 ? 'Medium' : 'Low',
      riskScore: log.riskScore,
    }))

    // Format Alerts
    const alerts = rawAlerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      detail: alert.detail,
      level: alert.level,
      riskScore: alert.riskScore,
      isResolved: alert.isResolved,
      time: new Date(alert.createdAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }))

    // Format Devices
    const devices = rawDevices.map((dev) => ({
      id: dev.id,
      name: dev.name,
      detail: `${dev.browser} · ${dev.os}`,
      location: dev.lastLocation || 'Unknown',
      last: new Date(dev.lastActive).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      isCurrent: dev.fingerprint === currentDevice.fingerprint,
    }))

    return NextResponse.json({
      metrics: {
        totalAttempts,
        successfulLogins,
        failedAttempts,
        suspiciousActivity: blockedAttempts,
      },
      chart: last7Days,
      logins,
      alerts,
      devices,
    })
  } catch (error: any) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load telemetry stats' },
      { status: 500 }
    )
  }
}
