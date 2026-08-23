// Demo auth seeding for Comp-Dash.
// Creates the demo users referenced on the sign-in page, then writes their
// profile rows (the `on_auth_user_created` trigger in supabase/schema.sql also
// does this automatically on real signups).
//
// Usage:
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:auth
//
// If SUPABASE_URL isn't set, NEXT_PUBLIC_SUPABASE_URL is used as a fallback.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error(`
Missing env vars. Set the following and try again:

  SUPABASE_URL=https://<your-project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

(SUPABASE_URL falls back to NEXT_PUBLIC_SUPABASE_URL if set.)
`)
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

const DEMO_USERS = [
  { email: 'admin@citchennai.net', password: 'CompDash@123', name: 'System Admin', role: 'super_admin', department: 'CSE' },
  { email: 'hod@citchennai.net', password: 'CompDash@123', name: 'Head of Department', role: 'hod', department: 'CSE' },
  { email: 'advisor@citchennai.net', password: 'CompDash@123', name: 'Faculty Advisor', role: 'advisor', department: 'CSE' },
  { email: 'student@citchennai.net', password: 'CompDash@123', name: 'Demo Student', role: 'student', department: 'CSE' },
  // Has the advisor role but is deliberately never given a row in
  // public.advisors, so the E2E suite can assert the "account not mapped to an
  // advisor record" path. Do not map this one.
  { email: 'unmapped.advisor@citchennai.net', password: 'CompDash@123', name: 'Unmapped Advisor', role: 'advisor', department: 'CSE' },
]

async function main() {
  // Listed once up front — doing this inside the loop re-fetched every user per iteration.
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const byEmail = new Map((existing.data?.users ?? []).map((u) => [u.email, u]))

  for (const user of DEMO_USERS) {
    const already = byEmail.get(user.email)

    if (already) {
      const { error: metaErr } = await admin.auth.admin.updateUserById(already.id, {
        user_metadata: { name: user.name, role: user.role, department: user.department },
      })
      if (metaErr) {
        console.error(`  ! ${user.email}: could not update role metadata — ${metaErr.message}`)
      } else {
        console.log(`  ✓ ${user.email} already exists (role metadata synced as ${user.role})`)
      }
      continue
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role, department: user.department },
    })

    if (error) {
      console.error(`  ✗ ${user.email}: ${error.message}`)
      continue
    }

    const userId = data.user?.id
    if (userId) {
      // Live schema is `user_profiles` keyed by user_id/full_name — there is no
      // `profiles` table and no on_auth_user_created trigger, so write it here.
      const { error: profileErr } = await admin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          email: user.email,
          full_name: user.name,
          role: user.role,
          department: user.department,
        }, { onConflict: 'user_id' })
      if (profileErr) {
        console.error(`  ! ${user.email}: user created but profile upsert failed — ${profileErr.message}`)
      }
    }

    console.log(`  ✓ ${user.email} created (role: ${user.role})`)
  }

  console.log(`
Done. Sign in on /sign-in with:

  admin@citchennai.net   / CompDash@123   (super_admin)
  hod@citchennai.net     / CompDash@123   (hod)
  advisor@citchennai.net / CompDash@123   (advisor)
  student@citchennai.net / CompDash@123   (student)

  unmapped.advisor@citchennai.net / CompDash@123   (advisor, intentionally unmapped — E2E fixture)

The advisor account needs a row in public.advisors before its dashboard shows
students. Map the demo one with:  npm run seed:demo-advisor
`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
