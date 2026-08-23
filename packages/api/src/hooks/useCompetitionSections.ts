import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { CompetitionSectionsResponse } from '@comp-dash/types'

export function useCompetitionSections(id: string, year?: string | number) {
  return useQuery<CompetitionSectionsResponse>({
    queryKey: ['competitions', 'sections', id, year ?? 'all'],
    queryFn: async () => {
      if (!id) throw new Error('Missing competition id')
      const qs = year && year !== 'all' ? `?year=${encodeURIComponent(year)}` : ''
      const res = await apiClient.get<CompetitionSectionsResponse>(`/competitions/${id}/sections${qs}`)
      return res
    },
    enabled: !!id,
  })
}
