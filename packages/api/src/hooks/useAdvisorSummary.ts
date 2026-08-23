import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { AdvisorSummaryResponse } from '@comp-dash/types'

/**
 * Cross-competition dashboard summary for the signed-in advisor.
 * The advisor is resolved server-side from the session cookie.
 */
export function useAdvisorSummary(yearNumber?: number) {
  return useQuery<AdvisorSummaryResponse>({
    queryKey: ['advisor', 'summary', yearNumber ?? 'default'],
    queryFn: () =>
      apiClient.get<AdvisorSummaryResponse>(
        `/advisor/summary${yearNumber ? `?year=${yearNumber}` : ''}`
      ),
    staleTime: 60 * 1000,
    retry: false,
  })
}
