import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyIdToken, SESSION_COOKIE, USER_COOKIE } from '@/lib/firebase/session'
import { FIREBASE_PROJECT_ID } from '@/lib/firebase/config'

const PUBLIC_ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/login',
  '/policy',
  '/terms',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // Firebase not configured — let the app render and surface setup guidance in the UI.
  if (!FIREBASE_PROJECT_ID) return NextResponse.next()

  if (isPublic) return NextResponse.next()

  // Verified entirely in-process against Google's public keys; no Admin SDK and
  // no network call to Firebase on the hot path.
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifyIdToken(token) : null

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', pathname)
    const response = NextResponse.redirect(url)
    // An expired or tampered cookie is cleared so the client stops resending it.
    if (token) {
      response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
      response.cookies.set(USER_COOKIE, '', { path: '/', maxAge: 0 })
    }
    return response
  }

  const response = NextResponse.next()

  response.cookies.set(
    USER_COOKIE,
    JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    }),
    {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
    }
  )

  return response
}

export const config = {
  matcher: ['/((?!.*\\..*|_next|api).*)', '/'],
}
