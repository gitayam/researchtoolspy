/**
 * Workspace Management Component
 *
 * UI for managing workspaces in hash-based system
 */

import { useState, useCallback } from 'react'
import { Plus, Trash2, Users, Globe, Lock, Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Workspace, WorkspaceType } from '@/types/settings'

interface WorkspaceManagementProps {
  workspaces: Workspace[]
  currentWorkspaceId: string
  onWorkspaceChange: (workspaceId: string) => void
  onWorkspaceCreate: (name: string, type: WorkspaceType, description?: string) => Promise<void>
  onWorkspaceDelete: (workspaceId: string) => Promise<void>
  onWorkspaceUpdate: (workspaceId: string, name: string, description?: string) => Promise<void>
}

export function WorkspaceManagement({
  workspaces,
  currentWorkspaceId,
  onWorkspaceChange,
  onWorkspaceCreate,
  onWorkspaceDelete,
  onWorkspaceUpdate,
}: WorkspaceManagementProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)

  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceType, setNewWorkspaceType] = useState<WorkspaceType>('PERSONAL')
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleCreateWorkspace = useCallback(async () => {
    if (!newWorkspaceName.trim()) return

    try {
      setCreating(true)
      await onWorkspaceCreate(
        newWorkspaceName,
        newWorkspaceType,
        newWorkspaceDescription || undefined
      )
      setNewWorkspaceName('')
      setNewWorkspaceDescription('')
      setNewWorkspaceType('PERSONAL')
      setCreateDialogOpen(false)
    } catch (error) {
      console.error('Failed to create workspace:', error)
    } finally {
      setCreating(false)
    }
  }, [newWorkspaceName, newWorkspaceType, newWorkspaceDescription, onWorkspaceCreate])

  const handleDeleteWorkspace = useCallback(async () => {
    if (!selectedWorkspace) return

    try {
      setDeleting(true)
      await onWorkspaceDelete(selectedWorkspace.id)
      setDeleteDialogOpen(false)
      setSelectedWorkspace(null)
    } catch (error) {
      console.error('Failed to delete workspace:', error)
    } finally {
      setDeleting(false)
    }
  }, [selectedWorkspace, onWorkspaceDelete])

  const getWorkspaceIcon = (type: WorkspaceType, isPublic: boolean) => {
    if (isPublic) return <Globe className="h-4 w-4" />
    if (type === 'TEAM') return <Users className="h-4 w-4" />
    return <Lock className="h-4 w-4" />
  }

  const getWorkspaceTypeLabel = (type: WorkspaceType) => {
    switch (type) {
      case 'PERSONAL':
        return 'Personal'
      case 'TEAM':
        return 'Team'
      case 'PUBLIC':
        return 'Public'
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Workspaces */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Workspaces</CardTitle>
              <CardDescription>
                Manage and switch between your workspaces
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Workspace</DialogTitle>
                  <DialogDescription>
                    Create a new workspace to organize your analyses
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace Name</Label>
                    <Input
                      id="workspace-name"
                      placeholder="e.g., Syria Analysis"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-type">Type</Label>
                    <Select
                      value={newWorkspaceType}
                      onValueChange={(value) => setNewWorkspaceType(value as WorkspaceType)}
                    >
                      <SelectTrigger id="workspace-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERSONAL">Personal - Just for you</SelectItem>
                        <SelectItem value="TEAM">Team - Invite collaborators</SelectItem>
                        <SelectItem value="PUBLIC">Public - Anyone can view</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-description">Description (Optional)</Label>
                    <Textarea
                      id="workspace-description"
                      placeholder="Brief description of this workspace's purpose"
                      value={newWorkspaceDescription}
                      onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWorkspace} disabled={creating || !newWorkspaceName.trim()}>
                    {creating ? 'Creating...' : 'Create Workspace'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  workspace.id === currentWorkspaceId
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    {getWorkspaceIcon(workspace.type, workspace.is_public)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{workspace.name}</h4>
                      {workspace.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {workspace.id === currentWorkspaceId && (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    {workspace.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {workspace.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {getWorkspaceTypeLabel(workspace.type)}
                      </Badge>
                      {workspace.member_count !== undefined && workspace.member_count > 1 && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {workspace.member_count} members
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {workspace.id !== currentWorkspaceId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onWorkspaceChange(workspace.id)}
                    >
                      Switch
                    </Button>
                  )}
                  {!workspace.is_default && workspace.role === 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedWorkspace(workspace)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {workspaces.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No workspaces yet. Create one to get started!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workspace "{selectedWorkspace?.name}" and all its data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
