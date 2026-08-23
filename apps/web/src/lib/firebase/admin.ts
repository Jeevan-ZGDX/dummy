import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Server-only Firebase Admin SDK. This bypasses Firestore security rules
 * entirely, so it must never be imported from a client component — the
 * `server-only`-style guard is the `fs` import, which fails any browser bundle.
 *
 * Credentials resolve in two ways: FIREBASE_SERVICE_ACCOUNT (a JSON string, how
 * Render supplies it) or a local service-account.json for development.
 */
function loadServiceAccount(): Record<string, unknown> | null {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv)
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON')
      return null
    }
  }

  // Checked in two places because `process.cwd()` is the repo root under
  // `npm run -w`, but apps/web when Next runs the server directly.
  for (const candidate of [
    join(process.cwd(), 'service-account.json'),
    join(process.cwd(), 'apps', 'web', 'service-account.json'),
  ]) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf-8'))
    } catch {
      // try the next candidate
    }
  }

  return null
}

let adminApp: App | null = null

function getAdminApp(): App | null {
  if (adminApp) return adminApp
  if (getApps().length > 0) {
    adminApp = getApps()[0]
    return adminApp
  }

  const serviceAccount = loadServiceAccount()
  if (!serviceAccount) return null

  adminApp = initializeApp({
    credential: cert(serviceAccount as never),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
  return adminApp
}

export function isAdminConfigured(): boolean {
  return getAdminApp() !== null
}

/** Returns null when credentials are absent, so callers degrade instead of crashing at import. */
export function getAdminDb(): Firestore | null {
  const instance = getAdminApp()
  if (!instance) return null
  const db = getFirestore(instance)
  // Firestore rejects `undefined` field values outright; the app has plenty of
  // optional fields, so drop them rather than hand-guarding every write.
  try {
    db.settings({ ignoreUndefinedProperties: true })
  } catch {
    // settings() throws if called twice — harmless, the first call won.
  }
  return db
}

export function getAdminAuth(): Auth | null {
  const instance = getAdminApp()
  return instance ? getAuth(instance) : null
}

export function getAdminStorage() {
  const instance = getAdminApp()
  return instance ? getStorage(instance) : null
}

export { Timestamp, FieldValue } from 'firebase-admin/firestore'
