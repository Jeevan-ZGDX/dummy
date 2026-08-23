export type CompetitionCategory = 'hackathon' | 'internship' | 'workshop' | 'paper_presentation' | 'project' | 'sports' | 'cultural' | 'other'

export type CompetitionMode = 'online' | 'offline' | 'hybrid'

export type CompetitionScope = 'national' | 'international' | 'state' | 'college'

export interface Competition {
  id: string
  title: string
  description: string
  shortDescription: string
  category: CompetitionCategory
  scope: CompetitionScope
  mode: CompetitionMode
  organizer: string
  organizerEmail: string
  organizerLogo: string | null
  bannerUrl: string | null
  websiteUrl: string
  registrationUrl: string
  registrationLink: string
  teamSizeMin: number
  teamSizeMax: number
  prizePool: string
  registrationDeadline: string
  startDate: string
  endDate: string
  eligibility: EligibilityCriteria
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface EligibilityCriteria {
  departments: string[]
  yearOfStudy: string[]
  minGpa?: number
  description: string
}

export interface CompetitionFilters {
  category?: CompetitionCategory
  scope?: CompetitionScope
  mode?: CompetitionMode
  department?: string
  search?: string
  sortBy?: 'deadline' | 'prizePool' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface CompetitionListResponse {
  data: Competition[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CompetitionDetail extends Competition {
  instructions: string
  contactEmail: string
  contactPhone?: string
  venue?: string
  isBookmarked: boolean
  bookmarkCount: number
  registrationCount: number
}
