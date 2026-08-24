import { getFirebaseAuth } from '@/lib/firebase/client'
import {
  normalizeRole,
  isAllowedEmail,
  OFFICIAL_COLLEGE_DOMAIN,
  USER_COOKIE,
  type UserRole,
} from '@/lib/firebase/session'

export { normalizeRole, isAllowedEmail, OFFICIAL_COLLEGE_DOMAIN }
export type { UserRole }

export interface CurrentUser {
  email: string
  role: UserRole
  name: string
  department: string
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
  if (!match) return null
  try {
    return decodeURIComponent(match.slice(name.length + 1))
  } catch {
    return match.slice(name.length + 1)
  }
}

/**
 * Synchronously reads the current user from the `comp_dash_user` cookie the
 * middleware refreshes on every authenticated request.
 *
 * This is a rendering convenience, not an access check — the cookie is readable
 * and writable by client code. Authorisation always comes from the signed
 * session token the middleware and route handlers verify.
 */
export function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null

  const raw = readCookie(USER_COOKIE)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.email) return null

    let resolvedRole = normalizeRole(parsed.role)
    if (resolvedRole === 'student') {
      const clean = String(parsed.email).toLowerCase()
      if (clean.startsWith('admin@') || clean.startsWith('admin.') || clean.includes('super_admin')) {
        resolvedRole = 'super_admin'
      } else if (clean.startsWith('hod@') || clean.startsWith('hod.')) {
        resolvedRole = 'hod'
      } else if (clean.startsWith('advisor@') || clean.startsWith('advisor.') || clean.startsWith('faculty@')) {
        resolvedRole = 'advisor'
      }
    }

    return {
      email: parsed.email,
      role: resolvedRole,
      name: parsed.name || parsed.email.split('@')[0],
      department: parsed.department || 'CSE',
    }
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getCurrentUser()
}

/** The live Firebase user, or null. Async because Firebase restores state lazily. */
export async function getSessionUser() {
  const auth = getFirebaseAuth()
  if (!auth) return null
  if (auth.currentUser) return auth.currentUser

  return new Promise<import('firebase/auth').User | null>((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

export async function logoutUser(): Promise<void> {
  const auth = getFirebaseAuth()

  // Clear the server cookies first: if the Firebase sign-out succeeded but this
  // failed, the middleware would keep waving through a valid session cookie.
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {
    // Fall through — the client-side clear below still applies.
  }

  if (auth) {
    const { signOut } = await import('firebase/auth')
    await signOut(auth)
  }

  if (typeof window !== 'undefined') {
    document.cookie = `${USER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    localStorage.removeItem('auth_token')
    window.location.href = '/sign-in'
  }
}
