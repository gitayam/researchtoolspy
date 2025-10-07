/**
 * Settings Hook
 *
 * React hook for managing hash-based user settings
 */

import { useState, useEffect, useCallback } from 'react'
import type {
  UserSettings,
  DisplaySettings,
  AISettings,
  NotificationSettings,
  WorkspaceSettings,
  SettingUpdate,
} from '@/types/settings'
import { DEFAULT_USER_SETTINGS } from '@/types/settings'

const STORAGE_PREFIX = 'settings_'

interface UseSettingsReturn {
  settings: UserSettings | null
  loading: boolean
  error: string | null
  updateDisplaySettings: (updates: Partial<DisplaySettings>) => Promise<void>
  updateAISettings: (updates: Partial<AISettings>) => Promise<void>
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => Promise<void>
  updateWorkspaceSettings: (updates: Partial<WorkspaceSettings>) => Promise<void>
  resetSettings: () => Promise<void>
  refreshSettings: () => Promise<void>
}

/**
 * Get user hash from localStorage
 */
function getUserHash(): string | null {
  return localStorage.getItem('omnicore_user_hash')
}

/**
 * Build API URL with hash header
 */
function buildHeaders(hash: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-User-Hash': hash,
  }
}

/**
 * Load settings from localStorage (fallback)
 */
function loadFromLocalStorage(hash: string): UserSettings | null {
  try {
    const key = `${STORAGE_PREFIX}${hash}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return {
      user_hash: hash,
      ...parsed,
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error)
    return null
  }
}

/**
 * Save settings to localStorage (backup)
 */
function saveToLocalStorage(settings: UserSettings): void {
  try {
    const key = `${STORAGE_PREFIX}${settings.user_hash}`
    const { user_hash, ...settingsData } = settings
    localStorage.setItem(key, JSON.stringify(settingsData))
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error)
  }
}

/**
 * Main settings hook
 */
export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load settings from API
   */
  const loadSettings = useCallback(async () => {
    const hash = getUserHash()
    if (!hash) {
      // No hash - use defaults
      setSettings(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Try to load from API
      const response = await fetch('/api/settings/user', {
        headers: buildHeaders(hash),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        saveToLocalStorage(data)
      } else if (response.status === 404) {
        // Settings don't exist yet - try localStorage or use defaults
        const localSettings = loadFromLocalStorage(hash)
        if (localSettings) {
          setSettings(localSettings)
        } else {
          // Create default settings
          const defaultSettings: UserSettings = {
            user_hash: hash,
            display: DEFAULT_USER_SETTINGS.display,
            ai: DEFAULT_USER_SETTINGS.ai,
            notifications: DEFAULT_USER_SETTINGS.notifications,
            workspace: DEFAULT_USER_SETTINGS.workspace,
          } as UserSettings
          setSettings(defaultSettings)
          saveToLocalStorage(defaultSettings)
        }
      } else {
        throw new Error('Failed to load settings')
      }
    } catch (err) {
      console.error('Settings load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load settings')

      // Fallback to localStorage
      const localSettings = loadFromLocalStorage(hash)
      if (localSettings) {
        setSettings(localSettings)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update settings (generic)
   */
  const updateSettings = useCallback(
    async (category: string, updates: Record<string, unknown>) => {
      const hash = getUserHash()
      if (!hash || !settings) return

      try {
        const currentCategory = settings[category as keyof UserSettings]
        const newSettings = {
          ...settings,
          [category]: {
            ...(typeof currentCategory === 'object' && currentCategory !== null ? currentCategory : {}),
            ...updates,
          },
        }

        // Optimistic update
        setSettings(newSettings)
        saveToLocalStorage(newSettings)

        // Send to API
        const response = await fetch('/api/settings/user', {
          method: 'PUT',
          headers: buildHeaders(hash),
          body: JSON.stringify({
            [category]: newSettings[category as keyof UserSettings],
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to update settings')
        }

        // Refresh from server to ensure sync
        await loadSettings()
      } catch (err) {
        console.error('Settings update error:', err)
        setError(err instanceof Error ? err.message : 'Failed to update settings')
        // Revert optimistic update
        await loadSettings()
        throw err
      }
    },
    [settings, loadSettings]
  )

  /**
   * Update display settings
   */
  const updateDisplaySettings = useCallback(
    async (updates: Partial<DisplaySettings>) => {
      await updateSettings('display', updates as Record<string, unknown>)
    },
    [updateSettings]
  )

  /**
   * Update AI settings
   */
  const updateAISettings = useCallback(
    async (updates: Partial<AISettings>) => {
      await updateSettings('ai', updates as Record<string, unknown>)
    },
    [updateSettings]
  )

  /**
   * Update notification settings
   */
  const updateNotificationSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      await updateSettings('notifications', updates as Record<string, unknown>)
    },
    [updateSettings]
  )

  /**
   * Update workspace settings
   */
  const updateWorkspaceSettings = useCallback(
    async (updates: Partial<WorkspaceSettings>) => {
      await updateSettings('workspace', updates as Record<string, unknown>)
    },
    [updateSettings]
  )

  /**
   * Reset settings to defaults
   */
  const resetSettings = useCallback(async () => {
    const hash = getUserHash()
    if (!hash) return

    try {
      const response = await fetch('/api/settings/user', {
        method: 'DELETE',
        headers: buildHeaders(hash),
      })

      if (!response.ok) {
        throw new Error('Failed to reset settings')
      }

      await loadSettings()
    } catch (err) {
      console.error('Settings reset error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset settings')
      throw err
    }
  }, [loadSettings])

  /**
   * Refresh settings from server
   */
  const refreshSettings = useCallback(async () => {
    await loadSettings()
  }, [loadSettings])

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    settings,
    loading,
    error,
    updateDisplaySettings,
    updateAISettings,
    updateNotificationSettings,
    updateWorkspaceSettings,
    resetSettings,
    refreshSettings,
  }
}
