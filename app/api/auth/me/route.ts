import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        totpEnabled: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Session lookup failed' },
      { status: 500 }
    )
  }
}
