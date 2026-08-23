import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query as fsQuery,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { apiClient } from '../client'
import { getFirestoreDb, isFirestoreEnabled } from '../firestore-manager'
import type {
  Competition,
  CompetitionDetail,
  CompetitionListResponse,
  CompetitionFilters,
} from '@comp-dash/types'

const DASHBOARD_COLLECTION = 'competition_dashboard'

function isCompetitionActive(comp: Competition): boolean {
  if (!comp.registrationDeadline) return true
  return new Date(comp.registrationDeadline) > new Date()
}

/** Documents keep the snake_case column names; the doc id is the row id. */
function toRow(snapshot: DocumentSnapshot): any {
  return { ...snapshot.data(), id: snapshot.id }
}

function matchesSearch(row: any, needle: string): boolean {
  return (
    String(row.competition_name || '').toLowerCase().includes(needle) ||
    String(row.organizer || '').toLowerCase().includes(needle)
  )
}

/** ASC on a nullable column puts NULLs last in Postgres; mirror that. */
function nullsLast(value: unknown): number {
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER
}

async function fetchFromFirestore<T>(collectionName: string, filters?: Record<string, unknown>): Promise<T> {
  const db = getFirestoreDb()
  if (!db) throw new Error('Firestore not configured')

  const constraints: QueryConstraint[] = []
  if (filters?.category && filters.category !== 'all') {
    constraints.push(where('category', '==', filters.category))
  }

  // Only the category filter is pushed to Firestore. Search has no server-side
  // equivalent (no ilike, no OR across fields), orderBy('serial_no') would drop
  // any doc missing that field, and the total row count has to be taken after
  // the in-memory search filter anyway — so the rest happens below.
  const snap = await getDocs(fsQuery(collection(db, DASHBOARD_COLLECTION), ...constraints))
  let rows = snap.docs.map(toRow)

  // Deduplicate by competition name + organizer (keeps the latest by serial_no)
  const seen = new Map<string, any>()
  for (const row of rows) {
    const key = `${String(row.competition_name || '').trim().toLowerCase()}|${String(row.organizer || '').trim().toLowerCase()}`
    const existing = seen.get(key)
    if (!existing || (row.serial_no ?? 0) > (existing.serial_no ?? 0)) {
      seen.set(key, row)
    }
  }
  rows = Array.from(seen.values())

  if (filters?.search) {
    const needle = String(filters.search).toLowerCase()
    rows = rows.filter((r) => matchesSearch(r, needle))
  }

  rows.sort((a, b) => nullsLast(a.serial_no) - nullsLast(b.serial_no))

  const total = rows.length
  const pageSize = Number(filters?.limit) || 10

  if (filters?.page) {
    const from = (Number(filters.page) - 1) * pageSize
    rows = rows.slice(from, from + pageSize)
  } else if (filters?.limit) {
    rows = rows.slice(0, Number(filters.limit))
  }

  const mapped = rows.map(mapDashboardRow)
  // Open registrations first. The serial_no order survives inside each group
  // because Array#sort is stable.
  mapped.sort((a: Competition, b: Competition) => {
    const aOpen = isCompetitionActive(a)
    const bOpen = isCompetitionActive(b)
    if (aOpen && !bOpen) return -1
    if (!aOpen && bOpen) return 1
    return 0
  })

  return {
    data: mapped,
    total,
    page: Number(filters?.page) || 1,
    limit: Number(filters?.limit) || 10,
    totalPages: Math.ceil(total / pageSize),
  } as T
}

function mapDashboardRow(row: any): Competition {
  return {
    id: row.id,
    title: row.competition_name || '',
    description: row.description || '',
    shortDescription: row.short_description || '',
    category: (row.category || 'other').toLowerCase(),
    scope: row.scope || 'national',
    mode: row.mode || 'online',
    organizer: row.organizer || '',
    organizerEmail: row.organizer_email || '',
    organizerLogo: null,
    bannerUrl: null,
    websiteUrl: row.website_url || '',
    registrationUrl: row.website_url || '',
    registrationLink: row.registration_link || '',
    teamSizeMin: row.team_size_min ?? 1,
    teamSizeMax: row.team_size_max ?? 1,
    prizePool: row.total_prize_amount || '',
    registrationDeadline: row.reg_deadline || '',
    startDate: row.r1_date || '',
    endDate: row.r2_date || '',
    eligibility: { departments: [], yearOfStudy: [row.eligible_year || ''], description: '' },
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  }
}

export function useCompetitions(filters?: CompetitionFilters) {
  const useFirestore = isFirestoreEnabled()

  return useQuery({
    queryKey: useFirestore ? ['supabase-competitions', filters] : ['competitions', filters],
    queryFn: () => {
      if (useFirestore) {
        return fetchFromFirestore<CompetitionListResponse>('competitions', filters as Record<string, unknown>)
      }
      return apiClient.get<CompetitionListResponse>('/competitions', filters as Record<string, unknown>)
    },
    staleTime: 30 * 1000,
  })
}

export function useCompetition(id: string) {
  const useFirestore = isFirestoreEnabled()

  return useQuery({
    queryKey: useFirestore ? ['supabase-competitions', id] : ['competitions', id],
    queryFn: async () => {
      if (useFirestore) {
        const db = getFirestoreDb()
        if (!db) throw new Error('Firestore not configured')
        const snap = await getDoc(doc(db, DASHBOARD_COLLECTION, id))
        if (!snap.exists()) throw new Error('Competition not found')
        const base = mapDashboardRow(toRow(snap))
        return {
          ...base,
          instructions: '',
          contactEmail: '',
          isBookmarked: false,
          bookmarkCount: 0,
          registrationCount: 0,
        } as CompetitionDetail
      }
      return apiClient.get<CompetitionDetail>(`/competitions/${id}`)
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpcomingDeadlines() {
  const useFirestore = isFirestoreEnabled()

  return useQuery({
    queryKey: useFirestore ? ['supabase-competitions', 'upcoming'] : ['competitions', 'upcoming'],
    queryFn: async () => {
      if (useFirestore) {
        const db = getFirestoreDb()
        if (!db) return []
        const now = new Date().toISOString().split('T')[0]
        // reg_deadline is stored as a 'YYYY-MM-DD' string, so the range filter
        // compares lexicographically the way the SQL date did. Docs with a null
        // or missing deadline are excluded by the inequality itself, which is
        // also what gte() did — so the required orderBy drops nothing extra.
        const snap = await getDocs(
          fsQuery(
            collection(db, DASHBOARD_COLLECTION),
            where('reg_deadline', '>=', now),
            orderBy('reg_deadline', 'asc'),
            limit(5)
          )
        )
        return snap.docs.map(toRow).map(mapDashboardRow)
      }
      return apiClient.get<Competition[]>('/competitions/upcoming')
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTrendingCompetitions() {
  const useFirestore = isFirestoreEnabled()

  return useQuery({
    queryKey: useFirestore ? ['supabase-competitions', 'trending'] : ['competitions', 'trending'],
    queryFn: async () => {
      if (useFirestore) {
        const db = getFirestoreDb()
        if (!db) return []
        // remaining_days_for_reg is nullable and Firestore's orderBy() silently
        // excludes docs that lack the field, so rank in memory instead.
        const snap = await getDocs(collection(db, DASHBOARD_COLLECTION))
        const rows = snap.docs.map(toRow)
        rows.sort((a, b) => nullsLast(a.remaining_days_for_reg) - nullsLast(b.remaining_days_for_reg))
        return rows.slice(0, 4).map(mapDashboardRow)
      }
      return apiClient.get<Competition[]>('/competitions/trending')
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSearchCompetitions(query: string) {
  const useFirestore = isFirestoreEnabled()

  return useQuery({
    queryKey: useFirestore ? ['supabase-competitions', 'search', query] : ['competitions', 'search', query],
    queryFn: async () => {
      if (useFirestore) {
        const db = getFirestoreDb()
        if (!db || query.length < 2) return []
        // Firestore has no case-insensitive substring match and no OR across
        // two fields, so the ilike pair is done client-side.
        const needle = query.toLowerCase()
        const snap = await getDocs(collection(db, DASHBOARD_COLLECTION))
        return snap.docs
          .map(toRow)
          .filter((r) => matchesSearch(r, needle))
          .slice(0, 20)
          .map(mapDashboardRow)
      }
      return apiClient.get<Competition[]>('/competitions/search', { q: query })
    },
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  })
}
