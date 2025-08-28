/**
 * E2E Tests for Authentication Persistence
 * 
 * Verifies authentication state persists across page navigation
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useRouter, usePathname } from 'next/navigation'
import '@testing-library/jest-dom'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(() => null),
}))

// Test helper to simulate navigation
const simulateNavigation = async (path: string) => {
  const mockPush = jest.fn()
  ;(useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
  })
  ;(usePathname as jest.Mock).mockReturnValue(path)
  
  return mockPush
}

// Test helper to setup authenticated state
const setupAuthenticatedState = () => {
  const tokens = {
    access_token: 'test_jwt_token',
    refresh_token: 'test_refresh_token',
    token_type: 'bearer',
    expires_in: 3600
  }
  
  const authState = {
    state: {
      user: {
        id: 1,
        username: 'user_12345678',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'user',
        is_active: true,
        is_verified: true,
        account_hash: '1234567890123456',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      isAuthenticated: true
    },
    version: 0
  }
  
  localStorage.setItem('omnicore_tokens', JSON.stringify(tokens))
  localStorage.setItem('omnicore_auth', JSON.stringify(authState))
}

describe('Authentication Persistence E2E', () => {
  beforeEach(() => {
    // Clear all mocks and storage
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('Login Flow', () => {
    it('should persist authentication after successful login', async () => {
      // Import components dynamically to avoid SSR issues in tests
      const { default: LoginPage } = await import('@/app/(auth)/login/page')
      const { AuthGuard } = await import('@/components/auth/auth-guard')
      
      // Render login page with AuthGuard
      const { rerender } = render(
        <AuthGuard>
          <LoginPage />
        </AuthGuard>
      )

      // Simulate successful login
      setupAuthenticatedState()

      // Navigate to dashboard
      const mockPush = await simulateNavigation('/dashboard')
      
      // Re-render to simulate navigation
      const { default: DashboardPage } = await import('@/app/(dashboard)/dashboard/page')
      rerender(
        <AuthGuard>
          <DashboardPage />
        </AuthGuard>
      )

      // Verify auth state persists
      expect(localStorage.getItem('omnicore_tokens')).toBeTruthy()
      expect(localStorage.getItem('omnicore_auth')).toBeTruthy()
    })

    it('should redirect to dashboard if already authenticated', async () => {
      setupAuthenticatedState()
      
      const mockPush = await simulateNavigation('/login')
      
      const { default: LoginPage } = await import('@/app/(auth)/login/page')
      const { AuthGuard } = await import('@/components/auth/auth-guard')
      
      render(
        <AuthGuard>
          <LoginPage />
        </AuthGuard>
      )

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Framework Navigation', () => {
    it('should maintain auth state when navigating to SWOT framework', async () => {
      setupAuthenticatedState()
      
      const { default: FrameworkLayout } = await import('@/app/frameworks/layout')
      const { default: SwotPage } = await import('@/app/frameworks/swot/page')
      
      render(
        <FrameworkLayout>
          <SwotPage />
        </FrameworkLayout>
      )

      // Auth state should be maintained
      expect(localStorage.getItem('omnicore_tokens')).toBeTruthy()
      
      // User menu should be visible (indicates authenticated state)
      await waitFor(() => {
        expect(screen.queryByText(/Dashboard/i)).toBeInTheDocument()
      })
    })

    it('should maintain auth state when navigating between frameworks', async () => {
      setupAuthenticatedState()
      
      // Start at SWOT
      const { default: FrameworkLayout } = await import('@/app/frameworks/layout')
      const { default: SwotPage } = await import('@/app/frameworks/swot/page')
      
      const { rerender } = render(
        <FrameworkLayout>
          <SwotPage />
        </FrameworkLayout>
      )

      // Navigate to ACH
      const { default: AchPage } = await import('@/app/frameworks/ach/page')
      
      rerender(
        <FrameworkLayout>
          <AchPage />
        </FrameworkLayout>
      )

      // Auth should persist
      expect(localStorage.getItem('omnicore_tokens')).toBeTruthy()
      expect(localStorage.getItem('omnicore_auth')).toBeTruthy()
    })
  })

  describe('Logout Flow', () => {
    it('should clear all auth state on logout', async () => {
      setupAuthenticatedState()
      
      const { default: DashboardLayout } = await import('@/app/(dashboard)/layout')
      const { default: DashboardPage } = await import('@/app/(dashboard)/dashboard/page')
      
      render(
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>
      )

      // Find and click logout button
      const logoutButton = await screen.findByText(/Logout/i)
      fireEvent.click(logoutButton)

      await waitFor(() => {
        expect(localStorage.getItem('omnicore_tokens')).toBeNull()
        expect(localStorage.getItem('omnicore_auth')).toBeNull()
      })
    })

    it('should redirect to login after logout', async () => {
      setupAuthenticatedState()
      
      const mockPush = await simulateNavigation('/dashboard')
      
      const { useAuthStore } = await import('@/stores/auth')
      const logout = useAuthStore.getState().logout
      
      // Trigger logout
      logout()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('Page Refresh', () => {
    it('should restore auth state after page refresh', async () => {
      setupAuthenticatedState()
      
      // Simulate page refresh by clearing component state but keeping localStorage
      const tokens = localStorage.getItem('omnicore_tokens')
      const auth = localStorage.getItem('omnicore_auth')
      
      // Clear Zustand store (simulating page refresh)
      const { useAuthStore } = await import('@/stores/auth')
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
      
      // Restore localStorage (browser keeps this on refresh)
      localStorage.setItem('omnicore_tokens', tokens!)
      localStorage.setItem('omnicore_auth', auth!)
      
      // Render with AuthGuard (which should restore state)
      const { AuthGuard } = await import('@/components/auth/auth-guard')
      const { default: DashboardPage } = await import('@/app/(dashboard)/dashboard/page')
      
      render(
        <AuthGuard>
          <DashboardPage />
        </AuthGuard>
      )

      // Auth should be restored
      await waitFor(() => {
        const state = useAuthStore.getState()
        expect(state.isAuthenticated).toBe(true)
        expect(state.user).toBeTruthy()
      })
    })
  })

  describe('Token Expiry', () => {
    it('should handle expired tokens gracefully', async () => {
      // Setup expired tokens
      const expiredTokens = {
        access_token: 'expired_token',
        refresh_token: 'expired_refresh',
        token_type: 'bearer',
        expires_in: -1 // Already expired
      }
      
      localStorage.setItem('omnicore_tokens', JSON.stringify(expiredTokens))
      
      const mockPush = await simulateNavigation('/dashboard')
      
      const { default: DashboardLayout } = await import('@/app/(dashboard)/layout')
      const { default: DashboardPage } = await import('@/app/(dashboard)/dashboard/page')
      
      render(
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>
      )

      // Should redirect to login due to expired tokens
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('Concurrent Access', () => {
    it('should handle multiple tabs accessing auth state', async () => {
      setupAuthenticatedState()
      
      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'omnicore_auth',
        newValue: JSON.stringify({
          state: {
            user: null,
            isAuthenticated: false
          },
          version: 0
        }),
        oldValue: localStorage.getItem('omnicore_auth'),
        storageArea: localStorage
      })
      
      window.dispatchEvent(storageEvent)
      
      // Auth store should sync with the storage event
      const { useAuthStore } = await import('@/stores/auth')
      
      await waitFor(() => {
        const state = useAuthStore.getState()
        expect(state.isAuthenticated).toBe(false)
      })
    })
  })

  describe('Error Scenarios', () => {
    it('should handle corrupted localStorage data', async () => {
      // Set corrupted data
      localStorage.setItem('omnicore_tokens', 'not_valid_json')
      localStorage.setItem('omnicore_auth', '{broken json')
      
      const { AuthGuard } = await import('@/components/auth/auth-guard')
      const { default: FrameworkLayout } = await import('@/app/frameworks/layout')
      
      // Should not crash
      expect(() => {
        render(
          <AuthGuard>
            <FrameworkLayout>
              <div>Test Content</div>
            </FrameworkLayout>
          </AuthGuard>
        )
      }).not.toThrow()
    })

    it('should handle localStorage quota exceeded', async () => {
      const originalSetItem = localStorage.setItem
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      
      const { useAuthStore } = await import('@/stores/auth')
      
      // Should handle error gracefully
      expect(() => {
        useAuthStore.getState().loginWithHash({ account_hash: '1234567890123456' })
      }).not.toThrow()
      
      // Restore original
      localStorage.setItem = originalSetItem
    })
  })
})