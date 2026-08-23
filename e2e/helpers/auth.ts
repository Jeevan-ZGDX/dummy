import type { BrowserContext, Page } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export interface Credentials {
  email: string
  password: string
}

export const ADVISOR: Credentials = {
  email: process.env.E2E_ADVISOR_EMAIL || '',
  password: process.env.E2E_ADVISOR_PASSWORD || '',
}

/** Demo accounts created by `npm run seed:auth`. */
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD || 'CompDash@123'
export const STUDENT: Credentials = { email: 'student@citchennai.net', password: DEMO_PASSWORD }
export const HOD: Credentials = { email: 'hod@citchennai.net', password: DEMO_PASSWORD }
export const UNMAPPED_ADVISOR: Credentials = {
  // Real `advisor` role but no row in public.advisors — exercises the
  // "account not mapped to an advisor record" path.
  //
  // Deliberately NOT advisor@citchennai.net: that account is the demo class
  // advisor and `scripts/setup-demo-advisor.mjs` gives it an advisors row, which
  // would make this fixture assert the wrong branch.
  email: process.env.E2E_UNMAPPED_ADVISOR_EMAIL || 'unmapped.advisor@citchennai.net',
  password: DEMO_PASSWORD,
}

function projectRef() {
  return SUPABASE_URL.split('//')[1]?.split('.')[0] ?? ''
}

/**
 * Signs in against Supabase directly and installs the session cookie that
 * `@supabase/ssr` expects, so tests don't depend on the sign-in form.
 *
 * ssr v0.5 stores the whole session JSON as `base64-<base64(json)>`.
 */
export async function signInViaApi(context: BrowserContext, creds: Credentials, baseURL: string) {
  if (!creds.email || !creds.password) {
    throw new Error('Missing E2E credentials — set E2E_ADVISOR_EMAIL / E2E_ADVISOR_PASSWORD')
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  })
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${creds.email}: ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  const token = await res.json()

  const session = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_in: token.expires_in,
    expires_at: token.expires_at,
    token_type: token.token_type,
    user: token.user,
  }
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64')
  const url = new URL(baseURL)

  await context.addCookies([
    {
      name: `sb-${projectRef()}-auth-token`,
      value: encodeURIComponent(value),
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ])

  return token.user
}

/** Signs in through the actual form — covers the UI login path itself. */
export async function signInViaForm(page: Page, creds: Credentials) {
  await page.goto('/sign-in')
  await page.getByLabel(/email/i).fill(creds.email)
  await page.locator('input[type="password"]').first().fill(creds.password)
  await page.getByRole('button', { name: /sign in/i }).first().click()
}
