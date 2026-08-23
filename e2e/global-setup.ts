import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { signInViaApi, ADVISOR, STUDENT, HOD, UNMAPPED_ADVISOR, type Credentials } from './helpers/auth'

export const AUTH_DIR = resolve(__dirname, '.auth')

export const STORAGE_STATE: Record<string, string> = {
  advisor: resolve(AUTH_DIR, 'advisor.json'),
  unmappedAdvisor: resolve(AUTH_DIR, 'unmapped-advisor.json'),
  student: resolve(AUTH_DIR, 'student.json'),
  hod: resolve(AUTH_DIR, 'hod.json'),
}

/**
 * Signs each role in exactly once and persists the session.
 *
 * Signing in per-test issued a fresh session each time for the same user; the
 * middleware then refreshed and rotated tokens, so an earlier context's cookie
 * could be invalidated mid-test. The client's axios interceptor turns that 401
 * into a hard redirect to /login, which looked like "the panel never rendered".
 * One sign-in per role removes the race and is much faster.
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3210'
  mkdirSync(AUTH_DIR, { recursive: true })

  const roles: Array<[string, Credentials]> = [
    ['advisor', ADVISOR],
    ['unmappedAdvisor', UNMAPPED_ADVISOR],
    ['student', STUDENT],
    ['hod', HOD],
  ]

  const browser = await chromium.launch()
  try {
    for (const [role, creds] of roles) {
      if (!creds.email || !creds.password) {
        // Write an empty state so tests that need it fail loudly rather than
        // silently running unauthenticated.
        writeFileSync(STORAGE_STATE[role], JSON.stringify({ cookies: [], origins: [] }))
        console.warn(`[e2e] no credentials for "${role}" — skipping sign-in`)
        continue
      }
      const context = await browser.newContext()
      await signInViaApi(context, creds, baseURL)
      await context.storageState({ path: STORAGE_STATE[role] })
      await context.close()
      console.log(`[e2e] signed in: ${role} (${creds.email})`)
    }
  } finally {
    await browser.close()
  }
}

export default globalSetup
