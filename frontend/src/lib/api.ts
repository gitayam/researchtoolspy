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

// Determine API URL based on environment
const getApiBaseUrl = () => {
  // If we have an explicit API URL set, use it
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  
  // For local development, always use localhost
  // (Tunnel URL logic removed to prevent confusion)
  return 'http://localhost:8000/api/v1'
}

const API_BASE_URL = getApiBaseUrl()

// Debug logging for API URL
if (typeof window !== 'undefined') {
  console.log('API Client initialized with base URL:', API_BASE_URL)
}

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
    try {
      console.log('API Client: Making hash auth request to:', `${API_BASE_URL}/hash-auth/authenticate`)
      console.log('API Client: Hash credentials:', hashCredentials)
      
      // Use the new hash authentication endpoint
      const response = await this.client.post<{
        access_token: string
        refresh_token: string
        token_type: string
        expires_in: number
        account_hash: string
        role: string
      }>('/hash-auth/authenticate', hashCredentials)
      
      console.log('API Client: Hash auth response received:', {
        status: response.status,
        hasAccessToken: !!response.data.access_token,
        tokenType: response.data.token_type,
        role: response.data.role
      })

      const tokens: AuthTokens = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in
      }

      this.saveTokensToStorage(tokens)

      // Create user from hash auth response
      const user: User = {
        id: 1, // Hash auth doesn't expose user IDs
        username: `user_${hashCredentials.account_hash.substring(0, 8)}`,
        email: 'anonymous@researchtools.dev',
        full_name: 'Research Analyst',
        role: response.data.role as UserRole,
        is_active: true,
        is_verified: true,
        account_hash: response.data.account_hash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      return {
        user,
        tokens
      }
    } catch (error: any) {
      // If hash auth fails, provide helpful error message
      if (error.response?.status === 401) {
        throw {
          message: 'Invalid account hash. Please check your account number.',
          status: 401,
          details: error.response?.data
        }
      }
      throw error
    }
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
    // Always make real API call - hash auth provides real JWT tokens
    const response = await this.client.get<User>('/auth/me')
    return response.data
  }

  logout(): void {
    this.clearTokens()
  }

  // Generic HTTP methods
  async get<T>(endpoint: string, config?: any): Promise<T> {
    const response = await this.client.get<T>(endpoint, config)
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