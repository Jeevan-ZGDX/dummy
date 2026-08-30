'use client'

import type { User } from 'firebase/auth'

export interface SessionResult {
  ok: boolean
  error?: string
  code?: string
}

async function postToken(idToken: string) {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const data = await response.json().catch(() => ({}))
  return { response, data }
}

/**
 * Trades a signed-in Firebase user for server session cookies.
 *
 * Runs the exchange up to twice on purpose. The server resolves the user's role
 * from Firestore and writes it as a custom claim, but claims are only visible in
 * a token minted *after* that write — so when the server reports
 * `refreshRequired`, we force a token refresh and submit again. Without the
 * second pass the cookie would carry no role and every user would read as a
 * student.
 */
export async function establishSession(user: User): Promise<SessionResult> {
  try {
    const idToken = await user.getIdToken()
    const { response, data } = await postToken(idToken)

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || 'Could not start your session.',
        code: data.code,
      }
    }

    // The server only asks for this when the claim write changed something,
    // which in practice means a first-ever sign-in or a role change. Forcing
    // the refresh mints a token that carries the new role, and the second
    // exchange stores *that* as the session cookie. The server answers
    // `refreshRequired: false` the second time, so this cannot loop.
    if (data.refreshRequired) {
      const refreshed = await user.getIdToken(true)
      const second = await postToken(refreshed)
      if (!second.response.ok) {
        return {
          ok: false,
          error: second.data.error || 'Could not confirm your access level.',
          code: second.data.code,
        }
      }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'Network error while signing in.' }
  }
}

/** Signs the user back out after a rejected sign-in, so no half-session lingers. */
export async function abandonSession(): Promise<void> {
  const { getFirebaseAuth } = await import('./client')
  const auth = getFirebaseAuth()
  if (auth) {
    const { signOut } = await import('firebase/auth')
    await signOut(auth).catch(() => {})
  }
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
}
