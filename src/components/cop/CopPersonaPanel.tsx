/**
 * CopPersonaPanel -- Card grid for tracking digital identities / personas.
 *
 * Renders inside a CopPanelExpander. Shows persona cards with platform icons,
 * handle, status badge, and link count. Inline add form and click-to-expand detail.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Hash,
  Send,
  MessageCircle,
  Camera,
  Music2,
  Globe,
  User,
  Link2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Local types (TODO: import from @/types/cop when backend merges types) ─

interface CopPersona {
  id: string
  cop_session_id: string
  display_name: string
  platform: string
  handle: string | null
  profile_url: string | null
  status: 'active' | 'suspended' | 'deleted' | 'unknown'
  linked_actor_id: string | null
  notes: string | null
  link_count?: number
  created_at: string
  updated_at: string
}

type CopPersonaPlatform = 'twitter' | 'telegram' | 'reddit' | 'onlyfans' | 'instagram' | 'tiktok' | 'other'

// ── Helpers ──────────────────────────────────────────────────────


const PLATFORM_OPTIONS: { value: CopPersonaPlatform; label: string }[] = [
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'onlyfans', label: 'OnlyFans' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Other' },
]

const PLATFORM_ICONS: Record<string, typeof Hash> = {
  twitter: Hash,
  telegram: Send,
  reddit: MessageCircle,
  onlyfans: Camera,
  instagram: Camera,
  tiktok: Music2,
  other: Globe,
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  suspended: 'bg-amber-500',
  deleted: 'bg-red-500',
  unknown: 'bg-gray-500',
}

const STATUS_TEXT_COLORS: Record<string, string> = {
  active: 'text-green-400',
  suspended: 'text-amber-400',
  deleted: 'text-red-400',
  unknown: 'text-gray-400',
}

// ── Props ────────────────────────────────────────────────────────

interface CopPersonaPanelProps {
  sessionId: string
  expanded: boolean
  onPromoteToActor?: (persona: CopPersona) => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopPersonaPanel({ sessionId, expanded, onPromoteToActor }: CopPersonaPanelProps) {
  const [personas, setPersonas] = useState<CopPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formPlatform, setFormPlatform] = useState<CopPersonaPlatform>('twitter')
  const [formHandle, setFormHandle] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch personas ──────────────────────────────────────────

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/personas`, { headers: getCopHeaders() })
      if (!res.ok) {
        setPersonas([])
        return
      }
      const data = await res.json()
      setPersonas(data.personas ?? data ?? [])
    } catch {
      // Silent failure
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchPersonas()
  }, [fetchPersonas])

  // ── Create persona ──────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const name = formName.trim()
    if (!name) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/personas`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          display_name: name,
          platform: formPlatform,
          handle: formHandle.trim().replace(/^@/, '') || null,
          notes: formNotes.trim() || null,
          status: 'active',
        }),
      })
      if (!res.ok) throw new Error('Failed to create persona')
      setFormName('')
      setFormHandle('')
      setFormNotes('')
      setShowForm(false)
      await fetchPersonas()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [formName, formPlatform, formHandle, formNotes, sessionId, fetchPersonas])

  // ── Render ──────────────────────────────────────────────────

  const visiblePersonas = expanded ? personas : personas.slice(0, 6)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">Actors</h2>
          {personas.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
              {personas.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
          className="h-6 text-[10px] px-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
        >
          <Plus className="h-3 w-3 mr-0.5" />
          Add Actor
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Inline add form */}
        {showForm && (
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Display name"
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                autoFocus
              />
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value as CopPersonaPlatform)}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={formHandle}
              onChange={(e) => setFormHandle(e.target.value)}
              placeholder="@handle (without @)"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="h-6 text-[10px] cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={submitting || !formName.trim()}
                className="h-6 text-[10px] px-2 bg-purple-600 hover:bg-purple-700 cursor-pointer"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
              </Button>
            </div>
          </div>
        )}

        {/* Card grid */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
          </div>
        ) : visiblePersonas.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {visiblePersonas.map((persona) => {
              const isOpen = expandedId === persona.id
              const PlatformIcon = PLATFORM_ICONS[persona.platform] ?? Globe

              return (
                <div
                  key={persona.id}
                  className={cn(
                    'rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 overflow-hidden',
                    'transition-colors duration-200',
                    isOpen && 'col-span-full border-purple-500/30',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : persona.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-500"
                  >
                    {/* Platform icon */}
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700/50 flex items-center justify-center shrink-0">
                      <PlatformIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-200 truncate">
                          {persona.display_name}
                        </span>
                        {/* Status dot */}
                        <span
                          className={cn(
                            'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                            STATUS_COLORS[persona.status] ?? 'bg-gray-500',
                          )}
                          title={persona.status}
                        />
                      </div>
                      {persona.handle && (
                        <span className="text-[10px] text-gray-500 truncate block">
                          @{persona.handle}
                        </span>
                      )}
                    </div>

                    {/* Link count */}
                    {(persona.link_count ?? 0) > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Link2 className="h-3 w-3 text-gray-500" />
                        <span className="text-[10px] text-gray-500">{persona.link_count}</span>
                      </div>
                    )}

                    <div className="shrink-0">
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] px-1.5 py-0',
                            STATUS_TEXT_COLORS[persona.status] ?? 'text-gray-400',
                          )}
                        >
                          {persona.status}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-gray-400">
                          {persona.platform}
                        </Badge>
                      </div>
                      {persona.profile_url && (
                        <a
                          href={persona.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 hover:text-blue-300 truncate block"
                        >
                          {persona.profile_url}
                        </a>
                      )}
                      {persona.notes && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-400">{persona.notes}</p>
                      )}
                      {/* Promote to Actor */}
                      {!persona.linked_actor_id && onPromoteToActor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onPromoteToActor(persona)
                          }}
                          className="text-xs text-blue-500 hover:text-blue-400 cursor-pointer transition-colors mt-2"
                        >
                          Promote to Actor
                        </button>
                      )}
                      {persona.linked_actor_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700 rounded px-1.5 py-0.5 mt-2">
                          Linked to Actor
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <User className="h-6 w-6 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">No actors tracked yet.</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
              Add actors to track research targets across platforms.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
