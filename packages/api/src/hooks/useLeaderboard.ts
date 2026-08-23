import { useQuery } from '@tanstack/react-query'
import type { PrizeLeaderboardEntry, RecentWinnerEntry } from '@comp-dash/types'

async function fetchPrizeLeaderboard(): Promise<PrizeLeaderboardEntry[]> {
  try {
    const response = await fetch('/api/leaderboard?type=prize&limit=25', {
      credentials: 'same-origin',
    })
    if (!response.ok) throw new Error('Failed to fetch prize leaderboard')
    const body = await response.json()
    return (body.data || []) as PrizeLeaderboardEntry[]
  } catch {
    return []
  }
}

async function fetchRecentWinners(): Promise<RecentWinnerEntry[]> {
  try {
    const response = await fetch('/api/leaderboard?type=recent&limit=25', {
      credentials: 'same-origin',
    })
    if (!response.ok) throw new Error('Failed to fetch recent winners')
    const body = await response.json()
    return (body.data || []) as RecentWinnerEntry[]
  } catch {
    return []
  }
}

export function usePrizeLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard', 'prize'],
    queryFn: () => fetchPrizeLeaderboard(),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useRecentWinners() {
  return useQuery({
    queryKey: ['leaderboard', 'recent-winners'],
    queryFn: () => fetchRecentWinners(),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}