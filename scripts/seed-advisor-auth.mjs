// Creates Supabase Auth accounts for the real class advisors in `public.advisors`
// so they can sign in and see their own sections.
//
// The advisors table is the source of truth (it already matches
// sampledata/advisors_rows.csv). Nothing here is hardcoded — sections, names and
// emails all come from the table.
//
// Usage:
//   ADVISOR_SEED_PASSWORD='<temp-password>' npm run seed:advisors
//   ADVISOR_SEED_PASSWORD='...' npm run seed:advisors -- --dry-run
//   ADVISOR_SEED_PASSWORD='...' npm run seed:advisors -- --only nagomiyas@citchennai.net
//
// Env:
//   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
//   ADVISOR_SEED_PASSWORD  required — no default, so no account ever gets a
//                          password that is public in this repo.

import { createClient } from '@supabase/supabase-js'

const OFFICIAL_DOMAIN = 'citchennai.net'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.ADVISOR_SEED_PASSWORD

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const onlyIdx = args.indexOf('--only')
const onlyEmail = onlyIdx !== -1 ? args[onlyIdx + 1]?.trim().toLowerCase() : null

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!password && !dryRun) {
  console.error(`
ADVISOR_SEED_PASSWORD is required (min 8 chars).

  ADVISOR_SEED_PASSWORD='SomeTemp@123' npm run seed:advisors

Advisors should change it after first sign-in. Use --dry-run to preview
without setting a password.
`)
  process.exit(1)
}
if (password && password.length < 8) {
  console.error('ADVISOR_SEED_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

function isAllowedEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith(`@${OFFICIAL_DOMAIN}`)
}

async function main() {
  const { data: advisors, error } = await admin
    .from('advisors')
    .select('id,name,email,department,assigned_sections')
    .order('id')

  if (error) {
    console.error('Could not read advisors:', error.message)
    process.exit(1)
  }

  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const byEmail = new Map((existing.data?.users ?? []).map((u) => [u.email?.toLowerCase(), u]))

  const skippedDomain = []
  const noSections = []
  let created = 0
  let synced = 0

  const targets = onlyEmail
    ? advisors.filter((a) => a.email?.trim().toLowerCase() === onlyEmail)
    : advisors

  if (onlyEmail && targets.length === 0) {
    console.error(`No advisor row with email ${onlyEmail}. Nothing to do.`)
    process.exit(1)
  }

  for (const advisor of targets) {
    const email = advisor.email?.trim().toLowerCase()
    const sections = advisor.assigned_sections ?? []

    // The app gates sign-in on the official domain, so an advisor whose stored
    // address is off-domain could never log in. Report instead of silently creating.
    if (!isAllowedEmail(email)) {
      skippedDomain.push({ id: advisor.id, name: advisor.name, email })
      continue
    }
    if (sections.length === 0) {
      // Still gets an account, but flag it — they will see an empty roster.
      noSections.push({ id: advisor.id, name: advisor.name, email })
    }

    const metadata = {
      name: advisor.name,
      role: 'advisor',
      department: advisor.department || 'CSE',
      advisor_id: advisor.id,
    }

    if (dryRun) {
      console.log(`  ~ would seed ${email.padEnd(42)} sections=[${sections}]`)
      continue
    }

    const already = byEmail.get(email)
    let userId = already?.id

    if (already) {
      const { error: updErr } = await admin.auth.admin.updateUserById(already.id, {
        user_metadata: metadata,
      })
      if (updErr) {
        console.error(`  ✗ ${email}: metadata sync failed — ${updErr.message}`)
        continue
      }
      synced++
      console.log(`  ✓ ${email.padEnd(42)} exists (role/sections metadata synced)`)
    } else {
      const { data, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      })
      if (createErr) {
        console.error(`  ✗ ${email}: ${createErr.message}`)
        continue
      }
      userId = data.user?.id
      created++
      console.log(`  ✓ ${email.padEnd(42)} created  sections=[${sections}]`)
    }

    if (userId) {
      const { error: profileErr } = await admin.from('user_profiles').upsert(
        {
          user_id: userId,
          email,
          full_name: advisor.name,
          role: 'advisor',
          department: advisor.department || 'CSE',
        },
        { onConflict: 'user_id' }
      )
      if (profileErr) {
        console.error(`  ! ${email}: user_profiles upsert failed — ${profileErr.message}`)
      }
    }
  }

  console.log(`\nAdvisors in table: ${advisors.length}   targeted: ${targets.length}`)
  if (!dryRun) console.log(`Created: ${created}   Synced: ${synced}`)

  if (skippedDomain.length) {
    console.log(`\n⚠ SKIPPED — email not on @${OFFICIAL_DOMAIN}, cannot ever sign in:`)
    for (const a of skippedDomain) console.log(`    ${a.id}  ${a.name}  ${a.email}`)
    console.log('  Fix the address in public.advisors, then re-run.')
  }
  if (noSections.length) {
    console.log('\n⚠ Advisors with no assigned_sections (roster will be empty):')
    for (const a of noSections) console.log(`    ${a.id}  ${a.name}  ${a.email}`)
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
