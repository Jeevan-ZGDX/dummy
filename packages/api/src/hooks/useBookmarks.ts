import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { Competition } from '@comp-dash/types'

export function useBookmarks() {
  return useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => apiClient.get<Competition[]>('/bookmarks'),
    staleTime: 2 * 60 * 1000,
  })
}

export function useToggleBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (competitionId: string) =>
      apiClient.post<{ bookmarked: boolean }, { competitionId: string }>('/bookmarks', { competitionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      queryClient.invalidateQueries({ queryKey: ['competitions'] })
    },
  })
}

export function useIsBookmarked(competitionId: string) {
  return useQuery({
    queryKey: ['bookmarks', competitionId],
    queryFn: () =>
      apiClient.get<{ bookmarked: boolean }>(`/bookmarks/check/${competitionId}`),
    staleTime: 5 * 60 * 1000,
  })
}
