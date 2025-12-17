/**
 * Hash-based authentication utilities
 * Mullvad-style privacy-focused authentication using account hashes
 */

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface User {
  id: number
  account_hash: string
  role: 'admin' | 'user'
  created_at: string
  last_login?: string
}

export interface HashAuthResponse {
  user: User
  tokens: AuthTokens
}

/**
 * Generate a cryptographically secure 16-digit account hash
 * Similar to Mullvad's account number system
 */
export function generateAccountHash(): string {
  const min = 1000000000000000 // 16 digits minimum
  const max = 9999999999999999 // 16 digits maximum
  
  // Use crypto.getRandomValues for better randomness
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  
  // Scale to our range
  const randomValue = (array[0] / (0xffffffff + 1)) * (max - min + 1) + min
  return Math.floor(randomValue).toString()
}

/**
 * Format account hash for display (adds spaces for readability)
 */
export function formatAccountHash(hash: string): string {
  return hash.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/**
 * Validate account hash format
 */
export function isValidAccountHash(hash: string): boolean {
  return /^\d{16}$/.test(hash.replace(/\s/g, ''))
}

/**
 * Store auth tokens securely
 */
export function storeAuthTokens(tokens: AuthTokens): void {
  localStorage.setItem('auth_tokens', JSON.stringify(tokens))
}

/**
 * Get stored auth tokens
 */
export function getStoredAuthTokens(): AuthTokens | null {
  try {
    const stored = localStorage.getItem('auth_tokens')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Clear stored auth tokens
 */
export function clearAuthTokens(): void {
  localStorage.removeItem('auth_tokens')
}

/**
 * Check if tokens are expired
 */
export function areTokensExpired(tokens: AuthTokens): boolean {
  try {
    const payload = JSON.parse(atob(tokens.access_token.split('.')[1]))
    const expiryTime = payload.exp * 1000 // Convert to milliseconds
    return Date.now() >= expiryTime
  } catch {
    return true // If we can't parse, consider expired
  }
}

/**
 * Clean hash input by removing spaces and non-digits
 */
export function cleanHashInput(input: string): string {
  return input.replace(/\s/g, '').replace(/\D/g, '')
}

/**
 * Check if hash is valid (alias for isValidAccountHash)
 */
export function isValidHash(hash: string): boolean {
  return isValidAccountHash(hash)
}

/**
 * Format hash for display (alias for formatAccountHash)
 */
export function formatHashForDisplay(hash: string): string {
  return formatAccountHash(hash)
}