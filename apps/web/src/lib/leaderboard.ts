/**
 * Server-side leaderboard: computation, storage and reads.
 *
 * Replaces a client-side implementation that pulled every student document
 * (1,087 in the active cohort) plus the whole `winners` collection into each visitor's
 * browser and joined them in JavaScript. Firestore bills per document read, so
 * that cost the 50k/day free quota roughly every 46 page views — and it was
 * paid again by every user, since the reads happened in their browser.
 *
 * The shape now is: winners are folded into a small `leaderboard` collection
 * when they are recorded, and the page reads the top N straight off it.
 *
 * Node runtime only — this uses the Admin SDK.
 */

import { getAdminDb } from './firebase/admin'
import { COLLECTIONS } from './firebase/config'
import { ACTIVE_YEAR_LABELS, normalizeSection } from '@comp-dash/utils'

/** How many rows the leaderboard shows. */
export const LEADERBOARD_LIMIT = 15

/** Cache tag, so recording a win can drop the cached page immediately. */
export const LEADERBOARD_TAG = 'leaderboard'

/** Ceiling for callers that ask for more (analytics aggregates by section). */
export const LEADERBOARD_MAX = 200

export interface LeaderboardRow {
  rank: number
  email: string
  studentName: string
  section: string
  department: string
  points: number
  wins: number
  competitionsCount: number
  recentCompetition: string
}

interface WinTally {
  wins: number
  totalPrize: number
  positions: string[]
  recentCompetition: string
  recentDate: string
}

/**
 * Parses the prize string into a number.
 *
 * Prizes are free text entered by staff — "RS.50000", "₹1,50,000", "2 Lakhs",
 * "$500" all occur — so this is deliberately forgiving and returns 0 rather
 * than throwing on anything it cannot read.
 */
export function extractNumericPrize(prizeStr: string): number {
  if (!prizeStr) return 0
  const upper = String(prizeStr).toUpperCase()

  const crore = upper.match(/([\d,.]+)\s*CRORE/)
  if (crore) return parseFloat(crore[1].replace(/,/g, '')) * 10000000

  const lakh = upper.match(/([\d,.]+)\s*LAKH/)
  if (lakh) return parseFloat(lakh[1].replace(/,/g, '')) * 100000

  const rupee = upper.match(/₹\s*([\d,]+)/)
  if (rupee) return parseFloat(rupee[1].replace(/,/g, ''))

  const dollar = String(prizeStr).match(/\$\s*([\d,]+)/)
  if (dollar) return parseFloat(dollar[1].replace(/,/g, ''))

  const bare = upper.match(/([\d,]+)/)
  if (bare) {
    const n = parseFloat(bare[1].replace(/,/g, ''))
    return Number.isFinite(n) ? n : 0
  }

  return 0
}

/**
 * The scoring rule — deliberately the only place points are decided.
 *
 * Every input a formula might plausibly want is passed in already aggregated,
 * so swapping the rule is a change to this function alone: nothing upstream
 * (the tally) or downstream (storage, the route, the page) needs to move.
 *
 * The current rule reproduces the behaviour it replaced — points are the summed
 * prize money of every recorded win — so ranks do not silently change on the
 * deploy that introduces this pipeline. `wins` and `positions` are already
 * threaded through for the weighted formula that replaces it.
 */
export function computePoints(input: {
  wins: number
  totalPrize: number
  positions: string[]
}): number {
  return input.totalPrize
}

/** Normalizes an email for use as a join key and document id. */
function keyOf(email: unknown): string {
  return String(email || '').trim().toLowerCase()
}

function tallyWinners(winnerDocs: Record<string, any>[]): Map<string, WinTally> {
  const byEmail = new Map<string, WinTally>()

  for (const w of winnerDocs) {
    const email = keyOf(w.email)
    if (!email) continue

    const tally = byEmail.get(email) || {
      wins: 0,
      totalPrize: 0,
      positions: [],
      recentCompetition: '',
      recentDate: '',
    }

    tally.wins++
    tally.totalPrize += extractNumericPrize(w.prize || '')
    if (w.position) tally.positions.push(String(w.position))

    // `date` is nullable, so the newest-first pick is done here rather than
    // with orderBy — which would drop every winner missing the field.
    const date = String(w.date || '')
    if (!tally.recentDate || date > tally.recentDate) {
      tally.recentDate = date
      tally.recentCompetition = String(w.competition || '')
    }

    byEmail.set(email, tally)
  }

  return byEmail
}

function buildRow(student: Record<string, any>, tally: WinTally): Omit<LeaderboardRow, 'rank'> {
  return {
    email: keyOf(student.email),
    studentName: String(student.name || ''),
    // Stored as "3%A" for 3rd years and bare "A" for 1st — normalize to "A".
    section: normalizeSection(student.section) || '',
    department: String(student.department || ''),
    points: computePoints(tally),
    wins: tally.wins,
    competitionsCount: tally.wins,
    recentCompetition: tally.recentCompetition,
  }
}

/**
 * Rebuilds the whole `leaderboard` collection from `students` + `winners`.
 *
 * This is the expensive path — it reads every active student — so it is NOT on
 * the request path. Run it from the admin endpoint or the backfill script after
 * a bulk import or a change to `computePoints`.
 *
 * Only students with at least one win are written. Storing a row per student
 * would mean 1,087 documents that all rank equally at zero, which is precisely
 * the waste this change exists to remove.
 */
export async function recomputeLeaderboard(): Promise<{
  studentsScanned: number
  winnersScanned: number
  rowsWritten: number
  unmatchedWinners: string[]
}> {
  const db = getAdminDb()
  if (!db) throw new Error('Firestore Admin is not configured')

  const [studentsSnap, winnersSnap] = await Promise.all([
    db.collection(COLLECTIONS.students).where('year', 'in', ACTIVE_YEAR_LABELS as string[]).get(),
    db.collection(COLLECTIONS.winners).get(),
  ])

  const winnerDocs = winnersSnap.docs.map((d) => d.data() as Record<string, any>)
  const tallies = tallyWinners(winnerDocs)

  const studentsByEmail = new Map<string, Record<string, any>>()
  for (const doc of studentsSnap.docs) {
    const data = doc.data() as Record<string, any>
    const email = keyOf(data.email)
    if (email) studentsByEmail.set(email, data)
  }

  // A winner whose email matches no student cannot be ranked. Reported rather
  // than dropped silently — it usually means the win was recorded against a
  // personal address instead of the college one.
  const unmatchedWinners: string[] = []
  const batch = db.batch()
  let rowsWritten = 0

  for (const [email, tally] of tallies) {
    const student = studentsByEmail.get(email)
    if (!student) {
      unmatchedWinners.push(email)
      continue
    }
    batch.set(
      db.collection(COLLECTIONS.leaderboard).doc(email),
      { ...buildRow(student, tally), updated_at: new Date().toISOString() },
      { merge: true }
    )
    rowsWritten++
  }

  if (rowsWritten > 0) await batch.commit()

  return {
    studentsScanned: studentsSnap.size,
    winnersScanned: winnersSnap.size,
    rowsWritten,
    unmatchedWinners,
  }
}

/**
 * Recomputes one student's row from their own wins.
 *
 * Called when a win is recorded. Recomputing that student's totals from
 * scratch — rather than incrementing the stored values — keeps the row correct
 * under any scoring rule, including non-additive ones, and costs only the
 * handful of documents belonging to that student.
 */
export async function refreshStudentLeaderboard(email: string): Promise<boolean> {
  const db = getAdminDb()
  if (!db) return false

  const key = keyOf(email)
  if (!key) return false

  try {
    const [winnersSnap, studentSnap] = await Promise.all([
      db.collection(COLLECTIONS.winners).where('email', '==', key).get(),
      db.collection(COLLECTIONS.students).where('email', '==', key).limit(1).get(),
    ])

    if (studentSnap.empty) return false

    const tallies = tallyWinners(winnersSnap.docs.map((d) => d.data() as Record<string, any>))
    const tally = tallies.get(key)
    if (!tally) return false

    await db
      .collection(COLLECTIONS.leaderboard)
      .doc(key)
      .set(
        {
          ...buildRow(studentSnap.docs[0].data() as Record<string, any>, tally),
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )

    return true
  } catch (err) {
    // A leaderboard that lags is far better than a win that fails to record.
    console.error('Leaderboard refresh failed:', (err as Error).message)
    return false
  }
}

/**
 * Reads the top N rows.
 *
 * Ordered by a SINGLE field on purpose: Firestore creates single-field indexes
 * automatically, while ordering by `points` and then `wins` would need a
 * hand-created composite index and would fail at runtime until someone built
 * it. Ties are settled in memory across the handful of rows fetched.
 */
export async function readTopLeaderboard(limit = LEADERBOARD_LIMIT): Promise<LeaderboardRow[]> {
  const db = getAdminDb()
  if (!db) return []

  const capped = Math.min(Math.max(1, limit), LEADERBOARD_MAX)

  // Verify winners exist in DB
  const winnersSnap = await db.collection(COLLECTIONS.winners).get()
  if (winnersSnap.empty) return []

  const snap = await db
    .collection(COLLECTIONS.leaderboard)
    .orderBy('points', 'desc')
    .limit(capped)
    .get()

  const rows = snap.docs.map((d) => d.data() as Omit<LeaderboardRow, 'rank'>)

  rows.sort(
    (a, b) =>
      (b.points || 0) - (a.points || 0) ||
      (b.wins || 0) - (a.wins || 0) ||
      String(a.studentName).localeCompare(String(b.studentName))
  )

  return rows.map((row, i) => ({ ...row, rank: i + 1 }))
}

/**
 * Reads the top students by cumulative prize amount computed live from the winners collection.
 * This guarantees 100% real-time reflection of the database (returns [] when winners is empty).
 */
export async function readTopPrizeLeaderboard(limit = 25): Promise<PrizeLeaderboardRow[]> {
  const db = getAdminDb()
  if (!db) return []

  const capped = Math.min(Math.max(1, limit), 100)

  // Query live winners collection
  const winnersSnap = await db.collection(COLLECTIONS.winners).get()
  if (winnersSnap.empty) {
    return []
  }

  const winnerDocs = winnersSnap.docs.map((d) => d.data() as Record<string, any>)
  const tallies = tallyWinners(winnerDocs)
  if (tallies.size === 0) {
    return []
  }

  // Fetch student sections and details for these emails
  const emails = Array.from(tallies.keys())
  const studentsByEmail = new Map<string, Record<string, any>>()

  if (emails.length > 0) {
    try {
      // Chunk emails in batches of 30 for Firestore 'in' query limit
      for (let i = 0; i < emails.length; i += 30) {
        const chunk = emails.slice(i, i + 30)
        const snap = await db.collection(COLLECTIONS.students).where('email', 'in', chunk).get()
        for (const doc of snap.docs) {
          const data = doc.data()
          const email = keyOf(data.email)
          if (email) studentsByEmail.set(email, data)
        }
      }
    } catch {
      // Ignore student lookup error, fallback to winner doc fields
    }
  }

  const rows: Omit<PrizeLeaderboardRow, 'rank'>[] = []
  for (const [email, tally] of tallies) {
    const student = studentsByEmail.get(email)
    const winnerDoc = winnerDocs.find((w) => keyOf(w.email) === email)
    const studentName =
      student?.name || winnerDoc?.student_name || winnerDoc?.studentName || email.split('@')[0]
    const rawSection = student?.section || winnerDoc?.section || ''
    const section = normalizeSection(rawSection) || rawSection || ''

    rows.push({
      email,
      studentName: String(studentName),
      section,
      totalPrizeAmount: tally.totalPrize,
      competitionsWon: tally.wins,
      wins: tally.wins,
    })
  }

  rows.sort(
    (a, b) =>
      (b.totalPrizeAmount || 0) - (a.totalPrizeAmount || 0) ||
      (b.competitionsWon || 0) - (a.competitionsWon || 0) ||
      String(a.studentName).localeCompare(String(b.studentName))
  )

  return rows.slice(0, capped).map((row, i) => ({ ...row, rank: i + 1 }))
}

export interface PrizeLeaderboardRow {
  rank: number
  email: string
  studentName: string
  section: string
  totalPrizeAmount: number
  competitionsWon: number
  wins: number
}

export interface RecentWinnerRow {
  rank: number
  email: string
  studentName: string
  section: string
  competition: string
  prize: string
  date: string
}

/**
 * Reads the most recent winners directly from the winners collection.
 */
export async function readRecentWinners(limit = 25): Promise<RecentWinnerRow[]> {
  const db = getAdminDb()
  if (!db) return []

  const capped = Math.min(Math.max(1, limit), 100)

  const snap = await db.collection(COLLECTIONS.winners).get()
  if (snap.empty) return []

  const rawDocs: Record<string, any>[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // Fetch sections for emails
  const emails = Array.from(new Set(rawDocs.map((d) => keyOf(d.email)).filter(Boolean)))
  const sectionsByEmail = new Map<string, string>()

  if (emails.length > 0) {
    try {
      for (let i = 0; i < emails.length; i += 30) {
        const chunk = emails.slice(i, i + 30)
        const studentSnap = await db.collection(COLLECTIONS.students).where('email', 'in', chunk).get()
        for (const doc of studentSnap.docs) {
          const data = doc.data()
          const email = keyOf(data.email)
          if (email) sectionsByEmail.set(email, normalizeSection(data.section) || data.section || '')
        }
      }
    } catch {
      // ignore
    }
  }

  const rows = rawDocs.map((data) => {
    const email = keyOf(data.email)
    return {
      email,
      studentName: String(data.student_name || data.studentName || ''),
      section: sectionsByEmail.get(email) || data.section || '',
      competition: String(data.competition || ''),
      prize: String(data.prize || ''),
      date: String(data.date || ''),
    } as Omit<RecentWinnerRow, 'rank'>
  })

  // Sort descending by date
  rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  return rows.slice(0, capped).map((row, i) => ({ ...row, rank: i + 1 }))
}
