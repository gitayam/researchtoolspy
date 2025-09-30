/**
 * Universal Framework Session Hook
 * 
 * Provides auto-save functionality and session management for any framework
 */

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAutoSave } from '@/services/auto-save'
import { useAutoSaveActions } from '@/stores/auto-save'

export interface UseFrameworkSessionOptions {
  title?: string
  autoSaveEnabled?: boolean
  loadFromUrl?: boolean
  debounceMs?: number
}

export function useFrameworkSession<T>(
  frameworkType: string,
  defaultData: T,
  options: UseFrameworkSessionOptions = {}
) {
  const searchParams = useSearchParams()
  const { createNewSession, loadSession } = useAutoSaveActions()
  
  const [sessionId, setSessionId] = useState<string>('new')
  const [data, setData] = useState<T>(defaultData)
  const [isLoading, setIsLoading] = useState(false)
  const [title, setTitle] = useState(options.title || 'Untitled')
  
  // Memoize the auto-save data to prevent infinite loops
  const autoSaveData = useMemo(() => ({
    ...data,
    title,
    framework_type: frameworkType
  }), [data, title, frameworkType])
  
  // Simple auto-save without complex state management
  const generateSessionId = () => `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Auto-save with debouncing
  useEffect(() => {
    if (!data || isLoading) return
    
    const timeoutId = setTimeout(() => {
      try {
        const session = {
          id: sessionId,
          frameworkType,
          title,
          data,
          lastModified: new Date(),
          version: 1,
          isAnonymous: true
        }
        
        const key = `omnicore_framework_${frameworkType}_${sessionId}`
        localStorage.setItem(key, JSON.stringify(session))
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, 1000) // 1 second debounce
    
    return () => clearTimeout(timeoutId)
  }, [data, title, frameworkType, sessionId, isLoading])
  
  // Mock save status for UI
  const saveStatus = { status: 'saved' as const }
  
  // Session initialization
  useEffect(() => {
    if (options.loadFromUrl) {
      const editId = searchParams.get('edit')
      const resumeId = searchParams.get('resume')
      
      if (editId || resumeId) {
        initializeFromId(editId || resumeId!)
      } else {
        initializeNew()
      }
    } else {
      initializeNew()
    }
  }, [searchParams, frameworkType])
  
  const initializeFromId = async (id: string) => {
    setIsLoading(true)
    try {
      const session = await loadSession(frameworkType, id)
      if (session && session.data) {
        setSessionId(id)
        setData(session.data)
        setTitle(session.title || options.title || 'Untitled')
      } else {
        // Session not found, create new
        initializeNew()
      }
    } catch (error) {
      console.error('Failed to load session:', error)
      // Fallback to new session
      initializeNew()
    } finally {
      setIsLoading(false)
    }
  }
  
  const initializeNew = () => {
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    createNewSession(frameworkType, title)
  }
  
  // Update data with auto-save
  const updateData = (updater: (prev: T) => T | T) => {
    if (typeof updater === 'function') {
      setData(prev => updater(prev))
    } else {
      setData(updater)
    }
  }
  
  // Update title
  const updateTitle = (newTitle: string) => {
    setTitle(newTitle)
  }
  
  // Reset session
  const resetSession = () => {
    initializeNew()
    setData(defaultData)
    setTitle(options.title || 'Untitled')
  }
  
  // Check if there's meaningful data
  const hasData = () => {
    if (typeof data === 'object' && data !== null) {
      return Object.values(data).some(value => {
        if (Array.isArray(value)) {
          return value.length > 0
        }
        if (typeof value === 'string') {
          return value.trim().length > 0
        }
        return value !== null && value !== undefined
      })
    }
    return false
  }
  
  return {
    // Session state
    sessionId,
    data,
    title,
    isLoading,
    saveStatus,
    
    // Actions
    setData,
    updateData,
    setTitle: updateTitle,
    resetSession,
    
    // Utilities
    hasData: hasData(),
    isNewSession: sessionId === 'new' || sessionId.startsWith('anon_'),
    
    // Low-level access
    generateSessionId
  }
}