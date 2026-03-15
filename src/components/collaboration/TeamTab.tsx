import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Share2, Copy, Trash2, Clock, Shield, Plus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { getCopHeaders } from '@/lib/cop-auth'
import type { WorkspaceInvite, CreateWorkspaceInviteRequest, WorkspaceMemberWithNickname } from '@/types/workspace-invites'

interface TeamTabProps {
  workspaceId: string
  userRole: string
}

export function TeamTab({ workspaceId, userRole }: TeamTabProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [members, setMembers] = useState<WorkspaceMemberWithNickname[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateWorkspaceInviteRequest>({
    default_role: 'VIEWER',
    max_uses: null,
    expires_in_hours: null,
    label: null
  })

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN'

  const getAuthHeaders = (): HeadersInit => getCopHeaders()

  useEffect(() => {
    const controller = new AbortController()
    fetchMembers(controller.signal)
    fetchInvites(controller.signal)
    return () => controller.abort()
  }, [workspaceId])

  const fetchMembers = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (response.ok) {
        const data = await response.json()
        setMembers(data)
        setError(null)
      } else {
        console.error('[TeamTab] fetchMembers failed:', response.status)
        setError(`Failed to load team members (${response.status})`)
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to fetch members:', error)
    }
  }

  const fetchInvites = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (response.ok) {
        const data = await response.json()
        setInvites(data.invites || [])
      } else {
        console.error('[TeamTab] fetchInvites failed:', response.status)
        setError(`Failed to load invites (${response.status})`)
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to fetch invites:', error)
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!response.ok) throw new Error('Failed to create invite')
      const invite = await response.json()
      toast({ title: t('pages.collaboration.inviteCreated'), description: t('pages.collaboration.inviteCreatedDesc') })
      await navigator.clipboard.writeText(invite.invite_url)
      toast({ title: t('pages.collaboration.linkCopied'), description: t('pages.collaboration.linkCopiedDesc') })
      setIsCreateDialogOpen(false)
      setCreateForm({ default_role: 'VIEWER', max_uses: null, expires_in_hours: null, label: null })
      fetchInvites()
    } catch (error) {
      toast({
        title: t('pages.collaboration.error'),
        description: error instanceof Error ? error.message : t('pages.collaboration.failedToCreateInvite'),
        variant: 'destructive'
      })
    }
  }

  const handleCopyInvite = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast({ title: t('pages.collaboration.linkCopied'), description: t('pages.collaboration.linkCopiedDesc') })
    } catch {
      toast({ title: t('pages.collaboration.error'), description: t('pages.collaboration.failedToCopyLink'), variant: 'destructive' })
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to revoke invite')
      toast({ title: t('pages.collaboration.inviteRevoked'), description: t('pages.collaboration.inviteRevokedDesc') })
      fetchInvites()
    } catch (error) {
      toast({
        title: t('pages.collaboration.error'),
        description: error instanceof Error ? error.message : t('pages.collaboration.failedToRevokeInvite'),
        variant: 'destructive'
      })
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'EDITOR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase()
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return t('pages.collaboration.neverExpires', 'Never expires')
    const diffMs = new Date(expiresAt).getTime() - Date.now()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    if (diffMs <= 0) return t('pages.collaboration.expired', 'Expired')
    if (diffDays > 1) return t('pages.collaboration.expiresInDays', { count: diffDays, defaultValue: `Expires in ${diffDays} days` })
    if (diffHours > 1) return t('pages.collaboration.expiresInHours', { count: diffHours, defaultValue: `Expires in ${diffHours} hours` })
    return t('pages.collaboration.expiresSoon', 'Expires soon')
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500 p-2">{error}</p>}

      {/* Invite Links */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pages.collaboration.inviteLinks')}</CardTitle>
              <CardDescription>{t('pages.collaboration.inviteLinksDesc')}</CardDescription>
            </div>
            {canManage && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />{t('pages.collaboration.newInvite')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('pages.collaboration.createInviteLink')}</DialogTitle>
                    <DialogDescription>{t('pages.collaboration.createInviteLinkDesc')}</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.role')}</Label>
                      <Select value={createForm.default_role} onValueChange={(value: any) => setCreateForm({ ...createForm, default_role: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">{t('pages.collaboration.viewer')}</SelectItem>
                          <SelectItem value="EDITOR">{t('pages.collaboration.editor')}</SelectItem>
                          <SelectItem value="ADMIN">{t('pages.collaboration.admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.labelOptional')}</Label>
                      <Input placeholder={t('pages.collaboration.labelPlaceholder')} value={createForm.label || ''} onChange={(e) => setCreateForm({ ...createForm, label: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.expiresIn')}</Label>
                      <Select value={createForm.expires_in_hours?.toString() || 'never'} onValueChange={(value) => setCreateForm({ ...createForm, expires_in_hours: value === 'never' ? null : parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">{t('pages.collaboration.neverExpires')}</SelectItem>
                          <SelectItem value="24">{t('pages.collaboration.hours24')}</SelectItem>
                          <SelectItem value="168">{t('pages.collaboration.days7')}</SelectItem>
                          <SelectItem value="720">{t('pages.collaboration.days30')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.maxUses')}</Label>
                      <Select value={createForm.max_uses?.toString() || 'unlimited'} onValueChange={(value) => setCreateForm({ ...createForm, max_uses: value === 'unlimited' ? null : parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unlimited">{t('pages.collaboration.unlimited')}</SelectItem>
                          <SelectItem value="1">{t('pages.collaboration.use1')}</SelectItem>
                          <SelectItem value="5">{t('pages.collaboration.uses5')}</SelectItem>
                          <SelectItem value="10">{t('pages.collaboration.uses10')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">{t('pages.collaboration.createCopyLink')}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="text-center py-8">
              <Share2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.noInvites')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {invite.label && <span className="font-medium text-gray-900 dark:text-white">{invite.label}</span>}
                        <Badge className={getRoleColor(invite.default_role)}>{invite.default_role}</Badge>
                        {!invite.is_active && <Badge variant="destructive">Revoked</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">{invite.invite_token}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatExpiry(invite.expires_at)}</span>
                        <span>{invite.current_uses}/{invite.max_uses || '\u221e'} uses</span>
                        {invite.created_by && <span>Created by {invite.created_by.nickname}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopyInvite(invite.invite_url)} disabled={!invite.is_active}><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(invite.invite_url, '_blank')} disabled={!invite.is_active}><ExternalLink className="h-4 w-4" /></Button>
                      {canManage && <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(invite.id)} disabled={!invite.is_active}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
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
          <CardTitle>{t('pages.collaboration.teamMembers')} ({members.length})</CardTitle>
          <CardDescription>{t('pages.collaboration.teamMembersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.noMembers')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarFallback>{getInitials(member.nickname || member.username || 'U')}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.nickname || member.username || 'Unknown'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Joined {new Date(member.joined_at).toLocaleDateString()}{member.joined_via_invite_id && ' via invite'}</p>
                    </div>
                  </div>
                  <Badge className={getRoleColor(member.role)}>{member.role}</Badge>
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
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t('pages.collaboration.secureCollaboration')}</h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">{t('pages.collaboration.securityInfo')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
