import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { alertId, isResolved } = body

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID required' }, { status: 400 })
    }

    await prisma.securityAlert.updateMany({
      where: {
        id: alertId,
        userId: session.userId,
      },
      data: {
        isResolved: !!isResolved,
        resolvedAt: isResolved ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update alert' },
      { status: 500 }
    )
  }
}
