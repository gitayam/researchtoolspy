export interface User {
  id: number
  username?: string
  email?: string
  full_name?: string
  account_hash?: string
  role?: string
  is_active?: boolean
  is_verified?: boolean
  created_at?: string
  updated_at?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
}

export interface HashLoginRequest {
  account_hash: string
}

export interface HashRegisterResponse {
  account_hash: string
  message?: string
  warning?: string
  created_at?: string
}

export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  ANALYST: 'analyst'
} as const

export type UserRole = typeof UserRole[keyof typeof UserRole]