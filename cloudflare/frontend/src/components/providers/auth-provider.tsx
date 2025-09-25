'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/lib/api'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { checkAuth, isAuthenticated, logout } = useAuthStore()

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
      
      // Sync authentication state
      const authResult = checkAuth()

      if (hasTokens && !authResult) {
        console.log('🔄 AuthProvider: API client has tokens but store is not authenticated, syncing...')
        checkAuth()
      } else if (!hasTokens && authResult) {
        console.log('⚠️ AuthProvider: Store shows authenticated but no API tokens - clearing auth state')
        logout()
      } else if (hasTokens && authResult) {
        console.log('✅ AuthProvider: Both API client and store are authenticated')
      } else {
        console.log('ℹ️ AuthProvider: No tokens found, user needs to login')
      }
    }

    initializeAuth()
  }, [isAuthenticated, checkAuth, logout])

  return <>{children}</>
}