// Auto-save service placeholder
export interface SaveResult {
  success: boolean
  message?: string
}

export class AutoSaveService {
  async save(data: any): Promise<SaveResult> {
    return { success: true }
  }
}