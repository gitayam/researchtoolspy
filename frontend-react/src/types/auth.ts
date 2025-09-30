export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface HashLoginRequest {
  account_hash: string
}

export interface HashRegisterResponse {
  account_hash: string
  message?: string
}