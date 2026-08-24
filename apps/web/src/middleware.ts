import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyIdToken, SESSION_COOKIE, USER_COOKIE, type UserRole } from '@/lib/firebase/session'
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

const AUTH_ROUTES = ['/sign-in', '/sign-up', '/login']

// Routes permitted per role. Subroutes starting with these prefixes are also allowed.
const ROLE_PERMITTED_ROUTES: Record<UserRole, string[]> = {
  student: [
    '/dashboard',
    '/competitions',
    '/email-verification',
    '/leaderboard',
    '/history',
    '/winners',
    '/notifications',
  ],
  hod: [
    '/dashboard',
    '/competitions',
    '/leaderboard',
    '/advisors',
    '/analytics',
    '/winners',
    '/notifications',
    '/verification-requests',
    '/od-granted',
  ],
  advisor: [
    '/dashboard',
    '/competitions',
    '/od-granted',
    '/leaderboard',
    '/verification-requests',
    '/winners',
    '/notifications',
  ],
  super_admin: [
    '/dashboard',
    '/competitions',
    '/email-verification',
    '/od-granted',
    '/leaderboard',
    '/history',
    '/verification-requests',
    '/create-competition',
    '/registrations',
    '/students',
    '/advisors',
    '/analytics',
    '/winners',
    '/audit',
    '/notifications',
  ],
}

function isPathAllowedForRole(pathname: string, role: UserRole): boolean {
  const allowedList = ROLE_PERMITTED_ROUTES[role]
  if (!allowedList) return true
  return allowedList.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // Firebase not configured — let the app render and surface setup guidance in the UI.
  if (!FIREBASE_PROJECT_ID) return NextResponse.next()

  // Verified entirely in-process against Google's public keys; no Admin SDK and
  // no network call to Firebase on the hot path.
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifyIdToken(token) : null

  if (!user) {
    if (isPublic) return NextResponse.next()

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

  // User is authenticated:
  // 1. If visiting sign-in / sign-up / login, redirect to /dashboard
  if (isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 2. Check role route access control for protected routes
  if (!isPublic && !isPathAllowedForRole(pathname, user.role)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
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

