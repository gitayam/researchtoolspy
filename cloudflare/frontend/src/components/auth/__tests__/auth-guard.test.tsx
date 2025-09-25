/**
 * Tests for AuthGuard Component
 * 
 * Verifies proper authentication state initialization and synchronization
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthGuard } from '../auth-guard'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/lib/api'

// Mock the auth store
jest.mock('@/stores/authStore')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    isAuthenticated: jest.fn(),
    getCurrentUser: jest.fn(),
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

describe('AuthGuard Component', () => {
  const mockCheckAuth = jest.fn()
  const mockLogout = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()

    // Default mock implementation
    mockUseAuthStore.mockReturnValue({
      checkAuth: mockCheckAuth,
      isAuthenticated: false,
      logout: mockLogout,
    } as any)
    
    // Mock getState for static access
    ;(useAuthStore as any).getState = jest.fn().mockReturnValue({
      logout: mockLogout,
    })
  })

  describe('Initialization', () => {
    it('should render fallback content while initializing', () => {
      render(
        <AuthGuard fallback={<div>Loading...</div>}>
          <div>Protected Content</div>
        </AuthGuard>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('should render children after initialization', async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })
    })

    it('should check localStorage for tokens on mount', async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('omnicore_tokens')
      })
    })
  })

  describe('Token and Auth State Synchronization', () => {
    it('should refresh user when tokens exist but user is not authenticated', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        access_token: 'test_token',
        refresh_token: 'refresh_token',
        expires_in: 3600,
        token_type: 'bearer'
      }))

      mockUseAuthStore.mockReturnValue({
        refreshUser: mockRefreshUser,
        isAuthenticated: false,
        logout: mockLogout,
      } as any)

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(mockRefreshUser).toHaveBeenCalled()
      })
    })

    it('should not refresh user when tokens exist and user is authenticated', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        access_token: 'test_token',
        refresh_token: 'refresh_token',
        expires_in: 3600,
        token_type: 'bearer'
      }))

      mockUseAuthStore.mockReturnValue({
        refreshUser: mockRefreshUser,
        isAuthenticated: true,
        logout: mockLogout,
      } as any)

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(mockRefreshUser).not.toHaveBeenCalled()
    })

    it('should logout when authenticated but no tokens in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue(null)

      mockUseAuthStore.mockReturnValue({
        refreshUser: mockRefreshUser,
        isAuthenticated: true,
        logout: mockLogout,
      } as any)

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
      })
    })

    it('should handle localStorage access errors gracefully', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available')
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AuthGuard: Failed to initialize auth'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('SSR Safety', () => {
    it('should handle server-side rendering without localStorage', async () => {
      // Temporarily remove window.localStorage to simulate SSR
      const originalLocalStorage = window.localStorage
      delete (window as any).localStorage

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      })
    })

    it('should not crash when window is undefined', async () => {
      const originalWindow = global.window
      delete (global as any).window

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      // Should still render without crashing
      expect(() => screen.getByText('Protected Content')).not.toThrow()

      // Restore window
      global.window = originalWindow
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed tokens in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue('invalid_json')

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      // Should handle error gracefully
      expect(mockRefreshUser).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle refresh user failure', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        access_token: 'test_token',
        refresh_token: 'refresh_token',
        expires_in: 3600,
        token_type: 'bearer'
      }))

      mockRefreshUser.mockRejectedValue(new Error('Network error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AuthGuard: Failed to initialize auth'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should render without fallback prop', async () => {
      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      )

      // Should not crash and eventually render children
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })
    })
  })

  describe('Multiple Children', () => {
    it('should render multiple children correctly', async () => {
      render(
        <AuthGuard>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Child 1')).toBeInTheDocument()
        expect(screen.getByText('Child 2')).toBeInTheDocument()
        expect(screen.getByText('Child 3')).toBeInTheDocument()
      })
    })

    it('should render nested components', async () => {
      const NestedComponent = () => (
        <div>
          <span>Nested Content</span>
        </div>
      )

      render(
        <AuthGuard>
          <NestedComponent />
        </AuthGuard>
      )

      await waitFor(() => {
        expect(screen.getByText('Nested Content')).toBeInTheDocument()
      })
    })
  })
})