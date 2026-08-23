import { cookies } from 'next/headers'
import { verifyIdToken, SESSION_COOKIE, type SessionUser } from './session'

/**
 * The signed-in user for a server component or route handler, or null.
 *
 * Verifies the same cookie the middleware checks, using the same public-key
 * path — so a route handler never trusts a header or cookie the client could
 * forge, and the two layers cannot disagree about who is signed in.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value
    if (!token) return null
    return await verifyIdToken(token)
  } catch {
    // Called outside a request scope.
    return null
  }
}

export type { SessionUser }
