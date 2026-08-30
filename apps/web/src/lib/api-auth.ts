import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/server-session'

/**
 * Guard for route handlers that live outside the catch-all dispatcher.
 *
 * The Edge middleware skips `/api` entirely — it cannot run the Admin SDK — so
 * nothing protects a route file on its own. The catch-all has a default-deny
 * gate in its dispatcher, but a dedicated route file under `app/api/**` shadows
 * the catch-all and never reaches it, which is how `/api/competitions` and
 * `/api/student-registrations` ended up answering anonymous callers, writes and
 * deletes included.
 *
 * Returns a 401 response to hand straight back, or null when the caller holds a
 * verified session:
 *
 *   const denied = await denyIfSignedOut()
 *   if (denied) return denied
 */
export async function denyIfSignedOut(): Promise<NextResponse | null> {
  const user = await getSessionUser()
  if (user?.email) return null

  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHENTICATED', message: 'Not signed in' } },
    { status: 401 }
  )
}
