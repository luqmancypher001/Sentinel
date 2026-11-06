import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const logs = await prisma.loginLog.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  })

  const header = [
    'Time',
    'Status',
    'Risk Score',
    'Risk Factors',
    'IP',
    'City',
    'Country',
    'Browser',
    'OS',
    'Device',
  ]

  const rows = logs.map((log) =>
    [
      log.createdAt.toISOString(),
      log.status,
      log.riskScore,
      (JSON.parse(log.riskFactors || '[]') as string[]).join('; '),
      log.ip,
      log.city,
      log.country,
      log.browser,
      log.os,
      log.device,
    ]
      .map(csvEscape)
      .join(',')
  )

  const csv = [header.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sentinel-login-history-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
