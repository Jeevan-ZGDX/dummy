import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose'
import { FIREBASE_PROJECT_ID } from './config'

export const SESSION_COOKIE = 'fb_session'
export const USER_COOKIE = 'comp_dash_user'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export type UserRole = 'student' | 'advisor' | 'hod' | 'super_admin'

/**
 * Lives here because this module is the one place imported by every runtime —
 * Edge middleware, Node route handlers and the browser bundle — so the domain
 * gate cannot drift between them.
 */
export const OFFICIAL_COLLEGE_DOMAIN = 'citchennai.net'

export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${OFFICIAL_COLLEGE_DOMAIN.toLowerCase()}`)
}

export interface SessionUser {
  uid: string
  email: string
  name: string
  role: UserRole
  department: string
}

export function normalizeRole(role: unknown): UserRole {
  return role === 'advisor' || role === 'hod' || role === 'super_admin' ? role : 'student'
}

/**
 * Google's public keys for Firebase ID tokens, in JWKS form.
 *
 * The Admin SDK cannot run in Next's Edge middleware (it needs Node crypto and
 * `fs`), so the middleware verifies the token itself against this endpoint.
 * `createRemoteJWKSet` caches and rotates the keys internally, so this is one
 * cold fetch rather than a per-request round trip.
 */
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

/**
 * Verifies a Firebase ID token's signature, issuer, audience and expiry.
 * Returns null on any failure — callers treat null as "not signed in".
 */
export async function verifyIdToken(token: string): Promise<SessionUser | null> {
  if (!token || !FIREBASE_PROJECT_ID) return null

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    if (!email) return null

    return {
      uid: String(payload.user_id || payload.sub || ''),
      email,
      // Role and department ride as custom claims, set server-side after the
      // database lookup — never taken from anything the client can influence.
      role: normalizeRole(payload.role),
      name: String(payload.name || email.split('@')[0]),
      department: String(payload.department || ''),
    }
  } catch {
    return null
  }
}

/**
 * Reads claims without verifying the signature. Only for non-security paths
 * such as deciding whether a cookie is worth refreshing — never for access
 * control.
 */
export function decodeTokenUnsafe(token: string): Record<string, unknown> | null {
  try {
    return decodeJwt(token) as Record<string, unknown>
  } catch {
    return null
  }
}
