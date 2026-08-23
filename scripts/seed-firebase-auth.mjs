// Seeds Firebase Auth users and the role_access allowlist.
//
// Usage:
//   node --env-file=.env scripts/seed-firebase-auth.mjs
//
// The data migration copies tables, not auth users — Supabase stores bcrypt
// password hashes that Firebase will not accept without a matching
// `auth:import` hash config. So the accounts have to be recreated here.
//
// Idempotent: existing users get their password and claims reset rather than a
// duplicate created.

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join } from 'path'

const DEMO_PASSWORD = 'CompDash@123'

// role_access is the highest-priority source in resolveUserFromDatabase, so an
// entry here decides the role outright. `granted: false` would BLOCK the
// account, hence every seeded row is explicitly granted.
const ACCOUNTS = [
  { email: 'anbuchelvanganesan.cse2024@citchennai.net', role: 'super_admin', name: 'Anbuchelvan Ganesan', department: 'CSE', password: null },
  { email: 'admin@citchennai.net', role: 'super_admin', name: 'System Admin', department: 'Administration', password: DEMO_PASSWORD },
  { email: 'hod@citchennai.net', role: 'hod', name: 'Head of Department', department: 'CSE', password: DEMO_PASSWORD },
  { email: 'advisor@citchennai.net', role: 'advisor', name: 'Advisor', department: 'CSE', password: DEMO_PASSWORD },
  { email: 'nagomiyas@citchennai.net', role: 'advisor', name: 'Nagomi Y S', department: 'CSE', password: DEMO_PASSWORD },
  { email: 'unmapped.advisor@citchennai.net', role: 'advisor', name: 'Unmapped Advisor', department: 'CSE', password: DEMO_PASSWORD },
  { email: 'student@citchennai.net', role: 'student', name: 'Student', department: 'CSE', password: DEMO_PASSWORD },
]

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  for (const candidate of [
    join(process.cwd(), 'service-account.json'),
    join(process.cwd(), 'apps', 'web', 'service-account.json'),
  ]) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf-8'))
    } catch {
      /* try next */
    }
  }
  console.error('Firebase service account not found.')
  process.exit(1)
}

const sa = loadServiceAccount()
if (getApps().length === 0) initializeApp({ credential: cert(sa), projectId: sa.project_id })

const auth = getAuth()
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true, preferRest: true })

async function upsertUser({ email, role, name, department, password }) {
  let user
  try {
    user = await auth.getUserByEmail(email)
    await auth.updateUser(user.uid, {
      displayName: name,
      emailVerified: true,
      // A null password means "Google sign-in only" — do not set one.
      ...(password ? { password } : {}),
    })
  } catch {
    user = await auth.createUser({
      email,
      displayName: name,
      emailVerified: true,
      ...(password ? { password } : {}),
    })
  }

  // Claims ride inside the ID token, which is what the Edge middleware trusts.
  await auth.setCustomUserClaims(user.uid, { role, department, name })

  await db.collection('role_access').doc(email).set(
    { email, role, department, granted: true },
    { merge: true }
  )

  return user.uid
}

async function main() {
  console.log(`\nSeeding Firebase Auth + role_access (${sa.project_id})\n`)
  let failed = 0

  for (const account of ACCOUNTS) {
    process.stdout.write(`  ${account.email.padEnd(44)} ${account.role.padEnd(12)}`)
    try {
      await upsertUser(account)
      console.log(account.password ? 'ok (password set)' : 'ok (Google sign-in only)')
    } catch (err) {
      failed++
      console.log(`FAILED — ${err.message}`)
    }
  }

  console.log(
    `\n  ${ACCOUNTS.length - failed}/${ACCOUNTS.length} accounts seeded.` +
      (failed ? ' Re-running is safe.' : '')
  )
  if (failed) process.exit(1)
}

main().catch((err) => {
  console.error('\nSeeding aborted:', err)
  process.exit(1)
})
