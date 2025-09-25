/**
 * AuthGuard Component
 * 
 * Ensures authentication state is properly initialized before rendering children.
 * This prevents SSR/client hydration mismatches and ensures auth persistence.
 */

'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/lib/api'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AuthGuard({ children, fallback = null }: AuthGuardProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const { checkAuth, isAuthenticated, logout } = useAuthStore()
  
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
        
        // Check and sync authentication state
        const authResult = checkAuth()

        // If auth store says authenticated but no tokens, clear auth
        if (authResult && !storedTokens) {
          console.log('🛡️ AuthGuard: Auth store says authenticated but no tokens, clearing...')
          logout()
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