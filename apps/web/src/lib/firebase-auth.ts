import { getAdminAuth } from './firebase/admin'
import { getDocById, findOneByField } from './firestore-data'
import { COLLECTIONS } from './firebase/config'
import {
  normalizeRole,
  isAllowedEmail,
  OFFICIAL_COLLEGE_DOMAIN,
  type UserRole,
} from './firebase/session'

export { isAllowedEmail, OFFICIAL_COLLEGE_DOMAIN }

export interface ResolvedUser {
  email: string
  name: string
  role: UserRole
  department: string
  denied: boolean
  reason?: string
}

/**
 * Resolves a signed-in email to its role and department.
 *
 * Priority: `role_access` (explicit allowlist) → `profiles` → `user_profiles`.
 * A college email that appears nowhere defaults to the student role.
 *
 * `role_access` documents are keyed by lowercased email, so the common case is
 * a single point read rather than a query.
 */
export async function resolveUserFromDatabase(email: string): Promise<ResolvedUser> {
  const cleanEmail = email.trim().toLowerCase()

  // Privilege is granted by a record, never inferred from the address. This
  // used to promote anything starting with `admin@`, `hod@`, `advisor@` or
  // `faculty@`, so the shape of an email decided what it could do.
  const fallback: ResolvedUser = {
    email: cleanEmail,
    name: cleanEmail.split('@')[0],
    role: 'student',
    department: '',
    denied: false,
  }

  const access = await getDocById(COLLECTIONS.roleAccess, cleanEmail)
  if (access) {
    // granted:false is a revocation. It was previously ignored entirely, so
    // clearing the flag removed nobody's access.
    if (access.granted === false) {
      return {
        ...fallback,
        name: access.name || fallback.name,
        department: access.department || fallback.department,
        denied: true,
        reason: 'Your access to Comp-Dash has been revoked.',
      }
    }
    return {
      ...fallback,
      name: access.name || fallback.name,
      role: normalizeRole(access.role),
      department: access.department || fallback.department,
    }
  }

  const profile = await findOneByField(COLLECTIONS.profiles, 'email', cleanEmail)
  if (profile) {
    return {
      ...fallback,
      name: profile.name || fallback.name,
      role: normalizeRole(profile.role),
      department: profile.department || fallback.department,
    }
  }

  const legacy = await findOneByField(COLLECTIONS.userProfiles, 'email', cleanEmail)
  if (legacy) {
    return {
      ...fallback,
      name: legacy.full_name || legacy.name || fallback.name,
      role: normalizeRole(legacy.role),
      department: legacy.department || fallback.department,
    }
  }

  return fallback
}

/**
 * Writes role/department onto the Firebase user as custom claims, so they ride
 * inside the signed ID token and the Edge middleware can trust them without a
 * database read.
 *
 * Returns whether anything actually changed: claims only reach the client after
 * it force-refreshes its token, and that refresh is worth skipping when the
 * existing claims already match.
 */
export async function syncUserClaims(
  uid: string,
  claims: { role: UserRole; department: string; name: string }
): Promise<boolean> {
  const auth = getAdminAuth()
  if (!auth) throw new Error('Firebase Admin is not configured')

  const user = await auth.getUser(uid)
  const existing = (user.customClaims || {}) as Record<string, unknown>

  if (
    existing.role === claims.role &&
    existing.department === claims.department &&
    existing.name === claims.name
  ) {
    return false
  }

  await auth.setCustomUserClaims(uid, {
    ...existing,
    role: claims.role,
    department: claims.department,
    name: claims.name,
  })
  return true
}

/**
 * Rejections that mean the token really is unusable. Anything else that comes
 * out of the revocation lookup is treated as a transport problem, not a verdict
 * on the token.
 */
const FATAL_TOKEN_ERRORS = new Set([
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/argument-error',
])

/** Verifies an ID token server-side using the Admin SDK (Node runtime only). */
export async function verifyIdTokenAdmin(idToken: string) {
  const auth = getAdminAuth()
  if (!auth) throw new Error('Firebase Admin is not configured')

  try {
    // `checkRevoked` catches tokens belonging to a disabled or signed-out user.
    return await auth.verifyIdToken(idToken, true)
  } catch (err) {
    const code = (err as { code?: string }).code || ''
    if (FATAL_TOKEN_ERRORS.has(code)) throw err

    // checkRevoked costs an EXTRA round trip to Google's user store, separate
    // from the signature check. On a slow or flaky link that call is the part
    // that fails — and reporting it as "invalid token" locks out users holding
    // a perfectly valid one. Fall back to signature/issuer/audience/expiry,
    // which needs only Google's cached public keys.
    console.warn(`Revocation check unavailable (${code || 'no code'}), verifying signature only`)
    return auth.verifyIdToken(idToken)
  }
}
