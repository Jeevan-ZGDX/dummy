// Makes the demo advisor account advertised on the sign-in page actually work.
//
// `advisor@citchennai.net` is created by `npm run seed:auth` with the advisor
// role, but it has no row in `public.advisors` — so it has no assigned sections
// and the roster correctly reports "not mapped to an advisor record". That is
// right behaviour, but it makes the demo login look broken.
//
// This creates a clearly-tagged demo advisor row mapped to a real 3rd-year
// section, so the advertised credentials show the feature end to end.
//
// Usage:
//   node scripts/setup-demo-advisor.mjs [--section A] [--email advisor@citchennai.net]
//   node scripts/setup-demo-advisor.mjs --remove
//
// Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

const DEMO_ADVISOR_ID = 'adv-demo-001'
const DEFAULT_EMAIL = 'advisor@citchennai.net'
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
const remove = args.includes('--remove')
const email = (flag('email') || DEFAULT_EMAIL).toLowerCase()
const sectionArg = flag('section')

const normalizeSection = (s) => (s ?? '').trim().replace(/^(\d+)\s*%\s*/, '').trim().toUpperCase()

async function main() {
  if (remove) {
    const { error } = await db.from('advisors').delete().eq('id', DEMO_ADVISOR_ID)
    if (error) throw new Error(error.message)
    console.log(`Removed demo advisor row ${DEMO_ADVISOR_ID}.`)
    console.log('Its auth account is untouched — delete that in the Supabase dashboard if you want it gone too.')
    return
  }

  // Confirm the auth account exists, so the printed credentials really work.
  const { data: authList, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authErr) throw new Error(authErr.message)
  const authUser = authList.users.find((u) => u.email?.toLowerCase() === email)
  if (!authUser) {
    console.error(`No auth user ${email}. Run: npm run seed:auth`)
    process.exit(1)
  }

  // Pick a section that actually has 3rd-year students.
  let section = sectionArg ? normalizeSection(sectionArg) : null
  if (!section) {
    const { data: sample, error } = await db
      .from('students')
      .select('section')
      .eq('year', YEAR_LABEL)
      .limit(1000)
    if (error) throw new Error(error.message)
    const counts = new Map()
    for (const r of sample) {
      const s = normalizeSection(r.section)
      if (s) counts.set(s, (counts.get(s) || 0) + 1)
    }
    section = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!section) {
      console.error(`No ${YEAR_LABEL} students found — nothing to map.`)
      process.exit(1)
    }
  }

  const { count: studentCount, error: cErr } = await db
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('year', YEAR_LABEL)
    .eq('section', `3%${section}`)
  if (cErr) throw new Error(cErr.message)
  if (!studentCount) {
    console.error(`Section ${section} has no ${YEAR_LABEL} students.`)
    process.exit(1)
  }

  const { error: upErr } = await db.from('advisors').upsert(
    {
      id: DEMO_ADVISOR_ID,
      name: 'Demo Class Advisor',
      email,
      department: 'CSE',
      assigned_sections: [section],
      pending_verifications: 0,
    },
    { onConflict: 'id' }
  )
  if (upErr) throw new Error(upErr.message)

  // Keep the auth metadata in step so the UI shows the right name/role.
  await db.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      name: 'Demo Class Advisor',
      role: 'advisor',
      department: 'CSE',
      advisor_id: DEMO_ADVISOR_ID,
    },
  })
  await db.from('user_profiles').upsert(
    {
      user_id: authUser.id,
      email,
      full_name: 'Demo Class Advisor',
      role: 'advisor',
      department: 'CSE',
    },
    { onConflict: 'user_id' }
  )

  console.log(`Demo class advisor ready:`)
  console.log(`  login    : ${email}`)
  console.log(`  advisor  : Demo Class Advisor (${DEMO_ADVISOR_ID})`)
  console.log(`  section  : ${section}  (${studentCount} ${YEAR_LABEL} students)`)
  console.log(`\nSeed visible statuses:`)
  console.log(`  node scripts/seed-demo-registrations.mjs --advisor ${email}`)
  console.log(`\nRemove this mapping:`)
  console.log(`  node scripts/setup-demo-advisor.mjs --remove`)
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
