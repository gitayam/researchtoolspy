'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { refreshUser, isAuthenticated } = useAuthStore()

  useEffect(() => {
    // Initialize auth state on app startup
    const initializeAuth = async () => {
      console.log('🚀 AuthProvider: Initializing auth state...')
      console.log('📊 AuthProvider: Current state - isAuthenticated:', isAuthenticated)
      
      // Check localStorage directly
      const storedTokens = localStorage.getItem('omnicore_tokens')
      const storedAuth = localStorage.getItem('omnicore_auth')
      console.log('💾 AuthProvider: localStorage tokens:', storedTokens ? 'Found' : 'None')
      console.log('💾 AuthProvider: localStorage auth:', storedAuth ? 'Found' : 'None')
      
      // Check if API client has valid tokens
      const hasTokens = apiClient ? apiClient.isAuthenticated() : false
      console.log('🔐 AuthProvider: API client has tokens:', hasTokens, 'apiClient exists:', !!apiClient)
      
      if (hasTokens && !isAuthenticated) {
        console.log('🔄 AuthProvider: API client has tokens but store is not authenticated, refreshing user...')
        try {
          await refreshUser()
          console.log('✅ AuthProvider: User refreshed successfully')
        } catch (error) {
          console.error('❌ AuthProvider: Failed to refresh user:', error)
          console.log('🗑️ AuthProvider: Clearing invalid tokens')
          // Tokens might be expired, clear them
          if (apiClient) {
            apiClient.logout()
          }
        }
      } else if (hasTokens && isAuthenticated) {
        console.log('✅ AuthProvider: Both API client and store are authenticated')
      } else if (!hasTokens && isAuthenticated) {
        console.log('⚠️ AuthProvider: Store shows authenticated but no API tokens - clearing auth state')
        // This is an inconsistent state, clear the auth store
        const { logout } = useAuthStore.getState()
        logout()
      } else {
        console.log('ℹ️ AuthProvider: No tokens found, user needs to login')
      }
    }

    initializeAuth()
  }, [isAuthenticated, refreshUser])

  return <>{children}</>
}