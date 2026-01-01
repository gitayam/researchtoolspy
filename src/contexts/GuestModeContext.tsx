import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { safeJSONParse, safeJSONStringify } from '@/utils/safe-json'
import { useAuthStore } from '@/stores/auth'

export type UserMode = 'guest' | 'authenticated'

interface GuestModeContextType {
  mode: UserMode
  isGuest: boolean
  isAuthenticated: boolean
  guestSessionId: string | null
  setMode: (mode: UserMode) => void
  convertToAuthenticated: (userId: number) => Promise<void>
  getStorageKey: (key: string) => string
  saveToLocalStorage: (key: string, data: any) => void
  loadFromLocalStorage: (key: string) => any
  clearGuestData: () => void
}

const GuestModeContext = createContext<GuestModeContextType | undefined>(undefined)

const GUEST_SESSION_KEY = 'guest_session_id'
const GUEST_DATA_PREFIX = 'guest_'
const GUEST_SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days

interface GuestModeProviderProps {
  children: ReactNode
}

export function GuestModeProvider({ children }: GuestModeProviderProps) {
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
  
  // Use auth store as source of truth
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const mode: UserMode = isAuthenticated ? 'authenticated' : 'guest'

  // Initialize guest session
  useEffect(() => {
    if (isAuthenticated) return

    // Initialize or load guest session
    let sessionId = localStorage.getItem(GUEST_SESSION_KEY)
    const sessionTimestamp = localStorage.getItem(`${GUEST_SESSION_KEY}_timestamp`)

    // Check if session expired
    if (sessionTimestamp) {
      const elapsed = Date.now() - parseInt(sessionTimestamp)
      if (elapsed > GUEST_SESSION_EXPIRY) {
        // Session expired, clear data
        clearGuestData()
        sessionId = null
      }
    }

    // Create new session if needed
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(GUEST_SESSION_KEY, sessionId)
      localStorage.setItem(`${GUEST_SESSION_KEY}_timestamp`, Date.now().toString())
    }

    setGuestSessionId(sessionId)
  }, [isAuthenticated])

  const setMode = (newMode: UserMode) => {
    // Mode is derived from auth state, but we can support explicit logout/guest switch
    if (newMode === 'guest') {
      useAuthStore.getState().logout()
    }
    // To switch to authenticated, user must login via login page
  }

  const convertToAuthenticated = async (userId: number) => {
    // Transfer guest data to authenticated user
    try {
      // Collect guest data
      const guestData: Record<string, any> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(GUEST_DATA_PREFIX)) {
          const value = localStorage.getItem(key)
          if (value) {
            guestData[key] = safeJSONParse(value)
          }
        }
      }

      // Send to backend (implement this based on your API)
      const response = await fetch('/api/guest-conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_session_id: guestSessionId,
          user_id: userId,
          data: guestData,
        }),
      })

      if (response.ok) {
        // Clear guest data
        clearGuestData()
        // Auth state update happens elsewhere (e.g. login)
      }
    } catch (error) {
      console.error('Failed to convert guest to authenticated:', error)
      throw error
    }
  }

  const getStorageKey = (key: string): string => {
    if (mode === 'guest') {
      return `${GUEST_DATA_PREFIX}${key}`
    }
    return key
  }

  const saveToLocalStorage = (key: string, data: any) => {
    const storageKey = getStorageKey(key)
    localStorage.setItem(storageKey, safeJSONStringify(data))
    localStorage.setItem(`${storageKey}_timestamp`, Date.now().toString())
  }

  const loadFromLocalStorage = (key: string): any => {
    const storageKey = getStorageKey(key)
    const data = localStorage.getItem(storageKey)
    return data ? safeJSONParse(data, null) : null
  }

  const clearGuestData = () => {
    // Clear all guest-prefixed data
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith(GUEST_DATA_PREFIX) || key === GUEST_SESSION_KEY || key === `${GUEST_SESSION_KEY}_timestamp`)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
    setGuestSessionId(null)
  }

  const value: GuestModeContextType = {
    mode,
    isGuest: mode === 'guest',
    isAuthenticated,
    guestSessionId,
    setMode,
    convertToAuthenticated,
    getStorageKey,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearGuestData,
  }

  return <GuestModeContext.Provider value={value}>{children}</GuestModeContext.Provider>
}

export function useGuestMode() {
  const context = useContext(GuestModeContext)
  if (context === undefined) {
    throw new Error('useGuestMode must be used within a GuestModeProvider')
  }
  return context
}
