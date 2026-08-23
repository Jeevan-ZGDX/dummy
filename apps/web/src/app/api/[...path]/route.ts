export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  departments, students, advisors, competitions, registrations,
  winners, auditLogs, notifications, verificationRequests, odRequests,
  ensureLoaded, pushRegistration, pushNotification, pushNotifications,
  pushVerificationRequest, pushOdRequest, pushWinner, pushStudent, pushAdvisor,
  pushCompetition, syncRegistration, syncVerificationRequests, syncNotifications,
  persistToStorage,
} from '@/lib/firebase-data'
import { getAllRoleAccessData, setUserAccess, checkUserAccess } from '@/lib/firestore-service'
import {
  isFirestoreConfigured,
  getDocById,
  fetchNotificationsForUser,
  countUnreadNotifications,
  markNotificationRead,
  fetchAuditLogs,
  updatePrizeAmountForWinner,
} from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'
import { storeGmailTokens, getValidAccessToken as getValidGmailAccessToken, getGmailTokens, clearGmailTokens } from '@/lib/gmail-tokens'
import type { UserRole } from '@/lib/auth'
import { normalizeSection, sectionMatches, ACTIVE_YEAR_LABELS } from '@comp-dash/utils'
import { getSessionUser } from '@/lib/firebase/server-session'
import { refreshStudentLeaderboard, LEADERBOARD_TAG } from '@/lib/leaderboard'
import { revalidateTag } from 'next/cache'

// ─── Types & Helper Functions ───────────────────────────────────────
type RouteHandler = (req: NextRequest, segments: string[]) => Promise<NextResponse>

function ok(data: unknown) {
  return NextResponse.json({ success: true, data })
}

function error(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status })
}

// ─── Server-side Gmail API Helpers ─────────────────────────────────────
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function gmailApiRequest(accessToken: string, endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail API error: ${res.status} ${err}`)
  }
  return res.json()
}

async function gmailSearchMessages(accessToken: string, query: string, maxResults = 20) {
  const data = await gmailApiRequest(accessToken, `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`)
  return data.messages || []
}

async function gmailGetMessage(accessToken: string, messageId: string) {
  return gmailApiRequest(accessToken, `/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
}

async function gmailGetProfile(accessToken: string) {
  return gmailApiRequest(accessToken, '/profile')
}

async function gmailGetHistory(accessToken: string, startHistoryId: string) {
  return gmailApiRequest(accessToken, `/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`)
}

function extractHeaders(payload: any): Record<string, string> {
  return (payload?.headers || []).reduce((acc: Record<string, string>, h: any) => {
    acc[h.name.toLowerCase()] = h.value
    return acc
  }, {})
}

function mapGmailMessage(message: any): any {
  const headers = extractHeaders(message.payload)
  return {
    id: message.id,
    threadId: message.threadId,
    from: headers.from || '',
    to: headers.to || '',
    subject: headers.subject || '',
    snippet: message.snippet || '',
    date: headers.date || message.internalDate || '',
    labels: message.labelIds || [],
  }
}

function extractCompetitionHint(email: any): string | null {
  const subject = (email.subject || '').toLowerCase()
  const from = (email.from || '').toLowerCase()
  const keywords = ['competition', 'hackathon', 'contest', 'challenge', 'registration', 'workshop', 'conference', 'seminar', 'symposium']
  for (const kw of keywords) {
    if (subject.includes(kw) || from.includes(kw)) return kw
  }
  return null
}

function paginated<T>(items: T[], page: number, limit: number) {
  const total = items.length
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  return {
    data: items.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages,
  }
}

function filterRegs(list: typeof registrations, qs: URLSearchParams) {
  let result = [...list]
  const status = qs.get('status')
  if (status && status !== 'all') result = result.filter(r => r.status === status)
  return result
}

function filterStudents(list: typeof students, qs: URLSearchParams) {
  let result = [...list]
  const s = qs.get('search')?.toLowerCase()
  if (s) result = result.filter(x => x.name.toLowerCase().includes(s) || x.email.toLowerCase().includes(s))
  const dept = qs.get('department')
  if (dept) result = result.filter(x => x.department === dept)
  return result
}

function filterAdvisors(list: typeof advisors, qs: URLSearchParams) {
  let result = [...list]
  const s = qs.get('search')?.toLowerCase()
  if (s) result = result.filter(x => x.name.toLowerCase().includes(s) || x.email.toLowerCase().includes(s))
  return result
}

function filterComps(list: typeof competitions, qs: URLSearchParams) {
  // Deduplicate by title + organizer (keeps the latest by createdAt)
  const deduped = new Map<string, any>()
  for (const c of list) {
    const key = `${(c.title || '').trim().toLowerCase()}|${(c.organizer || '').trim().toLowerCase()}`
    const existing = deduped.get(key)
    if (!existing || new Date(c.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()) {
      deduped.set(key, c)
    }
  }
  let result = Array.from(deduped.values())

  const cat = qs.get('category')
  if (cat) result = result.filter(c => c.category === cat)
  const s = qs.get('search')?.toLowerCase()
  if (s) result = result.filter(c => c.title.toLowerCase().includes(s) || c.organizer.toLowerCase().includes(s))
  return result
}

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function buildRegistrationsOverTime(): { date: string; count: number }[] {
  const buckets = new Map<string, number>()
  for (const reg of registrations) {
    const ts = reg.registeredAt || reg.createdAt
    if (!ts) continue
    const d = new Date(ts)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  const now = new Date()
  const result: { date: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ date: key, count: buckets.get(key) || 0 })
  }
  return result
}

function buildVerificationTrend(): { date: string; count: number }[] {
  const buckets = new Map<string, number>()
  for (const reg of registrations) {
    if (!reg.verifiedAt) continue
    const d = new Date(reg.verifiedAt)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  const now = new Date()
  const result: { date: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({ date: key, count: buckets.get(key) || 0 })
  }
  return result
}

function getCompetitionDepartments(comp: any): string[] {
  const eligibility = safeParseJson<any>(comp?.eligibility, comp?.eligibility)
  if (!eligibility) return []
  if (Array.isArray(eligibility)) return eligibility
  if (Array.isArray(eligibility.departments)) return eligibility.departments
  return []
}

function countDepartmentRegistrations(deptName: string): number {
  return registrations.filter(r => {
    const comp = competitions.find(c => c.id === r.competitionId)
    return getCompetitionDepartments(comp).includes(deptName)
  }).length
}

const routes: Record<string, RouteHandler> = {}

function register(method: string, pattern: string, handler: RouteHandler) {
  const key = `${method}:${pattern}`
  routes[key] = handler
}

async function handle(request: NextRequest, pathSegments: string[]) {
  await ensureLoaded()
  const method = request.method
  const qs = new URL(request.url).searchParams
  const path = '/' + pathSegments.join('/')

  const exactKey = `${method}:${path}`
  if (routes[exactKey]) return routes[exactKey](request, pathSegments)

  for (const [key, handler] of Object.entries(routes)) {
    const colonIdx = key.indexOf(':')
    const m = key.slice(0, colonIdx)
    const pattern = key.slice(colonIdx + 1)
    if (m !== method) continue
    const patternParts = pattern.split('/')
    if (patternParts.length !== pathSegments.length + 1) continue
    let match = true
    for (let i = 0; i < pathSegments.length; i++) {
      const pp = patternParts[i + 1]
      if (pp?.startsWith(':')) continue
      if (pp !== pathSegments[i]) { match = false; break }
    }
    if (match) return handler(request, pathSegments)
  }

  return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `No handler for ${method} ${path}` } }, { status: 404 })
}

// ─── Auth identity ─────────────────────────────────────────────
// In-memory profile cache keyed by email (demo-grade; not a security boundary).
const profileMemory: Record<string, any> = {}

async function getAuthenticatedEmail(req: NextRequest): Promise<string | null> {
  // The verified session cookie is authoritative; the bearer path below is a
  // legacy fallback for callers that never carried one.
  const sessionUser = await getSessionUser()
  if (sessionUser?.email) return sessionUser.email

  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  const parts = token.split('-')
  return parts.length >= 3 ? parts[2] || null : null
}

async function getProfileByEmail(email: string): Promise<any> {
  const base = {
    id: 'user-' + email.split('@')[0],
    email,
    name: email.split('@')[0],
    role: 'student' as UserRole,
    department: '',
    avatarUrl: null as string | null,
    language: 'en' as const,
  }

  const cached = profileMemory[email]
  if (cached) return { ...base, ...cached }

  if (isFirestoreConfigured()) {
    // role_access documents are keyed by lowercased email, so this is a point read.
    const data = await getDocById(COLLECTIONS.roleAccess, email.toLowerCase())
    if (data?.role) {
      return {
        ...base,
        name: data.name || base.name,
        role: data.role,
        department: data.department || '',
        granted: data.granted !== false,
      }
    }
  }

  return base
}

// --- AUTH ---
register('POST', '/auth/google', async (req) => {
  const body = await req.json()
  const email = body.email || 'student@citchennai.net'
  const profile = await getProfileByEmail(email)
  const token = 'sb-' + email + '-' + Date.now()
  return ok({ user: profile, token, refreshToken: 'sb-refresh-' + Date.now() })
})

register('GET', '/auth/check-access', async (req) => {
  const url = new URL(req.url)
  const email = url.searchParams.get('email') || (await getAuthenticatedEmail(req)) || ''
  const result = await checkUserAccess(email)
  return ok(result)
})

register('GET', '/auth/me', async (req) => {
  const email = (await getAuthenticatedEmail(req)) || ''
  const profile = await getProfileByEmail(email)
  return ok({ ...profile, email, role: profile.role })
})

register('PUT', '/auth/profile', async (req) => {
  const email = (await getAuthenticatedEmail(req)) || ''
  const body = await req.json()
  if (!email) return error('UNAUTHORIZED', 'Not authenticated', 401)
  profileMemory[email] = { ...profileMemory[email], ...body }
  return ok({ ...(await getProfileByEmail(email)), ...body })
})

register('PUT', '/auth/notification-preferences', async (req) => {
  const email = (await getAuthenticatedEmail(req)) || ''
  const body = await req.json()
  if (!email) return error('UNAUTHORIZED', 'Not authenticated', 401)
  const current = profileMemory[email]?.notificationPreferences || {}
  profileMemory[email] = { ...profileMemory[email], notificationPreferences: { ...current, ...body } }
  return ok(profileMemory[email].notificationPreferences)
})

register('PUT', '/auth/language', async (req) => {
  const email = (await getAuthenticatedEmail(req)) || ''
  const body = await req.json()
  if (!email) return error('UNAUTHORIZED', 'Not authenticated', 401)
  profileMemory[email] = { ...profileMemory[email], language: body.language }
  return ok({ language: body.language })
})

register('POST', '/auth/logout', async () => ok(null))

// --- COMPETITIONS ---
register('POST', '/competitions', async (req) => {
  const body = await req.json()
  const { title, description, shortDescription, category, scope, mode, organizer, organizerEmail, websiteUrl, registrationUrl, registrationLink, teamSizeMin, teamSizeMax, prizePool, registrationDeadline, startDate, endDate, eligibility, tags } = body
  if (!title || !category || !scope || !mode || !organizer) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'title, category, scope, mode, and organizer are required' } }, { status: 400 })
  }
  const now = new Date().toISOString()
  const newCompetition = {
    id: 'comp-' + Date.now(),
    title,
    description: description || '',
    shortDescription: shortDescription || '',
    category,
    scope,
    mode,
    organizer,
    organizerEmail: organizerEmail || '',
    organizerLogo: null,
    bannerUrl: null,
    websiteUrl: websiteUrl || '',
    registrationUrl: registrationUrl || '',
    registrationLink: registrationLink || '',
    teamSizeMin: teamSizeMin || 1,
    teamSizeMax: teamSizeMax || 1,
    prizePool: prizePool || '',
    registrationDeadline: registrationDeadline || '',
    startDate: startDate || '',
    endDate: endDate || '',
    eligibility: eligibility || { departments: [], yearOfStudy: [], description: '' },
    tags: tags || [],
    createdAt: now,
    updatedAt: now,
  }
  await pushCompetition(newCompetition)

  // ─── Notifications (fire-and-forget) ──────────────────────────────────
  // Send to eligible students and all advisors. Duplicate guard: skip any
  // user who already has a notification for this competition.
  const notifDeadline = registrationDeadline
    ? new Date(registrationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'TBA'

  const existingNotifs = new Set(
    notifications
      .filter(n => n.data?.competitionId === newCompetition.id)
      .map(n => n.userId)
  )

  // Students: filter by eligibility (departments / yearOfStudy)
  const eligibleStudents = students.filter(s => {
    if (existingNotifs.has(s.id)) return false
    const elig = eligibility as { departments?: string[]; yearOfStudy?: string[] } | undefined
    if (elig?.departments?.length && !elig.departments.includes(s.department)) return false
    if (elig?.yearOfStudy?.length && !elig.yearOfStudy.includes(s.year)) return false
    return true
  })

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')

  const studentNotifs = eligibleStudents.map(s => ({
    id: 'notif-' + Date.now() + '-stu-' + s.id,
    userId: s.id,
    type: 'new_competition' as const,
    title: 'New Competition Available',
    message: `A new ${categoryLabel} competition "${title}" has been published. Registration deadline: ${notifDeadline}. View details and register now!`,
    data: { competitionId: newCompetition.id, competitionTitle: title, category, deadline: registrationDeadline },
    isRead: false,
    createdAt: new Date().toISOString(),
  }))

  // Advisors: all advisors get notified
  const advisorNotifs = advisors
    .filter(a => !existingNotifs.has(a.id))
    .map(a => ({
      id: 'notif-' + Date.now() + '-adv-' + a.id,
      userId: a.id,
      type: 'new_competition' as const,
      title: 'New Competition Published',
      message: `A new ${categoryLabel} competition "${title}" is now open for registrations. Deadline: ${notifDeadline}. Students in your sections may be eligible.`,
      data: { competitionId: newCompetition.id, competitionTitle: title, category, deadline: registrationDeadline },
      isRead: false,
      createdAt: new Date().toISOString(),
    }))

  const allNotifs = [...studentNotifs, ...advisorNotifs]
  if (allNotifs.length > 0) {
    pushNotifications(allNotifs).catch(err => console.error('Competition notification push failed:', err))
  }

  // ─── Deadline reminders (fire-and-forget) ─────────────────────────────
  // Schedule reminders 3 days before the registration deadline using BullMQ.
  if (registrationDeadline) {
    const deadline = new Date(registrationDeadline)
    const reminderDate = new Date(deadline.getTime() - 3 * 24 * 60 * 60 * 1000)
    const delayMs = reminderDate.getTime() - Date.now()

    if (delayMs > 0) {
      import('@/lib/redis-queue').then(({ competitionQueue }) => {
        return competitionQueue.add(
          'deadline-reminder',
          {
            competitionId: newCompetition.id,
            competitionTitle: title,
            category,
            registrationDeadline,
          },
          {
            delay: delayMs,
            jobId: `reminder-${newCompetition.id}`,
            removeOnComplete: true,
            removeOnFail: false,
          }
        )
      }).catch(err => console.error('Failed to schedule deadline reminder:', err))
    }
  }

  return ok(newCompetition)
})

register('GET', '/competitions', async (req) => {
  const qs = new URL(req.url).searchParams
  const filtered = filterComps(competitions, qs)
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')
  return ok(paginated(filtered, page, limit))
})

register('GET', '/competitions/upcoming', async () => {
  const upcoming = competitions.filter(c => new Date(c.startDate) > new Date()).slice(0, 5)
  return ok(upcoming)
})

register('GET', '/competitions/trending', async () => {
  const trending = competitions.filter(c => c.scope === 'national' || c.scope === 'international').slice(0, 4)
  return ok(trending)
})

register('GET', '/competitions/search', async (req) => {
  const q = new URL(req.url).searchParams.get('q')?.toLowerCase() || ''
  const results = competitions.filter(c => c.title.toLowerCase().includes(q))
  return ok(results)
})

register('GET', '/competitions/:id', async (req, seg) => {
  const id = seg[1]
  const comp = competitions.find(c => c.id === id)
  if (!comp) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 })
  return ok({
    ...comp,
    registrationCount: registrations.filter(r => r.competitionId === id).length,
    isBookmarked: false,
    bookmarkCount: 0,
  })
})

register('PUT', '/competitions/:id', async (req, seg) => {
  const id = seg[1]
  const comp = competitions.find(c => c.id === id)
  if (!comp) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 })
  const body = await req.json()
  const idx = competitions.indexOf(comp)
const updated = {
    ...comp,
    title: body.title ?? comp.title,
    description: body.description ?? comp.description,
    shortDescription: body.shortDescription ?? comp.shortDescription,
    category: body.category ?? comp.category,
    scope: body.scope ?? comp.scope,
    mode: body.mode ?? comp.mode,
    organizer: body.organizer ?? comp.organizer,
    organizerEmail: body.organizerEmail ?? comp.organizerEmail,
    websiteUrl: body.websiteUrl ?? comp.websiteUrl,
    registrationUrl: body.registrationUrl ?? comp.registrationUrl,
    registrationLink: body.registrationLink ?? comp.registrationLink,
    teamSizeMin: body.teamSizeMin ?? comp.teamSizeMin,
    teamSizeMax: body.teamSizeMax ?? comp.teamSizeMax,
    prizePool: body.prizePool ?? comp.prizePool,
    registrationDeadline: body.registrationDeadline ?? comp.registrationDeadline,
    startDate: body.startDate ?? comp.startDate,
    endDate: body.endDate ?? comp.endDate,
    eligibility: body.eligibility ?? comp.eligibility,
    tags: body.tags ?? comp.tags,
    updatedAt: new Date().toISOString(),
  }
  competitions[idx] = updated
  await pushCompetition(updated)
  return ok(updated)
})

register('POST', '/competitions/:id/bookmark', async (req, seg) => {
  const id = seg[1]
  return ok({ message: 'Competition bookmarked', id })
})

register('GET', '/competitions/:id/match-feedback', async (req, seg) => {
  const id = seg[1]
  return ok({ feedback: `Your performance in ${competitions.find(c => c.id === id)?.title || 'this competition'}` })
})

register('GET', '/competitions/:id/dashboard', async (req, seg) => {
  const id = seg[1]
  const comp = competitions.find(c => c.id === id)
  if (!comp) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 })
  
  const compRegistrations = registrations.filter(r => r.competitionId === id)
  const registeredStudents = compRegistrations.map(r => {
    const student = students.find(s => s.id === r.userId)
    return {
      id: r.id,
      userId: r.userId,
      userName: student?.name || r.userName,
      department: student?.department || r.department,
      status: r.status,
      registeredAt: r.registeredAt,
    }
  })
  
  const registeredStudentIds = new Set(compRegistrations.map(r => r.userId))
  const unregisteredStudents = students
    .filter(s => !registeredStudentIds.has(s.id))
    .map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      department: s.department,
      section: s.section,
    }))
  
  const registrationsByDepartment = departments.map(dept => ({
    department: dept.name,
    count: registeredStudents.filter(s => s.department === dept.name).length,
  })).filter(d => d.count > 0)
  
  return ok({
    competition: comp,
    registeredStudents,
    unregisteredStudents,
    totalRegistered: registeredStudents.length,
    totalUnregistered: unregisteredStudents.length,
    registrationsByDepartment,
  })
})

register('GET', '/advisor/competitions/:id/stats', async (req, seg) => {
  const id = seg[1]
  const comp = competitions.find(c => c.id === id)
  if (!comp) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 })
  const compRegistrations = registrations.filter(r => r.competitionId === id)
  const appliedStudents = compRegistrations.length
  const totalStudents = students.length
  const unregisteredStudents = totalStudents - appliedStudents
  const registrationsByDepartment = departments.map(dept => ({
    department: dept.name,
    count: compRegistrations.filter(r => {
      const student = students.find(s => s.id === r.userId)
      return student?.department === dept.name
    }).length,
  })).filter(d => d.count > 0)
  const studentsWithDetails = compRegistrations.map(r => {
    const student = students.find(s => s.id === r.userId)
    return {
      id: student?.id || '',
      name: student?.name || r.userName,
      email: student?.email || '',
      department: student?.department || r.department,
      section: student?.section || '',
      status: r.status,
      registeredAt: r.registeredAt,
    }
  })
  return ok({
    totalStudents,
    appliedStudents,
    unregisteredStudents,
    registrationsByDepartment,
    studentsWithDetails,
  })
})

// ─── REGISTRATIONS ───────────────────────────────────────────────────
register('GET', '/registrations', async (req) => {
  const qs = new URL(req.url).searchParams
  const filtered = filterRegs(registrations, qs)
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')
  return ok(paginated(filtered, page, limit))
})

register('POST', '/registrations', async (req) => {
  const body = await req.json()
  const { competitionId, userId, verificationMethod, confirmationScreenshot, confirmationEmail } = body
  if (!competitionId || !userId || !verificationMethod) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'competitionId, userId, and verificationMethod are required' } }, { status: 400 })
  }

  // Check for existing registration in-memory first
  const existing = registrations.find(r => r.competitionId === competitionId && r.userId === userId)
  if (existing) return ok({ ...existing, alreadyRegistered: true })

  // Also check Firestore for the unique student+competition constraint
  try {
    if (isFirestoreConfigured()) {
      const { COLLECTIONS } = await import('@/lib/firebase/config')
      const { queryByField } = await import('@/lib/firestore-data')
      const rows = await queryByField(COLLECTIONS.studentCompetitions, 'student_email', userId)
      const existingFirestore = rows.find((r: any) => r.competition_id === competitionId)
      if (existingFirestore) {
        return ok({ ...existingFirestore, alreadyRegistered: true })
      }
    }
  } catch (err) {
    console.error('Firestore duplicate check error:', err)
  }

  const comp = competitions.find(c => c.id === competitionId)
  if (!comp) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 })
  const user = students.find(s => s.id === userId)
  if (!user) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 })

  const newRegistration = {
    id: 'reg-' + Date.now(),
    competitionId,
    userId,
    userName: user.name,
    department: user.department,
    status: 'pending_verification' as const,
    registeredAt: new Date().toISOString(),
    verifiedAt: null,
    verificationMethod,
    extractedConfirmationId: null,
    extractedEmail: null,
    rejectionReason: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await pushRegistration(newRegistration)

  // Also persist to Firestore with the unique constraint
  try {
    if (isFirestoreConfigured()) {
      const { COLLECTIONS } = await import('@/lib/firebase/config')
      const { createDoc } = await import('@/lib/firestore-data')
      await createDoc(COLLECTIONS.studentCompetitions, {
        student_id: userId,
        student_email: user.email || userId,
        student_name: user.name,
        competition_id: competitionId,
        competition_name: comp.title,
        verification_status: 'pending_verification',
        verification_method: verificationMethod,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('Firestore registration persist error:', err)
  }

  await pushNotification({
    id: 'notif-' + Date.now(),
    userId,
    type: 'verification_update',
    title: 'Registration Submitted',
    message: `Your registration for ${comp.title} has been submitted and is pending verification.`,
    data: null,
    isRead: false,
    createdAt: new Date().toISOString(),
  })
  return ok({ ...newRegistration, alreadyRegistered: false })
})

register('GET', '/registrations/user/:userId', async (req, seg) => {
  const userId = seg[1]
  const userRegs = registrations.filter(r => r.userId === userId)
  return ok(userRegs.map(r => ({
    ...r,
    competition: competitions.find(c => c.id === r.competitionId) || null,
  })))
})

register('GET', '/registrations/:id', async (req, seg) => {
  const id = seg[1]
  const reg = registrations.find(r => r.id === id)
  if (!reg) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } }, { status: 404 })
  return ok({
    ...reg,
    competition: competitions.find(c => c.id === reg.competitionId) || null,
    user: students.find(s => s.id === reg.userId) || null,
  })
})

register('PUT', '/registrations/:id', async (req, seg) => {
  const id = seg[1]
  const updates = await req.json()
  const item = registrations.find(r => r.id === id)
  if (!item) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } }, { status: 404 })
  const updated = { ...item, ...updates, updatedAt: new Date().toISOString() }
  const idx = registrations.indexOf(item)
  registrations[idx] = updated
  await syncRegistration(updated.id)
  return ok(updated)
})

register('GET', '/registrations/lookup', async (req) => {
  const qs = new URL(req.url).searchParams
  const email = (qs.get('email') || '').toLowerCase()
  if (!email) return error('BAD_REQUEST', 'email required')
  const student = students.find(s => s.email.toLowerCase() === email)
  if (!student) return ok({ registrations: [], student: null })
  const userRegs = registrations
    .filter(r => r.userId === student.id)
    .map(r => ({
      ...r,
      competition: competitions.find(c => c.id === r.competitionId) || null,
    }))
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
  return ok({ registrations: userRegs, student })
})

// ─── VERIFICATION REQUESTS ───────────────────────────────────────────
register('POST', '/verification/job', async (req) => {
  const body = await req.json()
  const { competitionId, userEmail } = body

  if (!competitionId || !userEmail) {
    return NextResponse.json({ success: false, error: 'Missing competitionId or userEmail' }, { status: 400 })
  }

  try {
    if (!isFirestoreConfigured()) {
      return NextResponse.json({ success: false, error: 'Firestore not configured' }, { status: 500 })
    }

    const { COLLECTIONS } = await import('@/lib/firebase/config')
    const competition = await getDocById(COLLECTIONS.competitionDashboard, competitionId)

    if (!competition) {
      return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 })
    }

    // Push verification job to BullMQ queue
    const { Queue } = await import('bullmq')
    const queue = new Queue('verification-queue', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    })

    await queue.add('verify-registration', {
      studentEmail: userEmail,
      competitionId,
      userId: userEmail,
      competitionTitle: competition.competition_name,
      organizerEmail: competition.organizer_email,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      timeout: 60000,
    })

    return NextResponse.json({
      success: true,
      queued: true,
      message: 'Verification job queued. Processing started asynchronously.',
    })

  } catch (err) {
    console.error('Verification job submission error:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Verification failed'
    }, { status: 500 })
  }
})

register('POST', '/verification-requests', async (req) => {
  const body = await req.json()
  const { registrationId, studentEmail } = body
  if (!registrationId || !studentEmail) return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'registrationId and studentEmail required' } }, { status: 400 })
  const student = students.find(s => s.email.toLowerCase() === studentEmail.toLowerCase())
  if (!student) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 })
  const reg = registrations.find(r => r.id === registrationId)
  if (!reg) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Registration not found' } }, { status: 404 })
  const existingVr = verificationRequests.find(v => v.registrationId === registrationId && v.studentId === student.id)
  if (existingVr) return ok({ ...existingVr, alreadyRequested: true })
  const competitionTitle = competitions.find(c => c.id === reg.competitionId)?.title || 'Unknown'
  const newVr = {
    id: 'vr-' + (verificationRequests.length + 1),
    registrationId,
    studentId: student.id,
    studentName: student.name,
    department: student.department,
    competitionTitle,
    advisorNotified: false,
    emailProof: null,
    status: 'pending' as const,
    requestedAt: new Date().toISOString(),
  }
  await pushVerificationRequest(newVr as any)
  await pushNotification({
    id: 'notif-' + (notifications.length + 1),
    userId: student.id,
    type: 'verification_update' as const,
    title: 'Verification Requested',
    message: `${student.name} has requested verification for ${competitionTitle}.`,
    data: null,
    isRead: false,
    createdAt: new Date().toISOString(),
  })
  return ok({ ...newVr, alreadyRequested: false })
})

register('POST', '/verification-requests/with-proof', async (req) => {
  const body = await req.json()
  const { registrationId, emailProof, studentId } = body
  if (!registrationId || !emailProof || !studentId) return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'registrationId, emailProof, and studentId required' } }, { status: 400 })
  const vr = verificationRequests.find(v => v.registrationId === registrationId && v.studentId === studentId)
  if (!vr) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Verification request not found' } }, { status: 404 })
  const student = students.find(s => s.id === studentId)
  if (!student) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 })
  vr.emailProof = emailProof
  vr.status = 'under_review'
  vr.advisorNotified = true
  vr.reviewedAt = new Date().toISOString()
  await syncVerificationRequests()
  await pushNotification({
    id: 'notif-' + (notifications.length + 1),
    userId: student.id,
    type: 'verification_update' as const,
    title: 'Verification Under Review',
    message: `Your verification request for ${vr.competitionTitle} has been received and is under review.`,
    data: null,
    isRead: false,
    createdAt: new Date().toISOString(),
  })
  return ok(vr)
})

register('PUT', '/verification-requests/:id', async (req, seg) => {
  const id = seg[1]
  const updates = await req.json()
  const item = verificationRequests.find(v => v.id === id)
  if (!item) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Verification request not found' } }, { status: 404 })
  const updated = { ...item, ...updates }
  const idx = verificationRequests.indexOf(item)
  verificationRequests[idx] = updated
  await syncVerificationRequests()
  return ok(updated)
})

register('GET', '/verification-requests/user/:userId', async (req, seg) => {
  const userId = seg[1]
  const userVrs = verificationRequests.filter(v => v.studentId === userId)
  return ok(userVrs)
})

register('GET', '/verification-requests', async () => {
  return ok(verificationRequests)
})

register('PATCH', '/verification-requests/:id/verify', async (req, seg) => {
  const id = seg[1]
  const item = verificationRequests.find(v => v.id === id)
  if (!item) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Verification request not found' } }, { status: 404 })
  const idx = verificationRequests.indexOf(item)
  verificationRequests[idx] = { ...item, status: 'verified', advisorNotified: true }
  await syncVerificationRequests()
  return ok(verificationRequests[idx])
})

// ─── OD REQUESTS ─────────────────────────────────────────────────────
register('GET', '/od-requests', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId')
  const role = qs.get('role')
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')

  let filtered = [...odRequests]
  if (userId) {
    if (role === 'student') {
      filtered = filtered.filter(od => od.studentId === userId)
    } else if (role === 'advisor') {
      const deptStudents = students.filter(s => s.department === (students.find(s => s.id === userId)?.department || ''))
      const deptStudentIds = new Set(deptStudents.map(s => s.id))
      filtered = filtered.filter(od => deptStudentIds.has(od.studentId))
    }
  }
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return ok(paginated(filtered, page, limit))
})

register('POST', '/od-requests', async (req) => {
  const body = await req.json()
  const { competitionId, studentId } = body
  if (!competitionId || !studentId) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'competitionId and studentId required' } }, { status: 400 })
  }
  const student = students.find(s => s.id === studentId)
  if (!student) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 })
  }
  const competition = competitions.find(c => c.id === competitionId)
  if (!competition) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Competition not found' } }, { status: 404 })
  }

  // Check if OD request already exists for this student + competition
  const existing = odRequests.find(od => od.studentId === studentId && od.competitionId === competitionId)
  if (existing) {
    if (existing.status === 'cancelled') {
      // Allow re-requesting if previously cancelled
      const idx = odRequests.indexOf(existing)
      const now = new Date().toISOString()
      odRequests[idx] = { ...existing, status: 'requested', requestedAt: now, reviewedAt: null, reviewedBy: null, rejectionReason: null, updatedAt: now }
      await pushOdRequest(odRequests[idx])
      return ok(odRequests[idx])
    }
    return ok({ ...existing, alreadyRequested: true })
  }

  // Find the student's advisor (by department match)
  const advisor = advisors.find(a => a.department === student.department) || { id: 'adv-1', name: 'Faculty Advisor' }

  const now = new Date().toISOString()
  const newOdRequest = {
    id: 'od-' + Date.now(),
    studentId,
    studentName: student.name,
    studentEmail: student.email,
    competitionId,
    competitionTitle: competition.title,
    section: student.section || '',
    department: student.department,
    advisorId: advisor.id,
    advisorName: advisor.name,
    status: 'requested',
    requestedAt: now,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  }
  await pushOdRequest(newOdRequest as any)

  // Notify advisor
  await pushNotification({
    id: 'notif-' + Date.now(),
    userId: advisor.id,
    type: 'od_request',
    title: 'New OD Request',
    message: `${student.name} has requested OD approval for ${competition.title}.`,
    data: { odRequestId: newOdRequest.id, studentId, competitionId },
    isRead: false,
    createdAt: now,
  })

  return ok(newOdRequest)
})

register('PATCH', '/od-requests/:id/approve', async (req, seg) => {
  const id = seg[1]
  const idx = odRequests.findIndex(od => od.id === id)
  if (idx === -1) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'OD request not found' } }, { status: 404 })
  }
  const od = odRequests[idx]
  if (od.status !== 'requested') {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `Cannot approve OD request in status: ${od.status}` } }, { status: 400 })
  }
  const now = new Date().toISOString()
  odRequests[idx] = { ...od, status: 'approved', reviewedAt: now, reviewedBy: 'advisor', updatedAt: now }
  await pushOdRequest(odRequests[idx])

  // Notify student
  await pushNotification({
    id: 'notif-' + Date.now(),
    userId: od.studentId,
    type: 'od_request',
    title: 'OD Request Approved',
    message: `Your OD request for ${od.competitionTitle} has been approved.`,
    data: { odRequestId: id, status: 'approved' },
    isRead: false,
    createdAt: now,
  })

  return ok(odRequests[idx])
})

register('PATCH', '/od-requests/:id/reject', async (req, seg) => {
  const id = seg[1]
  const body = await req.json().catch(() => ({}))
  const idx = odRequests.findIndex(od => od.id === id)
  if (idx === -1) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'OD request not found' } }, { status: 404 })
  }
  const od = odRequests[idx]
  if (od.status !== 'requested') {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `Cannot reject OD request in status: ${od.status}` } }, { status: 400 })
  }
  const now = new Date().toISOString()
  odRequests[idx] = { ...od, status: 'rejected', reviewedAt: now, reviewedBy: 'advisor', rejectionReason: body.reason || null, updatedAt: now }
  await pushOdRequest(odRequests[idx])

  // Notify student
  await pushNotification({
    id: 'notif-' + Date.now(),
    userId: od.studentId,
    type: 'od_request',
    title: 'OD Request Rejected',
    message: `Your OD request for ${od.competitionTitle} has been rejected.${body.reason ? ` Reason: ${body.reason}` : ''}`,
    data: { odRequestId: id, status: 'rejected' },
    isRead: false,
    createdAt: now,
  })

  return ok(odRequests[idx])
})

register('PATCH', '/od-requests/:id/cancel', async (req, seg) => {
  const id = seg[1]
  const idx = odRequests.findIndex(od => od.id === id)
  if (idx === -1) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'OD request not found' } }, { status: 404 })
  }
  const od = odRequests[idx]
  if (od.status !== 'requested') {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `Cannot cancel OD request in status: ${od.status}` } }, { status: 400 })
  }
  const now = new Date().toISOString()
  odRequests[idx] = { ...od, status: 'cancelled', updatedAt: now }
  await pushOdRequest(odRequests[idx])

  return ok(odRequests[idx])
})

// ─── NOTIFICATIONS ───────────────────────────────────────────────────
register('GET', '/notifications', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId')
  if (!userId) return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'userId required' } }, { status: 400 })
  // Scoped query rather than filtering the whole collection in memory: this
  // reads one user's rows instead of ~15,000.
  const limit = Math.min(parseInt(qs.get('limit') || '50', 10) || 50, 200)
  return ok(await fetchNotificationsForUser(userId, limit))
})

register('PUT', '/notifications/:id/read', async (req, seg) => {
  const id = seg[1]
  // A single targeted write. The old path loaded every notification, mutated
  // one in memory, then wrote the entire array back.
  const updated = await markNotificationRead(id)
  if (!updated) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } }, { status: 404 })
  return ok({ id, isRead: true })
})

// ─── AUDIT LOGS ───────────────────────────────────────────────────────
// Read on demand rather than at warm-up: only someone opening the audit page
// pays for this collection, instead of every cold start paying for it.
register('GET', '/audit-logs', async (req) => {
  const qs = new URL(req.url).searchParams
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')
  return ok(paginated(await fetchAuditLogs(), page, limit))
})

register('GET', '/audit-logs/:id', async (req, seg) => {
  const id = seg[1]
  const log = (await fetchAuditLogs()).find(l => l.id === id)
  if (!log) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Audit log not found' } }, { status: 404 })
  return ok(log)
})

// ─── ADMIN ROUTES (legacy - mapped to COE) ───────────────────────────────────
register('GET', '/admin/dashboard/stats', async () => {
  const totalCompetitions = competitions.length
  const totalRegistrations = registrations.length
  const verifiedRegistrations = registrations.filter(r => r.status === 'verified' || r.status === 'completed').length
  const verificationRate = totalRegistrations > 0 ? Math.round((verifiedRegistrations / totalRegistrations) * 100) : 0
  const registrationsOverTime = buildRegistrationsOverTime()
  const topDepartments = departments.map(d => ({ name: d.name, count: countDepartmentRegistrations(d.name) })).sort((a, b) => b.count - a.count).slice(0, 5)
  const recentVerified = registrations.filter(r => r.verifiedAt).sort((a, b) => new Date(b.verifiedAt!).getTime() - new Date(a.verifiedAt!).getTime()).slice(0, 5)
  const pendingVerifications = registrations.filter(r => r.status === 'pending_verification').slice(0, 5)
  const selfVerificationRequests = verificationRequests.filter(v => v.status === 'pending').slice(0, 5)

  return ok({ totalCompetitions, totalRegistrations, verifiedRegistrations, verificationRate, registrationsOverTime, topDepartments, recentVerified, pendingVerifications, selfVerificationRequests })
})

// ─── HOD DASHBOARD ──────────────────────────────────────────────────────
register('GET', '/hod/dashboard/stats', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || 'user-hod'
  const user = students.find(s => s.id === userId) || { id: userId, name: 'HOD User', department: 'CSE' }
  const deptName = user.department || 'CSE'
  const now = new Date()

  const deptStudents = students.filter(s => s.department === deptName && ACTIVE_YEAR_LABELS.includes(s.year))
  const deptRegistrations = registrations.filter(r => deptStudents.some(s => s.id === r.userId))

  // Open competitions: registration deadline is empty or still in the future
  const openCompetitions = competitions.filter(c => {
    if (c.registrationDeadline) {
      const deadline = new Date(c.registrationDeadline)
      if (!isNaN(deadline.getTime()) && deadline <= now) return false
    }
    return true
  })

  // Total Expected = openComps × dept eligible students
  const totalExpected = openCompetitions.length * deptStudents.length
  const registered = deptRegistrations.length
  const unregistered = Math.max(totalExpected - registered, 0)

  const verifiedCount = deptRegistrations.filter(r => r.status === 'verified' || r.status === 'completed').length
  const pendingCount = deptRegistrations.filter(r => r.status === 'pending_verification').length
  const rejectedCount = deptRegistrations.filter(r => r.status === 'rejected').length

  const yearWise = ['2nd Year', '3rd Year'].map(year => {
    const yearStudents = deptStudents.filter(s => s.year === year)
    const yearRegs = deptRegistrations.filter(r => yearStudents.some(s => s.id === r.userId))
    const yearExpected = openCompetitions.length * yearStudents.length
    return {
      year,
      studentCount: yearStudents.length,
      registrationCount: yearRegs.length,
      totalExpected: yearExpected,
      unregistered: Math.max(yearExpected - yearRegs.length, 0),
      verifiedCount: yearRegs.filter(r => r.status === 'verified' || r.status === 'completed').length,
      pendingCount: yearRegs.filter(r => r.status === 'pending_verification').length,
    }
  })
  const selfVerificationRequests = verificationRequests.filter(v => v.status === 'pending' && deptStudents.some(s => s.id === v.studentId)).slice(0, 10)
  const recentRegs = deptRegistrations
    .map(r => ({
      ...r,
      competition: competitions.find(c => c.id === r.competitionId),
      userName: deptStudents.find(s => s.id === r.userId)?.name || r.userName,
    }))
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    .slice(0, 10)

  return ok({
    totalStudents: deptStudents.length,
    openCompetitions: openCompetitions.length,
    totalExpected,
    registered,
    unregistered,
    verifiedCount,
    pendingCount,
    rejectedCount,
    yearWise,
    selfVerificationRequests,
    registrations: recentRegs,
  })
})

// ─── ADVISOR DASHBOARD ──────────────────────────────────────────────────
register('GET', '/advisor/dashboard/stats', async (req) => {
  const qs = new URL(req.url).searchParams
  const sessionUser = await getSessionUser()
  const sessionEmail = sessionUser?.email?.trim().toLowerCase() || null
  const userId = qs.get('userId') || ''
  const advisor = advisors.find(a =>
    (sessionEmail && a.email?.trim().toLowerCase() === sessionEmail) ||
    (userId && (a.id === userId || a.email?.trim().toLowerCase() === userId.toLowerCase()))
  )
  if (!advisor) {
    return error('ADVISOR_NOT_FOUND', `No advisor record for ${sessionEmail || userId || 'this session'}`, 404)
  }
  const deptName = advisor.department || 'CSE'
  // assigned_sections holds bare labels ("A"); students.section is year-prefixed
  // ("3%A"), so a direct includes() never matches. Compare normalized values.
  const assignedSections: string[] = (advisor.assignedSections || advisor.assigned_sections || []).map(normalizeSection)
  const deptStudents = students.filter(
    s => s.department === deptName && assignedSections.some(sec => sectionMatches(sec, s.section))
  )
  const deptRegistrations = registrations.filter(r => deptStudents.some(s => s.id === r.userId))
  const verifiedCount = deptRegistrations.filter(r => r.status === 'verified' || r.status === 'completed').length
  const pendingCount = deptRegistrations.filter(r => r.status === 'pending_verification').length
  const rejectedCount = deptRegistrations.filter(r => r.status === 'rejected').length
  const verificationRequestsList = verificationRequests.filter(v => v.status === 'pending' && deptStudents.some(s => s.id === v.studentId)).slice(0, 10)
  const recentRegs = deptRegistrations
    .map(r => ({
      ...r,
      competition: competitions.find(c => c.id === r.competitionId),
      userName: deptStudents.find(s => s.id === r.userId)?.name || r.userName,
    }))
    .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
    .slice(0, 10)

  return ok({
    totalStudents: deptStudents.length,
    registeredCount: deptRegistrations.length,
    verifiedCount,
    pendingCount,
    rejectedCount,
    verificationRequests: verificationRequestsList,
    registrations: recentRegs,
  })
})

// ─── COE DASHBOARD ──────────────────────────────────────────────────────
register('GET', '/coe/dashboard/stats', async () => {
  const now = new Date()

  // Open competitions: registration deadline is empty or still in the future
  const openCompetitions = competitions.filter(c => {
    if (c.registrationDeadline) {
      const deadline = new Date(c.registrationDeadline)
      if (!isNaN(deadline.getTime()) && deadline <= now) return false
    }
    return true
  })

  // Eligible students: active year cohorts only (2nd/3rd year)
  // A student is excluded if every open competition restricts departments
  // and none match the student's department.
  const eligibleStudents = students.filter(s => {
    if (!ACTIVE_YEAR_LABELS.includes(s.year)) return false
    return true
  })

  const totalExpected = openCompetitions.length * eligibleStudents.length

  const totalRegistrations = registrations.length
  const registered = totalRegistrations
  const unregistered = Math.max(totalExpected - registered, 0)

  const verifiedRegistrations = registrations.filter(r => r.status === 'verified' || r.status === 'completed').length
  const pendingRegistrations = registrations.filter(r => r.status === 'pending_verification').length
  const rejectedRegistrations = registrations.filter(r => r.status === 'rejected').length
  const verificationRate = registered > 0 ? Math.round((verifiedRegistrations / registered) * 100) : 0

  const registrationsOverTime = buildRegistrationsOverTime()
  const verificationTrend = buildVerificationTrend()

  const topDepartments = departments.map(d => ({ name: d.name, count: countDepartmentRegistrations(d.name) })).sort((a, b) => b.count - a.count).slice(0, 5)
  const recentVerified = registrations.filter(r => r.verifiedAt).sort((a, b) => new Date(b.verifiedAt!).getTime() - new Date(a.verifiedAt!).getTime()).slice(0, 5)
  const pendingVerifications = registrations.filter(r => r.status === 'pending_verification').slice(0, 5)
  const selfVerificationRequests = verificationRequests.filter(v => v.status === 'pending').slice(0, 5)

  return ok({
    totalCompetitions: competitions.length,
    openCompetitions: openCompetitions.length,
    totalRegistered: registered,
    registered,
    totalExpected,
    unregistered,
    verifiedRegistrations,
    pendingRegistrations,
    rejectedRegistrations,
    verificationRate,
    registrationsOverTime,
    verificationTrend,
    topDepartments,
    recentVerified,
    pendingVerifications,
    selfVerificationRequests,
  })
})

// ─── STUDENT DASHBOARD ──────────────────────────────────────────────────
register('GET', '/student/dashboard/stats', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || 'user-stu'
  const userRegs = registrations.filter(r => r.userId === userId)
  const verifiedCount = userRegs.filter(r => r.status === 'verified' || r.status === 'completed').length
  const pendingCount = userRegs.filter(r => r.status === 'pending_verification').length
  const rejectedCount = userRegs.filter(r => r.status === 'rejected').length

  // Wins from the winners collection
  const userWins = winners.filter(w => w.email?.toLowerCase() === (students.find(s => s.id === userId)?.email?.toLowerCase() || ''))
  const totalWins = userWins.length

  // Unregistered: competitions eligible for this student that they have NOT registered for
  const user = students.find(s => s.id === userId)
  const registeredCompetitionIds = new Set(userRegs.map(r => r.competitionId))
  const unregisteredCount = competitions.filter(c => {
    if (registeredCompetitionIds.has(c.id)) return false
    if (!c.startDate || new Date(c.startDate) <= new Date()) return false
    const elig = c.eligibility
    if (elig?.yearOfStudy?.length && user?.year && !elig.yearOfStudy.includes(user.year)) return false
    return true
  }).length

  const upcomingCompetitions = competitions
    .filter(c => new Date(c.startDate) > new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5)
    .map(c => ({
      ...c,
      registration: userRegs.find(r => r.competitionId === c.id),
    }))

  return ok({
    totalRegistered: userRegs.length,
    totalVerified: verifiedCount,
    totalPending: pendingCount,
    totalRejected: rejectedCount,
    totalWins,
    unregisteredCount,
    upcomingCompetitions,
    registrations: userRegs.map(r => ({
      ...r,
      competition: competitions.find(c => c.id === r.competitionId),
    })),
  })
})

// ─── NOTIFICATIONS UNREAD COUNT ─────────────────────────────────────────
register('GET', '/notifications/unread-count', async (req) => {
  const qs = new URL(req.url).searchParams
  // The header polls this without a userId, which used to 400 on every page.
  // Fall back to the signed-in session, and report zero rather than an error
  // when we still cannot identify a user.
  let userId = qs.get('userId')
  if (!userId) {
    const sessionUser = await getSessionUser()
    const email = sessionUser?.email?.trim().toLowerCase()
    if (email) {
      const student = students.find(s => s.email?.trim().toLowerCase() === email)
      userId = student?.id || email
    }
  }
  if (!userId) return ok({ count: 0 })
  // The header polls this on every page. A count() aggregation bills one read
  // per 1,000 index entries instead of one per document, so this stays cheap
  // no matter how large the collection grows.
  return ok({ count: await countUnreadNotifications(userId) })
})

register('GET', '/admin/registrations/stats', async () => {
  const totalRegistered = registrations.length
  const totalVerified = registrations.filter(r => r.status === 'verified' || r.status === 'completed').length
  const totalPending = registrations.filter(r => r.status === 'pending_verification').length
  const totalRejected = registrations.filter(r => r.status === 'rejected').length
  const totalCompleted = registrations.filter(r => r.status === 'completed').length
  const verificationRate = totalRegistered > 0 ? Math.round((totalVerified / totalRegistered) * 100) : 0
  const registrationGrowth = 15.5
  const verifiedGrowth = 12.3
  const verificationRateChange = 2.1

  return ok({ totalRegistered, totalVerified, totalCompleted, totalRejected, totalPending, verificationRate, registrationGrowth, verifiedGrowth, verificationRateChange })
})

register('GET', '/admin/students', async (req) => {
  const qs = new URL(req.url).searchParams
  const filtered = filterStudents(students, qs)
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')
  return ok(paginated(filtered, page, limit))
})

register('POST', '/admin/students', async (req) => {
  const body = await req.json()
  const { name, email, year, section } = body
  if (!name || !email) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'name and email required' } }, { status: 400 })
  }
  const newStudent = {
    id: 'stu-' + (students.length + 1),
    name,
    email,
    department: 'CSE',
    year: year || '2nd Year',
    section: section || 'A',
    registeredCompetitions: 0,
    verifiedCompetitions: 0,
    createdAt: new Date().toISOString(),
  }
  await pushStudent(newStudent)
  return ok(newStudent)
})

register('GET', '/admin/advisors', async (req) => {
  const qs = new URL(req.url).searchParams
  const filtered = filterAdvisors(advisors, qs)
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')
  return ok(paginated(filtered, page, limit))
})

register('POST', '/admin/advisors', async (req) => {
  const body = await req.json()
  const { name, email, assignedSections } = body
  if (!name || !email) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'name and email required' } }, { status: 400 })
  }
  const newAdvisor = {
    id: 'adv-' + (advisors.length + 1),
    name,
    email,
    department: 'CSE',
    assignedSections: assignedSections || [],
    pendingVerifications: 0,
    createdAt: new Date().toISOString(),
  }
  await pushAdvisor(newAdvisor)
  return ok(newAdvisor)
})

register('GET', '/admin/departments', async () => ok(departments))

register('GET', '/admin/winners', async (req) => {
  const qs = new URL(req.url).searchParams

  let winnersData: any[] = []
  if (isFirestoreConfigured()) {
    const { fetchWinners } = await import('@/lib/firestore-data')
    winnersData = await fetchWinners()
    // Sync in-memory cache with real DB
    winners.splice(0, winners.length, ...winnersData)
    persistToStorage()
  } else {
    winnersData = winners
  }

  let filtered = [...winnersData]
  const s = qs.get('search')?.toLowerCase()
  if (s) {
    filtered = filtered.filter(
      (w) =>
        (w.studentName || '').toLowerCase().includes(s) ||
        (w.competition || '').toLowerCase().includes(s)
    )
  }
  const page = parseInt(qs.get('page') || '1')
  const limit = parseInt(qs.get('limit') || '10')
  return ok(paginated(filtered, page, limit))
})

register('DELETE', '/admin/winners/:id', async (req, seg) => {
  const id = seg[1]
  if (isFirestoreConfigured()) {
    const { deleteDocById } = await import('@/lib/firestore-data')
    const { COLLECTIONS } = await import('@/lib/firebase/config')
    await deleteDocById(COLLECTIONS.winners, id)
  }
  const idx = winners.findIndex((w) => w.id === id)
  if (idx !== -1) winners.splice(idx, 1)
  persistToStorage()
  revalidateTag(LEADERBOARD_TAG)
  return ok({ success: true, id })
})

register('POST', '/admin/winners', async (req) => {
  const body = await req.json()
  const { studentName, email, competition, competitionId, department, position, prize } = body
  if (!studentName || !email || !competition) {
    return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'studentName, email, and competition are required' } }, { status: 400 })
  }
  const newWinner = {
    id: 'win-' + (winners.length + 1),
    studentName,
    email,
    competition,
    competitionId: competitionId || null,
    department: department || 'CSE',
    position: position || '',
    prize: prize || '',
    date: new Date().toISOString().split('T')[0],
    verificationDate: new Date().toISOString(),
    registrationId: null,
  }
  await pushWinner(newWinner)
  // Fold the win into the precomputed leaderboard now, so the page never has to
  // derive it. Failure here is logged, not thrown — a lagging ranking must not
  // cost us the recorded win.
  await refreshStudentLeaderboard(email)
  // Also update cumulative prize amount per student
  await updatePrizeAmountForWinner(newWinner)
  revalidateTag(LEADERBOARD_TAG)
  await pushNotification({
    id: 'notif-' + (notifications.length + 1),
    userId: 'user-1',
    type: 'winner_announced' as const,
    title: 'Winner Announced',
    message: `${studentName} from ${department} has won ${position} in ${competition}!`,
    data: null,
    isRead: false,
    createdAt: new Date().toISOString(),
  })
  return ok(newWinner)
})

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

async function fetchPrizeLeaderboard(): Promise<any[]> {
  const sectionByEmail = new Map<string, string>()
  for (const s of students || []) {
    sectionByEmail.set((s.email || '').toLowerCase().trim(), s.section || '')
  }

  const prizeByEmail = new Map<string, { totalPrize: number; studentName: string; competitions: string[]; section: string }>()

  for (const w of winners || []) {
    const email = (w.email || '').toLowerCase().trim()
    if (!email) continue
    const section = sectionByEmail.get(email) || w.section || ''
    const existing = prizeByEmail.get(email) || { totalPrize: 0, studentName: String(w.student_name || w.studentName || ''), competitions: [] as string[], section }
    existing.totalPrize += extractNumericPrize(w.prize || '')
    const compName = String(w.competition || '')
    if (compName && !existing.competitions.includes(compName)) {
      existing.competitions.push(compName)
    }
    prizeByEmail.set(email, existing)
  }

  const entries = Array.from(prizeByEmail.entries())
    .map(([email, data]) => ({
      studentName: data.studentName,
      email,
      section: data.section,
      competitionsWon: data.competitions.length,
      totalPrizeAmount: data.totalPrize,
    }))
    .sort((a, b) => b.totalPrizeAmount - a.totalPrizeAmount)
    .slice(0, 25)
    .map((e, i) => ({ rank: i + 1, ...e }))

  return entries
}

register('GET', '/leaderboard', async () => {
  const entries = await fetchPrizeLeaderboard()
  return ok(entries)
})

async function fetchRecentWinners(): Promise<any[]> {
  const sectionByEmail = new Map<string, string>()
  for (const s of students || []) {
    sectionByEmail.set((s.email || '').toLowerCase().trim(), s.section || '')
  }

  const sortedWinners = [...(winners || [])].sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 25)

  return sortedWinners.map((w: any, i: number) => ({
    rank: i + 1,
    studentName: w.student_name || w.studentName || '',
    email: w.email || '',
    section: sectionByEmail.get((w.email || '').toLowerCase().trim()) || w.section || '',
    competition: w.competition || '',
    prize: w.prize || '',
    date: w.date || '',
  }))
}

register('GET', '/leaderboard/recent-winners', async () => {
  const entries = await fetchRecentWinners()
  return ok(entries)
})

register('GET', '/admin/analytics/stats', async () => {
  const totalCompetitions = competitions.length
  const totalParticipants = registrations.length
  const winRate = registrations.length > 0 ? Math.round((winners.length / registrations.length) * 100) : 0
  const verifiedCount = registrations.filter(r => r.status === 'verified' || r.status === 'completed').length
  const verificationRate = registrations.length > 0 ? Math.round((verifiedCount / registrations.length) * 100) : 0
  const competitionTrends = buildRegistrationsOverTime()
  const departmentPerformance = departments.slice(0, 6).map(d => ({
    name: d.name,
    count: countDepartmentRegistrations(d.name),
  }))
  const verificationRateOverTime = buildRegistrationsOverTime().map(p => ({
    date: p.date,
    rate: p.count > 0 ? Math.min(100, Math.round((verifiedCount / Math.max(p.count, 1)) * 100)) : 0,
  }))
  return ok({ totalCompetitions, totalParticipants, winRate, verificationRate, competitionTrends, departmentPerformance, verificationRateOverTime })
})

// ─── GMAIL OAUTH ---
register('GET', '/auth/gmail', async (req) => {
  const qs = new URL(req.url).searchParams
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID || '')
  url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI || '')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly openid email')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  if (qs.get('userId')) url.searchParams.set('state', qs.get('userId')!)
  return NextResponse.redirect(url.toString())
})

register('GET', '/auth/gmail/callback', async (req) => {
  const qs = new URL(req.url).searchParams
  const code = qs.get('code')
  const state = qs.get('state') // userId to associate tokens
  if (!code) return NextResponse.redirect(new URL('/email-verification?error=no_code', req.url))

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    }).toString(),
  })

  if (!tokenResponse.ok) return NextResponse.redirect(new URL('/email-verification?error=auth_failed', req.url))

  const { access_token, refresh_token, expires_in } = await tokenResponse.json()
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!userResponse.ok) return NextResponse.redirect(new URL('/email-verification?error=user_info_failed', req.url))

  const user = await userResponse.json()
  const userId = state || user.email

  // Fetch initial historyId from Gmail profile
  let historyId = ''
  try {
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (profileRes.ok) {
      const profile = await profileRes.json()
      historyId = profile.historyId || ''
    }
  } catch { /* ignore */ }

  // Store tokens server-side. Never expose them in the URL or to the client.
  await storeGmailTokens({
    user_id: userId,
    user_email: user.email || userId,
    access_token,
    refresh_token: refresh_token || null,
    expires_at: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(),
    history_id: historyId,
  })

  const params = new URLSearchParams({
    gmail: 'connected',
    email: user.email || '',
  })
  return NextResponse.redirect(new URL(`/email-verification?${params.toString()}`, req.url))
})

// ─── GMAIL SYNC & SEARCH ────────────────────────────────────────────
// OAuth tokens are stored server-side (gmail_tokens table via the service role).
register('GET', '/gmail/tokens', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId')
  if (!userId) return error('BAD_REQUEST', 'userId required')
  const tokens = await getGmailTokens(userId)
  return ok({ connected: !!tokens, hasTokens: !!tokens, historyId: tokens?.history_id || '', email: tokens?.user_email || '' })
})

register('POST', '/gmail/tokens', async (req) => {
  const body = await req.json()
  const { userId, accessToken, refreshToken, expiresIn, historyId, userEmail } = body
  if (!userId || !accessToken) return error('BAD_REQUEST', 'userId and accessToken required')
  const result = await storeGmailTokens({
    user_id: userId,
    user_email: userEmail || userId,
    access_token: accessToken,
    refresh_token: refreshToken || null,
    expires_at: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString() : null,
    history_id: historyId || null,
  })
  if (!result.success) return error('INTERNAL', 'Failed to store tokens')
  return ok({ stored: true, historyId: historyId || '' })
})

register('DELETE', '/gmail/tokens', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId')
  if (!userId) return error('BAD_REQUEST', 'userId required')
  await clearGmailTokens(userId)
  return ok({ cleared: true })
})

register('GET', '/gmail/sync', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || ''
  const startHistoryId = qs.get('startHistoryId')
  if (!userId || !startHistoryId) {
    return error('BAD_REQUEST', 'userId and startHistoryId required')
  }
  const { accessToken, hasTokens } = await getValidGmailAccessToken(userId)
  if (!accessToken) return error('UNAUTHORIZED', hasTokens ? 'Gmail token expired or refresh failed' : 'Gmail not connected', 401)
  try {
    console.log('[Gmail Sync] Starting incremental sync for user:', userId)
    const history = await gmailGetHistory(accessToken, startHistoryId)
    const messageIds: string[] = []
    for (const record of history.history || []) {
      for (const msg of record.messagesAdded || []) {
        if (msg.message?.id) messageIds.push(msg.message.id)
      }
    }
    console.log('[Gmail Sync] Found', messageIds.length, 'new message(s)')
    const emails = []
    for (const id of messageIds.slice(0, 50)) {
      try {
        const message = await gmailGetMessage(accessToken, id)
        emails.push(mapGmailMessage(message))
      } catch (e) {
        console.warn('[Gmail Sync] Failed to fetch message', id, e)
      }
    }
    const newHistoryId = history.historyId || startHistoryId
    const tagged = emails.map(e => ({ ...e, competitionHint: extractCompetitionHint(e) }))
    return ok({ historyId: newHistoryId, newEmails: emails.length, emails: tagged })
  } catch (e) {
    console.error('[Gmail Sync] Error:', e)
    return error('INTERNAL', 'Sync failed: ' + (e instanceof Error ? e.message : String(e)))
  }
})

register('GET', '/gmail/sync/initial', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || ''
  if (!userId) return error('BAD_REQUEST', 'userId required')
  const { accessToken, hasTokens } = await getValidGmailAccessToken(userId)
  if (!accessToken) return error('UNAUTHORIZED', hasTokens ? 'Gmail token expired or refresh failed' : 'Gmail not connected', 401)
  try {
    console.log('[Gmail Initial Sync] Fetching profile for user:', userId)
    const profile = await gmailGetProfile(accessToken)
    const historyId = profile.historyId || ''
    console.log('[Gmail Initial Sync] Got historyId:', historyId)
    return ok({ historyId })
  } catch (e) {
    console.error('[Gmail Initial Sync] Error:', e)
    return error('INTERNAL', 'Initial sync failed: ' + (e instanceof Error ? e.message : String(e)))
  }
})

register('GET', '/gmail/search', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || ''
  const keyword = qs.get('keyword')
  const maxResults = parseInt(qs.get('maxResults') || '20')
  if (!userId || !keyword) {
    return error('BAD_REQUEST', 'userId and keyword required')
  }
  const { accessToken, hasTokens } = await getValidGmailAccessToken(userId)
  if (!accessToken) return error('UNAUTHORIZED', hasTokens ? 'Gmail token expired or refresh failed' : 'Gmail not connected', 401)
  try {
    console.log('[Gmail Search] Searching for:', keyword)
    const messages = await gmailSearchMessages(accessToken, keyword, maxResults)
    console.log('[Gmail Search] Found', messages.length, 'message(s)')
    const emails = []
    for (const msg of messages.slice(0, maxResults)) {
      try {
        const message = await gmailGetMessage(accessToken, msg.id)
        emails.push(mapGmailMessage(message))
      } catch (e) {
        console.warn('[Gmail Search] Failed to fetch message', msg.id, e)
      }
    }
    const tagged = emails.map(e => ({ ...e, competitionHint: extractCompetitionHint(e) }))
    return ok({ emails: tagged })
  } catch (e) {
    console.error('[Gmail Search] Error:', e)
    return error('INTERNAL', 'Search failed: ' + (e instanceof Error ? e.message : String(e)))
  }
})

register('GET', '/gmail/email-detail', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || ''
  const id = qs.get('id')
  if (!userId || !id) return error('BAD_REQUEST', 'userId and id required')
  const { accessToken, hasTokens } = await getValidGmailAccessToken(userId)
  if (!accessToken) return error('UNAUTHORIZED', hasTokens ? 'Gmail token expired or refresh failed' : 'Gmail not connected', 401)
  try {
    console.log('[Gmail Detail] Fetching message:', id)
    const message = await gmailGetMessage(accessToken, id)
    return ok({ email: mapGmailMessage(message) })
  } catch (e) {
    console.error('[Gmail Detail] Error:', e)
    return error('INTERNAL', 'Failed to fetch email detail: ' + (e instanceof Error ? e.message : String(e)))
  }
})

register('GET', '/gmail/recent', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId') || ''
  const maxResults = parseInt(qs.get('maxResults') || '30')
  if (!userId) {
    return error('BAD_REQUEST', 'userId required')
  }
  const { accessToken, hasTokens } = await getValidGmailAccessToken(userId)
  if (!accessToken) return error('UNAUTHORIZED', hasTokens ? 'Gmail token expired or refresh failed' : 'Gmail not connected', 401)
  try {
    console.log('[Gmail Recent] Fetching recent messages for user:', userId)
    const data = await gmailApiRequest(accessToken, `/messages?maxResults=${maxResults}`)
    const messageIds: string[] = (data.messages || []).map((m: any) => m.id)
    console.log('[Gmail Recent] Found', messageIds.length, 'recent message(s)')
    const emails = []
    for (const id of messageIds.slice(0, maxResults)) {
      try {
        const message = await gmailGetMessage(accessToken, id)
        emails.push(mapGmailMessage(message))
      } catch (e) {
        console.warn('[Gmail Recent] Failed to fetch message', id, e)
      }
    }
    const tagged = emails.map(e => ({ ...e, competitionHint: extractCompetitionHint(e) }))
    return ok({ emails: tagged })
  } catch (e) {
    console.error('[Gmail Recent] Error:', e)
    return error('INTERNAL', 'Failed to fetch recent emails: ' + (e instanceof Error ? e.message : String(e)))
  }
})

register('GET', '/gmail/emails/stored', async (req) => {
  const qs = new URL(req.url).searchParams
  const userId = qs.get('userId')
  if (!userId) return error('BAD_REQUEST', 'userId required')
  // Client manages stored emails in localStorage
  return ok({ emails: [], note: 'Emails stored client-side in localStorage' })
})

// ─── AI COMPETITION EXTRACTION (placeholder) ────────────────────────
register('POST', '/gmail/extract-competitions', async (req) => {
  const body = await req.json()
  const { userId, emailIds } = body
  if (!userId || !emailIds?.length) return error('BAD_REQUEST', 'userId and emailIds required')
  try {
    const { getSyncedEmails } = await import('@/lib/gmail-sync')
    const allEmails = getSyncedEmails(userId)
    const selected = allEmails.filter(e => emailIds.includes(e.id))
    const extracted = selected.map(e => ({
      emailId: e.id,
      subject: e.subject,
      from: e.from,
      date: e.date,
      competitionHint: e.competitionHint || null,
      // Future: AI-extracted fields
      suggestedTitle: null as string | null,
      suggestedOrganizer: null as string | null,
      suggestedDeadline: null as string | null,
    }))
    return ok({ extracted })
  } catch { return error('INTERNAL', 'Extraction failed') }
})

// ─── IMPORT ENDPOINT ---
register('POST', '/admin/import', async (req) => {
  try {
    const body = await req.json()
    const { type, items } = body
    
    if (!type || !items) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Missing type or items' } },
        { status: 400 }
      )
    }
    
    const processedItems = items.map((item: Record<string, unknown>) => {
      const base = { ...item }
      if (type === 'advisors' && item.assignedSections && typeof item.assignedSections === 'string') {
        base.assignedSections = item.assignedSections.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      if (type === 'students' && item.createdAt && typeof item.createdAt === 'string') {
        base.createdAt = new Date(item.createdAt).toISOString()
      }
      if (type === 'competitions' && item.eligibility && typeof item.eligibility === 'string') {
        base.eligibility = JSON.parse(item.eligibility)
      }
      if (type === 'competitions' && item.tags && typeof item.tags === 'string') {
        base.tags = JSON.parse(item.tags)
      }
      return base
    })
    
    // Import to local data stores
    for (const item of processedItems) {
      switch (type) {
        case 'advisors':
          await pushAdvisor(item)
          break
        case 'students':
          await pushStudent(item)
          break
        case 'competitions':
          await pushCompetition(item)
          break
        case 'winners':
          await pushWinner(item)
          break
        case 'registrations':
          await pushRegistration(item)
          break
      }
    }
    
    // One rebuild for the whole import rather than one per row — a bulk winner
    // upload would otherwise re-derive the same students over and over.
    if (type === 'winners') {
      const { recomputeLeaderboard } = await import('@/lib/leaderboard')
      await recomputeLeaderboard().catch((err) =>
        console.error('Leaderboard rebuild after import failed:', err.message)
      )
      revalidateTag(LEADERBOARD_TAG)
    }

    const remainingItems = items.length > 100 ? items.slice(0, 100) : items
    return ok({
      success: true,
      message: `Successfully imported ${items.length} records for ${type}`,
      count: items.length,
      preview: remainingItems.slice(0, 5),
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_ERROR', message: 'Failed to import data' } },
      { status: 500 }
    )
  }
})

// ─── END OF IMPORT ENDPOINT ---

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params.path)
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params.path)
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params.path)
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params.path)
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params.path)
}