/**
 * AuthGuard Component
 * 
 * Ensures authentication state is properly initialized before rendering children.
 * This prevents SSR/client hydration mismatches and ensures auth persistence.
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AuthGuard({ children, fallback = null }: AuthGuardProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const { refreshUser, isAuthenticated } = useAuthStore()
  
  useEffect(() => {
    const initAuth = async () => {
      console.log('🛡️ AuthGuard: Initializing authentication...')
      
      try {
        // Check if we're in the browser
        if (typeof window === 'undefined') {
          console.log('🛡️ AuthGuard: SSR context, skipping initialization')
          return
        }
        
        // Check for stored tokens
        const storedTokens = localStorage.getItem('omnicore_tokens')
        const storedAuth = localStorage.getItem('omnicore_auth')
        
        console.log('🛡️ AuthGuard: Checking storage:', {
          hasTokens: !!storedTokens,
          hasAuth: !!storedAuth
        })
        
        // If we have tokens but auth store is not authenticated, refresh
        if (storedTokens && !isAuthenticated) {
          console.log('🛡️ AuthGuard: Found tokens but not authenticated, refreshing user...')
          await refreshUser()
        }
        
        // If auth store says authenticated but no tokens, clear auth
        if (isAuthenticated && !storedTokens) {
          console.log('🛡️ AuthGuard: Auth store says authenticated but no tokens, clearing...')
          useAuthStore.getState().logout()
        }
        
      } catch (error) {
        console.error('🛡️ AuthGuard: Failed to initialize auth:', error)
      } finally {
        setIsInitialized(true)
        console.log('🛡️ AuthGuard: Initialization complete')
      }
    }
    
    initAuth()
  }, []) // Only run once on mount
  
  // During SSR or before initialization, render fallback
  if (!isInitialized) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}