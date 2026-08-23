import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { AdvisorCompetitionRosterResponse } from '@comp-dash/types'

/**
 * The signed-in advisor's own roster for one competition: their sections'
 * students, each with registration status.
 *
 * The advisor is resolved server-side from the session cookie, so no id is
 * passed from the client.
 */
export function useAdvisorCompetitionRoster(competitionId?: string, yearNumber?: number) {
  return useQuery<AdvisorCompetitionRosterResponse>({
    queryKey: ['advisor', 'roster', competitionId, yearNumber ?? 'default'],
    queryFn: () => {
      const suffix = yearNumber ? `?year=${yearNumber}` : ''
      return apiClient.get<AdvisorCompetitionRosterResponse>(
        `/advisor/competitions/${competitionId}/roster${suffix}`
      )
    },
    enabled: !!competitionId,
    staleTime: 60 * 1000,
    retry: false,
  })
}
