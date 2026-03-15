/**
 * COP Session List Page
 *
 * Fetches all COP sessions and renders a card grid.
 * "New COP" opens the CopWizard; clicking a card navigates to the active view.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Map,
  Plus,
  Loader2,
  Zap,
  Radio,
  BookOpen,
  AlertTriangle,
  Settings,
  Search,
  Layers,
  Clock,
  MoreVertical,
  Share2,
  Trash2,
  Archive,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { getCopHeaders } from '@/lib/cop-auth'
import CopInviteDialog from '@/components/cop/CopInviteDialog'
import type { CopSession, CopTemplateType, CopStatus } from '@/types/cop'

// ── Template icon mapping ────────────────────────────────────────

const TEMPLATE_ICONS: Record<CopTemplateType, typeof Zap> = {
  quick_brief: Zap,
  event_monitor: Radio,
  area_study: BookOpen,
  crisis_response: AlertTriangle,
  event_analysis: Search,
  custom: Settings,
}

const TEMPLATE_LABELS: Record<CopTemplateType, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
}

// ── Status badge colors ──────────────────────────────────────────

const STATUS_VARIANT: Record<CopStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  ARCHIVED: 'outline',
}

// ── Relative time helper ─────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Component ────────────────────────────────────────────────────

export default function CopListPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<CopSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CopSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [inviteSession, setInviteSession] = useState<CopSession | null>(null)
  // ── Fetch sessions ──────────────────────────────────────────────

  const fetchSessions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cop/sessions', { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)

      const data = await res.json()
      // API may return { sessions: [...] } or an array directly
      const list = Array.isArray(data) ? data : data.sessions ?? []
      setSessions(list)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchSessions(controller.signal)
    return () => controller.abort()
  }, [fetchSessions])

  // ── Delete (archive) session ──────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/cop/sessions/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch((e) => { console.error('[CopListPage] JSON parse error:', e); return {} })
        throw new Error(data.error ?? 'Failed to delete')
      }
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget])

  // ── Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">
          {error}
        </div>
        <Button onClick={() => fetchSessions()} variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="rounded-full bg-muted p-6 mb-6">
          <Map className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Create Your First COP</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Build a Common Operating Picture to overlay entities, events, and external
          data on an interactive map.
        </p>
        <Button onClick={() => navigate('/dashboard/workspace/new')} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Workspace
        </Button>
      </div>
    )
  }

  // ── Session grid ────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operating Pictures</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard/workspace/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((session) => {
          const TemplateIcon = TEMPLATE_ICONS[session.template_type] ?? Settings
          const templateLabel = TEMPLATE_LABELS[session.template_type] ?? 'COP'
          const layerCount = session.active_layers?.length ?? 0

          return (
            <Card
              key={session.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border hover:border-blue-400"
              onClick={() => navigate(`/dashboard/cop/${session.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="rounded-md bg-muted p-1.5 shrink-0">
                      <TemplateIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-sm font-semibold truncate">
                      {session.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={STATUS_VARIANT[session.status] ?? 'secondary'} className="text-[10px]">
                      {session.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setInviteSession(session)}>
                          <Share2 className="h-4 w-4 mr-2" />
                          Share / Invite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteTarget(session)}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive Workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {session.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {session.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TemplateIcon className="h-3 w-3" />
                    {templateLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {layerCount} layer{layerCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {timeAgo(session.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Delete confirmation dialog ──────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive &ldquo;{deleteTarget?.name}&rdquo;? This will hide it from your workspace list. You can contact support to restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Share / Invite dialog ──────────────────────────────── */}
      {inviteSession && (
        <CopInviteDialog
          sessionId={inviteSession.id}
          sessionName={inviteSession.name}
          open={!!inviteSession}
          onOpenChange={(open) => !open && setInviteSession(null)}
        />
      )}
    </div>
  )
}
