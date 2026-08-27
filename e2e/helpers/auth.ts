import type { BrowserContext } from '@playwright/test'

/**
 * Signs E2E roles in against Firebase and installs the app's own session
 * cookies.
 *
 * Replaces the pre-migration Supabase helper, which signed in at
 * `${SUPABASE_URL}/auth/v1/token` and set an `sb-<ref>-auth-token` cookie. That
 * project no longer exists, and the cookie was never read anyway: the Firebase
 * middleware reads `fb_session`, which holds a raw Firebase ID token.
 *
 * There is no email/password form to drive — the app signs in through a Google
 * popup — so tests mint a token via Firebase's REST API instead and hand it to
 * the app's own /api/auth/session, which is what the browser would post.
 */

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'
const SECURE_TOKEN = 'https://securetoken.googleapis.com/v1/token'

export interface Credentials {
  email: string
  password: string
}

/** Demo accounts created by `npm run seed:auth`. */
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD || 'CompDash@123'

/**
 * The demo class advisor. `scripts/setup-demo-advisor.mjs` gives this account an
 * advisors row, so it exercises the mapped-advisor path.
 */
export const ADVISOR: Credentials = {
  email: process.env.E2E_ADVISOR_EMAIL || 'advisor@citchennai.net',
  password: process.env.E2E_ADVISOR_PASSWORD || DEMO_PASSWORD,
}

export const STUDENT: Credentials = { email: 'student@citchennai.net', password: DEMO_PASSWORD }
export const HOD: Credentials = { email: 'hod@citchennai.net', password: DEMO_PASSWORD }

export const UNMAPPED_ADVISOR: Credentials = {
  // Real `advisor` role but no advisors row — exercises the "account not mapped
  // to an advisor record" path. Deliberately NOT advisor@citchennai.net, which
  // is the demo class advisor and would assert the wrong branch.
  email: process.env.E2E_UNMAPPED_ADVISOR_EMAIL || 'unmapped.advisor@citchennai.net',
  password: DEMO_PASSWORD,
}

export function assertAuthEnv() {
  if (!API_KEY) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY — required to mint E2E ID tokens')
  }
}

interface TokenPair {
  idToken: string
  refreshToken: string
}

async function signInWithPassword(creds: Credentials): Promise<TokenPair> {
  const res = await fetch(`${IDENTITY}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password, returnSecureToken: true }),
  })
  const body = await res.json()
  if (!res.ok) {
    // Firebase's own error string ("INVALID_LOGIN_CREDENTIALS", "USER_DISABLED")
    // is the only thing that distinguishes a wrong password from a missing
    // account, so let it travel rather than collapsing it.
    throw new Error(
      `Firebase sign-in failed for ${creds.email}: ${body?.error?.message || res.status}. ` +
        `Run \`npm run seed:auth\` if the demo accounts are missing.`
    )
  }
  return { idToken: body.idToken, refreshToken: body.refreshToken }
}

/**
 * Trades a refresh token for a freshly minted ID token.
 *
 * Custom claims (the user's role) only appear in a token issued *after* they
 * are written, so the first token of a session predates its own role claim.
 */
async function refreshIdToken(refreshToken: string): Promise<string> {
  const res = await fetch(`${SECURE_TOKEN}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Token refresh failed: ${body?.error?.message || res.status}`)
  return body.id_token
}

/**
 * Posts an ID token to the app's session endpoint. `context.request` shares
 * cookie storage with the BrowserContext, so the Set-Cookie response lands
 * where `storageState()` will capture it.
 */
async function postSession(context: BrowserContext, baseURL: string, idToken: string) {
  const res = await context.request.post(`${baseURL}/api/auth/session`, { data: { idToken } })
  if (!res.ok()) {
    throw new Error(`/api/auth/session rejected the token: ${res.status()} ${(await res.text()).slice(0, 300)}`)
  }
  return res.json()
}

/**
 * Signs a role in and leaves `context` holding a valid session.
 *
 * Deliberately posts twice. The first call makes the server resolve the role and
 * write it as a custom claim; the second carries a token that actually contains
 * that claim. The middleware reads the role straight out of the cookie's token,
 * so a single pass would leave every role looking like `student`.
 */
export async function signInViaApi(context: BrowserContext, creds: Credentials, baseURL: string) {
  assertAuthEnv()
  if (!creds.email || !creds.password) {
    throw new Error('Missing E2E credentials')
  }

  const { idToken, refreshToken } = await signInWithPassword(creds)
  await postSession(context, baseURL, idToken)

  const refreshed = await refreshIdToken(refreshToken)
  const { profile } = await postSession(context, baseURL, refreshed)

  return profile
}
