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

const ROLE_ROUTES: Partial<Record<string, UserRole[]>> = {
  '/email-verification': ['student'],
  '/history': ['student'],
  '/od-granted': ['advisor', 'super_admin'],
  '/verification-requests': ['advisor'],
  '/create-competition': ['super_admin'],
  '/registrations': ['super_admin'],
  '/students': ['super_admin'],
  '/advisors': ['hod', 'super_admin'],
  '/analytics': ['hod'],
  '/audit': ['super_admin'],
  '/notifications': ['student', 'advisor', 'hod', 'super_admin'],
  '/winners': ['student', 'advisor', 'hod', 'super_admin'],
}

function getAllowedRoles(pathname: string): UserRole[] | null {
  const exact = ROLE_ROUTES[pathname]
  if (exact) return exact
  for (const [prefix, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(`${prefix}/`)) return roles
  }
  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_next')) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (!FIREBASE_PROJECT_ID) return NextResponse.next()

  if (isPublic) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verifyIdToken(token) : null

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', pathname)
    const response = NextResponse.redirect(url)
    if (token) {
      response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
      response.cookies.set(USER_COOKIE, '', { path: '/', maxAge: 0 })
    }
    return response
  }

  const allowedRoles = getAllowedRoles(pathname)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
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
