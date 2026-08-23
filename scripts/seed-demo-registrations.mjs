// Seeds a spread of registration statuses so the advisor roster is meaningful
// to look at locally. `student_competitions` is empty in the live project, so
// without this every student legitimately reads "Not registered".
//
// Every row is tagged with verification_method = 'demo-seed', so --clear removes
// exactly what this script created and never touches real registrations. The
// marker is deliberately not in a column any screen renders.
//
// Usage:
//   node scripts/seed-demo-registrations.mjs --advisor <email> [--competition dash-002]
//   node scripts/seed-demo-registrations.mjs --clear
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

// Marker goes in verification_method, not competition_name: the latter is
// rendered on the verification screens, which put "DEMO_SEED_REMOVE_ME" on
// screen for users.
const DEMO_METHOD = 'demo-seed'
const YEAR_LABEL = '3rd Year'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}
const clearOnly = args.includes('--clear')
const advisorEmail = flag('advisor')
const competitionArg = flag('competition')

/** Strips the stored year prefix: "3%A" -> "A". Mirrors packages/utils. */
const normalizeSection = (s) => (s ?? '').trim().replace(/^(\d+)\s*%\s*/, '').trim().toUpperCase()

async function clearDemo() {
  const { error } = await db.from('student_competitions').delete().eq('verification_method', DEMO_METHOD)
  if (error) throw new Error(error.message)
  const { count } = await db
    .from('student_competitions')
    .select('*', { count: 'exact', head: true })
    .eq('verification_method', DEMO_METHOD)
  console.log(`Cleared demo rows. Remaining tagged rows: ${count ?? 0}`)
}

async function main() {
  if (clearOnly) return clearDemo()

  if (!advisorEmail) {
    console.error('Pass --advisor <email> (or --clear). Example:\n' +
      '  node scripts/seed-demo-registrations.mjs --advisor nagomiyas@citchennai.net')
    process.exit(1)
  }

  const { data: advisor, error: advErr } = await db
    .from('advisors')
    .select('id,name,email,assigned_sections')
    .ilike('email', advisorEmail)
    .maybeSingle()
  if (advErr) throw new Error(advErr.message)
  if (!advisor) {
    console.error(`No advisor row with email ${advisorEmail}`)
    process.exit(1)
  }

  const sections = (advisor.assigned_sections ?? []).map(normalizeSection).filter(Boolean)
  if (!sections.length) {
    console.error(`${advisor.name} has no assigned_sections — nothing to seed.`)
    process.exit(1)
  }

  // Pick a competition that admits 3rd year unless one was named.
  let competitionId = competitionArg
  let competitionName = ''
  const { data: comps, error: compErr } = await db
    .from('competition_dashboard')
    .select('id,competition_name,eligible_year')
    .order('serial_no')
  if (compErr) throw new Error(compErr.message)

  if (competitionId) {
    const found = comps.find((c) => c.id === competitionId)
    if (!found) {
      console.error(`No competition ${competitionId}`)
      process.exit(1)
    }
    competitionName = found.competition_name
  } else {
    const admitsThird = comps.find((c) =>
      (c.eligible_year ?? '').split(',').map((t) => t.trim().toUpperCase()).includes('III')
    )
    if (!admitsThird) {
      console.error('No competition admits 3rd year (III).')
      process.exit(1)
    }
    competitionId = admitsThird.id
    competitionName = admitsThird.competition_name
  }

  await clearDemo()

  let total = 0
  for (const section of sections) {
    const { data: students, error: stuErr } = await db
      .from('students')
      .select('id,name,email')
      .eq('year', YEAR_LABEL)
      .eq('section', `3%${section}`)
      .order('name')
    if (stuErr) throw new Error(stuErr.message)
    if (!students.length) {
      console.log(`  section ${section}: no ${YEAR_LABEL} students, skipped`)
      continue
    }

    // Roughly a third registered: a spread of verified / pending / rejected so
    // every badge in the UI is exercised.
    const picks = []
    students.forEach((s, i) => {
      if (i % 3 === 0) picks.push({ s, status: 'verified' })
      else if (i % 7 === 0) picks.push({ s, status: 'pending' })
      else if (i % 11 === 0) picks.push({ s, status: 'rejected' })
    })

    // Uniform key set on every object — PostgREST 400s on a bulk insert
    // whose rows have differing keys.
    const rows = picks.map(({ s, status }) => ({
      student_id: s.id,
      student_email: s.email,
      student_name: s.name,
      competition_id: competitionId,
      competition_name: competitionName,
      verification_status: status,
      verification_method: DEMO_METHOD,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
    }))

    const { error: insErr } = await db.from('student_competitions').insert(rows)
    if (insErr) throw new Error(insErr.message)

    const counts = rows.reduce((acc, r) => {
      acc[r.verification_status] = (acc[r.verification_status] || 0) + 1
      return acc
    }, {})
    console.log(
      `  section ${section}: ${rows.length}/${students.length} seeded ` +
        `(${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')})`
    )
    total += rows.length
  }

  console.log(`\nSeeded ${total} demo registrations for ${advisor.name} (${advisor.email})`)
  console.log(`Competition: ${competitionName} (${competitionId})`)
  console.log(`\nView at: /competitions/${competitionId}`)
  console.log('Remove with: node scripts/seed-demo-registrations.mjs --clear')
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
