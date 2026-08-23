import dotenv from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: resolve(__dirname, '../.env'), override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[CRON] Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

interface Competition {
  id: string
  title: string
  registration_deadline: string | null
  registration_url: string
  category: string
}

interface Student {
  id: string
  name: string
  email: string
  department: string
  year: string
  section: string
}

interface Advisor {
  id: string
  name: string
  email: string
  department: string
  assigned_sections: string[]
}

interface Registration {
  id: string
  competition_id: string
  user_id: string
  status: string
}

interface VerificationRequest {
  id: string
  registration_id: string
  student_id: string
  student_name: string
  department: string
  competition_title: string
  status: string
  requested_at: string
}

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const prefix = `[CRON] [${level.toUpperCase()}]`
  if (meta) {
    console[level === 'error' ? 'error' : 'log'](`${timestamp} ${prefix} ${message}`, meta)
  } else {
    console[level === 'error' ? 'error' : 'log'](`${timestamp} ${prefix} ${message}`)
  }
}

async function fetchUpcomingCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, title, registration_deadline, registration_url, category')
    .not('registration_deadline', 'is', null)
    .gte('registration_deadline', new Date().toISOString().split('T')[0])

  if (error) {
    // Table might not exist yet - handle gracefully
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Competitions table not found, skipping deadline reminders')
      return []
    }
    log('error', 'Failed to fetch upcoming competitions', { error: error.message })
    throw new Error(`Failed to fetch competitions: ${error.message}`)
  }

  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    registration_deadline: row.registration_deadline,
    registration_url: row.registration_url,
    category: row.category,
  }))
}

async function fetchAllStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, email, department, year, section')

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Students table not found, returning empty array')
      return []
    }
    log('error', 'Failed to fetch students', { error: error.message })
    throw new Error(`Failed to fetch students: ${error.message}`)
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || 'CSE',
    year: row.year || '2nd Year',
    section: row.section || 'A',
  }))
}

async function fetchAllAdvisors(): Promise<Advisor[]> {
  const { data, error } = await supabase
    .from('advisors')
    .select('id, name, email, department, assigned_sections')

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Advisors table not found, returning empty array')
      return []
    }
    log('error', 'Failed to fetch advisors', { error: error.message })
    throw new Error(`Failed to fetch advisors: ${error.message}`)
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    department: row.department || 'CSE',
    assigned_sections: row.assigned_sections || [],
  }))
}

async function fetchRegistrations(): Promise<Registration[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, competition_id, user_id, status')

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Registrations table not found, returning empty array')
      return []
    }
    log('error', 'Failed to fetch registrations', { error: error.message })
    throw new Error(`Failed to fetch registrations: ${error.message}`)
  }

  return (data || []).map(row => ({
    id: row.id,
    competition_id: row.competition_id,
    user_id: row.user_id,
    status: row.status,
  }))
}

async function fetchPendingVerificationRequests(): Promise<VerificationRequest[]> {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('id, registration_id, student_id, student_name, department, competition_title, status, requested_at')
    .eq('status', 'pending')

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Verification requests table not found, returning empty array')
      return []
    }
    log('error', 'Failed to fetch pending verification requests', { error: error.message })
    throw new Error(`Failed to fetch verification requests: ${error.message}`)
  }

  return (data || []).map(row => ({
    id: row.id,
    registration_id: row.registration_id,
    student_id: row.student_id,
    student_name: row.student_name,
    department: row.department,
    competition_title: row.competition_title,
    status: row.status,
    requested_at: row.requested_at,
  }))
}

async function upsertNotifications(notifications: Notification[]): Promise<{ inserted: number; skipped: number }> {
  if (notifications.length === 0) return { inserted: 0, skipped: 0 }

  const rows = notifications.map(n => ({
    id: n.id,
    user_id: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    data: n.data,
    is_read: n.is_read,
    created_at: n.created_at,
  }))

  const { data, error } = await supabase
    .from('notifications')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Notifications table not found, skipping upsert')
      return { inserted: 0, skipped: notifications.length }
    }
    log('error', 'Failed to upsert notifications', { error: error.message })
    throw new Error(`Failed to upsert notifications: ${error.message}`)
  }

  const inserted = data?.length || 0
  const skipped = notifications.length - inserted

  log('info', 'Notifications upserted', { inserted, skipped, total: notifications.length })
  return { inserted, skipped }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

async function sendDeadlineReminders(): Promise<{ sent: number; skipped: number }> {
  log('info', 'Starting deadline reminder job')

  const [competitions, students, registrations] = await Promise.all([
    fetchUpcomingCompetitions(),
    fetchAllStudents(),
    fetchRegistrations(),
  ])

  if (competitions.length === 0) {
    log('info', 'No upcoming competitions with deadlines found')
    return { sent: 0, skipped: 0 }
  }

  log('info', 'Found upcoming competitions', { count: competitions.length })

  const registrationMap = new Map<string, Set<string>>()
  for (const reg of registrations) {
    if (!registrationMap.has(reg.competition_id)) {
      registrationMap.set(reg.competition_id, new Set())
    }
    registrationMap.get(reg.competition_id)!.add(reg.user_id)
  }

  const notifications: Notification[] = []
  const reminderDays = [7, 3, 1]

  for (const competition of competitions) {
    if (!competition.registration_deadline) continue

    const daysLeft = daysUntil(competition.registration_deadline)

    if (!reminderDays.includes(daysLeft)) continue

    const registeredStudentIds = registrationMap.get(competition.id) || new Set()
    const eligibleStudents = students.filter(s => !registeredStudentIds.has(s.id))

    for (const student of eligibleStudents) {
      const notificationId = `notif-deadline-${competition.id}-${student.id}-${daysLeft}d`

      notifications.push({
        id: notificationId,
        user_id: student.id,
        type: 'deadline_reminder',
        title: `Registration Deadline in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`,
        message: `Don't miss out on "${competition.title}" (${competition.category}). Registration closes on ${new Date(competition.registration_deadline).toLocaleDateString()}.`,
        data: {
          competitionId: competition.id,
          competitionTitle: competition.title,
          daysUntilDeadline: daysLeft,
          registrationUrl: competition.registration_url,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      })
    }
  }

  const result = await upsertNotifications(notifications)
  log('info', 'Deadline reminders completed', { sent: result.inserted, skipped: result.skipped })

  return { sent: result.inserted, skipped: result.skipped }
}

async function sendVerificationReminders(): Promise<{ sent: number; skipped: number }> {
  log('info', 'Starting verification reminder job')

  const [verificationRequests, advisors] = await Promise.all([
    fetchPendingVerificationRequests(),
    fetchAllAdvisors(),
  ])

  if (verificationRequests.length === 0) {
    log('info', 'No pending verification requests found')
    return { sent: 0, skipped: 0 }
  }

  log('info', 'Found pending verification requests', { count: verificationRequests.length })

  const notifications: Notification[] = []

  for (const vr of verificationRequests) {
    const relevantAdvisors = advisors.filter(a =>
      a.department === vr.department &&
      a.assigned_sections.length > 0
    )

    if (relevantAdvisors.length === 0) {
      log('warn', 'No advisors found for verification request', {
        verificationRequestId: vr.id,
        department: vr.department,
      })
      continue
    }

    const requestedDate = new Date(vr.requested_at)
    const daysPending = Math.floor((Date.now() - requestedDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysPending < 1) continue

    for (const advisor of relevantAdvisors) {
      const notificationId = `notif-verify-${vr.id}-${advisor.id}`

      notifications.push({
        id: notificationId,
        user_id: advisor.id,
        type: 'verification_reminder',
        title: `Pending Verification: ${vr.student_name}`,
        message: `${vr.student_name} (${vr.department}) requested verification for "${vr.competition_title}" ${daysPending} day${daysPending > 1 ? 's' : ''} ago. Please review.`,
        data: {
          verificationRequestId: vr.id,
          studentId: vr.student_id,
          studentName: vr.student_name,
          competitionTitle: vr.competition_title,
          daysPending,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      })
    }
  }

  const result = await upsertNotifications(notifications)
  log('info', 'Verification reminders completed', { sent: result.inserted, skipped: result.skipped })

  return { sent: result.inserted, skipped: result.skipped }
}

async function cleanupOldNotifications(): Promise<{ deleted: number }> {
  log('info', 'Starting notification cleanup job')

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString()

  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('is_read', true)
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      log('warn', 'Notifications table not found, skipping cleanup')
      return { deleted: 0 }
    }
    log('error', 'Failed to cleanup old notifications', { error: error.message })
    throw new Error(`Failed to cleanup notifications: ${error.message}`)
  }

  const deleted = data?.length || 0
  log('info', 'Notification cleanup completed', { deleted })

  return { deleted }
}

async function main() {
  const startTime = Date.now()
  log('info', 'Cron job started', { timestamp: new Date().toISOString() })

  let totalSent = 0
  let totalSkipped = 0
  let errors: string[] = []

  try {
    log('info', '--- Running Deadline Reminders ---')
    const deadlineResult = await sendDeadlineReminders()
    totalSent += deadlineResult.sent
    totalSkipped += deadlineResult.skipped
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log('error', 'Deadline reminders failed', { error: msg })
    errors.push(`Deadline reminders: ${msg}`)
  }

  try {
    log('info', '--- Running Verification Reminders ---')
    const verifyResult = await sendVerificationReminders()
    totalSent += verifyResult.sent
    totalSkipped += verifyResult.skipped
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log('error', 'Verification reminders failed', { error: msg })
    errors.push(`Verification reminders: ${msg}`)
  }

  try {
    log('info', '--- Running Notification Cleanup ---')
    await cleanupOldNotifications()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log('error', 'Notification cleanup failed', { error: msg })
    errors.push(`Notification cleanup: ${msg}`)
  }

  const duration = Date.now() - startTime

  if (errors.length > 0) {
    log('error', 'Cron job completed with errors', {
      duration: `${duration}ms`,
      totalSent,
      totalSkipped,
      errors,
    })
    process.exit(1)
  }

  log('info', 'Cron job completed successfully', {
    duration: `${duration}ms`,
    totalSent,
    totalSkipped,
  })
  process.exit(0)
}

main().catch(error => {
  log('error', 'Unhandled error in cron job', { error: error.message, stack: error.stack })
  process.exit(1)
})