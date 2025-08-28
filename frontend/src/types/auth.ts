export interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  organization?: string
  department?: string
  account_hash?: string
  created_at: string
  updated_at: string
}

export enum UserRole {
  ADMIN = "admin",
  ANALYST = "analyst", 
  RESEARCHER = "researcher",
  VIEWER = "viewer"
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: "bearer"
  expires_in: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface HashLoginRequest {
  account_hash: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  full_name: string
  organization?: string
  department?: string
}

export interface LoginResponse {
  user: User
  tokens: AuthTokens
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface AuthError {
  detail: string
  status_code: number
}