import axios, { AxiosInstance, AxiosError } from 'axios'
import type { 
  User, 
  AuthTokens, 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest,
  RefreshTokenRequest,
  HashLoginRequest
} from '@/types/auth'
import { UserRole } from '@/types/auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1'

// Error types for better error handling
export interface APIError {
  message: string
  status: number
  details?: any
}

export class APIClient {
  private client: AxiosInstance
  private tokens: AuthTokens | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Load existing tokens from storage
    this.loadTokensFromStorage()

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.tokens?.access_token) {
          config.headers.Authorization = `Bearer ${this.tokens.access_token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            await this.refreshToken()
            // Retry the original request with new token
            if (this.tokens?.access_token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${this.tokens.access_token}`
            }
            return this.client.request(originalRequest)
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearTokens()
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(this.handleError(error))
      }
    )

    // Load tokens from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.loadTokensFromStorage()
    }
  }

  private handleError(error: AxiosError): APIError {
    if (error.response) {
      const data = error.response.data as any
      const message = data?.detail || data?.message || 'An error occurred'
      return {
        message,
        status: error.response.status,
        details: data
      }
    } else if (error.request) {
      return {
        message: 'Network error - please check your connection',
        status: 0
      }
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0
      }
    }
  }

  private loadTokensFromStorage(): void {
    try {
      // Check if we're in the browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('omnicore_tokens')
        if (stored) {
          this.tokens = JSON.parse(stored)
        }
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error)
    }
  }

  private saveTokensToStorage(tokens: AuthTokens): void {
    try {
      // Check if we're in the browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('omnicore_tokens', JSON.stringify(tokens))
      }
      this.tokens = tokens
    } catch (error) {
      console.error('Failed to save tokens to storage:', error)
    }
  }

  private clearTokens(): void {
    this.tokens = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('omnicore_tokens')
    }
  }

  // Auth methods
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const formData = new URLSearchParams()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const response = await this.client.post<AuthTokens>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    this.saveTokensToStorage(response.data)

    // Get user profile
    const user = await this.getCurrentUser()
    
    return {
      user,
      tokens: response.data
    }
  }

  // Hash-based login (Mullvad-style)
  async loginWithHash(hashCredentials: HashLoginRequest): Promise<LoginResponse> {
    // Mock implementation for development since backend doesn't support hash auth yet
    const { TEST_ACCOUNT_HASH } = await import('@/lib/hash-auth')
    
    if (hashCredentials.account_hash === TEST_ACCOUNT_HASH) {
      // Mock successful authentication
      const mockTokens: AuthTokens = {
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now(),
        token_type: 'bearer',
        expires_in: 3600
      }
      
      const mockUser: User = {
        id: 1,
        username: 'test_user',
        email: 'test@researchtools.dev',
        full_name: 'Research Analyst',
        role: UserRole.ANALYST,
        is_active: true,
        is_verified: true,
        account_hash: hashCredentials.account_hash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      this.saveTokensToStorage(mockTokens)
      
      return {
        user: mockUser,
        tokens: mockTokens
      }
    } else {
      // Mock failed authentication
      throw {
        message: 'Invalid account hash',
        status: 401,
        details: { detail: 'Invalid account hash' }
      }
    }

    // TODO: Replace with real backend call when hash auth is implemented
    /*
    const response = await this.client.post<AuthTokens>('/auth/login-hash', hashCredentials, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.saveTokensToStorage(response.data)

    // Get user profile
    const user = await this.getCurrentUser()
    
    return {
      user,
      tokens: response.data
    }
    */
  }

  async register(userData: RegisterRequest): Promise<User> {
    const response = await this.client.post<User>('/auth/register', userData)
    return response.data
  }

  async refreshToken(): Promise<AuthTokens> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available')
    }

    const response = await this.client.post<AuthTokens>('/auth/refresh', {
      refresh_token: this.tokens.refresh_token
    })

    this.saveTokensToStorage(response.data)
    return response.data
  }

  async getCurrentUser(): Promise<User> {
    // For development with mock auth, return mock user if authenticated
    if (this.isAuthenticated() && this.tokens?.access_token?.startsWith('mock_access_token')) {
      return {
        id: 1,
        username: 'test_user',
        email: 'test@researchtools.dev',
        full_name: 'Research Analyst',
        role: UserRole.ANALYST,
        organization: 'Research Tools Corp',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    // Real API call for production
    const response = await this.client.get<User>('/auth/me')
    return response.data
  }

  logout(): void {
    this.clearTokens()
  }

  // Generic HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    const response = await this.client.get<T>(endpoint)
    return response.data
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(endpoint, data)
    return response.data
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(endpoint, data)
    return response.data
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(endpoint, data)
    return response.data
  }

  async delete(endpoint: string): Promise<void> {
    await this.client.delete(endpoint)
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.tokens?.access_token
  }

  getTokens(): AuthTokens | null {
    return this.tokens
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await this.client.get('/health')
    return response.data
  }
}

// Export singleton instance
export const apiClient = new APIClient()

// Export type for dependency injection  
export type APIClientType = APIClient