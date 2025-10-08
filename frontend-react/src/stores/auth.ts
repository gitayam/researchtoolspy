// Hash-based authentication store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

          console.log('[Auth] Attempting login with hash:', hash.substring(0, 8) + '...')

          // Validate hash exists in valid hashes list
          const validHashesStr = localStorage.getItem('omnicore_valid_hashes')
          const validHashes: string[] = validHashesStr ? JSON.parse(validHashesStr) : []

          console.log('[Auth] Valid hashes in localStorage:', validHashes.length, 'hashes')
          console.log('[Auth] Hash being checked:', hash)
          console.log('[Auth] First valid hash (if exists):', validHashes[0]?.substring(0, 8) + '...')

          if (!validHashes.includes(hash)) {
            console.error('[Auth] Hash not found in valid hashes list')
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

          console.log('[Auth] Login successful for hash:', hash.substring(0, 8) + '...')
        } catch (error: any) {
          console.error('[Auth] Login failed:', error)
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
        console.log('[Auth] Logged out')
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
            console.log('[Auth] Restored session from localStorage')
          }
        } else {
          // Invalid or no hash, ensure logged out
          if (get().isAuthenticated) {
            set({ user: null, isAuthenticated: false })
            console.log('[Auth] Session invalid, logged out')
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