export function getCopHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
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

  const workspaceId = localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id')
  if (workspaceId) headers['X-Workspace-ID'] = workspaceId

  return headers
}
