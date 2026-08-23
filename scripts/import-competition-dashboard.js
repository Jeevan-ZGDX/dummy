import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const scriptDir = resolve(decodeURIComponent(new URL('.', import.meta.url).pathname))
const projectRoot = resolve(scriptDir, '..')

dotenv.config({ path: resolve(projectRoot, 'apps/web/.env'), override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL in apps/web/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const { error: tableCheck } = await supabase.from('competition_dashboard').select('id').limit(1)
if (tableCheck) {
  const migration = readFileSync(resolve(projectRoot, 'supabase/competition-dashboard.sql'), 'utf-8')
  console.log('')
  console.log('='.repeat(60))
  console.log('TABLE DOES NOT EXIST — run this SQL in Supabase SQL Editor first:')
  console.log('='.repeat(60))
  console.log('')
  console.log(migration)
  console.log('')
  console.log('After running the SQL, re-run this script.')
  process.exit(1)
}

const csvPath = resolve(projectRoot, '..', decodeURIComponent('Competition Dashboard - Google Sheets.csv'))
const raw = readFileSync(csvPath, 'utf-8').trim()

const lines = raw.split('\n')
const headers = parseCSVLine(lines[0])

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

const rows = []
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const cols = parseCSVLine(lines[i])
  const row = {}
  headers.forEach((h, idx) => { row[h] = cols[idx] || '' })
  rows.push(row)
}

console.log(`Parsed ${rows.length} rows from CSV`)

const upsertData = rows.map((r) => {
  const parseDate = (v) => {
    if (!v || v === 'NULL' || v === 'TBA') return null
    const parts = v.split('/')
    if (parts.length === 3) {
      // CSV dates are MM/DD/YYYY
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    }
    return null
  }

  const parseNum = (v) => {
    const n = parseInt(v, 10)
    return isNaN(n) ? 0 : n
  }

  const sno = parseNum(r['S. No'])
  const id = `dash-${String(sno).padStart(3, '0')}`

  return {
    id,
    serial_no: sno,
    competition_name: r['Competition Name'] || '',
    competition_status: r['Competition Status'] || 'On Going',
    eligible_year: r['Eligible Year'] || '',
    reg_deadline: parseDate(r['Reg. Deadline']),
    r1_date: parseDate(r['R1 -Date']),
    r2_date: parseDate(r['R2 - Date']),
    remaining_days_for_reg: parseNum(r['Remaining Days for Reg.']),
    r_days_for_r1: parseNum(r['R. Days for R1']),
    r_days_for_r2: parseNum(r['R. Days for R2']),
    reg_team: parseNum(r['Reg. Team']),
    total_prize_amount: r['Total Prize Amount'] || '',
    category: r['Category'] || 'Competition',
    organizer: r['Organizer'] || '',
  }
})

const batchSize = 50
for (let i = 0; i < upsertData.length; i += batchSize) {
  const batch = upsertData.slice(i, i + batchSize)
  const { error } = await supabase
    .from('competition_dashboard')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })

  if (error) {
    console.error(`Batch ${i / batchSize + 1} failed:`, error.message)
  } else {
    console.log(`Batch ${i / batchSize + 1}: upserted ${batch.length} rows`)
  }
}

console.log('Import complete!')
