// Auto-save service
export interface SaveResult {
  success: boolean
  message?: string
}

export const SaveStatus = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error'
} as const

export type SaveStatus = typeof SaveStatus[keyof typeof SaveStatus]

export interface FrameworkSession {
  id: string
  framework_type: string
  title: string
  data: any
  status: string
  created_at: string
  updated_at: string
}

export class AutoSaveService {
  async save(_data: any): Promise<SaveResult> {
    return { success: true }
  }

  async load(_id: string): Promise<FrameworkSession | null> {
    return null
  }
}

export const autoSaveService = new AutoSaveService()