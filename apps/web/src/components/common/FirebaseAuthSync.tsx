'use client'

import { useEffect } from 'react'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { establishSession } from '@/lib/firebase/establish-session'

/**
 * Keeps the httpOnly session cookie in step with the Firebase client's token.
 *
 * Firebase ID tokens expire after an hour and the SDK silently refreshes them in
 * the background. Nothing propagates that refresh to the server on its own, so
 * without this the cookie the middleware checks would go stale mid-session and
 * bounce the user to /sign-in while the tab still looked signed in.
 *
 * `onIdTokenChanged` fires on sign-in, on sign-out, and on every silent refresh,
 * which is exactly the set of moments the cookie needs rewriting.
 */
export function FirebaseAuthSync() {
  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) return

    let cancelled = false

    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (cancelled) return

      if (!user) {
        // Signed out in this tab or another one — drop the server cookies too.
        await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
        return
      }

      await establishSession(user)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return null
}
