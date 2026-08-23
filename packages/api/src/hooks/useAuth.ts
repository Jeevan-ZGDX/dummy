import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type {
  User,
  LoginResponse,
  ProfileUpdate,
  SupportedLanguage,
  NotificationPreferences,
} from '@comp-dash/types'

export function useLogin() {
  return useMutation({
    mutationFn: (data: { idToken: string }) =>
      apiClient.post<LoginResponse, { idToken: string }>('/auth/google', data),
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<User>('/auth/me'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProfileUpdate) =>
      apiClient.put<User, ProfileUpdate>('/auth/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: NotificationPreferences) =>
      apiClient.put<NotificationPreferences, NotificationPreferences>('/auth/notification-preferences', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useUpdateLanguage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (language: SupportedLanguage) =>
      apiClient.put<{ language: SupportedLanguage }, { language: SupportedLanguage }>('/auth/language', { language }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      queryClient.clear()
    },
  })
}
