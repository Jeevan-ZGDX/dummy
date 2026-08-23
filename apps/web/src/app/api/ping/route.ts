export const dynamic = 'force-dynamic'
export const revalidate = 0

// Ultra-light keep-alive endpoint. No DB, no JSON, no imports.
// Its only job is to be inbound traffic so Render's free tier never
// hits the 15-minute idle spin-down. Use /api/health for real checks.

const NO_STORE = {
  'content-type': 'text/plain; charset=utf-8',
  'cache-control': 'no-store, no-cache, must-revalidate',
}

export async function GET() {
  return new Response('pong', { status: 200, headers: NO_STORE })
}

// UptimeRobot and several monitors default to HEAD.
export async function HEAD() {
  return new Response(null, { status: 200, headers: NO_STORE })
}
