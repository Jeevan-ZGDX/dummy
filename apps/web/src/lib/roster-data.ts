import { getAdminDb } from '@/lib/firebase/admin'
import { COLLECTIONS } from '@/lib/firebase/config'
import { SESSION_COOKIE, verifyIdToken, type SessionUser } from '@/lib/firebase/session'
import { normalizeSection, storedSectionVariants } from '@comp-dash/utils'

/**
 * Shared reads behind the advisor roster and the HOD section grid.
 *
 * Both answer the same question from different angles — "who, in which section,
 * has registered for this competition" — so the section normalisation and the
 * registration join live here rather than being written twice and drifting.
 */

/** How a single student appears in either view. */
export interface RosterStudent {
  id: string
  name: string
  email: string
  /** Always the bare label ("A"), never the stored "3%A". */
  section: string
  year: string
  status: 'not_registered' | 'registered' | 'verified' | 'rejected'
  verificationStatus: string | null
  verifiedAt: string | null
}

export interface CompetitionRef {
  id: string
  name: string
  eligibleYear: string | null
}

/**
 * Session identity from the request's own cookie header.
 *
 * The browser-side helper cannot run here, and reading the raw header rather
 * than `cookies()` keeps this working off the plain `Request` a route handler
 * receives.
 */
export async function getSessionUserFromRequest(request: Request): Promise<SessionUser | null> {
  const header = request.headers.get('cookie') ?? ''
  const entry = header.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  if (!entry) return null
  const token = decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1))
  return verifyIdToken(token)
}

/** Looks a competition up in the dashboard collection. Null when absent. */
export async function findCompetition(id: string): Promise<CompetitionRef | null> {
  const db = getAdminDb()
  if (!db) return null
  const doc = await db.collection(COLLECTIONS.competitionDashboard).doc(id).get()
  if (!doc.exists) return null
  const data = doc.data() ?? {}
  return {
    id: doc.id,
    name: String(data.competition_name ?? ''),
    eligibleYear: (data.eligible_year ?? null) as string | null,
  }
}

/**
 * Every registration for one competition, keyed by lowercased student email.
 *
 * Keyed on the competition rather than on student emails: one indexed query
 * replaces the chunked 30-at-a-time `in` scans the summary endpoint has to do,
 * and a competition's registrations are always the smaller set.
 */
export async function registrationsByEmail(
  competitionId: string
): Promise<Map<string, Record<string, any>>> {
  const db = getAdminDb()
  const out = new Map<string, Record<string, any>>()
  if (!db) return out

  const snap = await db
    .collection(COLLECTIONS.studentCompetitions)
    .where('competition_id', '==', competitionId)
    .get()

  for (const doc of snap.docs) {
    const data = doc.data()
    const key = String(data.student_email ?? '').trim().toLowerCase()
    if (key) out.set(key, data)
  }
  return out
}

/** Students of one year cohort. Used where every section is needed. */
export async function studentsForYear(yearLabel: string): Promise<Record<string, any>[]> {
  const db = getAdminDb()
  if (!db) return []
  const snap = await db.collection(COLLECTIONS.students).where('year', '==', yearLabel).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Students in specific sections of one year.
 *
 * Filters on `section` rather than `year` because a handful of sections is far
 * smaller than a whole cohort — an advisor's 65 students instead of 1,086 —
 * which is both faster and a fraction of the read cost. `in` caps at 30 values,
 * so the variant list is chunked.
 */
export async function studentsForSections(
  bareSections: string[],
  yearLabel: string
): Promise<Record<string, any>[]> {
  const db = getAdminDb()
  if (!db || !bareSections.length) return []

  const variants = [...new Set(bareSections.flatMap((s) => storedSectionVariants(s)))]
  const rows: Record<string, any>[] = []

  for (let i = 0; i < variants.length; i += 30) {
    const snap = await db
      .collection(COLLECTIONS.students)
      .where('section', 'in', variants.slice(i, i + 30))
      .get()
    rows.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  // The year has to be applied in memory: a bare "A" is shared by 1st and 3rd
  // year, so the section filter alone would merge two cohorts into one list.
  return rows.filter((s) => String(s.year ?? '') === yearLabel)
}

/** Joins a student document to its registration, if any. */
export function toRosterStudent(
  student: Record<string, any>,
  reg: Record<string, any> | undefined
): RosterStudent {
  const verification = reg ? String(reg.verification_status ?? 'pending') : null

  let status: RosterStudent['status'] = 'not_registered'
  if (verification === 'verified') status = 'verified'
  else if (verification === 'rejected') status = 'rejected'
  else if (verification) status = 'registered'

  return {
    id: String(student.id ?? ''),
    name: String(student.name ?? ''),
    email: String(student.email ?? ''),
    section: normalizeSection(String(student.section ?? '')),
    year: String(student.year ?? ''),
    status,
    verificationStatus: verification,
    verifiedAt: reg?.verified_at ?? null,
  }
}

/** Groups roster students under their bare section label, sorted by name. */
export function groupBySection(students: RosterStudent[]) {
  const groups = new Map<string, RosterStudent[]>()
  for (const s of students) {
    const label = s.section || 'Unassigned'
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(s)
  }
  return [...groups.entries()]
    .map(([section, list]) => ({
      section,
      students: list.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.section.localeCompare(b.section))
}

/** "Registered" means signed up — pending or verified, never rejected. */
export const isRegistered = (s: RosterStudent) => s.status === 'registered' || s.status === 'verified'
