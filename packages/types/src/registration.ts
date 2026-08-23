import { Competition } from './competition'

export type RegistrationStatus = 'pending_verification' | 'verified' | 'completed' | 'rejected'

export interface Registration {
  id: string
  competitionId: string
  competition: Competition
  userId: string
  userName: string
  department: string
  status: RegistrationStatus
  registeredAt: string
  verifiedAt: string | null
  verificationMethod: 'screenshot' | 'email' | 'manual' | null
  extractedConfirmationId: string | null
  extractedEmail: string | null
  rejectionReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface RegistrationListResponse {
  data: Registration[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RegistrationCreate {
  competitionId: string
  verificationMethod: 'screenshot' | 'email'
  confirmationScreenshot?: string
  confirmationEmail?: string
  userId?: string
  userEmail?: string
  userName?: string
  competitionTitle?: string
}

export interface RegistrationStats {
  totalRegistered: number
  totalVerified: number
  totalCompleted: number
  totalRejected: number
  totalPending: number
  verificationRate: number
}

export interface AdminRegistrationStats extends RegistrationStats {
  totalCompetitions: number
  totalRegistrations: number
  registrationGrowth: number
  verifiedGrowth: number
  verificationRateChange: number
}

export interface StudentDashboardStats {
  totalRegistered: number
  totalVerified: number
  totalPending: number
  totalWins: number
  unregisteredCount: number
  registrations: Registration[]
  upcomingCompetitions: Competition[]
  selfVerificationRequests: any[]
}

export interface HodDashboardStats {
  totalStudents: number
  openCompetitions: number
  totalExpected: number
  registered: number
  unregistered: number
  verifiedCount: number
  pendingCount: number
  rejectedCount: number
  yearWise: { year: string; studentCount: number; registrationCount: number; totalExpected: number; unregistered: number; verifiedCount: number; pendingCount: number }[]
  selfVerificationRequests: any[]
  registrations: any[]
}

export interface DashboardStats {
  totalCompetitions: number
  openCompetitions: number
  totalRegistered: number
  registered: number
  totalExpected: number
  unregistered: number
  verifiedRegistrations: number
  pendingRegistrations: number
  rejectedRegistrations: number
  verificationRate: number
  registrationsOverTime: { date: string; count: number }[]
  verificationTrend: { date: string; count: number }[]
  topDepartments: { name: string; count: number }[]
  recentVerified: Registration[]
  pendingVerifications: Registration[]
  selfVerificationRequests: any[]
}

export interface CompetitionDashboardData {
  competition: Competition
  registeredStudents: Registration[]
  unregisteredStudents: { id: string; name: string; email: string; department: string; section: string }[]
  totalRegistered: number
  totalUnregistered: number
  registrationsByDepartment: { department: string; count: number }[]
}

export interface HistoryEntry {
  registration: Registration
  competition: Competition
  status: RegistrationStatus
  verifiedAt: string | null
  position?: string
  prize?: string
}

export type OdRequestStatus = 'requested' | 'approved' | 'rejected' | 'cancelled'

export interface OdRequest {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  competitionId: string
  competitionTitle: string
  section: string
  department: string
  advisorId: string
  advisorName: string
  status: OdRequestStatus
  requestedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface OdRequestCreate {
  competitionId: string
  studentId: string
}

export interface OdRequestListResponse {
  data: OdRequest[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdvisorDashboardStats {
  totalStudents: number
  registeredCount: number
  verifiedCount: number
  pendingCount: number
  rejectedCount: number
  verificationRequests: Array<{
    id: string
    studentId?: string
    studentName: string
    department?: string
    competitionTitle?: string
    status: string
    emailProof?: {
      from?: string
      to?: string
      subject?: string
      date?: string
    } | null
    requestedAt?: string
  }>
  registrations: Array<Record<string, unknown>>
}
