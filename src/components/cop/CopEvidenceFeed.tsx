import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Globe, Users, Brain, Link, ExternalLink, Loader2, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────

interface FeedItem {
  id: string
  type: 'evidence' | 'analysis' | 'entity' | 'framework' | 'url'
  evidence_type?: string
  title: string
  description?: string
  url?: string
  created_at: string
  entities?: Array<{ name: string } | string>
}

// ── Props ────────────────────────────────────────────────────────

interface CopEvidenceFeedProps {
  sessionId: string
  expanded: boolean
  monitorMode?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (isNaN(then)) return ''
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

const TYPE_CONFIG: Record<FeedItem['type'], { icon: typeof FileText; color: string; darkColor: string }> = {
  evidence:  { icon: FileText, color: 'bg-blue-100 text-blue-700',     darkColor: 'dark:bg-blue-900/40 dark:text-blue-300' },
  analysis:  { icon: Globe,    color: 'bg-purple-100 text-purple-700', darkColor: 'dark:bg-purple-900/40 dark:text-purple-300' },
  entity:    { icon: Users,    color: 'bg-emerald-100 text-emerald-700', darkColor: 'dark:bg-emerald-900/40 dark:text-emerald-300' },
  framework: { icon: Brain,    color: 'bg-amber-100 text-amber-700',   darkColor: 'dark:bg-amber-900/40 dark:text-amber-300' },
  url:       { icon: Link,     color: 'bg-gray-100 text-gray-700',     darkColor: 'dark:bg-gray-800 dark:text-gray-300' },
}

// ── Component ────────────────────────────────────────────────────

export default function CopEvidenceFeed({ sessionId, expanded, monitorMode = false }: CopEvidenceFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [newItemCount, setNewItemCount] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevItemCountRef = useRef(0)

  // ── Fetch evidence ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function fetchEvidence() {
      setLoading(true)
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const userHash = localStorage.getItem('omnicore_user_hash')
        if (userHash) headers['Authorization'] = `Bearer ${userHash}`

        const res = await fetch('/api/evidence', { headers })
        if (!res.ok) throw new Error(`Failed to fetch evidence (${res.status})`)

        const data = await res.json()
        const list: FeedItem[] = (Array.isArray(data) ? data : data.evidence ?? data.items ?? []).map(
          (e: any) => ({
            id: e.id ?? crypto.randomUUID(),
            type: e.type ?? 'evidence',
            evidence_type: e.evidence_type ?? undefined,
            title: e.title ?? e.name ?? 'Untitled',
            description: e.description ?? e.summary ?? undefined,
            url: e.url ?? e.source_url ?? undefined,
            created_at: e.created_at ?? e.created ?? new Date().toISOString(),
            entities: e.entities ?? undefined,
          })
        )

        if (!cancelled) {
          list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          setItems(list)
        }
      } catch (err) {
        console.error('[CopEvidenceFeed] fetch error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEvidence()
    return () => { cancelled = true }
  }, [sessionId])

  // Polling in monitor mode
  useEffect(() => {
    if (!monitorMode) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    pollingRef.current = setInterval(async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const userHash = localStorage.getItem('omnicore_user_hash')
        if (userHash) headers['X-User-Hash'] = userHash

        const res = await fetch(`/api/evidence?workspace_id=${sessionId}&limit=50`, { headers })
        if (!res.ok) return
        const data = await res.json()
        const newItems: FeedItem[] = (data.evidence ?? data.items ?? []).map((e: any) => ({
          id: e.id,
          type: 'evidence' as const,
          evidence_type: e.evidence_type ?? e.type,
          title: e.title ?? e.name ?? 'Untitled',
          description: e.description ?? e.content?.substring(0, 200),
          url: e.source_url ?? e.url,
          created_at: e.created_at ?? new Date().toISOString(),
          entities: e.entities,
        }))

        // Check for new items
        const currentCount = newItems.length
        if (currentCount > prevItemCountRef.current && prevItemCountRef.current > 0) {
          setNewItemCount(currentCount - prevItemCountRef.current)
        }
        prevItemCountRef.current = currentCount

        // Update items (this is a full refresh, not incremental)
        // We use a setter function to avoid stale closures
        setItems(newItems)
      } catch {
        // Silent failure on polling
      }
    }, 30000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [monitorMode, sessionId])

  // ── URL analysis ────────────────────────────────────────────

  const analyzeUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setAnalyzing(true)
    setError(null)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const userHash = localStorage.getItem('omnicore_user_hash')
      if (userHash) headers['Authorization'] = `Bearer ${userHash}`

      const res = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Analysis failed (${res.status})`)
      }

      const data = await res.json()
      const newItem: FeedItem = {
        id: data.id ?? data.analysis_id ?? crypto.randomUUID(),
        type: 'url',
        title: data.title ?? trimmed,
        description: data.summary ?? data.description ?? undefined,
        url: trimmed,
        created_at: new Date().toISOString(),
      }

      setItems(prev => [newItem, ...prev])
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }, [url])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        analyzeUrl()
      }
    },
    [analyzeUrl]
  )

  // ── Derived ─────────────────────────────────────────────────

  const filteredItems = typeFilter === 'all'
    ? items
    : items.filter(item => {
        const itemType = item.evidence_type ?? item.type ?? 'evidence'
        if (typeFilter === 'evidence') return ['document', 'testimony', 'physical', 'digital', 'evidence'].includes(itemType)
        if (typeFilter === 'analysis') return ['analysis', 'framework', 'synthesis'].includes(itemType)
        if (typeFilter === 'entity') return ['actor', 'source', 'event', 'entity'].includes(itemType)
        if (typeFilter === 'url_analysis') return itemType === 'url_analysis'
        return true
      })

  const visibleItems = expanded ? filteredItems.slice(0, 100) : filteredItems.slice(0, 10)

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Evidence</h2>
      </div>

      <div id="evidence-feed-scroll" className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* URL input */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste URL to analyze..."
              className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={analyzing}
            />
            <Button
              size="sm"
              onClick={analyzeUrl}
              disabled={analyzing || !url.trim()}
              className="h-8 shrink-0"
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Type filter bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-700 overflow-x-auto">
          {['all', 'evidence', 'analysis', 'entity', 'url_analysis'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors',
                typeFilter === type
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-400 border border-transparent hover:border-gray-700'
              )}
            >
              {type === 'all' ? `All (${items.length})` : type === 'url_analysis' ? 'URL Analysis' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Monitor mode controls */}
        {monitorMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700 bg-gray-800/50">
            {newItemCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setNewItemCount(0)
                  // Scroll to top
                  const feedEl = document.getElementById('evidence-feed-scroll')
                  if (feedEl) feedEl.scrollTop = 0
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-medium animate-pulse"
              >
                {newItemCount} new item{newItemCount !== 1 ? 's' : ''}
              </button>
            )}
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 h-3 w-3"
              />
              Auto-scroll
            </label>
          </div>
        )}

        {/* Feed list */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="space-y-1.5">
            {visibleItems.map(item => {
              const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.evidence
              const Icon = cfg.icon

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded border border-gray-700 bg-gray-800/50 px-2.5 py-2"
                >
                  {/* Type icon badge */}
                  <Badge
                    variant="secondary"
                    className={cn(
                      'h-6 w-6 p-0 flex items-center justify-center rounded-full shrink-0',
                      cfg.color,
                      cfg.darkColor
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </Badge>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-200 font-medium truncate flex-1">
                        {item.title}
                      </span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-blue-400 shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {expanded && item.description && (
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {/* Entity tags */}
                    {item.entities && item.entities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.entities.slice(0, 3).map((entity: any, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {entity.name ?? entity}
                          </span>
                        ))}
                        {item.entities.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] text-gray-500">
                            +{item.entities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-6 w-6 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No evidence yet</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Paste a URL above or add evidence from the dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
