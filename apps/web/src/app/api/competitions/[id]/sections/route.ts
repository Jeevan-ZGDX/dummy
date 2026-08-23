import { apiOk, apiError } from '@/lib/api-response'
import { getDocById, queryByField, isFirestoreConfigured } from '@/lib/firestore-data'
import { getAdminDb } from '@/lib/firebase/admin'
import { COLLECTIONS } from '@/lib/firebase/config'
import { activeEligibleYears, normalizeSection } from '@comp-dash/utils'
import type { CompetitionSectionsResponse } from '@comp-dash/types'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * Section-wise registration breakdown for one competition, supporting Year filtering.
 *
 * Registration status is joined through `student_competitions.student_email`
 * → `students.email`; `student_competitions` has no section column of its own.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const competitionId = params.id
  if (!competitionId) {
    return apiError('BAD_REQUEST', 'Missing competition id', 400)
  }

  const url = new URL(request.url)
  const rawYear = url.searchParams.get('year') || 'all'

  if (!isFirestoreConfigured()) {
    return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)
  }

  const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)
  if (!competition) {
    return apiError('NOT_FOUND', 'Competition not found', 404)
  }

  // An explicit ?year= overrides the competition's own eligibility; "all" falls
  // back to whatever the competition declares.
  let targetYears: string[] = []

  if (rawYear === '2' || rawYear.includes('2nd') || rawYear.includes('Second')) {
    targetYears = ['2nd Year']
  } else if (rawYear === '3' || rawYear.includes('3rd') || rawYear.includes('Third')) {
    targetYears = ['3rd Year']
  } else {
    // eligible_year holds Roman numerals ("I, II, III, IV") plus free text
    // ("StartUp", "Startups, MSME") — it is never a students.year label, so it
    // has to be translated before it can filter students.
    //
    // Then intersect with the cohorts we actually report on. Without that, a
    // competition open to "I, II, III, IV" pulled in both stored section
    // conventions — bare 1st-year "A" and prefixed 3rd-year "3%A" both normalize
    // to "A" — so every section double-counted (A showed 127 instead of 65).
    const eligible = activeEligibleYears(competition.eligible_year)

    if (eligible.excludesAllActive) {
      return apiOk<CompetitionSectionsResponse>({
        competitionId,
        eligibleYears: [],
        sections: [],
        notEligible: true,
      })
    }

    targetYears =
      eligible.yearLabels.length > 0 ? eligible.yearLabels : ['2nd Year', '3rd Year']
  }

  const db = getAdminDb()
  if (!db) return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)

  // `in` caps at 30 values and would need an index; the year set is tiny, so
  // filtering after a single read is both simpler and cheaper here. No paging
  // is needed either — the Admin SDK streams the whole collection, unlike
  // PostgREST's 1,000-row cap.
  const yearSet = new Set(targetYears)
  const studentSnap = await db.collection(COLLECTIONS.students).get()
  const studentRows = studentSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
    .filter((row) => yearSet.has(row.year))

  const registrationRows = await queryByField(
    COLLECTIONS.studentCompetitions,
    'competition_id',
    competitionId
  )

  const statusByEmail = new Map<string, string>()
  for (const reg of registrationRows) {
    const email = String(reg.student_email ?? '').trim().toLowerCase()
    if (email) statusByEmail.set(email, reg.verification_status ?? 'pending')
  }

  const sectionMap = new Map<
    string,
    { total: number; registered: number; details: CompetitionSectionsResponse['sections'][number]['registered'] }
  >()

  for (const student of studentRows) {
    const section = normalizeSection(student.section) || 'Unassigned'
    let entry = sectionMap.get(section)
    if (!entry) {
      entry = { total: 0, registered: 0, details: [] }
      sectionMap.set(section, entry)
    }
    entry.total++

    const status = statusByEmail.get(String(student.email ?? '').trim().toLowerCase())
    if (status) {
      entry.registered++
      entry.details!.push({
        id: student.id,
        name: student.name,
        email: student.email,
        department: student.department,
        section,
      })
    }
  }

  const response: CompetitionSectionsResponse = {
    competitionId,
    eligibleYears: targetYears,
    sections: Array.from(sectionMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([section, { total, registered, details }]) => ({
        section,
        totalCount: total,
        registeredCount: registered,
        registered: registered > 0 ? details : null,
      })),
  }

  return apiOk(response)
}
