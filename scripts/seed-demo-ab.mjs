/**
 * Seeds the 3rd-year CSE A/B demo.
 *
 * Additive only — it creates documents and never edits or deletes existing
 * ones. Everything it writes carries `seeded_by: SEED_TAG`, so the whole set
 * can be identified and removed later with `--undo`.
 *
 *   node --env-file=.env scripts/seed-demo-ab.mjs            # dry run (default)
 *   node --env-file=.env scripts/seed-demo-ab.mjs --commit   # actually write
 *   node --env-file=.env scripts/seed-demo-ab.mjs --undo     # remove what it wrote
 *
 * See DEMO_PLAN_CSE_A_B.md §4 for why each piece is needed.
 */
import admin from 'firebase-admin'
import { randomUUID } from 'crypto'

const COMMIT = process.argv.includes('--commit')
const UNDO = process.argv.includes('--undo')
const SEED_TAG = 'demo-ab-2026-08-30'

const COMPETITION_ID = 'dash-002'
const COMPETITION_NAME = 'HACK CORE 2026'

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
})
const db = admin.firestore()

const nowIso = () => new Date().toISOString()

/** Advisors whose only missing piece is the role grant (see plan §1). */
const ADVISOR_GRANTS = [
  { email: 'santhoshkumarr.cse@citchennai.net', name: 'Mr.Santhoshkumar', section: 'B' },
  { email: 'devsris.cse@citchennai.net', name: 'Ms.Dev sri', section: 'B' },
  { email: 'hemalathar.cse@citchennai.net', name: 'Ms.Hemalatha', section: 'A' },
]

/**
 * Status mix for section A. Deliberately leaves 5 pending: the live approval in
 * Act 2 needs something to approve, and a demo that consumes its only pending
 * row in rehearsal has nothing left on stage.
 */
const A_MIX = [
  ...Array(7).fill('verified'),
  ...Array(5).fill('pending'),
  ...Array(3).fill('rejected'),
]

async function undo() {
  let removed = 0
  for (const col of ['student_competitions', 'role_access', 'competition_dashboard']) {
    const snap = await db.collection(col).where('seeded_by', '==', SEED_TAG).get()
    if (snap.empty) continue
    if (COMMIT) {
      const batch = db.batch()
      snap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    removed += snap.size
    console.log(`${COMMIT ? 'deleted' : 'would delete'} ${snap.size} from ${col}`)
  }
  console.log(`\n${COMMIT ? 'removed' : 'would remove'} ${removed} documents tagged ${SEED_TAG}`)
  if (!COMMIT) console.log('(dry run — add --commit to apply)')
}

async function seed() {
  const plan = []

  // ── 1. The competition every existing registration already points at ──────
  const compRef = db.collection('competition_dashboard').doc(COMPETITION_ID)
  const compSnap = await compRef.get()
  const competition = {
    id: COMPETITION_ID,
    competition_name: COMPETITION_NAME,
    category: 'hackathon',
    organizer: 'Chennai Institute of Technology',
    organizer_email: '',
    total_prize_amount: '100000',
    website_url: '',
    registration_link: '',
    description:
      'A 24-hour inter-departmental hackathon. Teams build and pitch a working prototype.',
    short_description: '24-hour inter-departmental hackathon',
    scope: 'institution',
    mode: 'offline',
    team_size_min: 1,
    team_size_max: 4,
    tags: '[]',
    // Roman numerals are what parseEligibleYears() reads; "III" is what makes
    // this visible to 3rd years and only 3rd years.
    eligible_year: 'III',
    reg_deadline: '2026-09-15',
    r1_date: null,
    r2_date: null,
    competition_status: 'On Going',
    serial_no: 1,
    created_at: nowIso(),
    seeded_by: SEED_TAG,
  }
  if (compSnap.exists) {
    console.log(`• competition ${COMPETITION_ID} already exists — leaving it alone`)
  } else {
    plan.push(['competition_dashboard', COMPETITION_ID, competition])
    console.log(`• create competition_dashboard/${COMPETITION_ID} — "${COMPETITION_NAME}" (eligible_year: III)`)
  }

  // ── 2. Role grants, without which section B has no usable advisor ─────────
  for (const a of ADVISOR_GRANTS) {
    const ref = db.collection('role_access').doc(a.email)
    if ((await ref.get()).exists) {
      console.log(`• role_access/${a.email} already exists — leaving it alone`)
      continue
    }
    plan.push([
      'role_access',
      a.email,
      {
        email: a.email,
        role: 'advisor',
        department: 'CSE',
        granted: true,
        name: a.name,
        seeded_by: SEED_TAG,
      },
    ])
    console.log(`• grant advisor role to ${a.name} <${a.email}> (section ${a.section})`)
  }

  // ── 3. Section A registrations ───────────────────────────────────────────
  const existingA = await db
    .collection('student_competitions')
    .where('competition_id', '==', COMPETITION_ID)
    .get()
  const already = new Set(existingA.docs.map((d) => d.data().student_email))

  const students = (
    await db.collection('students').where('section', '==', '3%A').get()
  ).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.year === '3rd Year' && !already.has(s.email))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, A_MIX.length)

  if (students.length < A_MIX.length) {
    console.warn(`! only ${students.length} unregistered 3%A students available (wanted ${A_MIX.length})`)
  }

  students.forEach((s, i) => {
    const status = A_MIX[i]
    const id = randomUUID()
    plan.push([
      'student_competitions',
      id,
      {
        id,
        student_id: s.id,
        student_email: s.email,
        student_name: s.name,
        competition_id: COMPETITION_ID,
        competition_name: COMPETITION_NAME,
        verification_status: status,
        verification_method: 'demo-seed',
        verified_at: status === 'verified' ? nowIso() : null,
        registration_link: null,
        gmail_thread_id: null,
        gmail_message_id: null,
        created_at: nowIso(),
        updated_at: nowIso(),
        seeded_by: SEED_TAG,
      },
    ])
  })

  const counts = A_MIX.slice(0, students.length).reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {})
  console.log(`• seed ${students.length} section-A registrations: ${JSON.stringify(counts)}`)

  // ── Apply ────────────────────────────────────────────────────────────────
  console.log(`\n${plan.length} documents to write.`)
  if (!COMMIT) {
    console.log('DRY RUN — nothing written. Re-run with --commit to apply.')
    return
  }
  for (let i = 0; i < plan.length; i += 400) {
    const batch = db.batch()
    for (const [col, id, data] of plan.slice(i, i + 400)) {
      batch.set(db.collection(col).doc(id), data)
    }
    await batch.commit()
  }
  console.log(`✓ wrote ${plan.length} documents (tagged ${SEED_TAG})`)
}

await (UNDO ? undo() : seed())
process.exit(0)
