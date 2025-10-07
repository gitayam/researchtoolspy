import { Users, Lock, Globe } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWorkspace, useCurrentWorkspace } from '@/contexts/WorkspaceContext'

export function WorkspaceSelector() {
  const { workspaces, currentWorkspaceId, setCurrentWorkspaceId, isLoading } = useWorkspace()
  const currentWorkspace = useCurrentWorkspace()

  const getWorkspaceIcon = (type: string) => {
    switch (type) {
      case 'PERSONAL':
        return <Lock className="h-4 w-4 mr-2 inline" />
      case 'TEAM':
        return <Users className="h-4 w-4 mr-2 inline" />
      case 'PUBLIC':
        return <Globe className="h-4 w-4 mr-2 inline" />
      default:
        return <Lock className="h-4 w-4 mr-2 inline" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  // Don't show selector if only one workspace
  if (workspaces.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
        {getWorkspaceIcon(currentWorkspace?.type || 'PERSONAL')}
        <span className="font-medium">{currentWorkspace?.name || 'My Workspace'}</span>
      </div>
    )
  }

  return (
    <Select value={currentWorkspaceId} onValueChange={setCurrentWorkspaceId}>
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          <div className="flex items-center">
            {getWorkspaceIcon(currentWorkspace?.type || 'PERSONAL')}
            <span className="truncate">{currentWorkspace?.name || 'My Workspace'}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Your Workspaces</SelectLabel>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              <div className="flex items-center">
                {getWorkspaceIcon(workspace.type)}
                <span className="truncate">{workspace.name}</span>
                {workspace.role && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({workspace.role})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
