import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type {
  AdminStudentListResponse,
  AdminAdvisorListResponse,
  Department,
  WinnerListResponse,
  AnalyticsStats,
  AuditLogListResponse,
} from '@comp-dash/types'

export function useAdminStudents(params?: {
  search?: string
  department?: string
  year?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['admin', 'students', params],
    queryFn: () =>
      apiClient.get<AdminStudentListResponse>('/admin/students', params as Record<string, unknown>),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminAdvisors(params?: {
  search?: string
  department?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['admin', 'advisors', params],
    queryFn: () =>
      apiClient.get<AdminAdvisorListResponse>('/admin/advisors', params as Record<string, unknown>),
    staleTime: 2 * 60 * 1000,
  })
}

export function useAdminDepartments() {
  return useQuery({
    queryKey: ['admin', 'departments'],
    queryFn: () => apiClient.get<Department[]>('/admin/departments'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminWinners(params?: {
  search?: string
  department?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['admin', 'winners', params],
    queryFn: () =>
      apiClient.get<WinnerListResponse>('/admin/winners', params as Record<string, unknown>),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => apiClient.get<AnalyticsStats>('/admin/analytics/stats'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminAuditLogs(params?: {
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () =>
      apiClient.get<AuditLogListResponse>('/admin/audit-logs', params as Record<string, unknown>),
    staleTime: 30 * 1000,
  })
}
