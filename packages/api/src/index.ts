export { apiClient } from './client'
export { setFirestoreDb, getFirestoreDb, isFirestoreEnabled } from './firestore-manager'
export { useLogin, useProfile, useUpdateProfile, useUpdateNotificationPreferences, useUpdateLanguage, useLogout } from './hooks/useAuth'
export { useCompetitions, useCompetition, useUpcomingDeadlines, useTrendingCompetitions, useSearchCompetitions } from './hooks/useCompetitions'
// Leaderboard hooks come from useLeaderboard (Supabase-aware). useRegistrations
// also declares same-named copies; exporting both would be an ambiguous re-export.
export { usePrizeLeaderboard, useRecentWinners } from './hooks/useLeaderboard'
export {
  useRegistrations,
  useRegistration,
  useRegistrationStats,
  useRegisterForCompetition,
  useVerifyRegistration,
  useDashboardStats,
  useAdminRegistrationStats,
  useStudentDashboardStats,
  useStudentHistory,
  useCompetitionDashboard,
  useAdvisorDashboardStats,
  useHodDashboardStats,
  useCoeDashboardStats,
  useRoleAccess,
  useSendReminder,
  useCreateCompetition,
  useUpdateCompetition,
  useDeleteCompetition,
  useAdvisorCompetitionStats,
  useCompetitionDashboardRealtime,
  useLeaderboardOverall,
  useLeaderboardDepartment,
  useLeaderboardDepartments,
} from './hooks/useRegistrations'
export { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useUnreadNotificationCount } from './hooks/useNotifications'
export { useBookmarks, useToggleBookmark, useIsBookmarked } from './hooks/useBookmarks'
export {
  useAdminStudents,
  useAdminAdvisors,
  useAdminDepartments,
  useAdminWinners,
  useAdminAnalytics,
  useAdminAuditLogs,
} from './hooks/useAdmin'
export { useAdvisorSummary } from './hooks/useAdvisorSummary'
