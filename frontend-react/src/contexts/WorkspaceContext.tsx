import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

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
    // Load from localStorage or default to '1'
    return localStorage.getItem('current_workspace_id') || '1'
  })
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const setCurrentWorkspaceId = (id: string) => {
    setCurrentWorkspaceIdState(id)
    localStorage.setItem('current_workspace_id', id)
  }

  useEffect(() => {
    // Fetch available workspaces on mount
    const fetchWorkspaces = async () => {
      try {
        const token = localStorage.getItem('omnicore_token')
        if (!token) {
          // Guest user - only has default workspace
          setWorkspaces([{
            id: '1',
            name: 'My Workspace',
            type: 'PERSONAL',
            owner_id: 1,
            is_public: false
          }])
          setIsLoading(false)
          return
        }

        const response = await fetch('/api/workspaces', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          const allWorkspaces = [
            ...data.owned || [],
            ...data.member || []
          ]

          // If empty, add default workspace
          if (allWorkspaces.length === 0) {
            allWorkspaces.push({
              id: '1',
              name: 'My Workspace',
              type: 'PERSONAL',
              owner_id: 1,
              is_public: false
            })
          }

          setWorkspaces(allWorkspaces)
        } else {
          // Fallback to default workspace
          setWorkspaces([{
            id: '1',
            name: 'My Workspace',
            type: 'PERSONAL',
            owner_id: 1,
            is_public: false
          }])
        }
      } catch (error) {
        console.error('Failed to fetch workspaces:', error)
        // Fallback to default workspace
        setWorkspaces([{
          id: '1',
          name: 'My Workspace',
          type: 'PERSONAL',
          owner_id: 1,
          is_public: false
        }])
      } finally {
        setIsLoading(false)
      }
    }

    fetchWorkspaces()
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
