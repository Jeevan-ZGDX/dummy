const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const repoRoot = path.resolve(__dirname, '..')
const outputDir = path.join(repoRoot, 'apps/web/src/lib')

const excelFiles = [
  {
    filePath: '/home/vampire/Downloads/III year CSE Database 2028 16.7.26.xlsx',
    sheetName: 'Sheet1',
    year: '3rd Year',
    batch: '2024',
  },
  {
    filePath: '/home/vampire/Downloads/ORIGINAL NAMELIST.xlsx',
    sheetName: 'Sheet1',
    year: '2nd Year',
    batch: '2025',
  },
]

function normalizeText(value) {
  if (value === null || value === undefined) return ''
  return String(value).toString().trim()
}

function sanitizeSection(value) {
  const text = normalizeText(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return text.length > 0 ? text : 'A'
}

function normalizeEmail(value, rollNo, batch) {
  const email = normalizeText(value)
  if (email) return email
  const roll = normalizeText(rollNo).toLowerCase()
  if (roll) return `${roll}.cse${batch}@citchennai.net`
  return ''
}

function normalizeId(value, rollNo) {
  const raw = normalizeText(value)
  if (raw) return raw
  const roll = normalizeText(rollNo)
  return roll ? `stu-${roll}` : ''
}

function buildStudent(row, year, batch) {
  const name = normalizeText(row['Student Name'] || row['STUDENT NAME'] || row['Name'])
  if (!name) return null

  const rollNo = normalizeText(row['Reg No'] || row['ROLL NO'] || row['Reg. No'] || row['Roll No'])
  const section = sanitizeSection(row['Sec'] || row['NEW SEC'] || row['Section'])
  const email = normalizeEmail(row['Official mail id'] || row['Official Mail ID'] || row['Email'] || row['email'], rollNo, batch)

  return {
    id: normalizeId(row['id'], rollNo) || `stu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    email,
    department: 'CSE',
    year,
    section,
    registeredCompetitions: 0,
    verifiedCompetitions: 0,
    createdAt: new Date().toISOString(),
  }
}

const students = []
const seenIds = new Set()

for (const entry of excelFiles) {
  const workbook = XLSX.readFile(entry.filePath)
  const sheetName = workbook.SheetNames.includes(entry.sheetName) ? entry.sheetName : workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

  rows.forEach((row) => {
    const student = buildStudent(row, entry.year, entry.batch)
    if (!student) return
    if (!seenIds.has(student.id)) {
      seenIds.add(student.id)
      students.push(student)
    }
  })
}

const payload = {
  total_count: students.length,
  students,
}

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'real-students.json'), JSON.stringify(payload, null, 2) + '\n')
fs.writeFileSync(path.join(outputDir, 'students-data.json'), JSON.stringify(payload, null, 2) + '\n')

console.log(`Imported ${students.length} students from ${excelFiles.length} workbook(s).`)
console.log(`Wrote ${path.join(outputDir, 'real-students.json')} and ${path.join(outputDir, 'students-data.json')}`)
