import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Copy, Trash2, Loader2, Check, Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ──────────────────────────────────────────────────────

interface Collaborator {
  id: string
  email?: string
  user_id?: string
  role: 'viewer' | 'editor'
  invite_token?: string
  created_at: string
}

type InviteRole = 'viewer' | 'editor'

// ── Auth helper ────────────────────────────────────────────────


// ── Props ──────────────────────────────────────────────────────

interface CopInviteDialogProps {
  sessionId: string
  sessionName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Component ──────────────────────────────────────────────────

export default function CopInviteDialog({
  sessionId,
  sessionName,
  open,
  onOpenChange,
}: CopInviteDialogProps) {
  // Collaborator list
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  // Invite form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Share link
  const [shareLink, setShareLink] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Removal
  const [removingId, setRemovingId] = useState<string | null>(null)

  // ── Fetch collaborators ────────────────────────────────────

  const fetchCollaborators = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setFetchError(false)
    try {
      const res = await fetch(`/api/cop/${sessionId}/collaborators`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error('Failed to fetch collaborators')
      const data = await res.json()
      setCollaborators(data.collaborators ?? [])
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // Fetch when dialog opens
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetchCollaborators(controller.signal)
    setShareLink('')
    setLinkCopied(false)
    setInviteError('')
    return () => controller.abort()
  }, [open, fetchCollaborators])

  // ── Invite by email ────────────────────────────────────────

  const handleInvite = useCallback(async () => {
    const trimmed = email.trim()
    if (!trimmed) return

    setInviting(true)
    setInviteError('')
    try {
      const res = await fetch(`/api/cop/${sessionId}/collaborators`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ email: trimmed, role }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error ?? 'Failed to send invite')
      }
      setEmail('')
      setRole('viewer')
      await fetchCollaborators()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }, [email, role, sessionId, fetchCollaborators])

  // ── Generate share link ────────────────────────────────────

  const handleGenerateLink = useCallback(async () => {
    setGeneratingLink(true)
    setLinkCopied(false)
    try {
      const res = await fetch(`/api/cop/${sessionId}/collaborators`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ role: 'viewer' }),
      })
      if (!res.ok) throw new Error('Failed to generate link')
      const data = await res.json()
      const token = data.invite_link ?? data.collaborator?.invite_token ?? ''
      if (token) {
        setShareLink(`${window.location.origin}/dashboard/cop/${sessionId}?invite=${token}`)
      }
      await fetchCollaborators()
    } catch {
      // ignore
    } finally {
      setGeneratingLink(false)
    }
  }, [sessionId, fetchCollaborators])

  // ── Copy link ──────────────────────────────────────────────

  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // fallback
    }
  }, [shareLink])

  // ── Remove collaborator ────────────────────────────────────

  const handleRemove = useCallback(
    async (collaboratorId: string) => {
      setRemovingId(collaboratorId)
      try {
        const res = await fetch(`/api/cop/${sessionId}/collaborators`, {
          method: 'DELETE',
          headers: getCopHeaders(),
          body: JSON.stringify({ collaborator_id: collaboratorId }),
        })
        if (!res.ok) throw new Error('Failed to remove collaborator')
        await fetchCollaborators()
      } catch {
        // ignore
      } finally {
        setRemovingId(null)
      }
    },
    [sessionId, fetchCollaborators]
  )

  // ── Render ─────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            Invite to {sessionName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Add collaborators or generate a share link
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Invite by email ──────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Invite by Email
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  className="w-full rounded border border-gray-700 bg-gray-800 pl-8 pr-2 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInvite()
                  }}
                />
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button
                size="sm"
                onClick={handleInvite}
                disabled={inviting || !email.trim()}
                className="h-8 px-3 text-xs"
              >
                {inviting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Invite
                  </>
                )}
              </Button>
            </div>
            {inviteError && (
              <p className="text-xs text-red-400">{inviteError}</p>
            )}
          </div>

          {/* ── Share link ───────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Share Link
            </label>
            {shareLink ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-300 truncate focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-8 px-2 border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  {linkCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="h-8 text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                {generatingLink ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                )}
                Generate Share Link
              </Button>
            )}
          </div>

          {/* ── Current collaborators ────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Collaborators
            </label>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
                <span className="text-xs text-gray-500">Loading...</span>
              </div>
            ) : fetchError ? (
              <div className="text-center py-3">
                <p className="text-xs text-gray-500 mb-1">Failed to load collaborators.</p>
                <button
                  type="button"
                  onClick={() => fetchCollaborators()}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : collaborators.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {collaborators.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/40 px-2.5 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 truncate">
                        {c.email ?? c.user_id ?? 'Link invite'}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Invited {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className="text-[10px] px-1.5 py-0 leading-4 shrink-0"
                      style={{
                        backgroundColor: c.role === 'editor' ? '#3b82f6' : '#6b7280',
                        borderColor: c.role === 'editor' ? '#3b82f6' : '#6b7280',
                        color: '#fff',
                      }}
                    >
                      {c.role}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleRemove(c.id)}
                      disabled={removingId === c.id}
                      className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50"
                      title="Remove collaborator"
                    >
                      {removingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic py-2">
                No collaborators yet. Invite someone above.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
