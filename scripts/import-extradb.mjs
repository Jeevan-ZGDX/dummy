/**
 * Dry-run importer for the extradb/ workbooks.
 *
 * Reads the II-year student roster and the class-advisor sheet, normalizes both
 * into the shapes the Firestore `students` / `advisors` collections use, and
 * writes JSON to extradb/out/ for inspection. It deliberately writes NOTHING to
 * Firestore and does not touch apps/web/src/lib/*.json — the older
 * import-excel-students.js overwrites those in place.
 *
 * Usage: node scripts/import-extradb.mjs
 */
import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(repoRoot, 'extradb', 'out')

const STUDENT_FILE = join(repoRoot, 'extradb', '29 Batch Mail id.xlsx')
const FACULTY_FILE = join(repoRoot, 'extradb', 'FACULTY DETAILS - 2026 .xlsx')

// This cohort entered in 2025 and is currently in its second year.
const YEAR_LABEL = '2nd Year'
const YEAR_NUMBER = 2
const BATCH = '2025'
const DEPARTMENT = 'CSE'
const DOMAIN = 'citchennai.net'

const text = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** Bare section label, e.g. "J". Mirrors sanitizeSection in the older script. */
function bareSection(v) {
  const t = text(v).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return t || ''
}

/**
 * students.section is stored year-prefixed for every year except the first,
 * matching toStoredSection() in @comp-dash/utils ("J" -> "2%J").
 */
function storedSection(bare) {
  if (!bare) return ''
  return YEAR_NUMBER === 1 ? bare : `${YEAR_NUMBER}%${bare}`
}

function readSheet(file, wanted) {
  const wb = XLSX.readFile(file)
  const name = wanted && wb.SheetNames.includes(wanted) ? wanted : wb.SheetNames[0]
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' })
}

// ---------------------------------------------------------------- students
const studentRows = readSheet(STUDENT_FILE, 'Sheet1')
const students = []
const problems = []
const seenEmail = new Map()
const seenRoll = new Map()

studentRows.forEach((row, i) => {
  // The 29-batch sheet uses different headers than the III-year one the older
  // importer was written against, so accept both spellings.
  const name = text(row['NAME'] || row['Student Name'] || row['STUDENT NAME'] || row['Name'])
  const roll = text(row['Register Number'] || row['Reg No'] || row['ROLL NO'] || row['Reg. No'] || row['Roll No'])
  const bare = bareSection(row['Section'] || row['Sec'] || row['NEW SEC'])
  const rawEmail = text(
    row['Official Mail Id'] || row['Official mail id'] || row['Official Mail ID'] || row['Email'] || row['email']
  )
  const email = rawEmail.toLowerCase()
  const line = i + 2 // 1-based, plus the header row

  if (!name) { problems.push({ line, issue: 'no name — row skipped' }); return }
  if (!roll) problems.push({ line, name, issue: 'missing register number' })
  if (!bare) problems.push({ line, name, issue: 'missing section' })
  if (!email) problems.push({ line, name, issue: 'missing email' })
  else if (!email.endsWith(`@${DOMAIN}`)) problems.push({ line, name, email, issue: `email is not @${DOMAIN}` })

  if (email) {
    if (seenEmail.has(email)) problems.push({ line, name, email, issue: `duplicate email (first at line ${seenEmail.get(email)})` })
    else seenEmail.set(email, line)
  }
  if (roll) {
    if (seenRoll.has(roll)) problems.push({ line, name, roll, issue: `duplicate register number (first at line ${seenRoll.get(roll)})` })
    else seenRoll.set(roll, line)
  }

  students.push({
    id: roll ? `stu-${roll}` : `stu-${BATCH}-${line}`,
    name,
    email,
    roll_no: roll,
    department: DEPARTMENT,
    year: YEAR_LABEL,
    section: storedSection(bare),
    section_bare: bare,
    batch: BATCH,
    points: 0,
    registered_competitions: 0,
    verified_competitions: 0,
  })
})

// ---------------------------------------------------------------- advisors
const facultyRows = readSheet(FACULTY_FILE, 'II YR CLASS ADVISORS')
const byEmail = new Map()
const facultyProblems = []

facultyRows.forEach((row, i) => {
  const name = text(row['NAME'] || row['Name'])
  const bare = bareSection(row['SECTION'] || row['Section'])
  const email = text(row['MAIL ID'] || row['Mail Id'] || row['Email']).toLowerCase()
  const line = i + 2

  if (!name) { facultyProblems.push({ line, issue: 'no name — row skipped' }); return }
  if (!email) { facultyProblems.push({ line, name, issue: 'missing email — row skipped' }); return }
  if (!email.endsWith(`@${DOMAIN}`)) {
    facultyProblems.push({ line, name, email, issue: `email domain is not @${DOMAIN} — likely a typo` })
  }
  if (!bare) facultyProblems.push({ line, name, issue: 'missing section' })

  // One advisor can hold several sections; collapse duplicate rows into
  // assigned_sections rather than emitting two advisor docs.
  const existing = byEmail.get(email)
  if (existing) {
    if (bare && !existing.assigned_sections.includes(bare)) existing.assigned_sections.push(bare)
    return
  }
  byEmail.set(email, {
    id: `adv-${email.split('@')[0]}`,
    name,
    email,
    department: DEPARTMENT,
    assigned_sections: bare ? [bare] : [],
    assigned_year: YEAR_LABEL,
    pending_verifications: 0,
  })
})

const advisors = [...byEmail.values()]

// ---------------------------------------------------------------- report
const dist = {}
for (const s of students) dist[s.section_bare || '(none)'] = (dist[s.section_bare || '(none)'] || 0) + 1

const advisorSections = new Set(advisors.flatMap((a) => a.assigned_sections))
const studentSections = new Set(students.map((s) => s.section_bare).filter(Boolean))
const sectionsWithNoAdvisor = [...studentSections].filter((s) => !advisorSections.has(s)).sort()
const advisorsForNoStudents = [...advisorSections].filter((s) => !studentSections.has(s)).sort()

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'students-2nd-year.json'), JSON.stringify({ total_count: students.length, year: YEAR_LABEL, batch: BATCH, students }, null, 2) + '\n')
writeFileSync(join(outDir, 'advisors-ii-year.json'), JSON.stringify({ total_count: advisors.length, advisors }, null, 2) + '\n')
writeFileSync(join(outDir, 'problems.json'), JSON.stringify({ students: problems, faculty: facultyProblems }, null, 2) + '\n')

console.log(`students parsed : ${students.length} of ${studentRows.length} rows`)
console.log(`advisors parsed : ${advisors.length} of ${facultyRows.length} rows (deduped by email)`)
console.log(`section spread  : ${JSON.stringify(dist)}`)
console.log(`sections with students but NO advisor : ${sectionsWithNoAdvisor.join(', ') || 'none'}`)
console.log(`advisor sections with NO students     : ${advisorsForNoStudents.join(', ') || 'none'}`)
console.log(`student data issues : ${problems.length}`)
console.log(`faculty data issues : ${facultyProblems.length}`)
console.log(`\nwrote -> extradb/out/{students-2nd-year,advisors-ii-year,problems}.json  (no Firestore writes)`)
