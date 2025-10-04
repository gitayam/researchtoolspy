import { useState, useEffect } from 'react'
import { Users, UserPlus, Mail, Share2, Copy, Trash2, Clock, Shield, Plus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { WorkspaceInvite, CreateWorkspaceInviteRequest, WorkspaceMemberWithNickname } from '@/types/workspace-invites'

interface Workspace {
  id: string
  name: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
  owner_id: number
}

export function CollaborationPage() {
  const { toast } = useToast()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberWithNickname[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [loading, setLoading] = useState(true)

  // Create invite form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateWorkspaceInviteRequest>({
    default_role: 'VIEWER',
    max_uses: null,
    expires_in_hours: null,
    label: null
  })

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  useEffect(() => {
    if (selectedWorkspace) {
      fetchMembers()
      fetchInvites()
    }
  }, [selectedWorkspace])

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const allWorkspaces = [...(data.owned || []), ...(data.member || [])]
        setWorkspaces(allWorkspaces)

        // Auto-select first TEAM workspace
        const teamWorkspace = allWorkspaces.find(w => w.type === 'TEAM')
        if (teamWorkspace) {
          setSelectedWorkspace(teamWorkspace)
        } else if (allWorkspaces.length > 0) {
          setSelectedWorkspace(allWorkspaces[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    }
  }

  const fetchInvites = async () => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/invites`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setInvites(data.invites || [])
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error)
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify(createForm)
      })

      if (!response.ok) {
        throw new Error('Failed to create invite')
      }

      const invite = await response.json()

      toast({
        title: 'Invite created',
        description: 'Invite link has been created successfully',
      })

      // Copy to clipboard
      await navigator.clipboard.writeText(invite.invite_url)

      toast({
        title: 'Link copied',
        description: 'Invite link has been copied to clipboard',
      })

      setIsCreateDialogOpen(false)
      setCreateForm({
        default_role: 'VIEWER',
        max_uses: null,
        expires_in_hours: null,
        label: null
      })

      fetchInvites()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invite',
        variant: 'destructive'
      })
    }
  }

  const handleCopyInvite = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast({
        title: 'Link copied',
        description: 'Invite link has been copied to clipboard',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive'
      })
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedWorkspace) return

    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to revoke invite')
      }

      toast({
        title: 'Invite revoked',
        description: 'The invite link has been revoked',
      })

      fetchInvites()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke invite',
        variant: 'destructive'
      })
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800'
      case 'EDITOR':
        return 'bg-blue-100 text-blue-800'
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never expires'
    const date = new Date(expiresAt)
    return `Expires ${date.toLocaleDateString()}`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investigation Teams</h1>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investigation Teams</h1>
            <p className="text-gray-600 dark:text-gray-400">Create a workspace to collaborate</p>
          </div>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Workspaces Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create a workspace to start collaborating with your team
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investigation Teams</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage team members and secure invite links</p>
        </div>
      </div>

      {/* Workspace Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Workspace</CardTitle>
          <CardDescription>Choose a workspace to manage team collaboration</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedWorkspace?.id || ''}
            onValueChange={(id) => setSelectedWorkspace(workspaces.find(w => w.id === id) || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex items-center gap-2">
                    <span>{workspace.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {workspace.type}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedWorkspace && (
        <>
          {/* Invite Links */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invite Links</CardTitle>
                  <CardDescription>Secure links to invite team members</CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Invite Link</DialogTitle>
                      <DialogDescription>
                        Generate a secure invite link for team members to join this workspace
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateInvite} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={createForm.default_role}
                          onValueChange={(value: any) => setCreateForm({ ...createForm, default_role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VIEWER">Viewer (Read-only)</SelectItem>
                            <SelectItem value="EDITOR">Editor (Can edit)</SelectItem>
                            <SelectItem value="ADMIN">Admin (Full access)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Label (Optional)</Label>
                        <Input
                          placeholder="e.g., External analysts, Review team"
                          value={createForm.label || ''}
                          onChange={(e) => setCreateForm({ ...createForm, label: e.target.value || null })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Expires In (Optional)</Label>
                        <Select
                          value={createForm.expires_in_hours?.toString() || 'never'}
                          onValueChange={(value) =>
                            setCreateForm({
                              ...createForm,
                              expires_in_hours: value === 'never' ? null : parseInt(value)
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never expires</SelectItem>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="168">7 days</SelectItem>
                            <SelectItem value="720">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Max Uses (Optional)</Label>
                        <Select
                          value={createForm.max_uses?.toString() || 'unlimited'}
                          onValueChange={(value) =>
                            setCreateForm({
                              ...createForm,
                              max_uses: value === 'unlimited' ? null : parseInt(value)
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                            <SelectItem value="1">1 use</SelectItem>
                            <SelectItem value="5">5 uses</SelectItem>
                            <SelectItem value="10">10 uses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button type="submit" className="w-full">
                        Create & Copy Link
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <div className="text-center py-8">
                  <Share2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No invite links created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {invite.label && (
                              <span className="font-medium text-gray-900 dark:text-white">{invite.label}</span>
                            )}
                            <Badge className={getRoleColor(invite.default_role)}>
                              {invite.default_role}
                            </Badge>
                            {!invite.is_active && (
                              <Badge variant="destructive">Revoked</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">
                            {invite.invite_token}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatExpiry(invite.expires_at)}
                            </span>
                            <span>
                              {invite.current_uses}/{invite.max_uses || '∞'} uses
                            </span>
                            {invite.created_by && (
                              <span>Created by {invite.created_by.nickname}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyInvite(invite.invite_url)}
                            disabled={!invite.is_active}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invite.invite_url, '_blank')}
                            disabled={!invite.is_active}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeInvite(invite.id)}
                            disabled={!invite.is_active}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({members.length})</CardTitle>
              <CardDescription>People collaborating in this workspace</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No team members yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(member.nickname || member.username || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {member.nickname || member.username || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                            {member.joined_via_invite_id && ' via invite'}
                          </p>
                        </div>
                      </div>
                      <Badge className={getRoleColor(member.role)}>
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Secure Collaboration
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Invite links are independent from account credentials. Team members use their own
                    account hash to login and choose workspace-specific nicknames. You can revoke
                    invite links at any time without affecting existing members.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
