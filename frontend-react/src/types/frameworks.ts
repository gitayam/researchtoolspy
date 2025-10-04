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

// Framework Item Types
// Regular text item
export interface TextFrameworkItem {
  id: string
  text: string
}

// Question-answer pair item
export interface QuestionAnswerItem {
  id: string
  question: string
  answer: string
}

// Stakeholder item with rich metadata
export interface StakeholderItem {
  id: string
  name: string
  role?: string
  organization?: string
  contact_email?: string
  contact_phone?: string
  power_level: number // 1-10
  interest_level: number // 1-10
  position: 'supporter' | 'neutral' | 'opposer' | 'unknown'
  engagement_strategy?: string
  communication_frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'as_needed'
  key_concerns?: string[]
  influence_tactics?: string[]
  notes?: string
}

// Union type for framework items
export type FrameworkItem = TextFrameworkItem | QuestionAnswerItem | StakeholderItem

// Type guards
export function isQuestionAnswerItem(item: FrameworkItem): item is QuestionAnswerItem {
  return 'question' in item && 'answer' in item
}

export function isTextItem(item: FrameworkItem): item is TextFrameworkItem {
  return 'text' in item && !('question' in item) && !('name' in item)
}

export function isStakeholderItem(item: FrameworkItem): item is StakeholderItem {
  return 'name' in item && 'power_level' in item && 'interest_level' in item
}

// Helper to normalize items (for backward compatibility)
export function normalizeItem(item: any, itemType: 'text' | 'qa' = 'text'): FrameworkItem {
  if (itemType === 'qa') {
    if ('question' in item && 'answer' in item) {
      return item as QuestionAnswerItem
    }
    // Convert old text format to Q&A
    if ('text' in item) {
      return {
        id: item.id || crypto.randomUUID(),
        question: item.text || '',
        answer: ''
      }
    }
    // Fallback
    return {
      id: item.id || crypto.randomUUID(),
      question: item.question || '',
      answer: item.answer || ''
    }
  }

  // Text item
  if ('text' in item) {
    return item as TextFrameworkItem
  }
  // Convert Q&A to text if needed
  if ('question' in item) {
    return {
      id: item.id || crypto.randomUUID(),
      text: item.question
    }
  }
  // Fallback
  return {
    id: item.id || crypto.randomUUID(),
    text: item.text || ''
  }
}