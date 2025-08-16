import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User, AuthTokens, LoginRequest, RegisterRequest, HashLoginRequest } from '@/types/auth'
import { apiClient, type APIError } from '@/lib/api'

interface AuthState {
  // State
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginRequest) => Promise<void>
  loginWithHash: (hashCredentials: HashLoginRequest) => Promise<void>
  register: (userData: RegisterRequest) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        login: async (credentials: LoginRequest) => {
          set({ isLoading: true, error: null })
          
          try {
            const response = await apiClient.login(credentials)
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
          } catch (error) {
            const apiError = error as APIError
            set({
              isLoading: false,
              error: apiError.message || 'Login failed'
            })
            throw error
          }
        },

        loginWithHash: async (hashCredentials: HashLoginRequest) => {
          set({ isLoading: true, error: null })
          
          try {
            const response = await apiClient.loginWithHash(hashCredentials)
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
          } catch (error) {
            const apiError = error as APIError
            set({
              isLoading: false,
              error: apiError.message || 'Hash login failed'
            })
            throw error
          }
        },

        register: async (userData: RegisterRequest) => {
          set({ isLoading: true, error: null })
          
          try {
            await apiClient.register(userData)
            set({
              isLoading: false,
              error: null
            })
          } catch (error) {
            const apiError = error as APIError
            set({
              isLoading: false,
              error: apiError.message || 'Registration failed'
            })
            throw error
          }
        },

        logout: () => {
          apiClient.logout()
          set({
            user: null,
            isAuthenticated: false,
            error: null
          })
        },

        refreshUser: async () => {
          if (!apiClient.isAuthenticated()) {
            set({ isAuthenticated: false, user: null })
            return
          }

          try {
            const user = await apiClient.getCurrentUser()
            set({
              user,
              isAuthenticated: true,
              error: null
            })
          } catch (error) {
            const apiError = error as APIError
            if (apiError.status === 401) {
              // Token expired or invalid
              set({
                user: null,
                isAuthenticated: false,
                error: null
              })
            } else {
              set({
                error: apiError.message || 'Failed to refresh user data'
              })
            }
          }
        },

        clearError: () => {
          set({ error: null })
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading })
        }
      }),
      {
        name: 'omnicore-auth',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated
        })
      }
    ),
    {
      name: 'auth-store'
    }
  )
)

// Utility hooks for easier access
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthError = () => useAuthStore((state) => state.error)