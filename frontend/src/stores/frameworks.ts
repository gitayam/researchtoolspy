import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { FrameworkSession, FrameworkType, FrameworkStatus } from '@/types/frameworks'

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
      recentSessions: [
        {
          id: 1,
          title: "Q4 2024 Strategic Assessment",
          framework_type: "swot",
          status: "completed",
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          data: {},
          user_id: 1
        },
        {
          id: 2,
          title: "COG Analysis - Market Entry",
          framework_type: "cog",
          status: "in_progress",
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          data: {},
          user_id: 1
        },
        {
          id: 3,
          title: "PMESII-PT Threat Assessment",
          framework_type: "pmesii-pt",
          status: "draft",
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          data: {},
          user_id: 1
        }
      ],
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