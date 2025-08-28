/**
 * Universal Auto-Save Service
 * 
 * Handles automatic saving of framework data to localStorage (anonymous users)
 * and backend APIs (authenticated users) with seamless migration between states.
 */
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api'

// Types
export interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved?: Date
  error?: string
}

export interface FrameworkSession {
  id: string
  frameworkType: string
  title: string
  data: any
  lastModified: Date
  version: number
  isAnonymous: boolean
}

export interface AutoSaveOptions {
  debounceMs?: number
  maxRetries?: number
  enableLocalStorage?: boolean
  enableBackend?: boolean
}

// Storage Keys
const STORAGE_KEYS = {
  ANONYMOUS_PREFIX: 'omnicore_framework_',
  MIGRATION_DATA: 'omnicore_migration_pending',
  SAVE_STATUS: 'omnicore_save_status'
} as const

/**
 * Auto-Save Service Class
 */
class AutoSaveService {
  private saveQueue = new Map<string, FrameworkSession>()
  private saveStatus = new Map<string, SaveStatus>()
  private options: Required<AutoSaveOptions>
  public scheduleAutoSave: (sessionId: string, data: FrameworkSession) => void
  
  constructor(options: AutoSaveOptions = {}) {
    this.options = {
      debounceMs: 500,
      maxRetries: 3,
      enableLocalStorage: true,
      enableBackend: true,
      ...options
    }
    
    // Initialize debounced auto-save after options are set
    this.scheduleAutoSave = this.debounce(this.performAutoSave.bind(this), this.options.debounceMs)
  }

  /**
   * Simple debounce implementation
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => func.apply(this, args), delay)
    }
  }

  /**
   * Perform auto-save for framework data (called by debounced scheduleAutoSave)
   */
  private async performAutoSave(sessionId: string, data: FrameworkSession): Promise<void> {
    try {
      this.updateSaveStatus(sessionId, { status: 'saving' })
      
      const { isAuthenticated } = useAuthStore.getState()
      
      if (isAuthenticated && this.options.enableBackend) {
        await this.saveToBackend(sessionId, data)
      } else if (this.options.enableLocalStorage) {
        await this.saveToLocalStorage(sessionId, data)
      }
      
      this.updateSaveStatus(sessionId, { 
        status: 'saved', 
        lastSaved: new Date() 
      })
      
    } catch (error) {
      console.error('Auto-save failed:', error)
      this.updateSaveStatus(sessionId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Save failed' 
      })
      
      // Fallback to localStorage if backend fails
      if (this.options.enableLocalStorage) {
        try {
          await this.saveToLocalStorage(sessionId, data)
          this.updateSaveStatus(sessionId, { 
            status: 'saved', 
            lastSaved: new Date() 
          })
        } catch (localError) {
          console.error('Fallback to localStorage also failed:', localError)
        }
      }
    }
  }

  /**
   * Save to backend API
   */
  private async saveToBackend(sessionId: string, data: FrameworkSession): Promise<void> {
    const endpoint = this.getBackendEndpoint(data.frameworkType)
    
    if (sessionId === 'new' || data.isAnonymous) {
      // Create new session
      const response = await apiClient.post(endpoint, {
        title: data.title,
        framework_type: data.frameworkType,
        data: data.data
      })
      
      // Update session ID with backend response
      if (response.id || response.session_id) {
        const newId = response.id || response.session_id
        this.migrateSessionId(sessionId, String(newId))
      }
    } else {
      // Update existing session
      await apiClient.put(`${endpoint}/${sessionId}`, {
        title: data.title,
        data: data.data
      })
    }
  }

  /**
   * Save to localStorage
   */
  private async saveToLocalStorage(sessionId: string, data: FrameworkSession): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.ANONYMOUS_PREFIX}${data.frameworkType}_${sessionId}`
      const serializedData = JSON.stringify({
        ...data,
        lastModified: new Date().toISOString(),
        isAnonymous: true
      })
      
      localStorage.setItem(key, serializedData)
      
      // Also update the index
      this.updateLocalStorageIndex(data.frameworkType, sessionId, data.title)
      
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Handle storage quota exceeded
        await this.cleanupOldLocalStorage()
        // Retry once
        localStorage.setItem(
          `${STORAGE_KEYS.ANONYMOUS_PREFIX}${data.frameworkType}_${sessionId}`,
          JSON.stringify(data)
        )
      } else {
        throw error
      }
    }
  }

  /**
   * Load session data
   */
  public async loadSession(
    frameworkType: string, 
    sessionId: string
  ): Promise<FrameworkSession | null> {
    const { isAuthenticated } = useAuthStore.getState()
    
    if (isAuthenticated && sessionId !== 'new') {
      // Load from backend
      try {
        const endpoint = this.getBackendEndpoint(frameworkType)
        const data = await apiClient.get(`${endpoint}/${sessionId}`)
        
        return {
          id: sessionId,
          frameworkType,
          title: data.title,
          data: data.data,
          lastModified: new Date(data.updated_at || data.lastModified),
          version: data.version || 1,
          isAnonymous: false
        }
      } catch (error) {
        console.error('Failed to load from backend:', error)
        return null
      }
    } else {
      // Load from localStorage
      return this.loadFromLocalStorage(frameworkType, sessionId)
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(
    frameworkType: string, 
    sessionId: string
  ): FrameworkSession | null {
    try {
      const key = `${STORAGE_KEYS.ANONYMOUS_PREFIX}${frameworkType}_${sessionId}`
      const stored = localStorage.getItem(key)
      
      if (!stored) return null
      
      const data = JSON.parse(stored)
      return {
        ...data,
        lastModified: new Date(data.lastModified)
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return null
    }
  }

  /**
   * Get all anonymous sessions for a framework type
   */
  public getAnonymousSessions(frameworkType: string): FrameworkSession[] {
    const sessions: FrameworkSession[] = []
    const prefix = `${STORAGE_KEYS.ANONYMOUS_PREFIX}${frameworkType}_`
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const session = JSON.parse(data)
            sessions.push({
              ...session,
              lastModified: new Date(session.lastModified)
            })
          }
        } catch (error) {
          console.error('Failed to parse localStorage data:', error)
        }
      }
    }
    
    return sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  }

  /**
   * Migrate anonymous data to authenticated backend
   */
  public async migrateAnonymousData(): Promise<void> {
    const { isAuthenticated } = useAuthStore.getState()
    
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to migrate data')
    }
    
    const anonymousSessions = this.getAllAnonymousSessions()
    
    for (const session of anonymousSessions) {
      try {
        // Save to backend
        session.isAnonymous = false
        await this.saveToBackend('new', session)
        
        // Remove from localStorage after successful migration
        const key = `${STORAGE_KEYS.ANONYMOUS_PREFIX}${session.frameworkType}_${session.id}`
        localStorage.removeItem(key)
        
      } catch (error) {
        console.error('Failed to migrate session:', session.id, error)
        // Continue with other sessions
      }
    }
    
    // Clean up localStorage index
    this.cleanupLocalStorageIndex()
  }

  /**
   * Preserve work before authentication
   */
  public preserveWorkForAuthentication(): void {
    const allSessions = this.getAllAnonymousSessions()
    
    if (allSessions.length > 0) {
      sessionStorage.setItem(
        STORAGE_KEYS.MIGRATION_DATA,
        JSON.stringify(allSessions)
      )
    }
  }

  /**
   * Restore work after authentication
   */
  public async restoreWorkAfterAuthentication(): Promise<void> {
    const pendingData = sessionStorage.getItem(STORAGE_KEYS.MIGRATION_DATA)
    
    if (pendingData) {
      try {
        const sessions: FrameworkSession[] = JSON.parse(pendingData)
        
        // Save each session to backend
        for (const session of sessions) {
          session.isAnonymous = false
          await this.saveToBackend('new', session)
        }
        
        // Clear the pending data
        sessionStorage.removeItem(STORAGE_KEYS.MIGRATION_DATA)
        
        // Clear localStorage
        this.clearAllAnonymousData()
        
      } catch (error) {
        console.error('Failed to restore work after authentication:', error)
      }
    }
  }

  /**
   * Get save status for a session
   */
  public getSaveStatus(sessionId: string): SaveStatus {
    return this.saveStatus.get(sessionId) || { status: 'idle' }
  }

  /**
   * Update save status
   */
  private updateSaveStatus(sessionId: string, status: Partial<SaveStatus>): void {
    const current = this.saveStatus.get(sessionId) || { status: 'idle' }
    this.saveStatus.set(sessionId, { ...current, ...status })
  }

  /**
   * Get backend endpoint for framework type
   */
  private getBackendEndpoint(frameworkType: string): string {
    // Map framework types to their API endpoints
    const endpointMap: Record<string, string> = {
      'ach': '/frameworks',
      'swot': '/frameworks/swot',
      'cog': '/frameworks/sessions',
      'pest': '/frameworks/sessions',
      'dime': '/frameworks/dime',
      'vrio': '/frameworks/sessions',
      'pmesii-pt': '/frameworks/sessions',
      'starbursting': '/frameworks',
      'behavior': '/frameworks',
      'deception': '/frameworks',
      'dotmlpf': '/frameworks',
      'fundamental-flow': '/frameworks'
    }
    
    return endpointMap[frameworkType] || '/frameworks'
  }

  /**
   * Generate new session ID
   */
  public generateSessionId(): string {
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Migrate session ID (when anonymous session gets backend ID)
   */
  private migrateSessionId(oldId: string, newId: string): void {
    // Update internal tracking
    const oldStatus = this.saveStatus.get(oldId)
    if (oldStatus) {
      this.saveStatus.set(newId, oldStatus)
      this.saveStatus.delete(oldId)
    }
  }

  /**
   * Get all anonymous sessions across all frameworks
   */
  private getAllAnonymousSessions(): FrameworkSession[] {
    const sessions: FrameworkSession[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_KEYS.ANONYMOUS_PREFIX)) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const session = JSON.parse(data)
            sessions.push({
              ...session,
              lastModified: new Date(session.lastModified)
            })
          }
        } catch (error) {
          console.error('Failed to parse localStorage data:', error)
        }
      }
    }
    
    return sessions
  }

  /**
   * Update localStorage index for quick access
   */
  private updateLocalStorageIndex(
    frameworkType: string, 
    sessionId: string, 
    title: string
  ): void {
    try {
      const indexKey = `${STORAGE_KEYS.ANONYMOUS_PREFIX}index`
      const stored = localStorage.getItem(indexKey)
      const index = stored ? JSON.parse(stored) : {}
      
      if (!index[frameworkType]) {
        index[frameworkType] = []
      }
      
      // Update or add entry
      const existingIndex = index[frameworkType].findIndex((s: any) => s.id === sessionId)
      const entry = {
        id: sessionId,
        title,
        lastModified: new Date().toISOString()
      }
      
      if (existingIndex >= 0) {
        index[frameworkType][existingIndex] = entry
      } else {
        index[frameworkType].push(entry)
      }
      
      localStorage.setItem(indexKey, JSON.stringify(index))
    } catch (error) {
      console.error('Failed to update localStorage index:', error)
    }
  }

  /**
   * Clean up old localStorage entries
   */
  private async cleanupOldLocalStorage(): Promise<void> {
    const sessions = this.getAllAnonymousSessions()
    
    // Keep only the 10 most recent sessions per framework
    const frameworkGroups = sessions.reduce((acc, session) => {
      if (!acc[session.frameworkType]) {
        acc[session.frameworkType] = []
      }
      acc[session.frameworkType].push(session)
      return acc
    }, {} as Record<string, FrameworkSession[]>)
    
    for (const [frameworkType, frameworkSessions] of Object.entries(frameworkGroups)) {
      const sorted = frameworkSessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      const toRemove = sorted.slice(10) // Keep newest 10
      
      for (const session of toRemove) {
        const key = `${STORAGE_KEYS.ANONYMOUS_PREFIX}${frameworkType}_${session.id}`
        localStorage.removeItem(key)
      }
    }
  }

  /**
   * Clear all anonymous data
   */
  private clearAllAnonymousData(): void {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_KEYS.ANONYMOUS_PREFIX)) {
        keys.push(key)
      }
    }
    
    keys.forEach(key => localStorage.removeItem(key))
  }

  /**
   * Clean up localStorage index
   */
  private cleanupLocalStorageIndex(): void {
    localStorage.removeItem(`${STORAGE_KEYS.ANONYMOUS_PREFIX}index`)
  }
}

// Create singleton instance
export const autoSaveService = new AutoSaveService()

// React Hook for easy component integration
export function useAutoSave<T>(
  data: T,
  frameworkType: string,
  sessionId: string = 'new',
  options: { enabled?: boolean; title?: string } = {}
) {
  const { enabled = true, title = 'Untitled' } = options
  
  // Use a ref to track the last stringified data to avoid unnecessary re-renders
  const lastDataRef = React.useRef<string>('')
  
  React.useEffect(() => {
    if (!enabled || !data) return
    
    // Only trigger auto-save if data actually changed
    const currentDataString = JSON.stringify(data)
    if (currentDataString === lastDataRef.current) return
    lastDataRef.current = currentDataString
    
    const session: FrameworkSession = {
      id: sessionId,
      frameworkType,
      title,
      data,
      lastModified: new Date(),
      version: 1,
      isAnonymous: sessionId === 'new' || sessionId.startsWith('anon_')
    }
    
    autoSaveService.scheduleAutoSave(sessionId, session)
  }, [data, frameworkType, sessionId, title, enabled])
  
  const saveStatus = autoSaveService.getSaveStatus(sessionId)
  
  return {
    saveStatus,
    generateSessionId: autoSaveService.generateSessionId,
    loadSession: (id: string) => autoSaveService.loadSession(frameworkType, id),
    getAnonymousSessions: () => autoSaveService.getAnonymousSessions(frameworkType)
  }
}

import React from 'react'