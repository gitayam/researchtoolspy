// Hash-based authentication store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createLogger } from '@/lib/logger'
import { apiClient } from '@/lib/api'
import type { User } from '@/types/auth'

const logger = createLogger('Auth')

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginWithHash: (data: { account_hash: string }) => Promise<void>
  loginWithOidc: (token: string, userData: User) => void
  logout: () => void
  clearError: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      loginWithHash: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const hash = data.account_hash

          logger.info('Attempting login with hash:', hash.substring(0, 8) + '...')

          // Call API
          const response = await apiClient.loginWithHash({ account_hash: hash })

          // Store hash for backward compatibility with existing components
          localStorage.setItem('omnicore_user_hash', hash)

          // API Client handles token storage
          
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })

          logger.info('Login successful for user:', response.user.username)
        } catch (error: any) {
          logger.error('Login failed:', error)
          set({
            error: error.message || 'Login failed',
            isLoading: false,
            isAuthenticated: false,
            user: null
          })
          throw error
        }
      },

      loginWithOidc: (token: string, userData: User) => {
        const tokens = {
          access_token: token,
          refresh_token: '',
          token_type: 'bearer',
          expires_in: 86400,
          issued_at: Date.now()
        }
        localStorage.setItem('omnicore_tokens', JSON.stringify(tokens))

        // Store account hash for X-User-Hash header compatibility
        // OIDC users have a synthetic hash (oidc_xxx) that the backend recognizes
        if (userData.account_hash) {
          localStorage.setItem('omnicore_user_hash', userData.account_hash)
        }

        set({
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          error: null
        })

        logger.info('OIDC login successful for user:', userData.username || userData.email || String(userData.id))
      },

      logout: () => {
        apiClient.logout()
        localStorage.removeItem('omnicore_user_hash')
        set({
          user: null,
          isAuthenticated: false,
          error: null
        })
        logger.info('Logged out')
      },

      clearError: () => set({ error: null }),

      checkAuth: async () => {
        // Check client-side token expiry first
        try {
          const storedTokens = localStorage.getItem('omnicore_tokens')
          if (storedTokens) {
            const tokens = JSON.parse(storedTokens)
            if (tokens.issued_at && tokens.expires_in) {
              const expiresAt = tokens.issued_at + tokens.expires_in * 1000
              if (Date.now() > expiresAt) {
                logger.info('Token expired, logging out')
                apiClient.logout()
                localStorage.removeItem('omnicore_user_hash')
                set({ user: null, isAuthenticated: false })
                return
              }
            }
          }
        } catch { /* ignore parse errors */ }

        // Check if user is still authenticated (check token validity)
        if (apiClient.isAuthenticated()) {
          const state = get()
          if (!state.isAuthenticated) {
             try {
               const user = await apiClient.getCurrentUser()
               set({
                 user,
                 isAuthenticated: true
               })
               logger.info('Restored session from token')
             } catch (e) {
               // Token might be invalid
               apiClient.logout()
               set({ user: null, isAuthenticated: false })
             }
          }
        } else {
          // No token
          if (get().isAuthenticated) {
            set({ user: null, isAuthenticated: false })
            logger.info('Session invalid, logged out')
          }
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)
export const useAuthUser = () => useAuthStore((state) => state.user)