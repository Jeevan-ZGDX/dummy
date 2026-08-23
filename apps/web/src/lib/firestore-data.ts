import { getAdminDb, isAdminConfigured } from './firebase/admin'
import { COLLECTIONS } from './firebase/config'

/**
 * Server-side Firestore data access. This is the direct replacement for the old
 * `supabase-client.ts` and keeps the same function shapes, so call sites only
 * change their import.
 *
 * Documents deliberately keep the snake_case field names the Postgres tables
 * used (`roll_number`, `registered_competitions`, …). That makes the migration a
 * straight row→document copy and lets all the existing mappers below carry over
 * unchanged, instead of introducing a second naming convention mid-migration.
 */

export function isFirestoreConfigured(): boolean {
  return isAdminConfigured()
}

type Row = Record<string, any>

/**
 * Reads a whole collection and sorts in memory.
 *
 * Firestore's `orderBy` silently *excludes* documents missing the sort field,
 * which would quietly drop records the way the old unbounded PostgREST select
 * dropped rows past 1,000. Sorting here keeps every document and avoids needing
 * a composite index for each ordering.
 */
async function readAll(
  collection: string,
  sort?: { field: string; direction?: 'asc' | 'desc' }
): Promise<Row[]> {
  const db = getAdminDb()
  if (!db) return []

  try {
    const snapshot = await db.collection(collection).get()
    const rows: Row[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    if (sort) {
      const { field, direction = 'asc' } = sort
      const factor = direction === 'asc' ? 1 : -1
      rows.sort((a, b) => {
        const av = a[field]
        const bv = b[field]
        if (av == null && bv == null) return 0
        if (av == null) return 1 // missing values sort last regardless of direction
        if (bv == null) return -1
        if (av === bv) return 0
        return av < bv ? -factor : factor
      })
    }

    return rows
  } catch (err) {
    console.error(`Firestore read ${collection} failed:`, (err as Error).message)
    return []
  }
}

/** Upsert by document id, mirroring the old `upsert(..., { onConflict: 'id' })`. */
async function writeDoc(
  collection: string,
  id: string,
  data: Row
): Promise<{ success: boolean; reason?: string }> {
  const db = getAdminDb()
  if (!db) return { success: false, reason: 'missing-config' }
  if (!id) return { success: false, reason: 'missing-id' }

  try {
    await db.collection(collection).doc(String(id)).set(data, { merge: true })
    return { success: true }
  } catch (err) {
    return { success: false, reason: (err as Error).message }
  }
}

/** Batched upsert — Firestore caps a batch at 500 writes, so chunk. */
async function writeMany(
  collection: string,
  rows: Array<{ id: string; data: Row }>
): Promise<{ success: boolean; reason?: string }> {
  const db = getAdminDb()
  if (!db) return { success: false, reason: 'missing-config' }
  if (rows.length === 0) return { success: true }

  const CHUNK = 450
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = db.batch()
      for (const { id, data } of rows.slice(i, i + CHUNK)) {
        if (!id) continue
        batch.set(db.collection(collection).doc(String(id)), data, { merge: true })
      }
      await batch.commit()
    }
    return { success: true }
  } catch (err) {
    return { success: false, reason: (err as Error).message }
  }
}

const nowIso = () => new Date().toISOString()

// ─── Students ──────────────────────────────────────────────────────
export async function fetchStudents() {
  const rows = await readAll(COLLECTIONS.students, { field: 'name' })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || 'CSE',
    year: row.year || '2nd Year',
    section: row.section || 'A',
    registeredCompetitions: row.registered_competitions || 0,
    verifiedCompetitions: row.verified_competitions || 0,
    createdAt: row.created_at || nowIso(),
  }))
}

export async function upsertStudents(rows: Array<Record<string, unknown>>) {
  return writeMany(
    COLLECTIONS.students,
    rows.map((r) => ({
      id: String(r.id),
      data: {
        name: r.name,
        email: r.email,
        department: r.department || 'CSE',
        year: r.year || '2nd Year',
        section: r.section || 'A',
        roll_number: r.rollNumber || r.roll_number || null,
        phone: r.phone || null,
        registered_competitions: r.registeredCompetitions || r.registered_competitions || 0,
        verified_competitions: r.verifiedCompetitions || r.verified_competitions || 0,
      },
    }))
  )
}

export async function insertStudent(student: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.students, String(student.id), {
    name: student.name,
    email: student.email,
    department: student.department || 'CSE',
    year: student.year || '2nd Year',
    section: student.section || 'A',
    roll_number: student.rollNumber || null,
    phone: student.phone || null,
    registered_competitions: 0,
    verified_competitions: 0,
    created_at: nowIso(),
  })
}

// ─── Advisors ──────────────────────────────────────────────────────
export async function fetchAdvisors() {
  const rows = await readAll(COLLECTIONS.advisors, { field: 'name' })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || 'CSE',
    assignedSections: row.assigned_sections || [],
    pendingVerifications: row.pending_verifications || 0,
    phone: row.phone || null,
    officeLocation: row.office_location || null,
    experience: row.experience || 0,
    publications: row.publications || 0,
    createdAt: row.created_at || nowIso(),
  }))
}

export async function upsertAdvisor(advisor: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.advisors, String(advisor.id), {
    name: advisor.name,
    email: advisor.email,
    department: advisor.department || 'CSE',
    assigned_sections: advisor.assignedSections || advisor.assigned_sections || [],
    pending_verifications:
      advisor.pendingVerifications || advisor.pending_verifications || 0,
    phone: advisor.phone || null,
    office_location: advisor.officeLocation || advisor.office_location || null,
    experience: advisor.experience || 0,
    publications: advisor.publications || 0,
  })
}

// ─── Competitions ──────────────────────────────────────────────────
export async function fetchCompetitions() {
  const rows = await readAll(COLLECTIONS.competitions, {
    field: 'created_at',
    direction: 'desc',
  })
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    shortDescription: row.short_description || '',
    category: row.category,
    scope: row.scope,
    mode: row.mode,
    organizer: row.organizer,
    organizerLogo: row.organizer_logo,
    bannerUrl: row.banner_url,
    websiteUrl: row.website_url || '',
    registrationUrl: row.registration_url || '',
    teamSizeMin: row.team_size_min || 1,
    teamSizeMax: row.team_size_max || 1,
    prizePool: row.prize_pool || '',
    registrationDeadline: row.registration_deadline,
    startDate: row.start_date,
    endDate: row.end_date,
    eligibility: row.eligibility || {},
    tags: row.tags || [],
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  }))
}

export async function upsertCompetition(comp: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.competitions, String(comp.id), {
    title: comp.title,
    description: comp.description || '',
    short_description: comp.shortDescription || comp.short_description || '',
    category: comp.category,
    scope: comp.scope,
    mode: comp.mode,
    organizer: comp.organizer,
    organizer_logo: comp.organizerLogo || null,
    banner_url: comp.bannerUrl || null,
    website_url: comp.websiteUrl || '',
    registration_url: comp.registrationUrl || '',
    team_size_min: comp.teamSizeMin || comp.team_size_min || 1,
    team_size_max: comp.teamSizeMax || comp.team_size_max || 1,
    prize_pool: comp.prizePool || comp.prize_pool || '',
    registration_deadline: comp.registrationDeadline || null,
    start_date: comp.startDate || comp.start_date || null,
    end_date: comp.endDate || comp.end_date || null,
    eligibility: comp.eligibility || {},
    tags: comp.tags || [],
    updated_at: nowIso(),
  })
}

// ─── Registrations ─────────────────────────────────────────────────
export async function fetchRegistrations() {
  const rows = await readAll(COLLECTIONS.registrations, {
    field: 'created_at',
    direction: 'desc',
  })
  return rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    userId: row.user_id,
    userName: row.user_name,
    department: row.department || 'CSE',
    status: row.status || 'pending_verification',
    registeredAt: row.registered_at,
    verifiedAt: row.verified_at,
    verificationMethod: row.verification_method,
    extractedConfirmationId: row.extracted_confirmation_id,
    extractedEmail: row.extracted_email,
    rejectionReason: row.rejection_reason,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function upsertRegistration(reg: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.registrations, String(reg.id), {
    competition_id: reg.competitionId,
    user_id: reg.userId,
    user_name: reg.userName,
    department: reg.department || 'CSE',
    status: reg.status || 'pending_verification',
    registered_at: reg.registeredAt || nowIso(),
    verified_at: reg.verifiedAt || null,
    verification_method: reg.verificationMethod || null,
    extracted_confirmation_id: reg.extractedConfirmationId || null,
    extracted_email: reg.extractedEmail || null,
    rejection_reason: reg.rejectionReason || null,
    notes: reg.notes || null,
    updated_at: nowIso(),
  })
}

// ─── Winners ───────────────────────────────────────────────────────
export async function fetchWinners() {
  const rows = await readAll(COLLECTIONS.winners, {
    field: 'created_at',
    direction: 'desc',
  })
  return rows.map((row) => ({
    id: row.id,
    studentName: row.student_name,
    email: row.email,
    competition: row.competition,
    competitionId: row.competition_id,
    department: row.department || 'CSE',
    position: row.position || '',
    prize: row.prize || '',
    date: row.date,
    verificationDate: row.verification_date,
    registrationId: row.registration_id,
  }))
}

export async function upsertWinner(winner: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.winners, String(winner.id), {
    student_name: winner.studentName,
    email: winner.email,
    competition: winner.competition,
    competition_id: winner.competitionId || null,
    department: winner.department || 'CSE',
    position: winner.position || '',
    prize: winner.prize || '',
    date: winner.date || null,
    verification_date: winner.verificationDate || null,
    registration_id: winner.registrationId || null,
  })
}

// ─── Prize Amount (Cumulative per Student) ───────────────────────────
function extractNumericPrize(prizeStr: string): number {
  if (!prizeStr) return 0
  const upper = prizeStr.toUpperCase()
  const croreMatch = upper.match(/([\d,.]+)\s*CRORE/)
  if (croreMatch) return parseFloat(croreMatch[1].replace(/,/g, '')) * 10000000
  const lakhMatch = upper.match(/([\d,.]+)\s*LAKH/)
  if (lakhMatch) return parseFloat(lakhMatch[1].replace(/,/g, '')) * 100000
  const rupeeMatch = upper.match(/₹\s*([\d,]+)/)
  if (rupeeMatch) return parseFloat(rupeeMatch[1].replace(/,/g, ''))
  const dollarMatch = prizeStr.match(/\$\s*([\d,]+)/)
  if (dollarMatch) return parseFloat(dollarMatch[1].replace(/,/g, ''))
  const numMatch = prizeStr.match(/([\d,]+)/)
  if (numMatch) return parseFloat(numMatch[1].replace(/,/g, ''))
  return 0
}

export async function updatePrizeAmountForWinner(winner: Record<string, unknown>) {
  const email = String(winner.email || '').toLowerCase().trim()
  const prizeStr = (winner.prize || '') as string
  const studentName = (winner.studentName || '') as string
  const section = (winner.section || '') as string
  const competition = (winner.competition || '') as string

  if (!email) return

  const db = getAdminDb()
  if (!db) return

  const prizeValue = extractNumericPrize(prizeStr)
  if (prizeValue <= 0) return

  const docRef = db.collection(COLLECTIONS.prizeAmount).doc(email)

  try {
    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef)
      const existing = docSnap.exists ? docSnap.data() : null
      const currentTotal = existing?.total_prize_amount || 0
      const currentWins = existing?.wins || 0
      const competitions = existing?.competitions || []
      if (!competitions.includes(competition)) {
        competitions.push(competition)
      }

      transaction.set(docRef, {
        email,
        student_name: studentName,
        section,
        total_prize_amount: currentTotal + prizeValue,
        wins: currentWins + 1,
        competitions,
        last_updated: new Date().toISOString(),
      }, { merge: true })
    })
  } catch (err) {
    console.error('Failed to update prize amount:', (err as Error).message)
  }
}

// ─── Notifications ─────────────────────────────────────────────────
function mapNotification(row: Row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    data: row.data,
    isRead: row.is_read,
    createdAt: row.created_at,
  }
}

/**
 * Reads the ENTIRE notifications collection.
 *
 * Retained only for callers that genuinely need every row. Prefer
 * `fetchNotificationsForUser` — this collection holds ~15,000 documents and
 * Firestore bills per document returned, so one unscoped call is roughly a
 * third of the free daily read quota.
 */
export async function fetchNotifications(userId?: string) {
  const rows = await readAll(COLLECTIONS.notifications, {
    field: 'created_at',
    direction: 'desc',
  })
  const scoped = userId ? rows.filter((row) => row.user_id === userId) : rows
  return scoped.map(mapNotification)
}

/**
 * One user's notifications, newest first.
 *
 * Scoped and capped in the QUERY rather than after the fact. The previous path
 * pulled all ~15,000 documents into memory and filtered there, so every caller
 * paid ~15,000 reads to look at their own handful — the single largest source
 * of read-quota burn in the app.
 */
export async function fetchNotificationsForUser(userId: string, limit = 50) {
  const db = getAdminDb()
  if (!db || !userId) return []

  const scoped = db.collection(COLLECTIONS.notifications).where('user_id', '==', userId)

  let docs
  try {
    // Needs the composite index declared in firestore.indexes.json.
    docs = (await scoped.orderBy('created_at', 'desc').limit(limit).get()).docs
  } catch (err) {
    // FAILED_PRECONDITION means the composite index is not deployed yet.
    // Fall back to an unordered scoped read and sort here: still only this
    // user's documents, so the quota win holds even before the index exists.
    console.warn('Notification index unavailable, sorting in memory:', (err as Error).message)
    docs = (await scoped.limit(Math.max(limit, 200)).get()).docs
  }

  const rows: Row[] = docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  return rows.slice(0, limit).map(mapNotification)
}

/**
 * Unread count for one user.
 *
 * Uses Firestore's `count()` aggregation, which bills one read per 1,000 index
 * entries scanned instead of one per document — so this stays cheap even as the
 * collection grows. The two filters are both equality, which Firestore serves
 * from automatic single-field indexes; no composite index is required.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const db = getAdminDb()
  if (!db || !userId) return 0

  try {
    const snap = await db
      .collection(COLLECTIONS.notifications)
      .where('user_id', '==', userId)
      .where('is_read', '==', false)
      .count()
      .get()
    return snap.data().count
  } catch (err) {
    console.error('Unread notification count failed:', (err as Error).message)
    return 0
  }
}

/** Marks one notification read without loading the collection. */
export async function markNotificationRead(id: string): Promise<boolean> {
  const db = getAdminDb()
  if (!db || !id) return false

  try {
    await db.collection(COLLECTIONS.notifications).doc(String(id)).set(
      { is_read: true },
      { merge: true }
    )
    return true
  } catch (err) {
    console.error('Marking notification read failed:', (err as Error).message)
    return false
  }
}

function notificationDoc(notif: Record<string, unknown>) {
  return {
    user_id: notif.userId,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    data: notif.data || null,
    is_read: notif.isRead || false,
    created_at: notif.createdAt || nowIso(),
  }
}

export async function upsertNotification(notif: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.notifications, String(notif.id), notificationDoc(notif))
}

export async function upsertNotifications(notifs: Record<string, unknown>[]) {
  return writeMany(
    COLLECTIONS.notifications,
    notifs.map((n) => ({ id: String(n.id), data: notificationDoc(n) }))
  )
}

// ─── Audit Logs ────────────────────────────────────────────────────
export async function fetchAuditLogs() {
  const rows = await readAll(COLLECTIONS.auditLogs, {
    field: 'timestamp',
    direction: 'desc',
  })
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    user: row.user,
    action: row.action,
    resource: row.resource,
    details: row.details || '',
  }))
}

export async function insertAuditLog(log: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.auditLogs, String(log.id), {
    timestamp: log.timestamp || nowIso(),
    user: log.user,
    action: log.action,
    resource: log.resource,
    details: log.details || '',
  })
}

// ─── Verification Requests ─────────────────────────────────────────
export async function fetchVerificationRequests() {
  const rows = await readAll(COLLECTIONS.verificationRequests, {
    field: 'requested_at',
    direction: 'desc',
  })
  return rows.map((row) => ({
    id: row.id,
    registrationId: row.registration_id,
    studentId: row.student_id,
    studentName: row.student_name,
    department: row.department || 'CSE',
    competitionTitle: row.competition_title || '',
    advisorNotified: row.advisor_notified || false,
    emailProof: row.email_proof,
    status: row.status || 'pending',
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at,
  }))
}

export async function upsertVerificationRequest(vr: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.verificationRequests, String(vr.id), {
    registration_id: vr.registrationId,
    student_id: vr.studentId,
    student_name: vr.studentName,
    department: vr.department || 'CSE',
    competition_title: vr.competitionTitle || '',
    advisor_notified: vr.advisorNotified || false,
    email_proof: vr.emailProof || null,
    status: vr.status || 'pending',
    requested_at: vr.requestedAt || nowIso(),
    reviewed_at: vr.reviewedAt || null,
  })
}

// ─── Competition Dashboard (External) ──────────────────────────────
export async function fetchCompetitionDashboard() {
  const rows = await readAll(COLLECTIONS.competitionDashboard, { field: 'serial_no' })
  return rows.map(mapCompetitionDashboardRow)
}

/** Exported so the realtime client hook maps documents identically. */
export function mapCompetitionDashboardRow(row: Row) {
  return {
    id: row.id,
    serialNo: row.serial_no,
    competitionName: row.competition_name,
    competitionStatus: row.competition_status,
    eligibleYear: row.eligible_year,
    regDeadline: row.reg_deadline,
    r1Date: row.r1_date,
    r2Date: row.r2_date,
    remainingDaysForReg: row.remaining_days_for_reg,
    rDaysForR1: row.r_days_for_r1,
    rDaysForR2: row.r_days_for_r2,
    regTeam: row.reg_team,
    totalPrizeAmount: row.total_prize_amount,
    category: row.category,
    organizer: row.organizer,
    organizerEmail: row.organizer_email,
    websiteUrl: row.website_url,
    registrationLink: row.registration_link,
    description: row.description,
    shortDescription: row.short_description,
    scope: row.scope,
    mode: row.mode,
    teamSizeMin: row.team_size_min,
    teamSizeMax: row.team_size_max,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertCompetitionDashboardItem(item: Record<string, unknown>) {
  return writeDoc(COLLECTIONS.competitionDashboard, String(item.id), {
    serial_no: item.serialNo || item.serial_no || Math.floor(Date.now() / 1000),
    competition_name: item.competitionName || item.competition_name || item.title || '',
    competition_status: item.competitionStatus || item.competition_status || 'On Going',
    eligible_year: item.eligibleYear || item.eligible_year || ((item.eligibility as any)?.yearOfStudy?.[0]) || '',
    reg_deadline: item.regDeadline || item.reg_deadline || item.registrationDeadline || null,
    r1_date: item.r1Date || item.r1_date || item.startDate || null,
    r2_date: item.r2Date || item.r2_date || item.endDate || null,
    remaining_days_for_reg: item.remainingDaysForReg ?? item.remaining_days_for_reg ?? 0,
    r_days_for_r1: item.rDaysForR1 ?? item.r_days_for_r1 ?? 0,
    r_days_for_r2: item.rDaysForR2 ?? item.r_days_for_r2 ?? 0,
    reg_team: item.regTeam ?? item.reg_team ?? 0,
    total_prize_amount: item.totalPrizeAmount || item.total_prize_amount || item.prizePool || '',
    category: (item.category as string)?.toLowerCase() || 'competition',
    organizer: item.organizer || '',
    organizer_email: item.organizerEmail || item.organizer_email || '',
    website_url: item.registrationUrl || item.websiteUrl || item.website_url || '',
    registration_link: item.registrationLink || item.registration_link || '',
    description: item.description || '',
    short_description: item.shortDescription || item.short_description || '',
    scope: item.scope || 'national',
    mode: item.mode || 'online',
    team_size_min: item.teamSizeMin || item.team_size_min || 1,
    team_size_max: item.teamSizeMax || item.team_size_max || 1,
    tags: typeof item.tags === 'string' ? item.tags : JSON.stringify(item.tags || []),
    created_at: item.createdAt || item.created_at || nowIso(),
    updated_at: nowIso(),
  })
}

// ─── Role Access ───────────────────────────────────────────────────
export async function fetchRoleAccess() {
  const rows = await readAll(COLLECTIONS.roleAccess)
  return rows.map((row) => ({
    email: row.email || row.id,
    role: row.role,
    department: row.department || 'CSE',
    granted: row.granted || false,
  }))
}

/**
 * Keyed by email rather than a synthetic id — the old table used
 * `onConflict: 'email'`, and using it as the document id keeps the lookup in
 * `resolveUserFromDatabase` a single point read instead of a query.
 */
export async function upsertRoleAccess(access: Record<string, unknown>) {
  const email = String(access.email || '').trim().toLowerCase()
  return writeDoc(COLLECTIONS.roleAccess, email, {
    email,
    role: access.role,
    department: access.department || 'CSE',
    granted: access.granted || false,
  })
}

/** Single-document lookups used by the auth layer. */
export async function getDocById(collection: string, id: string): Promise<Row | null> {
  const db = getAdminDb()
  if (!db || !id) return null
  try {
    const snap = await db.collection(collection).doc(String(id)).get()
    return snap.exists ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    console.error(`Firestore get ${collection}/${id} failed:`, (err as Error).message)
    return null
  }
}

/** Upsert into any collection by explicit document id. */
export async function writeDocById(collection: string, id: string, data: Row) {
  return writeDoc(collection, id, data)
}

export async function writeGmailTokenDoc(userId: string, data: Row) {
  return writeDoc(COLLECTIONS.gmailTokens, userId, data)
}

/** Partial update of an existing document. Fails if the document is absent. */
export async function updateDocById(
  collection: string,
  id: string,
  data: Row
): Promise<{ success: boolean; reason?: string }> {
  const db = getAdminDb()
  if (!db) return { success: false, reason: 'missing-config' }
  try {
    await db.collection(collection).doc(String(id)).update(data)
    return { success: true }
  } catch (err) {
    return { success: false, reason: (err as Error).message }
  }
}

export async function deleteDocById(
  collection: string,
  id: string
): Promise<{ success: boolean; reason?: string }> {
  const db = getAdminDb()
  if (!db) return { success: false, reason: 'missing-config' }
  try {
    await db.collection(collection).doc(String(id)).delete()
    return { success: true }
  } catch (err) {
    return { success: false, reason: (err as Error).message }
  }
}

/** Creates a document with a generated id, returning the stored shape. */
export async function createDoc(
  collection: string,
  data: Row
): Promise<Row | null> {
  const db = getAdminDb()
  if (!db) return null
  try {
    const ref = db.collection(collection).doc()
    await ref.set({ ...data, created_at: data.created_at || nowIso() })
    const snap = await ref.get()
    return { id: ref.id, ...snap.data() }
  } catch (err) {
    console.error(`Firestore create ${collection} failed:`, (err as Error).message)
    return null
  }
}

/** All documents matching a field equality. */
export async function queryByField(
  collection: string,
  field: string,
  value: unknown
): Promise<Row[]> {
  const db = getAdminDb()
  if (!db) return []
  try {
    const snap = await db.collection(collection).where(field, '==', value).get()
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error(`Firestore query ${collection}.${field} failed:`, (err as Error).message)
    return []
  }
}

/** Cheap liveness probe used by /api/health. */
export async function pingFirestore(): Promise<{ ok: boolean; error?: string }> {
  const db = getAdminDb()
  if (!db) return { ok: false, error: 'missing-config' }
  try {
    await db.collection(COLLECTIONS.competitionDashboard).limit(1).get()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

/** Finds one document by field equality; returns null when nothing matches. */
export async function findOneByField(
  collection: string,
  field: string,
  value: unknown
): Promise<Row | null> {
  const db = getAdminDb()
  if (!db) return null
  try {
    const snap = await db.collection(collection).where(field, '==', value).limit(1).get()
    if (snap.empty) return null
    const doc = snap.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (err) {
    console.error(`Firestore query ${collection}.${field} failed:`, (err as Error).message)
    return null
  }
}
