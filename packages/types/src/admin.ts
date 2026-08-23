export interface AdminStudent {
  id: string
  name: string
  email: string
  department: string
  year: string
  section: string
  registeredCompetitions: number
  verifiedCompetitions: number
  createdAt: string
}

export interface AdminStudentListResponse {
  data: AdminStudent[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminAdvisor {
  id: string
  name: string
  email: string
  department: string
  assignedSections: string[]
  pendingVerifications: number
  createdAt: string
}

export interface AdminAdvisorListResponse {
  data: AdminAdvisor[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface Department {
  id: string
  name: string
  fullName: string
  studentCount: number
  competitionCount: number
}

export interface Winner {
  id: string
  studentName: string
  email: string
  competition: string
  competitionId: string
  department: string
  position: string
  prize: string
  date: string
}

export interface WinnerListResponse {
  data: Winner[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AnalyticsStats {
  totalCompetitions: number
  totalParticipants: number
  winRate: number
  verificationRate: number
  competitionTrends: { date: string; count: number }[]
  departmentPerformance: { name: string; count: number }[]
  verificationRateOverTime: { date: string; rate: number }[]
}

export interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: string
  resource: string
  details: string
}

export interface AuditLogListResponse {
  data: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}
