import { apiOk, apiError } from '@/lib/api-response'
import { isFirestoreConfigured } from '@/lib/firestore-data'
import { activeEligibleYears } from '@comp-dash/utils'
import {
  findCompetition,
  getSessionUserFromRequest,
  groupBySection,
  registrationsByEmail,
  studentsForYear,
  toRosterStudent,
} from '@/lib/roster-data'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * Department-wide section rollup for one competition — the HOD's view.
 *
 * Reports each section once, with its real cohort size. Two things this has to
 * get right, both of which produced wrong numbers before:
 *
 *  - Sections are keyed on the normalised label, so the bare and year-prefixed
 *    spellings of the same section collapse into one row instead of appearing
 *    twice.
 *  - Only the active cohorts are counted. A 1st-year "A" and a 3rd-year "3%A"
 *    both normalise to "A", so counting every year together reported 127
 *    students in a section that holds 65.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUserFromRequest(request)
  // Authenticated before the existence check: a 404 here would tell an
  // anonymous caller which competition ids are real.
  if (!session?.email) return apiError('UNAUTHENTICATED', 'Not signed in', 401)

  if (!isFirestoreConfigured()) {
    return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)
  }

  const competition = await findCompetition(params.id)
  if (!competition) {
    return apiError('NOT_FOUND', `No competition with id ${params.id}`, 404)
  }

  const { yearLabels, excludesAllActive } = activeEligibleYears(competition.eligibleYear)

  // Distinguishes "no cohort we hold data for may enter" from "nobody has
  // signed up yet" — the two look identical in an empty section list.
  if (excludesAllActive) {
    return apiOk({
      competitionId: competition.id,
      competitionName: competition.name,
      eligibleYears: yearLabels,
      notEligible: true,
      sections: [],
      totals: { totalStudents: 0, registeredCount: 0 },
    })
  }

  const registrations = await registrationsByEmail(competition.id)

  const studentDocs = (await Promise.all(yearLabels.map((y) => studentsForYear(y)))).flat()
  const students = studentDocs.map((s) =>
    toRosterStudent(s, registrations.get(String(s.email ?? '').trim().toLowerCase()))
  )

  const sections = groupBySection(students).map((g) => {
    // Every student holding a row for this competition counts as registered
    // here, rejections included: this view reports turnout, not approvals.
    const registered = g.students.filter((s) => s.status !== 'not_registered')
    return {
      section: g.section,
      totalCount: g.students.length,
      registeredCount: registered.length,
      verifiedCount: g.students.filter((s) => s.status === 'verified').length,
      registered,
    }
  })

  return apiOk({
    competitionId: competition.id,
    competitionName: competition.name,
    eligibleYears: yearLabels,
    sections,
    totals: {
      totalStudents: students.length,
      registeredCount: sections.reduce((n, s) => n + s.registeredCount, 0),
    },
  })
}
