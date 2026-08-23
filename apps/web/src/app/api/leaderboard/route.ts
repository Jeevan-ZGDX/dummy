/**
 * Leaderboard read + rebuild.
 *
 * GET  — the top N precomputed rows. One server-side query, cached, shared by
 *        every visitor. Replaces each browser pulling 1,087 student documents
 *        and the whole winners collection to compute the same answer.
 * POST — full rebuild. Admin only; used after a bulk import or a change to the
 *        scoring rule.
 */

import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache, revalidateTag } from 'next/cache'
import { getSessionUser } from '@/lib/firebase/server-session'
import {
  LEADERBOARD_LIMIT,
  LEADERBOARD_MAX,
  LEADERBOARD_TAG,
  readTopLeaderboard,
  readTopPrizeLeaderboard,
  readRecentWinners,
  recomputeLeaderboard,
} from '@/lib/leaderboard'

export const runtime = 'nodejs' // Admin SDK
export const dynamic = 'force-dynamic' // the session cookie decides the response

/**
 * Cached per requested size.
 *
 * `unstable_cache` is the documented way to cache a non-`fetch` data source in
 * the App Router — the Admin SDK never goes through `fetch`, so the Data Cache
 * would not see it otherwise. The tag lets a recorded win drop the cache
 * immediately instead of waiting out the TTL.
 */
function cachedTop(limit: number) {
  return unstable_cache(() => readTopLeaderboard(limit), ['leaderboard-top', String(limit)], {
    revalidate: 60,
    tags: [LEADERBOARD_TAG],
  })
}

function cachedPrizeTop(limit: number) {
  return unstable_cache(() => readTopPrizeLeaderboard(limit), ['leaderboard-prize-top', String(limit)], {
    revalidate: 60,
    tags: [LEADERBOARD_TAG],
  })
}

function cachedRecentWinners(limit: number) {
  return unstable_cache(() => readRecentWinners(limit), ['leaderboard-recent-winners', String(limit)], {
    revalidate: 60,
    tags: [LEADERBOARD_TAG],
  })
}

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw || '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return LEADERBOARD_LIMIT
  return Math.min(parsed, LEADERBOARD_MAX)
}

export async function GET(request: NextRequest) {
  // Middleware skips /api entirely, so the gate lives here.
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseLimit(searchParams.get('limit'))
  const type = searchParams.get('type') || 'points' // 'points' or 'prize' or 'recent'

  try {
    let data
    if (type === 'prize') {
      data = await readTopPrizeLeaderboard(limit)
    } else if (type === 'recent') {
      data = await readRecentWinners(limit)
    } else {
      data = await readTopLeaderboard(limit)
    }
    return NextResponse.json(
      { success: true, data, limit, type },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  } catch (err) {
    console.error('Leaderboard read failed:', (err as Error).message)
    return NextResponse.json(
      { success: false, error: 'Could not load the leaderboard.' },
      { status: 500 }
    )
  }
}

export async function POST() {
  const user = await getSessionUser()
  if (!user || (user.role !== 'hod' && user.role !== 'super_admin')) {
    return NextResponse.json(
      { success: false, error: 'Only an HOD or admin can rebuild the leaderboard.' },
      { status: 403 }
    )
  }

  try {
    const result = await recomputeLeaderboard()
    revalidateTag(LEADERBOARD_TAG)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Leaderboard rebuild failed:', (err as Error).message)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
