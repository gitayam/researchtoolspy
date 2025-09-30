// Minimal auth store stub for build
import { create } from 'zustand'

interface AuthState {
  user: any
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginWithHash: (data: { account_hash: string }) => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  loginWithHash: async (data) => {
    set({ isLoading: true, error: null })
    try {
      // TODO: Implement actual login
      console.log('Login with hash:', data.account_hash)
      set({ isAuthenticated: true, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },
  clearError: () => set({ error: null }),
}))

export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)