import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { deviceId } = body

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 })
    }

    // Delete device
    await prisma.device.deleteMany({
      where: {
        id: deviceId,
        userId: session.userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to remove device' },
      { status: 500 }
    )
  }
}
