import { apiOk, apiError } from '@/lib/api-response'
import {
  isFirestoreConfigured,
  fetchAdvisors,
  getDocById,
  queryByField,
} from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'
import { SESSION_COOKIE, verifyIdToken } from '@/lib/firebase/session'
import {
  normalizeSection,
  storedSectionVariants,
  parseEligibleYears,
  yearNumberToLabel,
} from '@comp-dash/utils'
import type {
  AdvisorCompetitionRosterResponse,
  AdvisorSectionRoster,
  AdvisorStudentRow,
  AdvisorStudentStatus,
} from '@comp-dash/types'

export const dynamic = 'force-dynamic'
// `dynamic` only controls route rendering. The Firestore reads below go through
// the Admin SDK rather than `fetch`, but the route must still opt out of Next's
// fetch cache so nothing upstream replays a stale first result.
export const fetchCache = 'force-no-store'

/**
 * Which academic year this roster covers. Scoped to 3rd year for now; the
 * section prefix convention ("3%A") and the advisors table both only cover it.
 * Overridable per-request with ?year=3 so widening later needs no code change.
 */
const DEFAULT_YEAR_NUMBER = 3

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

function mapStatus(verificationStatus: string | null | undefined): AdvisorStudentStatus {
  if (!verificationStatus) return 'not_registered'
  const s = verificationStatus.trim().toLowerCase()
  if (s === 'verified') return 'verified'
  if (s === 'rejected') return 'rejected'
  return 'registered'
}

/**
 * The advisor's own roster for one competition: every student in the sections
 * they are assigned, with each student's registration status.
 *
 * The advisor is resolved from the signed-in session, never from a query
 * param — otherwise any caller could read another advisor's roster.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const competitionId = params.id
  if (!competitionId) {
    return apiError('BAD_REQUEST', 'Missing competition id', 400)
  }

  const email = await getSessionEmail(request)
  if (!email) {
    return apiError('UNAUTHENTICATED', 'Not authenticated', 401)
  }

  if (!isFirestoreConfigured()) {
    return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)
  }

  // ── Advisor row (identity → assigned sections) ──────────────────────────
  // Firestore has no case-insensitive predicate to replace `ilike`, so the
  // advisors collection — a few dozen documents — is matched in memory.
  const advisors = await fetchAdvisors()
  const advisor = advisors.find((a) => String(a.email ?? '').trim().toLowerCase() === email)

  if (!advisor) {
    return apiError(
      'ADVISOR_NOT_MAPPED',
      'No advisor record is mapped to this account',
      404,
      { detail: `No document in advisors has email ${email}.` }
    )
  }

  // advisors.assigned_sections stores bare labels ("A"), students.section stores
  // them year-prefixed ("3%A"). Comparing them directly matches nothing.
  const assignedSections: string[] = ((advisor.assignedSections ?? []) as string[])
    .map((s) => normalizeSection(s))
    .filter((s): s is string => Boolean(s))
    .sort((a, b) => a.localeCompare(b))

  // ── Competition + eligibility ───────────────────────────────────────────
  const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)
  if (!competition) {
    return apiError('NOT_FOUND', 'Competition not found', 404)
  }

  const eligible = parseEligibleYears(competition.eligible_year)
  const yearNumber = Number(new URL(request.url).searchParams.get('year')) || DEFAULT_YEAR_NUMBER
  const yearScope = yearNumberToLabel(yearNumber)

  const base = {
    competitionId,
    competitionName: competition.competition_name ?? '',
    eligibleYears: eligible.yearLabels,
    openToAllYears: eligible.openToAllYears,
    advisor: {
      id: advisor.id,
      name: advisor.name,
      email: advisor.email,
      department: advisor.department ?? 'CSE',
      assignedSections,
    },
    yearScope,
  }

  // An advisor with no sections has no roster — report it rather than
  // returning an empty list that looks like "nobody registered".
  if (assignedSections.length === 0) {
    const empty: AdvisorCompetitionRosterResponse = {
      ...base,
      totals: { totalStudents: 0, registeredCount: 0, verifiedCount: 0, notRegisteredCount: 0 },
      sections: [],
    }
    return apiOk(empty)
  }

  // Competition not open to this year: say so explicitly.
  if (!eligible.openToAllYears && !eligible.yearNumbers.includes(yearNumber)) {
    const notEligible: AdvisorCompetitionRosterResponse = {
      ...base,
      totals: { totalStudents: 0, registeredCount: 0, verifiedCount: 0, notRegisteredCount: 0 },
      sections: [],
      notEligible: true,
    }
    return apiOk(notEligible)
  }

  // ── Students in the advisor's sections ──────────────────────────────────
  // Both spellings are accepted, then filtered by year — normalizing alone would
  // pull 1st-year "A" in alongside 3rd-year "3%A". The year is the indexed
  // filter and the section list is applied in memory, since the old `.in()` has
  // no Firestore equivalent for a list this size.
  const sectionVariants = new Set(assignedSections.flatMap((s) => storedSectionVariants(s)))

  const students = (await queryByField(COLLECTIONS.students, 'year', yearScope))
    .filter((s) => sectionVariants.has(String(s.section ?? '')))
    // Sorted here rather than with `orderBy`, which drops documents that have no
    // `name` field at all.
    .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))

  // ── Registration status for this competition ────────────────────────────
  const registrations = await queryByField(
    COLLECTIONS.studentCompetitions,
    'competition_id',
    competitionId
  )

  const regByEmail = new Map<string, Record<string, any>>()
  for (const reg of registrations) {
    const key = String(reg.student_email ?? '').trim().toLowerCase()
    if (!key) continue
    // Keep the most advanced record if a student somehow has duplicates.
    const existing = regByEmail.get(key)
    if (!existing || (!existing.verified_at && reg.verified_at)) regByEmail.set(key, reg)
  }

  // ── Group into sections ─────────────────────────────────────────────────
  const bySection = new Map<string, AdvisorStudentRow[]>()
  for (const section of assignedSections) bySection.set(section, [])

  for (const student of students) {
    const section = normalizeSection(student.section)
    const bucket = bySection.get(section)
    if (!bucket) continue // section outside this advisor's assignment

    const reg = regByEmail.get(String(student.email ?? '').trim().toLowerCase())
    bucket.push({
      id: student.id,
      name: student.name,
      email: student.email,
      section,
      year: student.year ?? yearScope,
      department: student.department ?? 'CSE',
      status: mapStatus(reg?.verification_status),
      verificationStatus: reg?.verification_status ?? null,
      registeredAt: reg?.created_at ?? null,
      verifiedAt: reg?.verified_at ?? null,
    })
  }

  const sections: AdvisorSectionRoster[] = assignedSections.map((section) => {
    const rows = bySection.get(section) ?? []
    const verifiedCount = rows.filter((r) => r.status === 'verified').length
    const registeredCount = rows.filter(
      (r) => r.status === 'registered' || r.status === 'verified'
    ).length
    return {
      section,
      totalCount: rows.length,
      registeredCount,
      verifiedCount,
      notRegisteredCount: rows.length - registeredCount,
      students: rows,
    }
  })

  const response: AdvisorCompetitionRosterResponse = {
    ...base,
    totals: {
      totalStudents: sections.reduce((n, s) => n + s.totalCount, 0),
      registeredCount: sections.reduce((n, s) => n + s.registeredCount, 0),
      verifiedCount: sections.reduce((n, s) => n + s.verifiedCount, 0),
      notRegisteredCount: sections.reduce((n, s) => n + s.notRegisteredCount, 0),
    },
    sections,
  }

  return apiOk(response)
}
