export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextRequest } from 'next/server'
import { denyIfSignedOut } from '@/lib/api-auth'
import { apiOk, apiError } from '@/lib/api-response'
import {
  ensureLoaded,
  competitions,
  students,
  pushCompetition,
  pushNotifications,
} from '@/lib/firebase-data'
import {
  isFirestoreConfigured,
  fetchCompetitionDashboard,
} from '@/lib/firestore-data'

function isCompetitionActive(regDeadline: string | null | undefined): boolean {
  if (!regDeadline) return true
  const d = new Date(regDeadline)
  if (isNaN(d.getTime())) return true
  return d > new Date()
}

export async function GET(request: NextRequest) {
  const denied = await denyIfSignedOut()
  if (denied) return denied

  await ensureLoaded()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')?.toLowerCase()
  const search = searchParams.get('search')?.toLowerCase() || searchParams.get('q')?.toLowerCase()
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  let list: any[] = []

  if (isFirestoreConfigured()) {
    const dbRows = await fetchCompetitionDashboard()
    list = dbRows.map((row) => ({
      id: row.id,
      title: row.competitionName || '',
      description: row.description || '',
      shortDescription: row.shortDescription || '',
      category: (row.category || 'other').toLowerCase(),
      scope: row.scope || 'national',
      mode: row.mode || 'online',
      organizer: row.organizer || '',
      organizerEmail: row.organizerEmail || '',
      organizerLogo: null,
      bannerUrl: null,
      websiteUrl: row.websiteUrl || '',
      registrationUrl: row.websiteUrl || '',
      registrationLink: row.registrationLink || '',
      teamSizeMin: row.teamSizeMin ?? 1,
      teamSizeMax: row.teamSizeMax ?? 1,
      prizePool: row.totalPrizeAmount || '',
      registrationDeadline: row.regDeadline || '',
      startDate: row.r1Date || '',
      endDate: row.r2Date || '',
      eligibility: { departments: [], yearOfStudy: [row.eligibleYear || ''], description: '' },
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
    }))
  } else {
    list = [...competitions]
  }

  // Filter by category
  if (category && category !== 'all') {
    list = list.filter((c) => (c.category || '').toLowerCase() === category)
  }

  // Filter by search term
  if (search) {
    list = list.filter((c) =>
      (c.title || '').toLowerCase().includes(search) ||
      (c.organizer || '').toLowerCase().includes(search) ||
      (c.description || '').toLowerCase().includes(search)
    )
  }

  // Sort active competitions first, then by date/id
  list.sort((a, b) => {
    const aOpen = isCompetitionActive(a.registrationDeadline)
    const bOpen = isCompetitionActive(b.registrationDeadline)
    if (aOpen && !bOpen) return -1
    if (!aOpen && bOpen) return 1
    return 0
  })

  const total = list.length
  const totalPages = Math.ceil(total / limit) || 1
  const start = (page - 1) * limit
  const paginatedData = list.slice(start, start + limit)

  return apiOk({
    data: paginatedData,
    total,
    page,
    limit,
    totalPages,
  })
}

export async function POST(request: NextRequest) {
  const denied = await denyIfSignedOut()
  if (denied) return denied

  try {
    await ensureLoaded()
    const body = await request.json()
    const {
      title,
      description,
      shortDescription,
      category,
      scope,
      mode,
      organizer,
      organizerEmail,
      websiteUrl,
      registrationUrl,
      registrationLink,
      teamSizeMin,
      teamSizeMax,
      prizePool,
      registrationDeadline,
      startDate,
      endDate,
      eligibility,
      tags,
    } = body

    if (!title || !category || !scope || !mode || !organizer) {
      return apiError(
        'BAD_REQUEST',
        'Title, category, scope, mode, and organizer are required.',
        400
      )
    }

    const now = new Date().toISOString()
    const newCompetition = {
      id: 'comp-' + Date.now(),
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      shortDescription: shortDescription ? String(shortDescription).trim() : '',
      category: String(category).toLowerCase(),
      scope: String(scope).toLowerCase(),
      mode: String(mode).toLowerCase(),
      organizer: String(organizer).trim(),
      organizerEmail: organizerEmail ? String(organizerEmail).trim() : '',
      organizerLogo: null,
      bannerUrl: null,
      websiteUrl: websiteUrl ? String(websiteUrl).trim() : '',
      registrationUrl: registrationUrl ? String(registrationUrl).trim() : '',
      registrationLink: registrationLink ? String(registrationLink).trim() : '',
      teamSizeMin: Number(teamSizeMin) || 1,
      teamSizeMax: Number(teamSizeMax) || 1,
      prizePool: prizePool ? String(prizePool).trim() : '',
      registrationDeadline: registrationDeadline || '',
      startDate: startDate || '',
      endDate: endDate || '',
      eligibility: eligibility || { departments: [], yearOfStudy: [], description: '' },
      tags: Array.isArray(tags) ? tags : [],
      createdAt: now,
      updatedAt: now,
    }

    // Persist to both collections (competition_dashboard + competitions) and memory
    await pushCompetition(newCompetition)

    // Broadcast notifications to students
    try {
      const notifItems = students.map((s) => ({
        id: 'notif-' + Date.now() + '-' + s.id,
        userId: s.id,
        type: 'new_competition',
        title: 'New Competition Added',
        message: `${newCompetition.title} has been added. Check it out now!`,
        data: { competitionId: newCompetition.id, competitionTitle: newCompetition.title },
        isRead: false,
        createdAt: now,
      }))
      if (notifItems.length > 0) {
        await pushNotifications(notifItems)
      }
    } catch (notifErr) {
      console.warn('Failed to dispatch notifications for new competition:', notifErr)
    }

    return apiOk(newCompetition)
  } catch (err: any) {
    console.error('Failed to create competition in POST /api/competitions:', err)
    return apiError(
      'INTERNAL_SERVER_ERROR',
      err?.message || 'Failed to create competition',
      500
    )
  }
}
