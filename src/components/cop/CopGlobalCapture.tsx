/**
 * CopGlobalCapture -- Command palette overlay for quick evidence/RFI/hypothesis capture.
 *
 * Triggered by Cmd/Ctrl+K or a FAB button. Auto-detects input type:
 *   - URL (http/https) -> submits to POST /api/evidence
 *   - ?prefix -> creates RFI
 *   - !prefix -> creates hypothesis
 *   - @handle -> persona creation suggestion
 *   - Free text -> submits as text evidence note
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  Globe,
  HelpCircle,
  Lightbulb,
  AtSign,
  FileText,
  Loader2,
  X,
  CheckCircle2,
  Database,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

type InputType = 'url' | 'rfi' | 'hypothesis' | 'persona' | 'entity' | 'note'

interface RecentEntry {
  text: string
  type: InputType
  timestamp: number
}

// ── Props ────────────────────────────────────────────────────────

interface CopGlobalCaptureProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onEvidenceAdded?: () => void
  onOpenEntityDrawer?: (tab: string, prefill: Record<string, any>) => void
}

// ── Helpers ──────────────────────────────────────────────────────

function detectInputType(input: string): InputType {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return 'url'
  if (trimmed.startsWith('?')) return 'rfi'
  if (trimmed.startsWith('!')) return 'hypothesis'
  if (/^@[\w.]{1,30}$/.test(trimmed)) return 'persona'
  if (/^\+(actor|event|place|source|behavior)\s/i.test(trimmed)) return 'entity'
  return 'note'
}

const TYPE_META: Record<InputType, { icon: typeof Search; label: string; color: string }> = {
  url:        { icon: Globe,        label: 'URL',        color: 'text-blue-400' },
  rfi:        { icon: HelpCircle,   label: 'RFI',        color: 'text-amber-400' },
  hypothesis: { icon: Lightbulb,    label: 'Hypothesis', color: 'text-emerald-400' },
  persona:    { icon: AtSign,       label: 'Persona',    color: 'text-purple-400' },
  entity:     { icon: Database,      label: 'Entity',     color: 'text-cyan-400' },
  note:       { icon: FileText,     label: 'Note',       color: 'text-gray-400' },
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  actor: 'actors', event: 'events', place: 'places',
  source: 'sources', behavior: 'behaviors',
}

function detectEntityLabel(input: string): string | null {
  const match = input.trim().match(/^\+(actor|event|place|source|behavior)\s/i)
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : null
}

const RECENT_KEY = 'cop_quick_capture_recent'

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    return JSON.parse(raw).slice(0, 3)
  } catch {
    return []
  }
}

function saveRecent(entry: RecentEntry) {
  const list = loadRecent().filter((e) => e.text !== entry.text)
  list.unshift(entry)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 3)))
}

// ── Component ────────────────────────────────────────────────────

export default function CopGlobalCapture({
  sessionId,
  open,
  onOpenChange,
  onEvidenceAdded,
  onOpenEntityDrawer,
}: CopGlobalCaptureProps) {
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent)
  const inputRef = useRef<HTMLInputElement>(null)

  const detectedType = input.trim() ? detectInputType(input) : 'note'
  const entityLabel = detectEntityLabel(input)
  const meta = TYPE_META[detectedType]
  const TypeIcon = meta.icon

  // Focus input on open
  useEffect(() => {
    if (open) {
      setInput('')
      setError(null)
      setSuccess(false)
      // Small delay to ensure the element is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [open])

  // Close on success after delay
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => {
      onOpenChange(false)
      setSuccess(false)
    }, 1200)
    return () => clearTimeout(timer)
  }, [success, onOpenChange])

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    setError(null)

    const type = detectInputType(trimmed)

    // Entity prefixes: +actor, +event, +place, +source, +behavior
    const entityMatch = trimmed.match(/^\+(actor|event|place|source|behavior)\s+(.*)/i)
    if (entityMatch) {
      const entityType = ENTITY_TYPE_MAP[entityMatch[1].toLowerCase()]
      onOpenEntityDrawer?.(entityType, { name: entityMatch[2].trim() })
      onOpenChange(false)
      setInput('')
      setSubmitting(false)
      return
    }

    try {
      let res: Response

      switch (type) {
        case 'url': {
          res = await fetch('/api/content-intelligence/analyze-url', {
            method: 'POST',
            headers: getCopHeaders(),
            body: JSON.stringify({ url: trimmed, workspace_id: sessionId }),
          })
          break
        }
        case 'rfi': {
          const question = trimmed.slice(1).trim()
          if (!question) throw new Error('RFI question cannot be empty')
          res = await fetch(`/api/cop/${sessionId}/rfis`, {
            method: 'POST',
            headers: getCopHeaders(),
            body: JSON.stringify({ question, priority: 'medium' }),
          })
          break
        }
        case 'hypothesis': {
          const statement = trimmed.slice(1).trim()
          if (!statement) throw new Error('Hypothesis statement cannot be empty')
          res = await fetch(`/api/cop/${sessionId}/hypotheses`, {
            method: 'POST',
            headers: getCopHeaders(),
            body: JSON.stringify({ statement }),
          })
          break
        }
        case 'persona': {
          // For persona, just show success -- the parent will handle actual creation
          // We could trigger a persona creation flow here
          setSuccess(true)
          setSubmitting(false)
          return
        }
        case 'note':
        default: {
          res = await fetch('/api/evidence', {
            method: 'POST',
            headers: getCopHeaders(),
            body: JSON.stringify({
              title: trimmed.slice(0, 100),
              description: trimmed,
              type: 'evidence',
              evidence_type: 'digital',
              workspace_id: sessionId,
            }),
          })
          break
        }
      }

      if (!res!.ok) {
        const errData = await res!.json().catch(() => null)
        throw new Error(errData?.error ?? `Request failed (${res!.status})`)
      }

      const entry: RecentEntry = { text: trimmed, type, timestamp: Date.now() }
      saveRecent(entry)
      setRecent(loadRecent())
      setSuccess(true)
      onEvidenceAdded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }, [input, submitting, sessionId, onEvidenceAdded, onOpenEntityDrawer, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    },
    [handleSubmit, onOpenChange],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Capture"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm motion-reduce:backdrop-blur-none"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-2xl mx-4 mt-[20vh]',
          'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl',
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-200',
        )}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={cn('shrink-0', meta.color)}>
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <TypeIcon className="h-5 w-5" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="URL, ?question, !hypothesis, @handle, +actor, or free text..."
            disabled={submitting || success}
            className={cn(
              'flex-1 bg-transparent text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'focus:outline-none disabled:opacity-60',
            )}
            aria-label="Quick capture input"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close quick capture"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type indicator + hint */}
        {input.trim() && !success && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider', meta.color)}>
              {detectedType === 'entity' && entityLabel ? `Create ${entityLabel}` : meta.label}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-500">
              {detectedType === 'url' && 'Will analyze URL and add to evidence feed'}
              {detectedType === 'rfi' && 'Will create a Request for Information'}
              {detectedType === 'hypothesis' && 'Will propose a new hypothesis'}
              {detectedType === 'persona' && 'Will suggest creating a persona'}
              {detectedType === 'entity' && `Will open the entity drawer to create a new ${entityLabel?.toLowerCase() ?? 'entity'}`}
              {detectedType === 'note' && 'Will add as a text evidence note'}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="px-4 pb-3">
            <p className="text-xs text-emerald-400">Submitted successfully.</p>
          </div>
        )}

        {/* Recent submissions */}
        {!input.trim() && recent.length > 0 && !success && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-2 space-y-1">
            <p className="text-[10px] text-gray-500 dark:text-gray-600 uppercase tracking-wider font-medium">Recent</p>
            {recent.map((entry, i) => {
              const entryMeta = TYPE_META[entry.type]
              const EntryIcon = entryMeta.icon
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(entry.text)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <EntryIcon className={cn('h-3.5 w-3.5 shrink-0', entryMeta.color)} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{entry.text}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Keyboard hints */}
        {!success && (
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center gap-4">
            <span className="text-[10px] text-gray-500 dark:text-gray-600">
              <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-mono">Enter</kbd> submit
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-600">
              <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-mono">Esc</kbd> close
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-600">
              <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-mono">+actor</kbd> <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-mono">+event</kbd> <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-mono">+place</kbd> create entity
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
