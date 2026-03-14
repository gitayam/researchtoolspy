/**
 * CopTimelinePanel — Interactive investigative timeline with manual entry + URL extraction
 *
 * Allows analysts to add timeline events manually or extract them from URLs via AI.
 * Displays events chronologically with category badges and importance indicators.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Clock,
  Loader2,
  Calendar,
  LinkIcon,
  MessageSquareText,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Star,
  Zap,
  Shield,
  FileText,
  MapPin,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

interface TimelineEvent {
  id?: string
  event_date: string
  title: string
  description?: string | null
  category?: string
  source_type?: string
  source_url?: string | null
  source_title?: string | null
  importance?: string
  entity_type?: string | null
  entity_id?: string | null
  action?: string | null
}

interface CopTimelinePanelProps {
  sessionId: string
  expanded: boolean
  onScrollToPanel?: (panelId: string, entityId: string) => void
}

// ── Constants ────────────────────────────────────────────────────

const CATEGORIES = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political']
const IMPORTANCE_LEVELS = ['low', 'normal', 'high', 'critical']

// ── Helpers ──────────────────────────────────────────────────────

function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}/i.test(trimmed)) return true
  return false
}

function getCategoryColor(category: string | undefined) {
  switch (category?.toLowerCase()) {
    case 'meeting': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'communication': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'financial': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'legal': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'travel': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    case 'publication': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
    case 'military': return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
    case 'political': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

function getImportanceIndicator(importance: string | undefined) {
  switch (importance) {
    case 'critical': return { icon: Zap, color: 'text-red-500' }
    case 'high': return { icon: Star, color: 'text-amber-500' }
    case 'low': return { icon: null, color: 'text-slate-400' }
    default: return { icon: null, color: '' }
  }
}

function formatEventDate(dateStr: string): string {
  // Handle partial dates (YYYY, YYYY-MM)
  if (/^\d{4}$/.test(dateStr)) return dateStr
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + '-01')
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getEntityIcon(entityType: string | null | undefined) {
  switch (entityType) {
    case 'claim': return Shield
    case 'evidence': return FileText
    case 'marker': return MapPin
    case 'hypothesis': return Lightbulb
    default: return Clock
  }
}

// ── Component ────────────────────────────────────────────────────

export default function CopTimelinePanel({ sessionId, expanded, onScrollToPanel }: CopTimelinePanelProps) {
  const [input, setInput] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<TimelineEvent[]>([])
  const [showDateInput, setShowDateInput] = useState(false)
  const [extractedPreview, setExtractedPreview] = useState<{ events: TimelineEvent[]; url: string; title: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'events' | 'activity' | 'all'>('events')
  const [pendingClassification, setPendingClassification] = useState<{
    text: string
    category: string
    importance: string
    eventDate: string
  } | null>(null)
  const [classifying, setClassifying] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const isUrl = looksLikeUrl(input)

  // Load persisted timeline entries on mount
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/cop/${sessionId}/timeline`, { headers: getCopHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.entries?.length) {
          const mapped = data.entries.map((e: any) => ({
            id: e.id,
            event_date: e.event_date,
            title: e.title,
            description: e.description,
            category: e.category,
            source_type: e.source_type,
            source_url: e.source_url,
            source_title: e.source_title,
            importance: e.importance,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
            action: e.action,
          }))
          setEntries(mapped)
          // Default to "all" if no manual events exist (only system entries)
          if (mapped.every((e: TimelineEvent) => e.source_type === 'system')) {
            setActiveTab('all')
          }
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false))
  }, [sessionId])

  // ── Filtered entries + tab counts ─────────────────────────────

  const filteredEntries = useMemo(() => {
    if (activeTab === 'events') return entries.filter(e => e.source_type !== 'system')
    if (activeTab === 'activity') return entries.filter(e => e.source_type === 'system')
    return entries
  }, [entries, activeTab])

  const tabCounts = useMemo(() => ({
    all: entries.length,
    events: entries.filter(e => e.source_type !== 'system').length,
    activity: entries.filter(e => e.source_type === 'system').length,
  }), [entries])

  // ── Manual entry ────────────────────────────────────────────────

  const handleManualEntry = useCallback(async (text: string) => {
    if (pendingClassification) {
      setLoading(true)
      setError(null)
      try {
        const entry = {
          title: pendingClassification.text,
          event_date: pendingClassification.eventDate,
          category: pendingClassification.category,
          importance: pendingClassification.importance,
          source_type: 'manual',
        }
        const res = await fetch(`/api/cop/${sessionId}/timeline`, {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({ entries: [entry] }),
        })
        if (!res.ok) throw new Error('Failed to save timeline entry')
        const data = await res.json()
        setEntries(prev => [...prev, { ...entry, id: data.ids?.[0] }]
          .sort((a, b) => a.event_date.localeCompare(b.event_date)))
        setPendingClassification(null)
        setInput('')
        setEventDate('')
        setShowDateInput(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save entry')
      } finally {
        setLoading(false)
      }
      return
    }

    setClassifying(true)
    setError(null)
    const fallback = { category: 'event', importance: 'normal', event_date_hint: null }
    let classification = fallback
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      const res = await fetch('/api/tools/classify-timeline-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: new Date().toISOString().slice(0, 10) }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) classification = await res.json()
    } catch { /* timeout or network error — use fallback */ }

    setPendingClassification({
      text,
      category: classification.category || 'event',
      importance: classification.importance || 'normal',
      eventDate: classification.event_date_hint || eventDate || new Date().toISOString().slice(0, 10),
    })
    setClassifying(false)
  }, [sessionId, eventDate, pendingClassification])

  // ── URL extraction ──────────────────────────────────────────────

  const handleExtractFromUrl = useCallback(async (rawUrl: string) => {
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

    try { new URL(fullUrl) } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tools/extract-timeline', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ url: fullUrl }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.details || errData.error || `Failed to extract timeline (${res.status})`)
      }

      const data = await res.json()

      if (!data.events?.length) {
        setError('No datable events found in this article')
        return
      }

      // Show preview so user can confirm before saving
      setExtractedPreview({
        events: data.events.map((e: any) => ({
          ...e,
          source_type: 'url_extract',
          source_url: rawUrl,
          source_title: data.title,
        })),
        url: rawUrl,
        title: data.title || rawUrl,
      })
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract timeline')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Save extracted events ───────────────────────────────────────

  const handleSaveExtracted = useCallback(async () => {
    if (!extractedPreview) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/cop/${sessionId}/timeline`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ entries: extractedPreview.events }),
      })

      if (!res.ok) throw new Error('Failed to save extracted events')
      const data = await res.json()

      const savedEntries = extractedPreview.events.map((e, i) => ({
        ...e,
        id: data.ids?.[i],
      }))

      setEntries(prev => [...prev, ...savedEntries]
        .sort((a, b) => a.event_date.localeCompare(b.event_date)))
      setExtractedPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save events')
    } finally {
      setLoading(false)
    }
  }, [sessionId, extractedPreview])

  // ── Delete entry ────────────────────────────────────────────────

  const handleDelete = useCallback(async (entryId: string) => {
    try {
      await fetch(`/api/cop/${sessionId}/timeline?entry_id=${entryId}`, {
        method: 'DELETE',
        headers: getCopHeaders(),
      })
      setEntries(prev => prev.filter(e => e.id !== entryId))
    } catch {
      // Non-fatal
    }
  }, [sessionId])

  // ── Inline update ─────────────────────────────────────────────

  const handleInlineUpdate = useCallback(async (entryId: string, field: string, value: string) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/timeline`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ entry_id: entryId, [field]: value }),
      })
      if (!res.ok) return
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: value } : e))
    } catch { /* non-fatal */ }
  }, [sessionId])

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (pendingClassification) {
      handleManualEntry(pendingClassification.text)
      return
    }
    if (!trimmed) return
    if (isUrl) {
      handleExtractFromUrl(trimmed)
    } else {
      handleManualEntry(trimmed)
    }
  }, [input, isUrl, pendingClassification, handleExtractFromUrl, handleManualEntry])

  // ── Category summary ────────────────────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      const cat = e.category || 'event'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [entries])

  // ── Render ──────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Input bar */}
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {isUrl ? (
              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            ) : (
              <MessageSquareText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null); if (pendingClassification) setPendingClassification(null) }}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
              placeholder="Add event or paste URL to extract timeline..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          {!isUrl && (
            <button
              type="button"
              onClick={() => setShowDateInput(!showDateInput)}
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-md border transition-colors cursor-pointer',
                showDateInput
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
              )}
              title="Set event date"
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || classifying || (!input.trim() && !pendingClassification)}
            className="h-8 text-xs px-3 cursor-pointer"
          >
            {loading || classifying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isUrl ? (
              'Extract'
            ) : pendingClassification ? (
              'Confirm'
            ) : (
              'Add'
            )}
          </Button>
        </div>

        {/* Date picker row (for manual entry) */}
        {showDateInput && !isUrl && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Date:</span>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="h-7 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {!eventDate && (
              <span className="text-[10px] text-slate-400">(defaults to today)</span>
            )}
          </div>
        )}

        {error && (
          <p className="text-[10px] text-red-500 dark:text-red-400">{error}</p>
        )}

        {/* AI classification chips */}
        {pendingClassification && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500">Classified:</span>
            <button
              type="button"
              onClick={() => setPendingClassification(prev => prev ? {
                ...prev,
                category: CATEGORIES[(CATEGORIES.indexOf(prev.category) + 1) % CATEGORIES.length]
              } : null)}
              className={cn('px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition-colors', getCategoryColor(pendingClassification.category))}
            >
              {pendingClassification.category}
            </button>
            <button
              type="button"
              onClick={() => setPendingClassification(prev => prev ? {
                ...prev,
                importance: IMPORTANCE_LEVELS[(IMPORTANCE_LEVELS.indexOf(prev.importance) + 1) % IMPORTANCE_LEVELS.length]
              } : null)}
              className={cn('px-1.5 py-0.5 text-[10px] rounded-full cursor-pointer transition-colors',
                pendingClassification.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                pendingClassification.importance === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                pendingClassification.importance === 'low' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {pendingClassification.importance}
            </button>
            <button
              type="button"
              onClick={() => {
                const newDate = prompt('Event date (YYYY-MM-DD):', pendingClassification.eventDate)
                if (newDate) setPendingClassification(prev => prev ? { ...prev, eventDate: newDate } : null)
              }}
              className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer font-mono"
            >
              {pendingClassification.eventDate}
            </button>
            <Button
              size="sm"
              onClick={() => handleManualEntry(pendingClassification.text)}
              className="h-5 text-[10px] px-2 cursor-pointer ml-auto"
            >
              Confirm
            </Button>
            <button
              type="button"
              onClick={() => setPendingClassification(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {entries.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
          {(['events', 'activity', 'all'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded-full transition-colors cursor-pointer',
                activeTab === tab
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
            </button>
          ))}
        </div>
      )}

      {/* Extracted preview — confirm before saving */}
      {extractedPreview && (
        <div className="px-3 py-2 border-b border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              Found {extractedPreview.events.length} events from {extractedPreview.title}
            </p>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExtractedPreview(null)}
                className="h-6 text-[10px] px-2 cursor-pointer"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSaveExtracted}
                disabled={loading}
                className="h-6 text-[10px] px-2 cursor-pointer"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save all'}
              </Button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {extractedPreview.events.map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px]">
                <span className="text-indigo-500 dark:text-indigo-400 shrink-0 font-mono">{ev.event_date}</span>
                <span className="text-slate-700 dark:text-slate-300">{ev.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline entries list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Clock className="h-6 w-6 text-slate-400 dark:text-slate-600" />
            <p className="text-xs text-slate-500">
              {activeTab === 'activity' ? 'No investigation activity recorded yet' : 'No timeline events yet'}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[220px]">
              Add events manually or paste a URL to extract a timeline from articles and reports.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Summary badges */}
            <div className="flex items-center gap-1.5 pb-2 flex-wrap">
              <Badge variant="outline" className="gap-1 text-[9px] px-1.5 py-0">
                {entries.length} event{entries.length !== 1 ? 's' : ''}
              </Badge>
              {Object.entries(categoryCounts).slice(0, 4).map(([cat, count]) => (
                <Badge key={cat} className={cn('text-[9px] px-1.5 py-0 border-transparent', getCategoryColor(cat))}>
                  {count} {cat}
                </Badge>
              ))}
            </div>

            {/* Event list with timeline line */}
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[52px] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

              {filteredEntries.map((entry, i) => {
                const imp = getImportanceIndicator(entry.importance)
                const ImpIcon = imp.icon
                const showDate = i === 0 || filteredEntries[i - 1].event_date !== entry.event_date

                return (
                  <div key={entry.id || i} className={cn(
                    'relative flex items-start gap-2 py-1.5 group',
                    entry.source_type === 'system' && 'opacity-75'
                  )}>
                    {/* Date column */}
                    <div className="w-[48px] shrink-0 text-right">
                      {showDate && (
                        entry.source_type !== 'system' && entry.id ? (
                          <input
                            type="date"
                            value={entry.event_date}
                            onChange={(e) => {
                              if (e.target.value) handleInlineUpdate(entry.id!, 'event_date', e.target.value)
                            }}
                            className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-transparent border-none outline-none w-full text-right cursor-pointer"
                          />
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
                            {formatEventDate(entry.event_date)}
                          </span>
                        )
                      )}
                    </div>

                    {/* Dot on the line */}
                    <div className={cn(
                      'relative z-10 mt-1 w-2 h-2 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900',
                      entry.importance === 'critical' ? 'bg-red-500' :
                      entry.importance === 'high' ? 'bg-amber-500' :
                      'bg-slate-400 dark:bg-slate-500'
                    )} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title area */}
                      <div className="flex items-start gap-1">
                        {entry.source_type !== 'system' && entry.id ? (
                          editingId === entry.id ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => {
                                if (editingTitle.trim() && editingTitle !== entry.title) {
                                  handleInlineUpdate(entry.id!, 'title', editingTitle.trim())
                                }
                                setEditingId(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              autoFocus
                              className="text-xs text-slate-700 dark:text-slate-200 bg-transparent border-b border-indigo-500 outline-none flex-1"
                            />
                          ) : (
                            <p
                              className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed flex-1 cursor-text"
                              onDoubleClick={() => { setEditingId(entry.id!); setEditingTitle(entry.title) }}
                              title="Double-click to edit"
                            >
                              {entry.title}
                            </p>
                          )
                        ) : (
                          <p className={cn(
                            'leading-relaxed flex-1',
                            entry.source_type === 'system' ? 'text-[11px] text-slate-500 dark:text-slate-400' : 'text-xs text-slate-700 dark:text-slate-200'
                          )}>
                            {entry.source_type === 'system' && (() => {
                              const EntityIcon = getEntityIcon(entry.entity_type)
                              return <EntityIcon className="inline h-3 w-3 mr-1 text-slate-400" />
                            })()}
                            {entry.source_type === 'system' && entry.entity_id && onScrollToPanel ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const panelMap: Record<string, string> = { claim: 'claims', evidence: 'evidence', hypothesis: 'analysis', marker: 'map' }
                                  const panelId = panelMap[entry.entity_type || ''] || 'claims'
                                  onScrollToPanel(panelId, entry.entity_id!)
                                }}
                                className="text-blue-500 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                {entry.title}
                              </button>
                            ) : (
                              <span>{entry.title}</span>
                            )}
                          </p>
                        )}
                        {ImpIcon && <ImpIcon className={cn('h-3 w-3 shrink-0 mt-0.5', imp.color)} />}
                        {entry.id && entry.source_type !== 'system' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id!)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
                          </button>
                        )}
                      </div>

                      {/* Description (if expanded panel) */}
                      {expanded && entry.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {entry.description}
                        </p>
                      )}

                      {/* Meta badges */}
                      <div className="flex items-center gap-1 mt-0.5">
                        {entry.category && entry.category !== 'event' && (
                          entry.source_type !== 'system' && entry.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                const next = CATEGORIES[(CATEGORIES.indexOf(entry.category || 'event') + 1) % CATEGORIES.length]
                                handleInlineUpdate(entry.id!, 'category', next)
                              }}
                              className={cn('text-[8px] px-1 py-0 leading-3 rounded cursor-pointer transition-colors', getCategoryColor(entry.category))}
                            >
                              {entry.category}
                            </button>
                          ) : (
                            <Badge className={cn('text-[8px] px-1 py-0 leading-3 border-transparent', getCategoryColor(entry.category))}>
                              {entry.category}
                            </Badge>
                          )
                        )}
                        {entry.importance && entry.importance !== 'normal' && entry.source_type !== 'system' && entry.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              const next = IMPORTANCE_LEVELS[(IMPORTANCE_LEVELS.indexOf(entry.importance || 'normal') + 1) % IMPORTANCE_LEVELS.length]
                              handleInlineUpdate(entry.id!, 'importance', next)
                            }}
                            className={cn('text-[8px] px-1 py-0 leading-3 rounded cursor-pointer transition-colors',
                              entry.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              entry.importance === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            )}
                          >
                            {entry.importance}
                          </button>
                        ) : entry.importance && entry.importance !== 'normal' ? (
                          <Badge className={cn('text-[8px] px-1 py-0 leading-3 border-transparent',
                            entry.importance === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            entry.importance === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}>
                            {entry.importance}
                          </Badge>
                        ) : null}
                        {entry.source_url && (
                          <a
                            href={entry.source_url.startsWith('http') ? entry.source_url : `https://${entry.source_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[8px] text-blue-500 dark:text-blue-400 hover:text-blue-600"
                            title={entry.source_title || entry.source_url}
                          >
                            <ExternalLink className="h-2 w-2" />
                            source
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
