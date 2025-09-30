// Framework types
export interface Framework {
  id: string
  name: string
  type: string
  data: any
  created_at: string
  updated_at: string
}

export interface FrameworkSession {
  id: string
  framework_type: FrameworkType
  title: string
  data: any
  status: FrameworkStatus
  created_at: string
  updated_at: string
  user_id?: string
}

export const FrameworkType = {
  SWOT: 'swot',
  ACH: 'ach',
  COG: 'cog',
  PMESII_PT: 'pmesii-pt',
  DOTMLPF: 'dotmlpf',
  DIME: 'dime',
  PEST: 'pest',
  VRIO: 'vrio',
  STAKEHOLDER: 'stakeholder',
  CAUSEWAY: 'causeway',
  BEHAVIOR: 'behavior',
  DECEPTION: 'deception',
  SURVEILLANCE: 'surveillance',
  TREND: 'trend',
  STARBURSTING: 'starbursting',
  FUNDAMENTAL_FLOW: 'fundamental-flow'
} as const

export type FrameworkType = typeof FrameworkType[keyof typeof FrameworkType]

export const FrameworkStatus = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
} as const

export type FrameworkStatus = typeof FrameworkStatus[keyof typeof FrameworkStatus]