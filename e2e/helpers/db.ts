/**
 * Direct Supabase REST helpers for E2E fixtures.
 *
 * Uses the service-role key so fixtures are independent of app auth. Every
 * fixture row is tagged with FIXTURE_TAG in `competition_name` so teardown can
 * delete exactly what the test created and nothing else.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Marker written into competition_name so cleanup never touches real rows. */
export const FIXTURE_TAG = 'E2E_FIXTURE_DO_NOT_KEEP'

export function assertDbEnv() {
  const missing = [
    !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
    !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean)
  if (missing.length) {
    throw new Error(`Missing env for E2E: ${missing.join(', ')}`)
  }
}

async function rest<T = any>(
  method: string,
  path: string,
  body?: unknown,
  prefer = 'return=representation'
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const text = await res.text()
  return (text.trim() ? JSON.parse(text) : null) as T
}

export interface AdvisorRow {
  id: string
  name: string
  email: string
  department: string | null
  assigned_sections: string[] | null
}

export interface StudentRow {
  id: string
  name: string
  email: string
  section: string
  year: string
}

export function getAdvisor(email: string) {
  return rest<AdvisorRow[]>(
    'GET',
    `advisors?email=eq.${encodeURIComponent(email)}&select=id,name,email,department,assigned_sections`
  ).then((rows) => {
    if (!rows?.length) throw new Error(`No advisor row for ${email}`)
    return rows[0]
  })
}

/**
 * Students in a bare section for a given year, using the stored
 * year-prefixed spelling (3rd year is stored as "3%A", not "A").
 */
export function getStudentsInSection(bareSection: string, yearLabel: string, limit = 500) {
  const stored = yearLabel.startsWith('1st') ? bareSection : `3%${bareSection}`
  return rest<StudentRow[]>(
    'GET',
    `students?year=eq.${encodeURIComponent(yearLabel)}` +
      `&section=eq.${encodeURIComponent(stored)}` +
      `&select=id,name,email,section,year&order=name&limit=${limit}`
  )
}

export function countStudentsInSection(bareSection: string, yearLabel: string) {
  return getStudentsInSection(bareSection, yearLabel).then((r) => r.length)
}

export function getCompetition(id: string) {
  return rest<any[]>(
    'GET',
    `competition_dashboard?id=eq.${encodeURIComponent(id)}&select=id,competition_name,eligible_year`
  ).then((rows) => rows?.[0] ?? null)
}

/** First competition whose eligible_year admits the given Roman numeral. */
export function findCompetitionForYear(roman: string) {
  return rest<any[]>(
    'GET',
    `competition_dashboard?select=id,competition_name,eligible_year&order=serial_no&limit=200`
  ).then((rows) => {
    const tokens = (v: string | null) =>
      (v ?? '').split(',').map((t) => t.trim().toUpperCase())
    return rows.find((r) => tokens(r.eligible_year).includes(roman)) ?? null
  })
}

export interface FixtureSpec {
  student: StudentRow
  status: 'pending' | 'verified' | 'rejected'
}

/**
 * Inserts tagged registration rows.
 *
 * Every object carries an identical key set — PostgREST rejects a bulk insert
 * with differing keys as a 400.
 */
export async function seedRegistrations(competitionId: string, specs: FixtureSpec[]) {
  if (!specs.length) return
  const rows = specs.map(({ student, status }) => ({
    student_id: student.id,
    student_email: student.email,
    student_name: student.name,
    competition_id: competitionId,
    competition_name: FIXTURE_TAG,
    verification_status: status,
    verified_at: status === 'verified' ? new Date().toISOString() : null,
  }))
  await rest('POST', 'student_competitions', rows, 'return=minimal')
}

/** Deletes only rows this suite created. */
export async function clearFixtureRegistrations() {
  await rest(
    'DELETE',
    `student_competitions?competition_name=eq.${encodeURIComponent(FIXTURE_TAG)}`,
    undefined,
    'return=minimal'
  )
}

export async function countFixtureRegistrations() {
  const rows = await rest<any[]>(
    'GET',
    `student_competitions?competition_name=eq.${encodeURIComponent(FIXTURE_TAG)}&select=id`
  )
  return rows?.length ?? 0
}

/**
 * First competition whose eligible_year admits `roman` but not `excludeRoman`.
 * Used to exercise the "not eligible for this year" branch deterministically.
 */
export function findCompetitionAdmittingButExcluding(roman: string, excludeRoman: string) {
  return rest<any[]>(
    'GET',
    `competition_dashboard?select=id,competition_name,eligible_year&order=serial_no&limit=200`
  ).then((rows) => {
    const tokens = (v: string | null) => (v ?? '').split(',').map((t) => t.trim().toUpperCase())
    return (
      rows.find((r) => {
        const t = tokens(r.eligible_year)
        return t.includes(roman) && !t.includes(excludeRoman)
      }) ?? null
    )
  })
}
