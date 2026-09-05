import { getOrCreateGuestSessionId, getOrCreateGuestWorkspaceId } from './guest-session'

export function getCopHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window === 'undefined') return headers

  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash

  // Also include Bearer token if available (JWT auth path)
  try {
    const tokensStr = localStorage.getItem('omnicore_tokens')
    if (tokensStr) {
      const tokens = JSON.parse(tokensStr)
      if (tokens?.access_token) {
        headers['Authorization'] = `Bearer ${tokens.access_token}`
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Guest sessions are deliberately separate from login credentials. APIs can
  // isolate and authorize guest work without making the auth store claim that
  // the visitor is logged in. Creation is synchronous so first-render requests
  // cannot race the GuestModeProvider effect and fail with a misleading 401.
  const isGuestRequest = !headers['X-User-Hash'] && !headers.Authorization
  if (isGuestRequest) {
    const guestSessionId = getOrCreateGuestSessionId()
    if (guestSessionId) headers['X-Guest-Session'] = guestSessionId
    const guestWorkspaceId = getOrCreateGuestWorkspaceId()
    if (guestWorkspaceId) headers['X-Workspace-ID'] = guestWorkspaceId
  }

  if (!isGuestRequest) {
    const workspaceId = localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id')
    if (workspaceId) headers['X-Workspace-ID'] = workspaceId
  }

  return headers
}
