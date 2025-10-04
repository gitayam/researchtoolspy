import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Clock, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth'
import type { WorkspaceInviteInfo, AcceptInviteRequest, AcceptInviteResponse } from '@/types/workspace-invites'

export function InviteAcceptPage() {
  const { inviteToken } = useParams<{ inviteToken: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()

  const [inviteInfo, setInviteInfo] = useState<WorkspaceInviteInfo | null>(null)
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If not authenticated, redirect to login with return URL
    if (!isAuthenticated) {
      navigate(`/login?redirect=/invite/${inviteToken}`)
      return
    }

    // Fetch invite info
    fetchInviteInfo()
  }, [inviteToken, isAuthenticated])

  const fetchInviteInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/invites/${inviteToken}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch invite')
      }

      const data = await response.json()
      setInviteInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nickname.trim()) {
      setError('Nickname is required')
      return
    }

    try {
      setAccepting(true)
      setError(null)

      const requestBody: AcceptInviteRequest = {
        nickname: nickname.trim()
      }

      const response = await fetch(`/api/invites/${inviteToken}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to accept invite')
      }

      const result: AcceptInviteResponse = await response.json()

      // Success! Redirect to workspace
      navigate(`/workspaces/${result.workspace_id}`, {
        state: {
          message: `Successfully joined ${inviteInfo?.workspace.name} as ${result.nickname}`
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
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

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never expires'

    const expiry = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiry.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 1) {
      return `Expires in ${diffDays} days`
    } else if (diffHours > 1) {
      return `Expires in ${diffHours} hours`
    } else if (diffMs > 0) {
      return 'Expires soon'
    } else {
      return 'Expired'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading invite...</p>
        </div>
      </div>
    )
  }

  if (error && !inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <CardTitle>Invalid Invite</CardTitle>
                <CardDescription>This invite link is not valid</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!inviteInfo) {
    return null
  }

  const { workspace, invite } = inviteInfo

  if (!invite.is_valid) {
    let invalidReason = 'This invite is no longer valid'
    if (invite.is_expired) {
      invalidReason = 'This invite has expired'
    } else if (invite.is_max_uses_reached) {
      invalidReason = 'This invite has reached maximum uses'
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <CardTitle>Invite Expired</CardTitle>
                <CardDescription>{invalidReason}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please contact the workspace owner for a new invite link.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>You've Been Invited!</CardTitle>
              <CardDescription>Join an investigation team</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Workspace Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Workspace</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {workspace.name}
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Invited by</p>
                <p className="font-medium text-gray-900 dark:text-white">{workspace.owner_nickname}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">Your role</p>
                <Badge className={getRoleBadgeColor(invite.default_role)}>
                  {invite.default_role}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>{formatExpiry(invite.expires_at)}</span>
            </div>

            {invite.label && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{invite.label}</Badge>
              </div>
            )}

            {invite.uses_remaining !== null && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {invite.uses_remaining} {invite.uses_remaining === 1 ? 'use' : 'uses'} remaining
              </div>
            )}
          </div>

          {/* Nickname Form */}
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname">Choose Your Display Name</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="e.g., Jane Doe, Analyst_47, Dr. Smith"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={50}
                required
                className="text-base"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This is how team members will see you in this workspace
              </p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1"
                disabled={accepting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={accepting || !nickname.trim()}
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Join Investigation Team
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Security Note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
            <div className="flex gap-2">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-400">
                <p className="font-medium mb-1">Secure Collaboration</p>
                <p className="text-xs">
                  Your account credentials remain private. This workspace-specific nickname
                  is only visible to team members in this investigation.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
