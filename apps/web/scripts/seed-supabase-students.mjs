import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const values = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    values[key] = value
  }
  return values
}

const envFiles = [
  path.resolve('.env.local'),
  path.resolve('.env.locals'),
  path.resolve('.env'),
]

const env = envFiles.reduce((acc, filePath) => ({ ...acc, ...loadEnvFile(filePath) }), {})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const dataPath = path.resolve('src/lib/students-data.json')
const raw = fs.readFileSync(dataPath, 'utf8')
const payload = JSON.parse(raw)

const rows = (payload.students || []).map((student) => ({
  id: student.id,
  name: student.name,
  email: student.email || null,
  department: student.department || 'CSE',
  year: student.year || '2nd Year',
  section: student.section || 'A',
  registered_competitions: student.registeredCompetitions || 0,
  verified_competitions: student.verifiedCompetitions || 0,
  created_at: student.createdAt || new Date().toISOString(),
}))

const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id' })
if (error) {
  console.error('Supabase seed failed:', error)
  process.exit(1)
}

console.log(`Seeded ${rows.length} student details into Supabase.`)
