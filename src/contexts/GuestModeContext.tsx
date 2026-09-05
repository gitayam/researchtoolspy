import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { safeJSONParse, safeJSONStringify } from '@/utils/safe-json'
import { useAuthStore } from '@/stores/auth'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  clearGuestStorage,
  getActiveGuestSessionId,
  getOrCreateGuestSessionId,
  transferGuestStorage,
} from '@/lib/guest-session'

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

const GUEST_DATA_PREFIX = 'guest_'

interface GuestModeProviderProps {
  children: ReactNode
}

export function GuestModeProvider({ children }: GuestModeProviderProps) {
  // Use auth store as source of truth
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const mode: UserMode = isAuthenticated ? 'authenticated' : 'guest'
  const [guestSessionId, setGuestSessionId] = useState<string | null>(() =>
    isAuthenticated ? null : getOrCreateGuestSessionId()
  )

  // Initialize guest session
  useEffect(() => {
    if (isAuthenticated) return

    setGuestSessionId(getOrCreateGuestSessionId())
  }, [isAuthenticated])

  const setMode = (newMode: UserMode) => {
    // Mode is derived from auth state, but we can support explicit logout/guest switch
    if (newMode === 'guest') {
      useAuthStore.getState().logout()
    }
    // To switch to authenticated, user must login via login page
  }

  const convertToAuthenticated = async (_userId: number) => {
    // Transfer guest data to authenticated user
    try {
      const sessionId = guestSessionId || getActiveGuestSessionId()
      if (!sessionId) return

      const response = await fetch('/api/guest-conversions', {
        method: 'POST',
        headers: { ...getCopHeaders(), 'X-Guest-Session': sessionId },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        transferGuestStorage()
        clearGuestData()
        // Auth state update happens elsewhere (e.g. login)
      } else {
        console.error('[GuestModeContext] Conversion failed:', response.status)
      }
    } catch (error) {
      console.error('Failed to convert guest to authenticated:', error)
      throw error
    }
  }

  // Authentication is the explicit save boundary. Once login succeeds, attach
  // any active anonymous workspace to that account; ordinary guest use never
  // invokes this endpoint and remains login-free.
  useEffect(() => {
    const userId = useAuthStore.getState().user?.id
    if (!isAuthenticated || !userId || !getActiveGuestSessionId()) return
    void convertToAuthenticated(userId)
  // convertToAuthenticated intentionally uses current storage/auth state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

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
    clearGuestStorage()
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
