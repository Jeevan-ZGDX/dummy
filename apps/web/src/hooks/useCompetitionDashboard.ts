'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/client'
import { COLLECTIONS } from '@/lib/firebase/config'

export interface CompetitionDashboardItem {
  id: string
  serialNo: number
  competitionName: string
  competitionStatus: string
  eligibleYear: string
  regDeadline: string | null
  r1Date: string | null
  r2Date: string | null
  remainingDaysForReg: number
  rDaysForR1: number
  rDaysForR2: number
  regTeam: number
  totalPrizeAmount: string
  category: string
  organizer: string
  createdAt: string
  updatedAt: string
}

export interface CompetitionDashboardFilters {
  search?: string
  category?: string
  status?: string
}

function mapRow(id: string, row: Record<string, any>): CompetitionDashboardItem {
  return {
    id,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Reads the dashboard collection and applies filters in memory.
 *
 * Filtering is deliberately not pushed into the query. Firestore has no
 * case-insensitive substring operator, so the old `ilike '%term%'` search cannot
 * be expressed server-side at all; and `orderBy('serial_no')` would silently
 * drop any document missing that field. Both are avoided by fetching the
 * collection — it is a single dashboard list, not an unbounded table — and
 * sorting and filtering here.
 */
async function fetchDashboard(filters?: CompetitionDashboardFilters) {
  const db = getFirebaseDb()
  if (!db) return []

  const snapshot = await getDocs(collection(db, COLLECTIONS.competitionDashboard))
  let items = snapshot.docs.map((d) => mapRow(d.id, d.data()))

  items.sort((a, b) => (a.serialNo ?? 0) - (b.serialNo ?? 0))

  if (filters?.category && filters.category !== 'all') {
    items = items.filter((item) => item.category === filters.category)
  }
  if (filters?.status && filters.status !== 'all') {
    items = items.filter((item) => item.competitionStatus === filters.status)
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase()
    items = items.filter(
      (item) =>
        (item.competitionName || '').toLowerCase().includes(term) ||
        (item.organizer || '').toLowerCase().includes(term)
    )
  }

  return items
}

export function useCompetitionDashboard(filters?: CompetitionDashboardFilters) {
  const queryClient = useQueryClient()
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)

  const query = useQuery({
    queryKey: ['competition-dashboard', filters],
    queryFn: () => fetchDashboard(filters),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const db = getFirebaseDb()
    if (!db) return

    // Firestore's own listener replaces the Supabase realtime channel. It fires
    // once immediately with the current contents, which is what flips the
    // connected flag — there is no separate subscribe callback.
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.competitionDashboard),
      () => {
        setIsRealtimeConnected(true)
        queryClient.invalidateQueries({ queryKey: ['competition-dashboard'] })
      },
      (error) => {
        console.error('Competition dashboard subscription error:', error.message)
        setIsRealtimeConnected(false)
      }
    )

    return () => {
      setIsRealtimeConnected(false)
      unsubscribe()
    }
  }, [queryClient])

  return {
    ...query,
    isRealtimeConnected,
  }
}

export function useCompetitionDashboardItem(id: string) {
  return useQuery({
    queryKey: ['competition-dashboard', id],
    queryFn: async () => {
      const db = getFirebaseDb()
      if (!db) return null
      const snap = await getDoc(doc(db, COLLECTIONS.competitionDashboard, id))
      if (!snap.exists()) return null
      return mapRow(snap.id, snap.data())
    },
    enabled: !!id,
  })
}
