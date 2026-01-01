import axios, { type AxiosInstance, type AxiosError } from 'axios'
import type {
  User,
  AuthTokens,
  LoginResponse,
  HashLoginRequest
} from '@/types/auth'
import { UserRole } from '@/types/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API')

// Determine API URL based on environment
const getApiBaseUrl = () => {
  // If we have an explicit API URL set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Default to relative path which works for both Wrangler dev and Production
  // This assumes the API is served from the same origin (which is true for Cloudflare Pages)
  return '/api'
}

const API_BASE_URL = getApiBaseUrl()

// Debug logging for API URL
if (typeof window !== 'undefined') {
  logger.info('API Client initialized with base URL:', API_BASE_URL)
}

// Error types for better error handling
export interface APIError {
  message: string
  status: number
  details?: unknown
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

    // Response interceptor for token handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, redirect to login
          this.clearTokens()
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
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
      const data = error.response.data as { detail?: string | { message?: string } | { msg?: string }[]; message?: string }
      let message = 'An error occurred'
      
      // Handle different error formats from the backend
      if (data?.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail
        } else if (Array.isArray(data.detail)) {
          // FastAPI validation error format
          message = data.detail[0]?.msg || 'Invalid input'
        } else if (typeof data.detail === 'object') {
          message = data.detail.message || JSON.stringify(data.detail)
        }
      } else if (data?.message) {
        message = data.message
      }
      
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

  // Hash-based registration
  async registerWithHash(): Promise<{ account_hash: string; message: string; warning: string; created_at: string }> {
    logger.info('Requesting new hash registration from backend')

    const response = await this.client.post<{
      account_hash: string
      message: string
      warning: string
      created_at: string
    }>('/hash-auth/register')

    logger.info('Hash registration successful:', {
      hash: response.data.account_hash.substring(0, 4) + '...',
      created_at: response.data.created_at
    })
    
    return response.data
  }

  // Hash-based login (Mullvad-style)
  async loginWithHash(hashCredentials: HashLoginRequest): Promise<LoginResponse> {
    try {
      logger.debug('Making hash auth request to:', `${API_BASE_URL}/hash-auth/authenticate`)
      logger.debug('Hash credentials:', hashCredentials)

      // Use the new hash authentication endpoint
      const response = await this.client.post<{
        access_token: string
        refresh_token: string
        token_type: string
        expires_in: number
        account_hash: string
        role: string
      }>('/hash-auth/authenticate', hashCredentials)

      logger.info('Hash auth response received:', {
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
    } catch (error: unknown) {
      // If hash auth fails, provide helpful error message
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 401) {
        throw {
          message: 'Invalid account hash. Please check your account number.',
          status: 401,
          details: axiosError.response?.data
        }
      }
      throw error
    }
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
  async get<T>(endpoint: string, config?: unknown): Promise<T> {
    const response = await this.client.get<T>(endpoint, config as any)
    return response.data
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.client.post<T>(endpoint, data)
    return response.data
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await this.client.put<T>(endpoint, data)
    return response.data
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
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