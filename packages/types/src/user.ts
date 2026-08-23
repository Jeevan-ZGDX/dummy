export type UserRole = 'student' | 'advisor' | 'hod' | 'coe'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  department: string
  section: string
  academicYear: string
  role: UserRole
  organizationId: string
  createdAt: string
  updatedAt: string
  notificationPreferences?: NotificationPreferences
  language?: SupportedLanguage
}

export interface Student extends User {
  role: 'student'
  rollNumber: string
  registeredCompetitions: number
  verifiedParticipations: number
  totalWins: number
}

export interface Advisor extends User {
  role: 'advisor'
  assignedSections: string[]
  pendingVerifications: number
}

export interface HOd extends User {
  role: 'hod'
  permissions: string[]
}

export interface Coe extends User {
  role: 'coe'
  permissions: string[]
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginResponse {
  user: User
  token: string
  refreshToken: string
}

export interface ProfileUpdate {
  avatarUrl?: string
  notificationPreferences?: NotificationPreferences
  language?: SupportedLanguage
}

export type SupportedLanguage = 'en' | 'ta' | 'hi'

export interface NotificationPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  deadlineReminders: boolean
  verificationUpdates: boolean
  newCompetitions: boolean
}
