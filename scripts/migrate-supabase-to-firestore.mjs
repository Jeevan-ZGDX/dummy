// One-shot migration: copy every Supabase table into the matching Firestore
// collection, preserving document ids so existing cross-references keep working.
//
// Usage:
//   node --env-file=.env scripts/migrate-supabase-to-firestore.mjs [--dry-run]
//
// Needs SUPABASE_SERVICE_ROLE_KEY (to read past RLS) and Firebase admin
// credentials via FIREBASE_SERVICE_ACCOUNT or apps/web/service-account.json.
//
// Safe to re-run: every write is an idempotent merge keyed on the source row's
// primary key, so a partial run can simply be repeated.

import { createClient } from '@supabase/supabase-js'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join } from 'path'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Tables to copy. `key` is the column used as the Firestore document id. ──
const TABLES = [
  { table: 'students', collection: 'students', key: 'id' },
  { table: 'advisors', collection: 'advisors', key: 'id' },
  { table: 'competitions', collection: 'competitions', key: 'id' },
  { table: 'registrations', collection: 'registrations', key: 'id' },
  { table: 'winners', collection: 'winners', key: 'id' },
  { table: 'audit_logs', collection: 'audit_logs', key: 'id' },
  { table: 'verification_requests', collection: 'verification_requests', key: 'id' },
  { table: 'competition_dashboard', collection: 'competition_dashboard', key: 'id' },
  // role_access is keyed by email in both stores, so the auth layer can do a
  // single point read instead of a query.
  { table: 'role_access', collection: 'role_access', key: 'email' },
  { table: 'profiles', collection: 'profiles', key: 'email' },
  // Keyed by email, not the source `user_id`: that column holds a Supabase auth
  // UUID which has no meaning under Firebase Auth, and email is what
  // resolveUserFromDatabase actually looks these up by.
  { table: 'user_profiles', collection: 'user_profiles', key: 'email' },
  { table: 'student_competitions', collection: 'student_competitions', key: 'id' },
  { table: 'gmail_tokens', collection: 'gmail_tokens', key: 'id' },
  // Deliberately last. It is by far the largest table (15k+ rows) and the least
  // urgent — it is notification history. Migrating it first meant a slow or
  // retrying pass blocked competition_dashboard and user_profiles, which carry
  // the app's actual content and every role in the system.
  { table: 'notifications', collection: 'notifications', key: 'id' },
]

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  }
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
  console.error(
    'Firebase service account not found.\n' +
      'Put it at apps/web/service-account.json or set FIREBASE_SERVICE_ACCOUNT.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const serviceAccount = loadServiceAccount()
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
}
const db = getFirestore()
// `preferRest` swaps the Admin SDK's gRPC transport for REST. gRPC keeps one
// long-lived HTTP/2 channel, and on a slow or lossy link a single stalled
// commit poisons it — every later call then fails with DEADLINE_EXCEEDED even
// though the credentials and data are fine. REST issues independent requests,
// so one slow batch cannot take the rest of the run down with it.
db.settings({ ignoreUndefinedProperties: true, preferRest: true })

/** PostgREST caps an unbounded select at 1,000 rows, so page explicitly. */
async function readTable(table) {
  const PAGE = 1000
  const rows = []
  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE - 1)

    if (error) {
      // A table that was never created is not a migration failure.
      if (/does not exist|schema cache/i.test(error.message)) return { rows: [], missing: true }
      throw new Error(`${table}: ${error.message}`)
    }

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
    offset += PAGE
  }

  return { rows, missing: false }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Commits one batch, retrying transient transport failures.
 *
 * DEADLINE_EXCEEDED / UNAVAILABLE are network-level, not data-level: the same
 * batch usually succeeds moments later. Retrying here rather than failing the
 * whole table means one slow moment costs seconds instead of a rerun.
 */
async function commitWithRetry(batch, attempts = 8) {
  for (let attempt = 1; ; attempt++) {
    try {
      await batch.commit()
      return
    } catch (err) {
      const message = err.message || ''
      // The failure this link actually produces is a bare
      // `request to https://firestore.googleapis.com/... failed, reason:` with
      // an EMPTY reason — a dropped connection surfaced by node-fetch. Matching
      // only the named gRPC codes missed it entirely and failed whole tables on
      // the first blip, so the generic transport failure is matched too.
      const transient =
        /DEADLINE_EXCEEDED|UNAVAILABLE|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|fetch failed|failed, reason/i.test(
          message
        ) ||
        err.code === 14 ||
        err.code === 4

      if (!transient || attempt >= attempts) throw err
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000))
    }
  }
}

/**
 * True when the destination already holds every source row.
 *
 * Re-running is safe but not free: over a slow link, rewriting a finished
 * collection costs minutes and starves the ones still missing. Comparing counts
 * first turns a resumed run into a no-op for whatever already landed.
 */
async function alreadyComplete(collection, expected) {
  if (expected === 0) return true
  try {
    const snap = await db.collection(collection).count().get()
    return snap.data().count >= expected
  } catch {
    return false // couldn't check — fall through and write
  }
}

async function writeCollection(collection, key, rows) {
  // Well under Firestore's 500-write cap. Large batches are what pushed a
  // commit past the 60s deadline on this link; smaller ones each finish fast
  // and fail independently.
  const CHUNK = 100
  let written = 0
  let skipped = 0

  // Build every batch up front, then commit a few at a time. Commits are
  // round-trip bound rather than CPU bound, so a little concurrency turns a
  // long serial wait into a much shorter one. Merge writes are idempotent and
  // order-independent, so overlapping them is safe.
  const batches = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = db.batch()
    let queued = 0

    for (const row of rows.slice(i, i + CHUNK)) {
      const rawId = row[key]
      if (rawId === null || rawId === undefined || rawId === '') {
        skipped++
        continue
      }
      // Email-keyed docs are lowercased so lookups never miss on casing.
      const docId =
        key === 'email' ? String(rawId).trim().toLowerCase() : String(rawId).trim()

      batch.set(db.collection(collection).doc(docId), row, { merge: true })
      queued++
    }

    if (queued > 0) batches.push({ batch, queued })
  }

  const CONCURRENCY = 4
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY)
    if (!DRY_RUN) await Promise.all(slice.map(({ batch }) => commitWithRetry(batch)))
    written += slice.reduce((n, b) => n + b.queued, 0)

    // Progress for the long collections, so a slow run is not a silent one.
    if (!DRY_RUN && rows.length > 2000) {
      process.stdout.write(`\n    …${written}/${rows.length}`)
    }
  }

  return { written, skipped }
}

async function main() {
  console.log(
    `\nMigrating Supabase → Firestore (${serviceAccount.project_id})${DRY_RUN ? '  [DRY RUN]' : ''}\n`
  )

  const summary = []
  let failed = 0

  for (const { table, collection, key } of TABLES) {
    process.stdout.write(`  ${table.padEnd(24)}`)
    try {
      const { rows, missing } = await readTable(table)

      if (missing) {
        console.log('— table not present, skipped')
        summary.push({ table, read: 0, written: 0, note: 'absent in Supabase' })
        continue
      }

      if (!DRY_RUN && (await alreadyComplete(collection, rows.length))) {
        console.log(`${String(rows.length).padStart(5)} already present, skipped`)
        summary.push({ table, read: rows.length, written: rows.length, note: 'already complete' })
        continue
      }

      const { written, skipped } = await writeCollection(collection, key, rows)
      console.log(
        `${String(rows.length).padStart(5)} read → ${String(written).padStart(5)} written` +
          (skipped ? `  (${skipped} skipped: no ${key})` : '')
      )
      summary.push({ table, read: rows.length, written, note: skipped ? `${skipped} skipped` : '' })
    } catch (err) {
      failed++
      console.log(`FAILED — ${err.message}`)
      summary.push({ table, read: 0, written: 0, note: `FAILED: ${err.message}` })
    }
  }

  const totalRead = summary.reduce((n, s) => n + s.read, 0)
  const totalWritten = summary.reduce((n, s) => n + s.written, 0)

  console.log(
    `\n${DRY_RUN ? 'Would migrate' : 'Migrated'} ${totalWritten}/${totalRead} documents across ${TABLES.length} collections.`
  )
  if (failed > 0) {
    console.log(`${failed} table(s) failed — see above. Re-running is safe.`)
    process.exit(1)
  }
  if (DRY_RUN) console.log('Dry run: nothing was written. Re-run without --dry-run to apply.\n')
}

main().catch((err) => {
  console.error('\nMigration aborted:', err)
  process.exit(1)
})
