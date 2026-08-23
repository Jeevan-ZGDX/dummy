// Seeds dummy rows for the Verification Requests and Verified Students pages.
//
// Both pages read `/api/verification-requests`, which is backed by the
// `verification_requests` table — empty in the live project, so both render
// "No data available". This fills it with plausible rows drawn from real
// students so the screens can be reviewed.
//
// Every row's id is prefixed with `vr-demo-`, so --clear removes exactly what
// this created without putting a marker anywhere users can see.
//
// Usage:
//   node scripts/seed-demo-verifications.mjs [--section B] [--count 14]
//   node scripts/seed-demo-verifications.mjs --clear
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

// Marker lives in the primary key, not in any rendered column — tagging
// `competition_title` put "DEMO_SEED_REMOVE_ME" on screen for users.
const DEMO_ID_PREFIX = 'vr-demo-'
const YEAR_LABEL = '3rd Year'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const flag = (n) => {
  const i = args.indexOf(`--${n}`)
  return i === -1 ? null : args[i + 1]
}
const clearOnly = args.includes('--clear')
const section = (flag('section') || 'B').trim().toUpperCase()
const count = Number(flag('count') || 14)

async function clearDemo() {
  const { error } = await db
    .from('verification_requests')
    .delete()
    .like('id', `${DEMO_ID_PREFIX}%`)
  if (error) throw new Error(error.message)
  console.log('Cleared demo verification requests.')
}

async function main() {
  if (clearOnly) return clearDemo()
  await clearDemo()

  const { data: students, error: sErr } = await db
    .from('students')
    .select('id,name,email,department,section')
    .eq('year', YEAR_LABEL)
    .eq('section', `3%${section}`)
    .order('name')
    .limit(Math.max(count, 1))
  if (sErr) throw new Error(sErr.message)
  if (!students?.length) {
    console.error(`No ${YEAR_LABEL} students in section ${section}.`)
    process.exit(1)
  }

  // Real competition titles, so the pages don't show placeholder text.
  const { data: comps, error: cErr } = await db
    .from('competition_dashboard')
    .select('id,competition_name,eligible_year')
    .order('serial_no')
    .limit(40)
  if (cErr) throw new Error(cErr.message)
  const admitsThird = (comps ?? []).filter((c) =>
    (c.eligible_year ?? '').split(',').map((t) => t.trim().toUpperCase()).includes('III')
  )
  const pool = admitsThird.length ? admitsThird : comps ?? []
  if (!pool.length) {
    console.error('No competitions available.')
    process.exit(1)
  }

  const now = Date.now()
  // A spread across the three statuses the UI renders. `verified` rows are what
  // the Verified Students page lists; `pending` is the advisor's inbox.
  const rows = students.slice(0, count).map((s, i) => {
    const comp = pool[i % pool.length]
    const status = i % 3 === 0 ? 'verified' : i % 3 === 1 ? 'pending' : 'under_review'
    const requestedAt = new Date(now - (i + 1) * 3600_000).toISOString()
    return {
      id: `${DEMO_ID_PREFIX}${String(i + 1).padStart(3, '0')}`,
      registration_id: null,
      student_id: s.id,
      student_name: s.name,
      department: s.department ?? 'CSE',
      competition_title: comp.competition_name,
      advisor_notified: status !== 'pending',
      email_proof:
        status === 'pending'
          ? null
          : JSON.stringify({
              from: `noreply@${(comp.competition_name || 'organizer').toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
              to: s.email,
              subject: `Registration confirmed — ${comp.competition_name}`,
              date: requestedAt,
            }),
      status,
      requested_at: requestedAt,
      reviewed_at: status === 'verified' ? new Date(now - i * 1800_000).toISOString() : null,
    }
  })

  const { error: insErr } = await db.from('verification_requests').insert(rows)
  if (insErr) throw new Error(insErr.message)

  const tally = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  console.log(`Seeded ${rows.length} verification requests from section ${section}:`)
  console.log('  ' + Object.entries(tally).map(([k, v]) => `${k}=${v}`).join('  '))
  console.log('\nView at:')
  console.log('  /verification-requests   (pending + under_review)')
  console.log('  /verified-students       (verified)')
  console.log('\nRemove with: node scripts/seed-demo-verifications.mjs --clear')
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
