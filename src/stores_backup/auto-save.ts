/**
 * Auto-Save Store
 * 
 * Manages auto-save state, session tracking, and data migration
 * across the application using Zustand.
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { SaveStatus, FrameworkSession } from '@/services/auto-save'
import { autoSaveService } from '@/services/auto-save'
import { useAuthStore } from '@/stores/auth'

interface AutoSaveState {
  // Current session being worked on
  currentSession: FrameworkSession | null
  
  // Save statuses for all active sessions
  saveStatuses: Record<string, SaveStatus>
  
  // Anonymous sessions available for migration
  pendingMigration: FrameworkSession[]
  
  // Migration state
  migrationInProgress: boolean
  
  // Recent sessions for quick access
  recentSessions: FrameworkSession[]
  
  // Actions
  setCurrentSession: (session: FrameworkSession | null) => void
  updateSaveStatus: (sessionId: string, status: SaveStatus) => void
  addToRecent: (session: FrameworkSession) => void
  
  // Migration actions
  checkForPendingMigration: () => Promise<void>
  startMigration: () => Promise<void>
  dismissMigration: () => void
  
  // Session management
  createNewSession: (frameworkType: string, title?: string) => FrameworkSession
  loadSession: (frameworkType: string, sessionId: string) => Promise<FrameworkSession | null>
  deleteSession: (sessionId: string) => Promise<void>
  
  // Anonymous session management
  getAnonymousSessions: (frameworkType: string) => FrameworkSession[]
  clearAnonymousData: () => void
}

export const useAutoSaveStore = create<AutoSaveState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      currentSession: null,
      saveStatuses: {},
      pendingMigration: [],
      migrationInProgress: false,
      recentSessions: [],

      // Actions
      setCurrentSession: (session) => {
        set({ currentSession: session })
        
        if (session) {
          get().addToRecent(session)
        }
      },

      updateSaveStatus: (sessionId, status) => {
        set((state) => ({
          saveStatuses: {
            ...state.saveStatuses,
            [sessionId]: status
          }
        }))
      },

      addToRecent: (session) => {
        set((state) => {
          const filtered = state.recentSessions.filter(s => s.id !== session.id)
          const updated = [session, ...filtered].slice(0, 10) // Keep 10 most recent
          
          return { recentSessions: updated }
        })
      },

      // Migration management
      checkForPendingMigration: async () => {
        const { isAuthenticated } = useAuthStore.getState()
        
        if (isAuthenticated) {
          // Check sessionStorage for preserved work
          const pendingData = sessionStorage.getItem('omnicore_migration_pending')
          
          if (pendingData) {
            try {
              const sessions: FrameworkSession[] = JSON.parse(pendingData)
              set({ pendingMigration: sessions })
            } catch (error) {
              console.error('Failed to parse pending migration data:', error)
            }
          }
          
          // Also check for any localStorage data
          const allFrameworks = ['ach', 'swot', 'cog', 'pest', 'dime', 'vrio', 'pmesii-pt', 'starbursting']
          const anonymousSessions: FrameworkSession[] = []
          
          for (const framework of allFrameworks) {
            const sessions = autoSaveService.getAnonymousSessions(framework)
            anonymousSessions.push(...sessions)
          }
          
          if (anonymousSessions.length > 0) {
            set((state) => ({
              pendingMigration: [...state.pendingMigration, ...anonymousSessions]
            }))
          }
        }
      },

      startMigration: async () => {
        set({ migrationInProgress: true })
        
        try {
          await autoSaveService.migrateAnonymousData()
          await autoSaveService.restoreWorkAfterAuthentication()
          
          set({ 
            pendingMigration: [],
            migrationInProgress: false 
          })
          
          // Refresh recent sessions from backend
          // This would need to be implemented based on your API structure
          
        } catch (error) {
          console.error('Migration failed:', error)
          set({ migrationInProgress: false })
          throw error
        }
      },

      dismissMigration: () => {
        set({ pendingMigration: [] })
        sessionStorage.removeItem('omnicore_migration_pending')
      },

      // Session management
      createNewSession: (frameworkType, title = 'Untitled') => {
        const sessionId = autoSaveService.generateSessionId()
        const { isAuthenticated } = useAuthStore.getState()
        
        const session: FrameworkSession = {
          id: sessionId,
          frameworkType,
          title,
          data: null,
          lastModified: new Date(),
          version: 1,
          isAnonymous: !isAuthenticated
        }
        
        get().setCurrentSession(session)
        return session
      },

      loadSession: async (frameworkType, sessionId) => {
        try {
          const session = await autoSaveService.loadSession(frameworkType, sessionId)
          
          if (session) {
            get().setCurrentSession(session)
          }
          
          return session
        } catch (error) {
          console.error('Failed to load session:', error)
          return null
        }
      },

      deleteSession: async (sessionId) => {
        const { isAuthenticated } = useAuthStore.getState()
        const session = get().currentSession
        
        if (!session) return
        
        try {
          if (isAuthenticated && !session.isAnonymous) {
            // Delete from backend
            const endpoint = autoSaveService['getBackendEndpoint'](session.frameworkType)
            await fetch(`${endpoint}/${sessionId}`, { method: 'DELETE' })
          } else {
            // Remove from localStorage
            const key = `omnicore_framework_${session.frameworkType}_${sessionId}`
            localStorage.removeItem(key)
          }
          
          // Update state
          set((state) => {
            const filtered = state.recentSessions.filter(s => s.id !== sessionId)
            return {
              recentSessions: filtered,
              currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
            }
          })
          
        } catch (error) {
          console.error('Failed to delete session:', error)
          throw error
        }
      },

      // Anonymous session management
      getAnonymousSessions: (frameworkType) => {
        return autoSaveService.getAnonymousSessions(frameworkType)
      },

      clearAnonymousData: () => {
        // Clear localStorage
        const keys = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('omnicore_framework_')) {
            keys.push(key)
          }
        }
        
        keys.forEach(key => localStorage.removeItem(key))
        
        // Clear state
        set({
          pendingMigration: [],
          recentSessions: []
        })
      }
    })),
    {
      name: 'auto-save-store'
    }
  )
)

// Subscribe to auth changes to trigger migration checks
useAutoSaveStore.subscribe(
  (state) => state.currentSession,
  (currentSession) => {
    // Auto-save when current session changes
    if (currentSession) {
      // This will be handled by the useAutoSave hook in components
    }
  }
)

// Utility hooks for easier access
export const useCurrentSession = () => useAutoSaveStore((state) => state.currentSession)
export const useSaveStatus = (sessionId: string) => 
  useAutoSaveStore((state) => state.saveStatuses[sessionId] || { status: 'idle' })
export const usePendingMigration = () => useAutoSaveStore((state) => state.pendingMigration)
export const useMigrationInProgress = () => useAutoSaveStore((state) => state.migrationInProgress)
export const useRecentSessions = () => useAutoSaveStore((state) => state.recentSessions)

// Actions
export const useAutoSaveActions = () => useAutoSaveStore((state) => ({
  setCurrentSession: state.setCurrentSession,
  updateSaveStatus: state.updateSaveStatus,
  checkForPendingMigration: state.checkForPendingMigration,
  startMigration: state.startMigration,
  dismissMigration: state.dismissMigration,
  createNewSession: state.createNewSession,
  loadSession: state.loadSession,
  deleteSession: state.deleteSession,
  clearAnonymousData: state.clearAnonymousData
}))

// Migration check on auth state changes
useAuthStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      // Check for pending migration when user logs in
      useAutoSaveStore.getState().checkForPendingMigration()
    }
  }
)