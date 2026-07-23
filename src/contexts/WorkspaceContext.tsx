import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'

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
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string>(() => {
    return localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id') || ''
  })
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const setCurrentWorkspaceId = (id: string) => {
    setCurrentWorkspaceIdState(id)
    localStorage.setItem('current_workspace_id', id)
    localStorage.setItem('omnicore_workspace_id', id)
  }

  useEffect(() => {
    const controller = new AbortController()
    // Fetch available workspaces on mount
    const fetchWorkspaces = async () => {
      try {
        const response = await fetch('/api/workspaces', {
          headers: getCopHeaders(),
          signal: controller.signal,
        })

        if (response.ok) {
          const data = await response.json()
          const allWorkspaces = [
            ...data.owned || [],
            ...data.member || []
          ]

          setWorkspaces(allWorkspaces)
          setCurrentWorkspaceIdState((currentId) => {
            if (allWorkspaces.length === 0) {
              localStorage.removeItem('current_workspace_id')
              localStorage.removeItem('omnicore_workspace_id')
              return ''
            }

            const resolvedId = allWorkspaces.some((workspace) => workspace.id === currentId)
              ? currentId
              : allWorkspaces[0].id

            if (resolvedId !== currentId) {
              localStorage.setItem('current_workspace_id', resolvedId)
              localStorage.setItem('omnicore_workspace_id', resolvedId)
            }
            return resolvedId
          })
        } else {
          setWorkspaces([])
          setCurrentWorkspaceIdState('')
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('Failed to fetch workspaces:', error)
          setWorkspaces([])
          setCurrentWorkspaceIdState('')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchWorkspaces()
    return () => controller.abort()
  }, [])

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspaceId,
      setCurrentWorkspaceId,
      workspaces,
      setWorkspaces,
      isLoading,
      setIsLoading
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
