// Real health check (hits /api/health, which reports DB status).
// This is NOT the keep-alive pinger — that is /api/ping, driven by
// cron-job.org (primary) and .github/workflows/keep-alive.yml (secondary).
//
// Run with: npm run cron:health
// Override target: HEALTH_URL=... npm run cron:health

const HEALTH_URL = process.env.HEALTH_URL || 'https://comp-dash.onrender.com/api/health'
// A cold start on Render's free tier takes ~60s; allow for it.
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 120_000)

async function ping() {
  const start = Date.now()
  const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  const ms = Date.now() - start

  if (!res.ok) {
    const hint = res.status === 503 ? ' (service suspended or unavailable)' : ''
    console.error(`[${new Date().toISOString()}] FAIL health check: HTTP ${res.status}${hint} (${ms}ms)`)
    process.exit(1)
  }

  const body = await res.json().catch(() => null)
  console.log(`[${new Date().toISOString()}] OK health check: HTTP ${res.status} (${ms}ms) db=${body?.database ?? 'unknown'}`)
}

ping().catch((err) => {
  console.error(`[${new Date().toISOString()}] ERROR health check:`, err.message)
  process.exit(1)
})
