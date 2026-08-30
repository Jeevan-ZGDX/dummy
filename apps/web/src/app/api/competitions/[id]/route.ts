export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { NextRequest } from 'next/server'
import { denyIfSignedOut } from '@/lib/api-auth'
import { apiOk, apiError } from '@/lib/api-response'
import {
  updateDocById,
  deleteDocById,
  getDocById,
  isFirestoreConfigured,
} from '@/lib/firestore-data'
import { COLLECTIONS } from '@/lib/firebase/config'
import {
  ensureLoaded,
  competitions,
  registrations,
  syncCompetition,
} from '@/lib/firebase-data'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await denyIfSignedOut()
  if (denied) return denied

  const competitionId = params.id
  if (!competitionId) {
    return apiError('BAD_REQUEST', 'Missing competition id', 400)
  }

  await ensureLoaded()

  if (isFirestoreConfigured()) {
    const docData = await getDocById(COLLECTIONS.competitionDashboard, competitionId)
    if (docData) {
      const mapped = {
        id: docData.id || competitionId,
        title: docData.competition_name || '',
        description: docData.description || '',
        shortDescription: docData.short_description || '',
        category: (docData.category || 'other').toLowerCase(),
        scope: docData.scope || 'national',
        mode: docData.mode || 'online',
        organizer: docData.organizer || '',
        organizerEmail: docData.organizer_email || '',
        organizerLogo: null,
        bannerUrl: null,
        websiteUrl: docData.website_url || '',
        registrationUrl: docData.website_url || '',
        registrationLink: docData.registration_link || '',
        teamSizeMin: docData.team_size_min ?? 1,
        teamSizeMax: docData.team_size_max ?? 1,
        prizePool: docData.total_prize_amount || '',
        registrationDeadline: docData.reg_deadline || '',
        startDate: docData.r1_date || '',
        endDate: docData.r2_date || '',
        eligibility: { departments: [], yearOfStudy: [docData.eligible_year || ''], description: '' },
        tags: typeof docData.tags === 'string' ? JSON.parse(docData.tags) : (docData.tags || []),
        createdAt: docData.created_at || new Date().toISOString(),
        updatedAt: docData.updated_at || new Date().toISOString(),
        registrationCount: registrations.filter((r) => r.competitionId === competitionId).length,
        isBookmarked: false,
        bookmarkCount: 0,
      }
      return apiOk(mapped)
    }
  }

  const comp = competitions.find((c) => c.id === competitionId)
  if (!comp) {
    return apiError('NOT_FOUND', 'Competition not found', 404)
  }

  return apiOk({
    ...comp,
    registrationCount: registrations.filter((r) => r.competitionId === competitionId).length,
    isBookmarked: false,
    bookmarkCount: 0,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await denyIfSignedOut()
  if (denied) return denied

  const competitionId = params.id
  if (!competitionId) {
    return apiError('BAD_REQUEST', 'Missing competition id', 400)
  }

  await ensureLoaded()
  const body = await request.json()

  // Update in-memory fallback
  const idx = competitions.findIndex((c) => c.id === competitionId)
  if (idx !== -1) {
    competitions[idx] = {
      ...competitions[idx],
      ...body,
      title: body.title ?? competitions[idx].title,
      description: body.description ?? competitions[idx].description,
      shortDescription: body.shortDescription ?? competitions[idx].shortDescription,
      category: body.category ?? competitions[idx].category,
      scope: body.scope ?? competitions[idx].scope,
      mode: body.mode ?? competitions[idx].mode,
      organizer: body.organizer ?? competitions[idx].organizer,
      organizerEmail: body.organizerEmail ?? competitions[idx].organizerEmail,
      websiteUrl: body.websiteUrl ?? competitions[idx].websiteUrl,
      registrationUrl: body.registrationUrl ?? competitions[idx].registrationUrl,
      registrationLink: body.registrationLink ?? competitions[idx].registrationLink,
      teamSizeMin: body.teamSizeMin ?? competitions[idx].teamSizeMin,
      teamSizeMax: body.teamSizeMax ?? competitions[idx].teamSizeMax,
      prizePool: body.prizePool ?? competitions[idx].prizePool,
      registrationDeadline: body.registrationDeadline ?? competitions[idx].registrationDeadline,
      startDate: body.startDate ?? competitions[idx].startDate,
      endDate: body.endDate ?? competitions[idx].endDate,
      eligibility: body.eligibility ?? competitions[idx].eligibility,
      tags: body.tags ?? competitions[idx].tags,
      updatedAt: new Date().toISOString(),
    }
  }

  if (isFirestoreConfigured()) {
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.competition_name = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.shortDescription !== undefined) updates.short_description = body.shortDescription
    if (body.category !== undefined) updates.category = (body.category as string).toLowerCase()
    if (body.scope !== undefined) updates.scope = body.scope
    if (body.mode !== undefined) updates.mode = body.mode
    if (body.organizer !== undefined) updates.organizer = body.organizer
    if (body.organizerEmail !== undefined) updates.organizer_email = body.organizerEmail
    if (body.prizePool !== undefined) updates.total_prize_amount = body.prizePool
    if (body.teamSizeMin !== undefined) updates.team_size_min = body.teamSizeMin
    if (body.teamSizeMax !== undefined) updates.team_size_max = body.teamSizeMax
    if (body.registrationUrl !== undefined) updates.website_url = body.registrationUrl
    else if (body.websiteUrl !== undefined) updates.website_url = body.websiteUrl
    if (body.registrationLink !== undefined) updates.registration_link = body.registrationLink
    if (body.tags !== undefined) updates.tags = typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)
    if (body.registrationDeadline !== undefined) updates.reg_deadline = body.registrationDeadline || null
    if (body.startDate !== undefined) updates.r1_date = body.startDate || null
    if (body.endDate !== undefined) updates.r2_date = body.endDate || null
    if (body.eligibility !== undefined) {
      updates.eligible_year = ((body.eligibility as Record<string, unknown>)?.yearOfStudy as string[])?.[0] || ''
    }
    updates.updated_at = new Date().toISOString()

    const resultDashboard = await updateDocById(
      COLLECTIONS.competitionDashboard,
      competitionId,
      updates
    )

    if (!resultDashboard.success) {
      console.error('Firestore update competition error:', resultDashboard.reason)
      return apiError('INTERNAL_SERVER_ERROR', resultDashboard.reason || 'Update failed', 500)
    }

    await syncCompetition(competitionId)
  }

  const updatedComp = competitions.find((c) => c.id === competitionId) || { id: competitionId, ...body }
  return apiOk(updatedComp)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await denyIfSignedOut()
  if (denied) return denied

  const competitionId = params.id
  if (!competitionId) {
    return apiError('BAD_REQUEST', 'Missing competition id', 400)
  }

  await ensureLoaded()

  const idx = competitions.findIndex((c) => c.id === competitionId)
  if (idx !== -1) {
    competitions.splice(idx, 1)
  }

  if (isFirestoreConfigured()) {
    const resultDashboard = await deleteDocById(COLLECTIONS.competitionDashboard, competitionId)
    const resultCompetitions = await deleteDocById(COLLECTIONS.competitions, competitionId)

    if (!resultDashboard.success && !resultCompetitions.success) {
      console.error('Firestore delete competition error:', resultDashboard.reason)
      return apiError('INTERNAL_SERVER_ERROR', resultDashboard.reason || 'Delete failed', 500)
    }
  }

  return apiOk({ id: competitionId, deleted: true })
}