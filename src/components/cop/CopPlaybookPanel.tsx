import { useState, useEffect, useCallback, useRef } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  Plus,
  Loader2,
  Play,
  Pause,
  FileText,
  Zap,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

type PlaybookStatus = 'active' | 'paused' | 'draft'

interface Playbook {
  id: string
  name: string
  description: string | null
  status: PlaybookStatus
  execution_count: number
  last_triggered_at: string | null
  rule_count: number
  created_at: string
  updated_at: string
}

interface CopPlaybookPanelProps {
  sessionId: string
  onEditPlaybook?: (playbookId: string) => void
  onViewLog?: (playbookId: string) => void
}

// ── Constants ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PlaybookStatus, { label: string; color: string; bg: string }> = {
  active:  { label: 'Active',  color: 'text-green-400',  bg: 'bg-green-500/20 border-green-500/30' },
  paused:  { label: 'Paused',  color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  draft:   { label: 'Draft',   color: 'text-gray-400',   bg: 'bg-gray-500/20 border-gray-500/30' },
}

// ── Component ─────────────────────────────────────────────────────

export default function CopPlaybookPanel({ sessionId, onEditPlaybook, onViewLog }: CopPlaybookPanelProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch ──────────────────────────────────────────────────

  const fetchPlaybooks = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error('Failed to fetch playbooks')
      const data = await res.json()
      setPlaybooks(data.playbooks ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[CopPlaybookPanel] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    const controller = new AbortController()
    fetchPlaybooks(controller.signal)
    intervalRef.current = setInterval(() => fetchPlaybooks(controller.signal), 30000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchPlaybooks])

  // ── Create ─────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ name: trimmed, description: newDescription.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to create playbook')
      setNewName('')
      setNewDescription('')
      setShowForm(false)
      await fetchPlaybooks()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [newName, newDescription, sessionId, fetchPlaybooks])

  // ── Status toggle ──────────────────────────────────────────

  const handleToggleStatus = useCallback(async (pb: Playbook) => {
    const nextStatus: PlaybookStatus = pb.status === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/${pb.id}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to toggle status')
      await fetchPlaybooks()
    } catch {
      // ignore
    }
  }, [sessionId, fetchPlaybooks])

  // ── Delete ─────────────────────────────────────────────────

  const handleDelete = useCallback(async (pbId: string) => {
    if (!confirm('Delete this playbook and all its rules?')) return
    try {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/${pbId}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      if (!res.ok) throw new Error('Failed to delete playbook')
      await fetchPlaybooks()
    } catch {
      // ignore
    }
  }, [sessionId, fetchPlaybooks])

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading playbooks...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          {playbooks.length} playbook{playbooks.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Playbook
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Playbook name..."
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <textarea
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting || !newName.trim()}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white transition-colors"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(''); setNewDescription('') }}
              className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Playbook list */}
      {playbooks.length === 0 && !showForm ? (
        <div className="text-center py-6 text-zinc-500 text-sm">
          No playbooks yet. Create one to automate COP workflows.
        </div>
      ) : (
        <div className="space-y-2">
          {playbooks.map(pb => {
            const config = STATUS_CONFIG[pb.status]
            const isExpanded = expandedId === pb.id

            return (
              <div
                key={pb.id}
                className="bg-zinc-800/30 border border-zinc-700/40 rounded-lg overflow-hidden"
              >
                {/* Playbook header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : pb.id)}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </button>

                  <Zap className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-zinc-200 font-medium truncate flex-1" title={pb.name}>
                    {pb.name}
                  </span>

                  {/* Status badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>

                  {/* Toggle active/paused */}
                  {pb.status !== 'draft' && (
                    <button
                      onClick={() => handleToggleStatus(pb)}
                      title={pb.status === 'active' ? 'Pause playbook' : 'Activate playbook'}
                      className="text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      {pb.status === 'active'
                        ? <Pause className="h-3.5 w-3.5" />
                        : <Play className="h-3.5 w-3.5" />
                      }
                    </button>
                  )}

                  {pb.status === 'draft' && (
                    <button
                      onClick={() => handleToggleStatus(pb)}
                      title="Activate playbook"
                      className="text-zinc-400 hover:text-green-400 transition-colors"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 px-3 pb-2 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {pb.rule_count} rule{pb.rule_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {pb.execution_count} run{pb.execution_count !== 1 ? 's' : ''}
                  </span>
                  {pb.last_triggered_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(pb.last_triggered_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="border-t border-zinc-700/30 px-3 py-2 flex items-center gap-2">
                    {onEditPlaybook && (
                      <button
                        onClick={() => onEditPlaybook(pb.id)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Edit Rules
                      </button>
                    )}
                    {onViewLog && (
                      <button
                        onClick={() => onViewLog(pb.id)}
                        className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        View Log
                      </button>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDelete(pb.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
