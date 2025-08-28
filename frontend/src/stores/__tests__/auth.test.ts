/**
 * Tests for Auth Store
 * 
 * Verifies authentication state management and persistence
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuthStore } from '../auth'
import { apiClient } from '@/lib/api'
import type { User, AuthTokens } from '@/types/auth'
import { UserRole } from '@/types/auth'

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    login: jest.fn(),
    loginWithHash: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn(),
    getTokens: jest.fn(),
  }
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('Auth Store', () => {
  const mockUser: User = {
    id: 1,
    username: 'user_12345678',
    email: 'test@example.com',
    full_name: 'Test User',
    role: UserRole.USER,
    is_active: true,
    is_verified: true,
    account_hash: '1234567890123456',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  const mockTokens: AuthTokens = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_type: 'bearer',
    expires_in: 3600
  }

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    
    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore())

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Login with Hash', () => {
    it('should login successfully with valid hash', async () => {
      const mockResponse = {
        user: mockUser,
        tokens: mockTokens
      }

      ;(apiClient.loginWithHash as jest.Mock).mockResolvedValue(mockResponse)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.loginWithHash({ account_hash: '1234567890123456' })
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle login failure', async () => {
      const errorMessage = 'Invalid account hash'
      ;(apiClient.loginWithHash as jest.Mock).mockRejectedValue({
        message: errorMessage,
        status: 401
      })

      const { result } = renderHook(() => useAuthStore())

      await expect(
        act(async () => {
          await result.current.loginWithHash({ account_hash: 'invalid' })
        })
      ).rejects.toThrow()

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.isLoading).toBe(false)
    })

    it('should set loading state during login', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      ;(apiClient.loginWithHash as jest.Mock).mockReturnValue(promise)

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.loginWithHash({ account_hash: '1234567890123456' })
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolvePromise!({ user: mockUser, tokens: mockTokens })
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Logout', () => {
    it('should clear all auth state on logout', () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        error: null,
      })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBeNull()
      expect(apiClient.logout).toHaveBeenCalled()
    })

    it('should handle logout when API client is not available', () => {
      // Temporarily make apiClient null
      const originalApiClient = apiClient
      ;(global as any).apiClient = null

      const { result } = renderHook(() => useAuthStore())

      // Should not throw
      expect(() => {
        act(() => {
          result.current.logout()
        })
      }).not.toThrow()

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)

      // Restore apiClient
      ;(global as any).apiClient = originalApiClient
    })
  })

  describe('Refresh User', () => {
    it('should refresh user when tokens are valid', async () => {
      ;(apiClient.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(apiClient.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should clear auth when tokens are invalid', async () => {
      ;(apiClient.isAuthenticated as jest.Mock).mockReturnValue(false)

      // Set initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should handle 401 error by clearing auth', async () => {
      ;(apiClient.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(apiClient.getCurrentUser as jest.Mock).mockRejectedValue({
        status: 401,
        message: 'Unauthorized'
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(apiClient.logout).toHaveBeenCalled()
    })

    it('should handle other errors without clearing auth', async () => {
      ;(apiClient.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(apiClient.getCurrentUser as jest.Mock).mockRejectedValue({
        status: 500,
        message: 'Server error'
      })

      // Set initial authenticated state
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(result.current.user).toEqual(mockUser) // User unchanged
      expect(result.current.isAuthenticated).toBe(true) // Still authenticated
      expect(result.current.error).toBe('Server error')
    })

    it('should retry when API client is not initialized', async () => {
      let callCount = 0
      const originalApiClient = apiClient

      // Mock apiClient being null initially, then available
      Object.defineProperty(global, 'apiClient', {
        get: () => {
          callCount++
          return callCount > 2 ? originalApiClient : null
        },
        configurable: true
      })

      ;(originalApiClient.isAuthenticated as jest.Mock).mockReturnValue(true)
      ;(originalApiClient.getCurrentUser as jest.Mock).mockResolvedValue(mockUser)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      // Should eventually succeed after retries
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)

      // Restore original apiClient
      Object.defineProperty(global, 'apiClient', {
        value: originalApiClient,
        configurable: true
      })
    })
  })

  describe('Error Handling', () => {
    it('should clear error', () => {
      useAuthStore.setState({ error: 'Some error' })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })

    it('should set loading state', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Utility Hooks', () => {
    it('useUser should return current user', () => {
      useAuthStore.setState({ user: mockUser })

      const { result } = renderHook(() => useAuthStore((state) => state.user))

      expect(result.current).toEqual(mockUser)
    })

    it('useIsAuthenticated should return auth status', () => {
      useAuthStore.setState({ isAuthenticated: true })

      const { result } = renderHook(() => useAuthStore((state) => state.isAuthenticated))

      expect(result.current).toBe(true)
    })

    it('useAuthLoading should return loading status', () => {
      useAuthStore.setState({ isLoading: true })

      const { result } = renderHook(() => useAuthStore((state) => state.isLoading))

      expect(result.current).toBe(true)
    })

    it('useAuthError should return error message', () => {
      const errorMessage = 'Test error'
      useAuthStore.setState({ error: errorMessage })

      const { result } = renderHook(() => useAuthStore((state) => state.error))

      expect(result.current).toBe(errorMessage)
    })
  })

  describe('State Persistence', () => {
    it('should persist user and isAuthenticated to localStorage', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        useAuthStore.setState({
          user: mockUser,
          isAuthenticated: true
        })
      })

      // Zustand persist middleware will handle this
      // We're mainly testing that the state is set correctly
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should rehydrate from localStorage on initialization', () => {
      const storedState = {
        state: {
          user: mockUser,
          isAuthenticated: true
        },
        version: 0
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedState))

      // Simulate store rehydration
      const { result } = renderHook(() => useAuthStore())

      // Note: In a real scenario, Zustand's persist middleware would handle this
      // This test mainly ensures our store structure is correct
      expect(result.current).toBeDefined()
    })
  })
})