import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifySessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('sentinel_session')?.value

    if (sessionCookie) {
      const { valid, payload } = await verifySessionToken(sessionCookie)
      if (valid && payload?.userId) {
        // Delete session from DB
        await prisma.session.deleteMany({
          where: { token: sessionCookie },
        })
      }
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('sentinel_session')
    return response
  } catch (error: any) {
    const response = NextResponse.json({ success: true })
    response.cookies.delete('sentinel_session')
    return response
  }
}

