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
    let { response, data } = await postToken(await user.getIdToken())

    if (response.ok && data.refreshRequired) {
      ;({ response, data } = await postToken(await user.getIdToken(true)))
    }

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || 'Could not start your session.',
        code: data.code,
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
