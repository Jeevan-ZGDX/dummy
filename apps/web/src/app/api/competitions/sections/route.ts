import { apiOk, apiError } from '@/lib/api-response'
import { getAdminDb } from '@/lib/firebase/admin'
import { COLLECTIONS } from '@/lib/firebase/config'
import { normalizeSection, yearNumberToLabel } from '@comp-dash/utils'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export interface StudentSectionRegistration {
  id: string
  name: string
  email: string
  department: string
  section: string
  competitionId?: string
  competitionName?: string
  verificationStatus?: string
  registeredAt?: string
}

export interface SectionBreakdownItem {
  section: string
  totalCount: number
  registeredCount: number
  verifiedCount: number
  coveragePercentage: number
  registeredStudents: StudentSectionRegistration[]
}

export interface HodYearSectionsResponse {
  yearNumber: number
  yearLabel: string
  competitionId: string
  competitionTitle?: string
  totalStudents: number
  totalRegisteredStudents: number
  totalVerifiedCount: number
  overallCoveragePercentage: number
  availableCompetitions: Array<{ id: string; title: string }>
  sections: SectionBreakdownItem[]
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawYear = url.searchParams.get('year') || '3'
  const competitionId = url.searchParams.get('competitionId') || 'all'

  let yearNumber = 3
  if (rawYear.includes('2') || rawYear.toLowerCase().includes('2nd')) {
    yearNumber = 2
  } else if (rawYear.includes('3') || rawYear.toLowerCase().includes('3rd')) {
    yearNumber = 3
  }

  const targetYearLabel = yearNumberToLabel(yearNumber) // e.g. "2nd Year" or "3rd Year"

  const db = getAdminDb()
  if (!db) return apiError('NOT_CONFIGURED', 'Firestore not configured', 500)

  // 1. Fetch all available competitions for the dropdown filter.
  // Sorted in memory: Firestore's orderBy silently EXCLUDES documents missing
  // the sort field, which would drop competitions with no serial_no.
  const compSnap = await db.collection(COLLECTIONS.competitionDashboard).get()
  const availableCompetitions = compSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
    .sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0))
    .map((c) => ({
      id: c.id,
      title: c.competition_name || 'Untitled Competition',
    }))

  let selectedCompTitle: string | undefined = undefined
  if (competitionId !== 'all') {
    const matched = availableCompetitions.find((c) => c.id === competitionId)
    selectedCompTitle = matched?.title
  }

  // 2. Fetch students belonging to the chosen academic year.
  // Firestore has no `ilike` and no OR across fields, so the original
  // `year.ilike.%N% OR year.eq.<label>` is applied in memory after one read.
  // That keeps the same tolerance for stored variants ("3", "3rd Year", "III").
  const studentSnap = await db.collection(COLLECTIONS.students).get()
  const students = studentSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
    .filter((row) => {
      const year = String(row.year ?? '')
      return year.includes(String(yearNumber)) || year === targetYearLabel
    })

  // 3. Fetch registrations from student_competitions
  const regCollection = db.collection(COLLECTIONS.studentCompetitions)
  const regSnap = await (competitionId !== 'all'
    ? regCollection.where('competition_id', '==', competitionId).get()
    : regCollection.get())

  const registrations = regSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Record<string, any>
  )

  // Build a lookup map of registrations grouped by student email
  const regsByEmail = new Map<string, any[]>()
  for (const reg of registrations) {
    const email = String(reg.student_email ?? '').trim().toLowerCase()
    if (!email) continue
    if (!regsByEmail.has(email)) {
      regsByEmail.set(email, [])
    }
    regsByEmail.get(email)!.push(reg)
  }

  // 4. Group students by normalized section ('A', 'B', 'C', etc.)
  const sectionMap = new Map<
    string,
    {
      total: number
      registeredCount: number
      verifiedCount: number
      students: StudentSectionRegistration[]
    }
  >()

  const uniqueRegisteredStudentEmails = new Set<string>()
  let totalVerified = 0

  for (const s of students) {
    const section = normalizeSection(s.section) || 'Unassigned'
    if (!sectionMap.has(section)) {
      sectionMap.set(section, {
        total: 0,
        registeredCount: 0,
        verifiedCount: 0,
        students: [],
      })
    }

    const sectionEntry = sectionMap.get(section)!
    sectionEntry.total++

    const email = String(s.email ?? '').trim().toLowerCase()
    const studentRegs = regsByEmail.get(email)

    if (studentRegs && studentRegs.length > 0) {
      sectionEntry.registeredCount++
      uniqueRegisteredStudentEmails.add(email)

      const isVerified = studentRegs.some(
        (r) => r.verification_status === 'verified' || r.verification_status === 'completed'
      )
      if (isVerified) {
        sectionEntry.verifiedCount++
        totalVerified++
      }

      for (const reg of studentRegs) {
        sectionEntry.students.push({
          id: s.id,
          name: s.name,
          email: s.email,
          department: s.department || 'CSE',
          section,
          competitionId: reg.competition_id,
          competitionName: reg.competition_name,
          verificationStatus: reg.verification_status || 'pending',
          registeredAt: reg.created_at,
        })
      }
    }
  }

  const sections: SectionBreakdownItem[] = Array.from(sectionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([section, data]) => {
      const coveragePercentage = data.total > 0 ? Math.round((data.registeredCount / data.total) * 100) : 0
      return {
        section,
        totalCount: data.total,
        registeredCount: data.registeredCount,
        verifiedCount: data.verifiedCount,
        coveragePercentage,
        registeredStudents: data.students,
      }
    })

  const totalStudents = students.length
  const totalRegisteredStudents = uniqueRegisteredStudentEmails.size
  const overallCoveragePercentage =
    totalStudents > 0 ? Math.round((totalRegisteredStudents / totalStudents) * 100) : 0

  const payload: HodYearSectionsResponse = {
    yearNumber,
    yearLabel: targetYearLabel,
    competitionId,
    competitionTitle: selectedCompTitle,
    totalStudents,
    totalRegisteredStudents,
    totalVerifiedCount: totalVerified,
    overallCoveragePercentage,
    availableCompetitions,
    sections,
  }

  return apiOk(payload)
}
