// Hash-based authentication store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Auth')

interface AuthUser {
  account_hash: string
  authenticated_at: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginWithHash: (data: { account_hash: string }) => Promise<void>
  logout: () => void
  clearError: () => void
  checkAuth: () => void
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

          // Validate hash exists in valid hashes list
          const validHashesStr = localStorage.getItem('omnicore_valid_hashes')
          const validHashes: string[] = validHashesStr ? JSON.parse(validHashesStr) : []

          logger.debug('Valid hashes in localStorage:', validHashes.length, 'hashes')
          logger.debug('Hash being checked:', hash)
          logger.debug('First valid hash (if exists):', validHashes[0]?.substring(0, 8) + '...')

          if (!validHashes.includes(hash)) {
            logger.error('Hash not found in valid hashes list')
            throw new Error('Invalid hash. Please check your bookmark code.')
          }

          // Store as current user hash
          localStorage.setItem('omnicore_user_hash', hash)

          // Update auth state
          const user: AuthUser = {
            account_hash: hash,
            authenticated_at: new Date().toISOString()
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })

          logger.info('Login successful for hash:', hash.substring(0, 8) + '...')
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

      logout: () => {
        localStorage.removeItem('omnicore_user_hash')
        set({
          user: null,
          isAuthenticated: false,
          error: null
        })
        logger.info('Logged out')
      },

      clearError: () => set({ error: null }),

      checkAuth: () => {
        // Check if user is still authenticated (e.g., on page refresh)
        const currentHash = localStorage.getItem('omnicore_user_hash')
        const validHashesStr = localStorage.getItem('omnicore_valid_hashes')
        const validHashes: string[] = validHashesStr ? JSON.parse(validHashesStr) : []

        if (currentHash && validHashes.includes(currentHash)) {
          const state = get()
          if (!state.isAuthenticated) {
            set({
              user: {
                account_hash: currentHash,
                authenticated_at: new Date().toISOString()
              },
              isAuthenticated: true
            })
            logger.info('Restored session from localStorage')
          }
        } else {
          // Invalid or no hash, ensure logged out
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