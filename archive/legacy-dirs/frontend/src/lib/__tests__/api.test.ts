/**
 * Tests for API Client
 * 
 * Verifies API client initialization, token management, and SSR safety
 */

import axios, { AxiosError } from 'axios'
import { APIClient } from '../api'
import type { AuthTokens, User } from '@/types/auth'
import { UserRole } from '@/types/auth'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

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

describe('API Client', () => {
  let apiClient: APIClient
  let mockAxiosInstance: any

  const mockTokens: AuthTokens = {
    access_token: 'test_access_token',
    refresh_token: 'test_refresh_token',
    token_type: 'bearer',
    expires_in: 3600
  }

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

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()

    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    }

    mockedAxios.create.mockReturnValue(mockAxiosInstance)
  })

  describe('Initialization', () => {
    it('should create axios instance with correct config', () => {
      apiClient = new APIClient()

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.stringContaining('/api/v1'),
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })

    it('should load tokens from localStorage on initialization', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTokens))

      apiClient = new APIClient()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('omnicore_tokens')
      expect(apiClient.isAuthenticated()).toBe(true)
    })

    it('should handle missing tokens in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null)

      apiClient = new APIClient()

      expect(apiClient.isAuthenticated()).toBe(false)
    })

    it('should handle malformed tokens in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid_json')

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      apiClient = new APIClient()

      expect(consoleSpy).toHaveBeenCalled()
      expect(apiClient.isAuthenticated()).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should setup request interceptor for auth headers', () => {
      apiClient = new APIClient()

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()

      // Get the interceptor function
      const [interceptorFn] = mockAxiosInstance.interceptors.request.use.mock.calls[0]

      // Test the interceptor
      const config = { headers: {} }
      apiClient['tokens'] = mockTokens // Set tokens directly
      const result = interceptorFn(config)

      expect(result.headers.Authorization).toBe(`Bearer ${mockTokens.access_token}`)
    })

    it('should setup response interceptor for token refresh', () => {
      apiClient = new APIClient()

      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('Hash Authentication', () => {
    beforeEach(() => {
      apiClient = new APIClient()
    })

    it('should register with hash successfully', async () => {
      const mockResponse = {
        account_hash: '1234567890123456',
        message: 'Account created',
        warning: 'Save your hash',
        created_at: '2024-01-01T00:00:00Z'
      }

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse })

      const result = await apiClient.registerWithHash()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/hash-auth/register')
      expect(result).toEqual(mockResponse)
    })

    it('should login with hash successfully', async () => {
      const mockResponse = {
        access_token: 'jwt_token',
        refresh_token: 'refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
        account_hash: '1234567890123456',
        role: 'user'
      }

      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse })

      const result = await apiClient.loginWithHash({ account_hash: '1234567890123456' })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/hash-auth/authenticate',
        { account_hash: '1234567890123456' }
      )
      expect(result.tokens).toBeDefined()
      expect(result.user).toBeDefined()
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'omnicore_tokens',
        expect.stringContaining('jwt_token')
      )
    })

    it('should handle invalid hash login', async () => {
      const error = {
        response: {
          status: 401,
          data: { detail: 'Invalid account hash' }
        }
      }

      mockAxiosInstance.post.mockRejectedValue(error)

      await expect(
        apiClient.loginWithHash({ account_hash: 'invalid' })
      ).rejects.toEqual({
        message: 'Invalid account hash. Please check your account number.',
        status: 401,
        details: error.response.data
      })
    })
  })

  describe('Token Management', () => {
    beforeEach(() => {
      apiClient = new APIClient()
    })

    it('should save tokens to localStorage', () => {
      apiClient['saveTokensToStorage'](mockTokens)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'omnicore_tokens',
        JSON.stringify(mockTokens)
      )
      expect(apiClient.isAuthenticated()).toBe(true)
    })

    it('should clear tokens from localStorage', () => {
      apiClient['tokens'] = mockTokens
      apiClient['clearTokens']()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('omnicore_tokens')
      expect(apiClient.isAuthenticated()).toBe(false)
    })

    it('should refresh tokens successfully', async () => {
      apiClient['tokens'] = mockTokens

      const newTokens = {
        ...mockTokens,
        access_token: 'new_access_token'
      }

      mockAxiosInstance.post.mockResolvedValue({ data: newTokens })

      const result = await apiClient.refreshToken()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: mockTokens.refresh_token
      })
      expect(result).toEqual(newTokens)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should throw error when refreshing without refresh token', async () => {
      apiClient['tokens'] = null

      await expect(apiClient.refreshToken()).rejects.toThrow('No refresh token available')
    })

    it('should handle 401 and refresh token', async () => {
      apiClient['tokens'] = mockTokens

      // Setup response interceptor test
      const [, errorHandler] = mockAxiosInstance.interceptors.response.use.mock.calls[0]

      const originalRequest = {
        headers: {},
        _retry: false
      }

      const error: Partial<AxiosError> = {
        response: { status: 401 } as any,
        config: originalRequest as any
      }

      // Mock successful refresh
      const newTokens = { ...mockTokens, access_token: 'new_token' }
      mockAxiosInstance.post.mockResolvedValue({ data: newTokens })
      mockAxiosInstance.request.mockResolvedValue({ data: 'retry_success' })

      const result = await errorHandler(error)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: mockTokens.refresh_token
      })
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(originalRequest)
      expect(result.data).toBe('retry_success')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      apiClient = new APIClient()
    })

    it('should handle network errors', () => {
      const error: Partial<AxiosError> = {
        request: {},
        message: 'Network Error'
      }

      const result = apiClient['handleError'](error as AxiosError)

      expect(result).toEqual({
        message: 'Network error - please check your connection',
        status: 0
      })
    })

    it('should handle server errors with detail string', () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 400,
          data: { detail: 'Bad request' }
        } as any
      }

      const result = apiClient['handleError'](error as AxiosError)

      expect(result).toEqual({
        message: 'Bad request',
        status: 400,
        details: { detail: 'Bad request' }
      })
    })

    it('should handle server errors with detail array', () => {
      const error: Partial<AxiosError> = {
        response: {
          status: 422,
          data: {
            detail: [
              { msg: 'Field required', type: 'value_error' }
            ]
          }
        } as any
      }

      const result = apiClient['handleError'](error as AxiosError)

      expect(result).toEqual({
        message: 'Field required',
        status: 422,
        details: expect.any(Object)
      })
    })

    it('should handle unexpected errors', () => {
      const error: Partial<AxiosError> = {
        message: 'Unexpected error'
      }

      const result = apiClient['handleError'](error as AxiosError)

      expect(result).toEqual({
        message: 'Unexpected error',
        status: 0
      })
    })
  })

  describe('API Methods', () => {
    beforeEach(() => {
      apiClient = new APIClient()
    })

    it('should make GET request', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { result: 'data' } })

      const result = await apiClient.get('/test')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', undefined)
      expect(result).toEqual({ result: 'data' })
    })

    it('should make POST request', async () => {
      const payload = { key: 'value' }
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } })

      const result = await apiClient.post('/test', payload)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', payload)
      expect(result).toEqual({ success: true })
    })

    it('should make PUT request', async () => {
      const payload = { key: 'updated' }
      mockAxiosInstance.put.mockResolvedValue({ data: { updated: true } })

      const result = await apiClient.put('/test', payload)

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test', payload)
      expect(result).toEqual({ updated: true })
    })

    it('should make PATCH request', async () => {
      const payload = { key: 'patched' }
      mockAxiosInstance.patch.mockResolvedValue({ data: { patched: true } })

      const result = await apiClient.patch('/test', payload)

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test', payload)
      expect(result).toEqual({ patched: true })
    })

    it('should make DELETE request', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: null })

      await apiClient.delete('/test')

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test')
    })
  })

  describe('SSR Safety', () => {
    it('should handle server-side rendering without localStorage', () => {
      // Temporarily remove window to simulate SSR
      const originalWindow = global.window
      delete (global as any).window

      // Should not throw
      expect(() => new APIClient()).not.toThrow()

      // Restore window
      global.window = originalWindow
    })

    it('should handle localStorage not being available', () => {
      const originalLocalStorage = window.localStorage
      delete (window as any).localStorage

      // Should not throw
      expect(() => new APIClient()).not.toThrow()

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      })
    })
  })

  describe('Singleton Pattern', () => {
    it('should use proxy for lazy initialization', async () => {
      // Import the proxied apiClient
      const { apiClient: proxiedClient } = await import('../api')

      // First access should initialize
      const isAuth = proxiedClient.isAuthenticated()

      expect(typeof isAuth).toBe('boolean')
    })
  })
})