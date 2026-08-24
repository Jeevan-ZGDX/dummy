import { NextRequest, NextResponse } from 'next/server'
import {
  resolveUserFromDatabase,
  syncUserClaims,
  verifyIdTokenAdmin,
  isAllowedEmail,
  OFFICIAL_COLLEGE_DOMAIN,
} from '@/lib/firebase-auth'
import { SESSION_COOKIE, USER_COOKIE, SESSION_MAX_AGE } from '@/lib/firebase/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // Admin SDK cannot run on the Edge runtime

const cookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_MAX_AGE,
}

/**
 * Exchanges a Firebase ID token for session cookies.
 *
 * The client calls this twice on a fresh sign-in. The first call resolves the
 * user's role and writes it as a custom claim, then answers
 * `{ refreshRequired: true }` — custom claims only appear in a token the client
 * fetches *after* they are set. The client force-refreshes and calls again, and
 * that second token, now carrying the role, becomes the session cookie.
 */
export async function POST(request: NextRequest) {
  let idToken: string

  try {
    const body = await request.json()
    idToken = String(body.idToken || '')
  } catch {
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 })
  }

  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
  }

  let decoded
  try {
    decoded = await verifyIdTokenAdmin(idToken)
  } catch (err) {
    // The Firebase error code is the only thing that distinguishes "your token
    // aged out" from "Admin credentials are wrong" from "this account is
    // disabled". Collapsing them into one opaque string made every sign-in
    // failure look identical, so the code travels to the client and the log.
    const code = (err as { code?: string }).code || 'unknown'
    console.error('ID token verification failed:', code, (err as Error).message)
    return NextResponse.json(
      {
        error:
          code === 'auth/id-token-expired'
            ? 'Your sign-in expired before it reached us. Please try again.'
            : `Could not verify your sign-in (${code}).`,
        code,
      },
      { status: 401 }
    )
  }

  const email = String(decoded.email || '').trim().toLowerCase()

  if (!email || !decoded.email_verified) {
    return NextResponse.json(
      { error: 'Your Google email must be verified before signing in.' },
      { status: 403 }
    )
  }

  if (!isAllowedEmail(email)) {
    return NextResponse.json(
      {
        error: `Only @${OFFICIAL_COLLEGE_DOMAIN} accounts can sign in. You signed in with ${email}.`,
        code: 'domain_denied',
      },
      { status: 403 }
    )
  }

  const resolved = await resolveUserFromDatabase(email)

  const profile = {
    email,
    name: resolved.name || String(decoded.name || email.split('@')[0]),
    role: resolved.role,
    department: resolved.department,
  }

  let claimsChanged = false
  try {
    claimsChanged = await syncUserClaims(decoded.uid, {
      role: profile.role,
      department: profile.department,
      name: profile.name,
    })
  } catch (err) {
    console.error('Failed to sync custom claims:', (err as Error).message)
  }

  // The token in hand predates the claim write, so ask the client to refresh
  // and resubmit rather than storing a cookie the middleware would read as
  // role=student.
  if (claimsChanged) {
    return NextResponse.json({ refreshRequired: true, profile })
  }

  const response = NextResponse.json({ refreshRequired: false, profile })
  response.cookies.set(SESSION_COOKIE, idToken, { ...cookieOptions, httpOnly: true })
  // Readable by client code for instant role-aware rendering. Not a security
  // boundary — the middleware always re-verifies the signed token above.
  response.cookies.set(USER_COOKIE, JSON.stringify(profile), cookieOptions)

  return response
}

/** Clears the session. Called on sign-out and whenever Firebase reports no user. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(USER_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
