import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// ponytail: CSP allows 'unsafe-inline' because Next's hydration/RSC bootstrap
// scripts are inline; tightening to per-request nonces would need wiring
// through every layout — only worth it if this ships beyond a demo/FYP.
// 'unsafe-eval' is added only in dev: webpack's Fast Refresh/HMR runtime
// evaluates code strings, which a stricter prod-only CSP correctly blocks.
const isDev = process.env.NODE_ENV !== 'production'
const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`

export function proxy(request: NextRequest) {
  // CSRF defense-in-depth: the session cookie is httpOnly + SameSite=Lax,
  // but also reject state-changing API requests whose Origin doesn't match
  // this app (a cross-site form/fetch can't spoof this header).
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    MUTATING_METHODS.has(request.method)
  ) {
    const origin = request.headers.get('origin')
    // Compare against the Host header rather than request.nextUrl.origin:
    // when the server binds a non-default host (e.g. `next dev -H 0.0.0.0`),
    // nextUrl.origin reflects the bind address, not what the client actually
    // requested, which would reject every same-origin request.
    if (origin && new URL(origin).host !== request.headers.get('host')) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403 }
      )
    }
  }

  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', CSP)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains'
    )
  }
  return response
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
