/**
 * Firestore fixture helpers for E2E.
 *
 * Ported from the pre-migration Supabase REST version. Uses the Admin SDK, so
 * fixtures stay independent of app auth and of the security rules.
 *
 * Every fixture row is tagged with FIXTURE_TAG in `competition_name` so teardown
 * deletes exactly what the suite created and nothing else.
 *
 * Queries deliberately avoid combining a `where` with an `orderBy`: that would
 * demand a composite index, and Firestore silently EXCLUDES documents missing
 * the sort field. Sorting and slicing happen in memory instead.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { parseEligibleYears, parseYearToken } from '../../packages/utils/src/academic'

const STUDENTS = 'students'
const ADVISORS = 'advisors'
const COMPETITION_DASHBOARD = 'competition_dashboard'
const STUDENT_COMPETITIONS = 'student_competitions'

/** Marker written into competition_name so cleanup never touches real rows. */
export const FIXTURE_TAG = 'E2E_FIXTURE_DO_NOT_KEEP'

/** Firestore's hard limit on a single batched write. */
const BATCH_LIMIT = 500

let app: App | undefined
let db: Firestore | undefined

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON')
  }
}

export function assertDbEnv() {
  if (!serviceAccount()) {
    throw new Error('Missing env for E2E: FIREBASE_SERVICE_ACCOUNT')
  }
}

function firestore(): Firestore {
  if (db) return db
  const sa = serviceAccount()
  if (!sa) throw new Error('Missing env for E2E: FIREBASE_SERVICE_ACCOUNT')
  app = getApps().find((a) => a.name === 'e2e') || initializeApp({ credential: cert(sa) }, 'e2e')
  db = getFirestore(app)
  return db
}

const rowsOf = <T>(snap: FirebaseFirestore.QuerySnapshot): T[] =>
  snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)

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

export async function getAdvisor(email: string): Promise<AdvisorRow> {
  const snap = await firestore().collection(ADVISORS).where('email', '==', email).limit(1).get()
  if (snap.empty) throw new Error(`No advisor row for ${email}`)
  return rowsOf<AdvisorRow>(snap)[0]
}

/** '3rd Year' -> 3. Returns null when the label carries no leading digit. */
function yearNumber(yearLabel: string): number | null {
  const m = /^(\d+)/.exec(yearLabel.trim())
  return m ? Number(m[1]) : null
}

/**
 * Both spellings a section may be stored under: bare ("A") and year-prefixed
 * ("3%A"). First-year rows are stored bare.
 */
function sectionVariants(bareSection: string, yearLabel: string): string[] {
  const bare = bareSection.trim().toUpperCase()
  if (!bare) return []
  const n = yearNumber(yearLabel)
  return n && n > 1 ? [bare, `${n}%${bare}`] : [bare]
}

/**
 * Students in a bare section for a given year, using whichever stored spelling
 * the documents actually carry.
 */
export async function getStudentsInSection(
  bareSection: string,
  yearLabel: string,
  limit = 500
): Promise<StudentRow[]> {
  const variants = sectionVariants(bareSection, yearLabel)
  if (!variants.length) return []

  // `in` caps at 30 values; two variants is well inside that.
  const snap = await firestore().collection(STUDENTS).where('section', 'in', variants).get()

  return rowsOf<StudentRow>(snap)
    .filter((s) => s.year === yearLabel)
    .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    .slice(0, limit)
}

export function countStudentsInSection(bareSection: string, yearLabel: string) {
  return getStudentsInSection(bareSection, yearLabel).then((r) => r.length)
}

export async function getCompetition(id: string) {
  const doc = await firestore().collection(COMPETITION_DASHBOARD).doc(id).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

/**
 * Whether a competition admits a given year, using the app's own reading of
 * eligible_year rather than raw string matching.
 *
 * The Supabase-era helper compared comma-split tokens directly, so a blank
 * eligible_year matched nothing. The app treats blank — and any value carrying
 * no year signal at all, like "Startups, MSME" — as open to every year, which is
 * what every competition in this dataset actually is.
 */
function admitsYear(eligible: string | null | undefined, roman: string): boolean {
  const target = parseYearToken(roman)
  if (target === null) return false
  const parsed = parseEligibleYears(eligible)
  return parsed.openToAllYears || parsed.yearNumbers.includes(target)
}

async function allCompetitions() {
  const snap = await firestore().collection(COMPETITION_DASHBOARD).limit(200).get()
  return rowsOf<{ id: string; competition_name?: string; eligible_year?: string | null; serial_no?: number }>(snap)
    .sort((a, b) => Number(a.serial_no ?? 0) - Number(b.serial_no ?? 0))
}

/** First competition whose eligible_year admits the given Roman numeral. */
export async function findCompetitionForYear(roman: string) {
  const rows = await allCompetitions()
  return rows.find((r) => admitsYear(r.eligible_year, roman)) ?? null
}

/**
 * First competition whose eligible_year admits `roman` but not `excludeRoman`.
 * Used to exercise the "not eligible for this year" branch deterministically.
 */
export async function findCompetitionAdmittingButExcluding(roman: string, excludeRoman: string) {
  const rows = await allCompetitions()
  return (
    rows.find((r) => admitsYear(r.eligible_year, roman) && !admitsYear(r.eligible_year, excludeRoman)) ??
    null
  )
}

export interface FixtureSpec {
  student: StudentRow
  status: 'pending' | 'verified' | 'rejected'
}

/** Inserts tagged registration rows. */
export async function seedRegistrations(competitionId: string, specs: FixtureSpec[]) {
  if (!specs.length) return
  const col = firestore().collection(STUDENT_COMPETITIONS)

  for (let i = 0; i < specs.length; i += BATCH_LIMIT) {
    const batch = firestore().batch()
    for (const { student, status } of specs.slice(i, i + BATCH_LIMIT)) {
      batch.set(col.doc(), {
        student_id: student.id,
        student_email: student.email,
        student_name: student.name,
        competition_id: competitionId,
        competition_name: FIXTURE_TAG,
        verification_status: status,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      })
    }
    await batch.commit()
  }
}

/** Deletes only rows this suite created. */
export async function clearFixtureRegistrations() {
  const col = firestore().collection(STUDENT_COMPETITIONS)

  // Loop because a delete batch is also capped at 500.
  for (;;) {
    const snap = await col.where('competition_name', '==', FIXTURE_TAG).limit(BATCH_LIMIT).get()
    if (snap.empty) return
    const batch = firestore().batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    if (snap.size < BATCH_LIMIT) return
  }
}

export async function countFixtureRegistrations() {
  // count() is an aggregation: it bills a fraction of a read rather than one
  // per matching document.
  const snap = await firestore()
    .collection(STUDENT_COMPETITIONS)
    .where('competition_name', '==', FIXTURE_TAG)
    .count()
    .get()
  return snap.data().count
}
