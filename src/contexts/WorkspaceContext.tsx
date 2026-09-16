import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { useAuthStore } from '@/stores/auth'
import {
  clearSelectedWorkspaceId,
  readSelectedWorkspaceId,
  writeSelectedWorkspaceId,
} from '@/lib/workspace-storage'

interface Workspace {
  id: string
  name: string
  description?: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
  owner_id: number
  is_public: boolean
  role?: string // For member workspaces
}

interface WorkspaceContextValue {
  currentWorkspaceId: string
  setCurrentWorkspaceId: (id: string) => void
  workspaces: Workspace[]
  setWorkspaces: (workspaces: Workspace[]) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  /** True when the workspace list could not be loaded, so `workspaces` means
   *  "unknown", not "none". Callers must not render "you have no workspaces"
   *  on the strength of an empty array alone. */
  loadFailed: boolean
  refreshWorkspaces: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

const MAX_ATTEMPTS = 3

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string>(() => readSelectedWorkspaceId())
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const setCurrentWorkspaceId = useCallback((id: string) => {
    setCurrentWorkspaceIdState(id)
    writeSelectedWorkspaceId(id)
  }, [])

  const refreshWorkspaces = useCallback(() => setReloadToken((token) => token + 1), [])

  // Re-run on sign-in and sign-out: the provider sits above the router and never
  // remounts, so without the isAuthenticated dependency a freshly logged-in user
  // kept the guest (or empty) workspace list until a full page reload.
  useEffect(() => {
    const controller = new AbortController()

    const fetchWorkspaces = async () => {
      setIsLoading(true)

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch('/api/workspaces', {
            headers: getCopHeaders(),
            signal: controller.signal,
          })

          // 5xx is "ask again", not "you have nothing". A transient D1 failure
          // used to land here and blank the picker while every request kept
          // sending the stale X-Workspace-ID, so writes 403'd with no way back.
          if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
            continue
          }

          if (!response.ok) {
            // Leave both React state and the persisted id untouched: we do not
            // know the truth, and discarding a valid selection here is what made
            // the failure permanent instead of momentary.
            setLoadFailed(true)
            return
          }

          const data = await response.json()
          const allWorkspaces: Workspace[] = [...(data.owned || []), ...(data.member || [])]

          setWorkspaces(allWorkspaces)
          setLoadFailed(false)
          setCurrentWorkspaceIdState((currentId) => {
            if (allWorkspaces.length === 0) {
              clearSelectedWorkspaceId()
              return ''
            }

            const resolvedId = allWorkspaces.some((workspace) => workspace.id === currentId)
              ? currentId
              : allWorkspaces[0].id

            // writeSelectedWorkspaceId refuses guest workspace ids, so a guest's
            // auto-provisioned workspace can no longer leak into the keys the
            // authenticated header path reads.
            if (resolvedId !== currentId) writeSelectedWorkspaceId(resolvedId)
            return resolvedId
          })
          return
        } catch (error: any) {
          if (error?.name === 'AbortError') return
          if (attempt >= MAX_ATTEMPTS) {
            console.error('Failed to fetch workspaces:', error)
            setLoadFailed(true)
            return
          }
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
        }
      }
    }

    fetchWorkspaces().finally(() => {
      if (!controller.signal.aborted) setIsLoading(false)
    })

    return () => controller.abort()
  }, [isAuthenticated, reloadToken])

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspaceId,
      setCurrentWorkspaceId,
      workspaces,
      setWorkspaces,
      isLoading,
      setIsLoading,
      loadFailed,
      refreshWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

// Helper hook to get current workspace object
export function useCurrentWorkspace() {
  const { currentWorkspaceId, workspaces } = useWorkspace()
  return workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0]
}
