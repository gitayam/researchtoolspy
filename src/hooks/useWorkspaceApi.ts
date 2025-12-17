import { useWorkspace } from '@/contexts/WorkspaceContext'

/**
 * Hook to append workspace_id to API URLs
 *
 * Usage:
 * const buildUrl = useWorkspaceApi()
 * const url = buildUrl('/api/frameworks')
 * // Returns: /api/frameworks?workspace_id=1
 */
export function useWorkspaceApi() {
  const { currentWorkspaceId } = useWorkspace()

  return (path: string, params?: Record<string, string>) => {
    const url = new URL(path, window.location.origin)

    // Add workspace_id
    url.searchParams.set('workspace_id', currentWorkspaceId)

    // Add any additional params
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    return url.pathname + url.search
  }
}
