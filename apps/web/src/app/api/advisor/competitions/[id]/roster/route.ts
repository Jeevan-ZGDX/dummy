import { apiOk, apiError } from '@/lib/api-response'
import { isFirestoreConfigured, fetchAdvisors } from '@/lib/firestore-data'
import { parseEligibleYears, yearNumberToLabel } from '@comp-dash/utils'
import {
  findCompetition,
  getSessionUserFromRequest,
  groupBySection,
  isRegistered,
  registrationsByEmail,
  studentsForSections,
  toRosterStudent,
} from '@/lib/roster-data'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** The cohort the roster shows unless `?year=` asks for another. */
const DEFAULT_YEAR_NUMBER = 3

/**
 * The signed-in advisor's students for one competition, grouped by section.
 *
 * Answers "who in my sections has signed up, and where did they get to" — the
 * advisor's working view. The section join is the delicate part: advisors hold
 * bare labels ("A") while students store a year-prefixed one ("3%A"), and
 * comparing them directly is what previously returned an empty roster.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUserFromRequest(request)
  if (!session?.email) return apiError('UNAUTHENTICATED', 'Not signed in', 401)

  if (!isFirestoreConfigured()) {
    return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)
  }

  const competition = await findCompetition(params.id)
  if (!competition) {
    return apiError('NOT_FOUND', `No competition with id ${params.id}`, 404)
  }

  // Firestore has no case-insensitive predicate, so the advisors collection —
  // a few dozen documents — is matched in memory.
  const email = session.email.trim().toLowerCase()
  const advisors = await fetchAdvisors()
  const advisor = advisors.find((a: any) => String(a.email ?? '').trim().toLowerCase() === email)

  if (!advisor) {
    // Naming the account matters: this used to fail silently and look like the
    // roster was simply empty.
    return apiError(
      'ADVISOR_NOT_MAPPED',
      'This account is not mapped to an advisor record.',
      404,
      { detail: `No advisors row for ${session.email}` }
    )
  }

  // fetchAdvisors() camel-cases the stored `assigned_sections`.
  const assignedSections: string[] = [...(advisor.assignedSections ?? [])]
  const sortedSections = assignedSections.slice().sort((a, b) => a.localeCompare(b))

  const requestedYear = Number(new URL(request.url).searchParams.get('year')) || DEFAULT_YEAR_NUMBER
  const yearScope = yearNumberToLabel(requestedYear)

  const parsed = parseEligibleYears(competition.eligibleYear)
  const eligibleYears = parsed.yearLabels
  // A competition with no year signal at all is open to everyone.
  const admitsYear = parsed.openToAllYears || parsed.yearNumbers.includes(requestedYear)

  const advisorRef = {
    id: String(advisor.id ?? ''),
    name: String(advisor.name ?? ''),
    email: String(advisor.email ?? ''),
    assignedSections: sortedSections,
  }

  // Answered as "this cohort cannot enter" rather than as an empty roster,
  // which would be indistinguishable from nobody having signed up.
  if (!admitsYear) {
    return apiOk({
      advisor: advisorRef,
      yearScope,
      eligibleYears,
      notEligible: true,
      sections: [],
      totals: { totalStudents: 0, registeredCount: 0, verifiedCount: 0, notRegisteredCount: 0 },
    })
  }

  const [studentDocs, registrations] = await Promise.all([
    studentsForSections(assignedSections, yearScope),
    registrationsByEmail(competition.id),
  ])

  const students = studentDocs.map((s) =>
    toRosterStudent(s, registrations.get(String(s.email ?? '').trim().toLowerCase()))
  )

  const sections = groupBySection(students).map((g) => ({
    section: g.section,
    totalCount: g.students.length,
    registeredCount: g.students.filter(isRegistered).length,
    students: g.students,
  }))

  const registeredCount = students.filter(isRegistered).length

  return apiOk({
    advisor: advisorRef,
    yearScope,
    eligibleYears,
    sections,
    totals: {
      totalStudents: students.length,
      registeredCount,
      verifiedCount: students.filter((s) => s.status === 'verified').length,
      // A rejected registration is not a signup, so it counts here.
      notRegisteredCount: students.length - registeredCount,
    },
  })
}
