/**
 * Get a stable auth identifier for the current user.
 * Works for both hash-based auth (omnicore_user_hash) and OIDC/JWT auth.
 * Returns null if not authenticated.
 */
export function getAuthIdentifier(): string | null {
  // Check hash first (original auth method)
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash && userHash !== 'default' && userHash !== 'guest') {
    return userHash
  }

  // Check JWT token (OIDC auth method)
  try {
    const tokensStr = localStorage.getItem('omnicore_tokens')
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr)
      if (tokens?.access_token) {
        // Extract user info from the Zustand persisted auth store
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const parsed = JSON.parse(authStorage)
          if (parsed?.state?.isAuthenticated) {
            // Return user ID or hash from persisted state
            const user = parsed?.state?.user
            return user?.account_hash || `user_${user?.id}` || 'authenticated'
          }
        }
        // Has token but no persisted state — extract sub from JWT payload
        try {
          const payload = JSON.parse(atob(tokens.access_token.split('.')[1]))
          if (payload.sub) return `user_${payload.sub}`
        } catch { /* not a valid JWT */ }
        return null
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null
}

/**
 * Check if the user is currently authenticated (any method).
 */
export function isUserAuthenticated(): boolean {
  return getAuthIdentifier() !== null
}
