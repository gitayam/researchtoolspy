import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FrameworkSession, FrameworkType, FrameworkStatus } from '@/types/frameworks'
import { apiClient } from '@/lib/api'

interface FrameworkState {
  // State
  currentSession: FrameworkSession | null
  sessions: FrameworkSession[]
  recentSessions: FrameworkSession[]
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentSession: (session: FrameworkSession | null) => void
  setSessions: (sessions: FrameworkSession[]) => void
  addSession: (session: FrameworkSession) => void
  updateSession: (id: number, updates: Partial<FrameworkSession>) => void
  removeSession: (id: number) => void
  setRecentSessions: (sessions: FrameworkSession[]) => void
  addRecentSession: (session: FrameworkSession) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  // API Actions
  fetchSessions: () => Promise<void>
  fetchRecentSessions: () => Promise<void>
  refreshData: () => Promise<void>

  // Selectors
  getSessionsByType: (type: FrameworkType) => FrameworkSession[]
  getSessionsByStatus: (status: FrameworkStatus) => FrameworkSession[]
  getSessionById: (id: number) => FrameworkSession | undefined
}

export const useFrameworkStore = create<FrameworkState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentSession: null,
      sessions: [],
      recentSessions: [],
      isLoading: false,
      error: null,

      // Actions
      setCurrentSession: (session) => {
        set({ currentSession: session })
        
        // Add to recent sessions if it's a new session
        if (session) {
          const { recentSessions } = get()
          const isAlreadyRecent = recentSessions.some(s => s.id === session.id)
          
          if (!isAlreadyRecent) {
            const newRecent = [session, ...recentSessions.slice(0, 4)] // Keep 5 most recent
            set({ recentSessions: newRecent })
          }
        }
      },

      setSessions: (sessions) => {
        set({ sessions })
      },

      addSession: (session) => {
        set((state) => ({
          sessions: [session, ...state.sessions]
        }))
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map(session => 
            session.id === id ? { ...session, ...updates } : session
          ),
          currentSession: state.currentSession?.id === id 
            ? { ...state.currentSession, ...updates }
            : state.currentSession,
          recentSessions: state.recentSessions.map(session =>
            session.id === id ? { ...session, ...updates } : session
          )
        }))
      },

      removeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter(session => session.id !== id),
          currentSession: state.currentSession?.id === id ? null : state.currentSession,
          recentSessions: state.recentSessions.filter(session => session.id !== id)
        }))
      },

      setRecentSessions: (sessions) => {
        set({ recentSessions: sessions })
      },

      addRecentSession: (session) => {
        set((state) => {
          const filtered = state.recentSessions.filter(s => s.id !== session.id)
          return {
            recentSessions: [session, ...filtered].slice(0, 5) // Keep 5 most recent
          }
        })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      clearError: () => {
        set({ error: null })
      },

      // API Actions
      fetchSessions: async () => {
        try {
          set({ isLoading: true, error: null })
          const sessions = await apiClient.get<FrameworkSession[]>('/frameworks/')
          set({ sessions, isLoading: false })
        } catch (error: any) {
          console.warn('Failed to fetch sessions, using empty data:', error.message)
          set({ sessions: [], isLoading: false, error: null }) // Don't show errors for API unavailability in development
        }
      },

      fetchRecentSessions: async () => {
        try {
          set({ isLoading: true, error: null })
          const allSessions = await apiClient.get<FrameworkSession[]>('/frameworks/')
          // Sort by updated_at desc and take first 5
          const recentSessions = allSessions
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 5)
          set({ recentSessions, isLoading: false })
        } catch (error: any) {
          console.warn('Failed to fetch recent sessions, using empty data:', error.message)
          set({ recentSessions: [], isLoading: false, error: null }) // Don't show errors for API unavailability in development
        }
      },

      refreshData: async () => {
        // Call the functions directly to avoid circular references
        const store = get()
        await Promise.all([
          store.fetchSessions(),
          store.fetchRecentSessions()
        ])
      },

      // Selectors
      getSessionsByType: (type) => {
        return get().sessions.filter(session => session.framework_type === type)
      },

      getSessionsByStatus: (status) => {
        return get().sessions.filter(session => session.status === status)
      },

      getSessionById: (id) => {
        return get().sessions.find(session => session.id === id)
      }
    }),
    {
      name: 'framework-store'
    }
  )
)

// Utility hooks for easier access
export const useCurrentSession = () => useFrameworkStore((state) => state.currentSession)
export const useFrameworkSessions = () => useFrameworkStore((state) => state.sessions)
export const useRecentSessions = () => useFrameworkStore((state) => state.recentSessions)
export const useFrameworkLoading = () => useFrameworkStore((state) => state.isLoading)
export const useFrameworkError = () => useFrameworkStore((state) => state.error)

// API hooks
export const useFrameworkActions = () => useFrameworkStore((state) => ({
  fetchSessions: state.fetchSessions,
  fetchRecentSessions: state.fetchRecentSessions,
  refreshData: state.refreshData,
  setLoading: state.setLoading,
  setError: state.setError
}))