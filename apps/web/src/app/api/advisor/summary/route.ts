import { apiOk, apiError } from '@/lib/api-response'
import {
  isFirestoreConfigured,
  fetchAdvisors,
  fetchCompetitionDashboard,
  queryByField,
} from '@/lib/firestore-data'
import { getAdminDb } from '@/lib/firebase/admin'
import { COLLECTIONS } from '@/lib/firebase/config'
import { SESSION_COOKIE, verifyIdToken } from '@/lib/firebase/session'
import { normalizeSection, storedSectionVariants, yearNumberToLabel } from '@comp-dash/utils'
import type { AdvisorRecentRegistration, AdvisorSummaryResponse } from '@comp-dash/types'

export const dynamic = 'force-dynamic'
// `dynamic` only controls route rendering. The Firestore reads below go through
// the Admin SDK rather than `fetch`, but the route must still opt out of Next's
// fetch cache so nothing upstream replays a stale first result.
export const fetchCache = 'force-no-store'

const DEFAULT_YEAR_NUMBER = 3
/** How many recent registrations to return for the activity table. */
const RECENT_LIMIT = 20
/** Firestore caps an `in` filter at 30 values per query. */
const IN_CHUNK = 30

/**
 * Session identity for a route handler.
 *
 * `@/lib/auth`'s `getSessionUser` runs against the browser Firebase SDK, so a
 * route handler has to verify the session cookie the middleware maintains
 * itself. Reading the raw header rather than `cookies()` keeps this working off
 * the plain `Request` the handler receives.
 */
async function getSessionEmail(request: Request): Promise<string | null> {
  const header = request.headers.get('cookie') ?? ''
  const entry = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  if (!entry) return null
  const token = decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1))
  const user = await verifyIdToken(token)
  return user?.email?.trim().toLowerCase() || null
}

/**
 * Dashboard summary for the signed-in advisor, across every competition.
 *
 * Reads `student_competitions` — the collection the app actually writes
 * registrations to. The older `/advisor/dashboard/stats` handler counted the
 * legacy `registrations` collection, which is empty, so the dashboard rendered
 * zeroes even when an advisor's students had registered.
 */
export async function GET(request: Request) {
  const email = await getSessionEmail(request)
  if (!email) return apiError('UNAUTHENTICATED', 'Not authenticated', 401)

  if (!isFirestoreConfigured()) {
    return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)
  }

  // Firestore has no case-insensitive predicate to replace `ilike`, so the
  // advisors collection — a few dozen documents — is matched in memory.
  const advisors = await fetchAdvisors()
  const advisor = advisors.find((a) => String(a.email ?? '').trim().toLowerCase() === email)
  if (!advisor) {
    return apiError('ADVISOR_NOT_MAPPED', 'No advisor record is mapped to this account', 404, {
      detail: `No document in advisors has email ${email}.`,
    })
  }

  const assignedSections: string[] = ((advisor.assignedSections ?? []) as string[])
    .map((s) => normalizeSection(s))
    .filter((s): s is string => Boolean(s))
    .sort((a, b) => a.localeCompare(b))

  const yearNumber = Number(new URL(request.url).searchParams.get('year')) || DEFAULT_YEAR_NUMBER
  const yearScope = yearNumberToLabel(yearNumber)

  const base = {
    advisor: {
      id: advisor.id,
      name: advisor.name,
      email: advisor.email,
      department: advisor.department ?? 'CSE',
      assignedSections,
    },
    yearScope,
  }

  if (assignedSections.length === 0) {
    return apiOk<AdvisorSummaryResponse>({
      ...base,
      totals: {
        totalStudents: 0,
        registeredStudents: 0,
        verifiedRegistrations: 0,
        pendingRegistrations: 0,
        rejectedRegistrations: 0,
        totalRegistrations: 0,
        competitionsEntered: 0,
      },
      sections: [],
      recentRegistrations: [],
    })
  }

  // The year is the indexed filter and the section list is applied in memory:
  // the old `.in('section', …)` has no Firestore equivalent for a list this
  // size, and the year cohort is the smaller of the two slices anyway.
  const sectionVariants = new Set(assignedSections.flatMap((s) => storedSectionVariants(s)))
  const students = (await queryByField(COLLECTIONS.students, 'year', yearScope)).filter((s) =>
    sectionVariants.has(String(s.section ?? ''))
  )

  const byEmail = new Map(
    students.map((s) => [String(s.email ?? '').trim().toLowerCase(), s])
  )

  // One pass over this advisor's students' registrations, across all competitions.
  const emails = [...byEmail.keys()]
  const registrations: Array<Record<string, any>> = []

  // Chunked, as the Supabase version was, but at Firestore's much smaller `in`
  // limit. Raw Admin access because the shared helpers only expose single-value
  // equality, and one query per student would be hundreds of round trips.
  const db = getAdminDb()
  if (!db) return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)
  try {
    for (let i = 0; i < emails.length; i += IN_CHUNK) {
      const snapshot = await db
        .collection(COLLECTIONS.studentCompetitions)
        .where('student_email', 'in', emails.slice(i, i + IN_CHUNK))
        .get()
      registrations.push(...snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    }
  } catch (err) {
    return apiError('DB_ERROR', (err as Error).message, 500)
  }

  const competitionIds = new Set<string>()
  const registeredStudentEmails = new Set<string>()
  let verified = 0
  let pending = 0
  let rejected = 0

  for (const reg of registrations) {
    const key = String(reg.student_email ?? '').trim().toLowerCase()
    if (!byEmail.has(key)) continue
    registeredStudentEmails.add(key)
    if (reg.competition_id) competitionIds.add(reg.competition_id)
    const status = (reg.verification_status ?? '').toLowerCase()
    if (status === 'verified') verified++
    else if (status === 'rejected') rejected++
    else pending++
  }

  // Per-section rollup.
  const sectionBuckets = new Map<string, { total: number; registered: Set<string>; verified: number }>()
  for (const section of assignedSections) {
    sectionBuckets.set(section, { total: 0, registered: new Set(), verified: 0 })
  }
  for (const student of students) {
    const bucket = sectionBuckets.get(normalizeSection(student.section))
    if (bucket) bucket.total++
  }
  for (const reg of registrations) {
    const key = String(reg.student_email ?? '').trim().toLowerCase()
    const student = byEmail.get(key)
    if (!student) continue
    const bucket = sectionBuckets.get(normalizeSection(student.section))
    if (!bucket) continue
    bucket.registered.add(key)
    if ((reg.verification_status ?? '').toLowerCase() === 'verified') bucket.verified++
  }

  // Competition names for the activity table. Firestore cannot join, so the
  // dashboard collection is read once and indexed by id in memory.
  const nameById = new Map<string, string>()
  if (competitionIds.size) {
    for (const c of await fetchCompetitionDashboard()) {
      if (competitionIds.has(c.id)) nameById.set(c.id, c.competitionName ?? c.id)
    }
  }

  const recentRegistrations = registrations
    .filter((r) => byEmail.has(String(r.student_email ?? '').trim().toLowerCase()))
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, RECENT_LIMIT)
    .map((r) => {
      const student = byEmail.get(String(r.student_email ?? '').trim().toLowerCase())!
      const raw = (r.verification_status ?? '').toLowerCase()
      const status: AdvisorRecentRegistration['status'] =
        raw === 'verified' ? 'verified' : raw === 'rejected' ? 'rejected' : 'pending'
      return {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        section: normalizeSection(student.section),
        competitionId: r.competition_id ?? '',
        competitionName: r.competition_id ? nameById.get(r.competition_id) ?? r.competition_id : '',
        status,
        registeredAt: r.created_at ?? null,
        verifiedAt: r.verified_at ?? null,
      }
    })

  return apiOk<AdvisorSummaryResponse>({
    ...base,
    totals: {
      totalStudents: students.length,
      registeredStudents: registeredStudentEmails.size,
      verifiedRegistrations: verified,
      pendingRegistrations: pending,
      rejectedRegistrations: rejected,
      totalRegistrations: registrations.length,
      competitionsEntered: competitionIds.size,
    },
    sections: assignedSections.map((section) => {
      const b = sectionBuckets.get(section)!
      return {
        section,
        totalCount: b.total,
        registeredCount: b.registered.size,
        verifiedCount: b.verified,
        notRegisteredCount: b.total - b.registered.size,
      }
    }),
    recentRegistrations,
  })
}
