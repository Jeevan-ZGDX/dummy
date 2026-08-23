import { NextRequest, NextResponse } from 'next/server'
import { isFirestoreConfigured, getDocById, queryByField } from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const competitionId = params.id
  if (!competitionId) {
    return NextResponse.json({ error: 'Missing competition id' }, { status: 400 })
  }
  if (!isFirestoreConfigured()) {
    return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 })
  }

  // Fetch competition to get eligible_year
  const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)

  if (!competition) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  const eligibleYears: string[] = competition.eligible_year
    ? String(competition.eligible_year).split(',').map((y) => y.trim()).filter(Boolean)
    : []

  if (eligibleYears.length === 0) {
    return NextResponse.json({
      totalStudents: 0,
      appliedStudents: 0,
      unregisteredStudents: 0,
      registrationsByDepartment: [],
      studentsWithDetails: [],
    })
  }

  // Total eligible students. Firestore has no `in` on an unbounded list, so the
  // year filter runs as one query per eligible year, de-duplicated by id.
  const byId = new Map<string, Record<string, any>>()
  for (const year of eligibleYears) {
    for (const student of await queryByField(COLLECTIONS.students, 'year', year)) {
      byId.set(student.id, student)
    }
  }
  const students = [...byId.values()]

  const totalStudents = students.length

  // Registrations for this competition
  const registrations = await queryByField(
    COLLECTIONS.studentCompetitions,
    'competition_id',
    competitionId
  )

  const registeredEmails = new Set(registrations.map((r) => r.student_email))
  const appliedStudents = registeredEmails.size
  const unregisteredStudents = totalStudents - appliedStudents

  // Registrations by department
  const deptMap = new Map<string, number>()
  students.forEach((s) => {
    if (registeredEmails.has(s.email)) {
      deptMap.set(s.department, (deptMap.get(s.department) || 0) + 1)
    }
  })
  const registrationsByDepartment = Array.from(deptMap.entries()).map(([department, count]) => ({
    department,
    count,
  }))

  // Students with details (only registered)
  const studentsWithDetails = students
    .filter((s) => registeredEmails.has(s.email))
    .map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      department: s.department,
      section: s.section,
      year: s.year,
    }))

  return NextResponse.json({
    totalStudents,
    appliedStudents,
    unregisteredStudents,
    registrationsByDepartment,
    studentsWithDetails,
  })
}
