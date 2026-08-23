import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

// Credentials and Supabase keys live in the gitignored local env files.
loadEnv({ path: resolve(__dirname, 'apps/web/.env.local') })
loadEnv({ path: resolve(__dirname, '.env') })

const PORT = Number(process.env.E2E_PORT || 3210)
export const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Advisor tests share fixture rows in `student_competitions`, so they must not
  // race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // Render's free tier can cold-start; be patient with navigations.
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },

  // One sign-in per role, reused by every test (see e2e/global-setup.ts).
  globalSetup: './e2e/global-setup.ts',

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Reuse an already-running server locally; boot one in CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        cwd: resolve(__dirname, 'apps/web'),
        url: `http://localhost:${PORT}/api/ping`,
        reuseExistingServer: true,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
