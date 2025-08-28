/**
 * Custom hook to initialize authentication state
 * This ensures auth state is properly restored from localStorage
 */

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth'

export function useAuthInit() {
  const [isInitialized, setIsInitialized] = useState(false)
  const { refreshUser } = useAuthStore()
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    
    const initAuth = async () => {
      console.log('🔄 useAuthInit: Initializing authentication...')
      
      // Check for stored tokens
      const storedTokens = localStorage.getItem('omnicore_tokens')
      const storedAuth = localStorage.getItem('omnicore_auth')
      
      console.log('📦 useAuthInit: Found stored tokens:', !!storedTokens)
      console.log('📦 useAuthInit: Found stored auth:', !!storedAuth)
      
      // If we have tokens, try to refresh the user
      if (storedTokens) {
        try {
          const tokens = JSON.parse(storedTokens)
          console.log('🔑 useAuthInit: Tokens found, refreshing user...')
          
          // Import apiClient dynamically to avoid SSR issues
          const { apiClient } = await import('@/lib/api')
          
          // Manually set tokens in API client if needed
          if (apiClient && tokens.access_token) {
            // The API client should already have loaded these from localStorage
            // but we ensure it's ready
            await refreshUser()
            console.log('✅ useAuthInit: User refreshed successfully')
          }
        } catch (error) {
          console.error('❌ useAuthInit: Failed to restore auth:', error)
          // Clear invalid tokens
          localStorage.removeItem('omnicore_tokens')
          localStorage.removeItem('omnicore_auth')
        }
      }
      
      setIsInitialized(true)
      console.log('✅ useAuthInit: Initialization complete')
    }
    
    initAuth()
  }, [refreshUser])
  
  return isInitialized
}