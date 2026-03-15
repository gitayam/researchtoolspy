import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'
import {
  FileText,
  Globe,
  Users,
  Brain,
  Link,
  ExternalLink,
  Loader2,
  Send,
  MapPin,
  Link2,
  LayoutGrid,
  LayoutList,
  AtSign,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'
import CopArtifactLightbox from '@/components/cop/CopArtifactLightbox'

// ── Types ────────────────────────────────────────────────────────

interface FeedItem {
  id: string
  type: 'evidence' | 'analysis' | 'entity' | 'framework' | 'url'
  evidence_type?: string
  title: string
  description?: string
  url?: string
  og_image?: string
  created_at: string
  entities?: Array<{ name: string } | string>
  status?: 'pending' | 'completed' | 'failed'
  error?: string
  /** True when this evidence item has a map marker linked */
  hasPinned?: boolean
  tags?: Array<{ id: string; tag_category: string; tag_value: string }>
}

interface HandleDetection {
  itemId: string
  handle: string
  platform: string
  dismissAt: number
}

// ── Props ────────────────────────────────────────────────────────

interface CopEvidenceFeedProps {
  sessionId: string
  expanded: boolean
  monitorMode?: boolean
  onPinToMap?: (item: FeedItem) => void
  onLinkEntity?: (item: FeedItem) => void
  onLinkPersona?: (handle: string, platform: string, itemId: string) => void
  viewMode?: 'feed' | 'gallery'
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

function isImageUrl(url?: string): boolean {
  if (!url) return false
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(url)
}

const TYPE_CONFIG: Record<FeedItem['type'], { icon: typeof FileText; color: string; darkColor: string }> = {
  evidence:  { icon: FileText, color: 'bg-blue-100 text-blue-700',     darkColor: 'dark:bg-blue-900/40 dark:text-blue-300' },
  analysis:  { icon: Globe,    color: 'bg-purple-100 text-purple-700', darkColor: 'dark:bg-purple-900/40 dark:text-purple-300' },
  entity:    { icon: Users,    color: 'bg-emerald-100 text-emerald-700', darkColor: 'dark:bg-emerald-900/40 dark:text-emerald-300' },
  framework: { icon: Brain,    color: 'bg-amber-100 text-amber-700',   darkColor: 'dark:bg-amber-900/40 dark:text-amber-300' },
  url:       { icon: Link,     color: 'bg-gray-100 text-gray-700',     darkColor: 'dark:bg-gray-800 dark:text-gray-300' },
}

/** Detect social handles in text / URLs */
function extractHandles(text: string): Array<{ handle: string; platform: string }> {
  const results: Array<{ handle: string; platform: string }> = []
  const seen = new Set<string>()

  // Platform URL patterns
  const platformPatterns: Array<{ regex: RegExp; platform: string }> = [
    { regex: /twitter\.com\/(@?[\w.]{1,30})/gi, platform: 'twitter' },
    { regex: /x\.com\/(@?[\w.]{1,30})/gi, platform: 'twitter' },
    { regex: /t\.me\/([\w.]{1,30})/gi, platform: 'telegram' },
    { regex: /reddit\.com\/u\/([\w.]{1,30})/gi, platform: 'reddit' },
    { regex: /instagram\.com\/([\w.]{1,30})/gi, platform: 'instagram' },
    { regex: /tiktok\.com\/@([\w.]{1,30})/gi, platform: 'tiktok' },
  ]

  for (const { regex, platform } of platformPatterns) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      const handle = match[1].replace(/^@/, '')
      const key = `${platform}:${handle}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({ handle, platform })
      }
    }
  }

  // Generic @handle pattern (only if no URL patterns matched for this handle)
  const genericRegex = /@([\w.]{1,30})/g
  let match: RegExpExecArray | null
  while ((match = genericRegex.exec(text)) !== null) {
    const handle = match[1]
    const alreadyFound = results.some((r) => r.handle === handle)
    if (!alreadyFound && !seen.has(`generic:${handle}`)) {
      seen.add(`generic:${handle}`)
      results.push({ handle, platform: 'unknown' })
    }
  }

  return results
}

// ── Component ────────────────────────────────────────────────────

export default function CopEvidenceFeed({
  sessionId,
  expanded,
  monitorMode = false,
  onPinToMap,
  onLinkEntity,
  onLinkPersona,
  viewMode: externalViewMode,
}: CopEvidenceFeedProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [newItemCount, setNewItemCount] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevItemCountRef = useRef(0)

  // View mode (local state if not controlled externally)
  const [localViewMode, setLocalViewMode] = useState<'feed' | 'gallery'>('feed')
  const viewMode = externalViewMode ?? localViewMode

  // Handle detection prompts
  const [handleDetections, setHandleDetections] = useState<HandleDetection[]>([])

  // Lightbox state
  const [lightboxItem, setLightboxItem] = useState<FeedItem | null>(null)

  // ── Helpers ──────────────────────────────────────────────────

  const fetchTagsForItems = useCallback(async (evidenceIds: string[]) => {
    if (evidenceIds.length === 0) return {}
    try {
      const res = await fetch('/api/evidence-tags/batch', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ evidence_ids: evidenceIds }),
      })
      if (!res.ok) return {}
      const data = await res.json()
      return (data.tags ?? {}) as Record<string, any[]>
    } catch {
      return {}
    }
  }, [])

  const handleTagUpdate = useCallback(async (evidenceId: string) => {
    const tagsMap = await fetchTagsForItems([evidenceId])
    const newTags = tagsMap[evidenceId] ?? []
    setItems(prev => prev.map(item => 
      item.id === evidenceId ? { ...item, tags: newTags } : item
    ))
    // Also update lightbox item if it's the one that changed
    setLightboxItem(prev => (prev?.id === evidenceId ? { ...prev, tags: newTags } : prev))
  }, [fetchTagsForItems])

  // ── Fetch evidence ──────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController()

    async function fetchEvidence() {
      setLoading(true)
      try {
        const headers = getCopHeaders()
        if (sessionId) headers['X-Workspace-ID'] = sessionId

        const res = await fetch(`/api/cop/${sessionId}/evidence`, { headers, signal: controller.signal })
        if (!res.ok) throw new Error(`Failed to fetch evidence (${res.status})`)

        const data = await res.json()
        const evidenceData = Array.isArray(data) ? data : data.evidence ?? data.items ?? []

        // Fetch tags for these items
        const tagsMap = await fetchTagsForItems(evidenceData.map((e: any) => e.id).filter(Boolean))

        const list: FeedItem[] = evidenceData.map(
          (e: any) => ({
            id: e.id ?? crypto.randomUUID(),
            type: e.type ?? 'evidence',
            evidence_type: e.evidence_type ?? undefined,
            title: e.title ?? e.name ?? 'Untitled',
            description: e.description ?? e.summary ?? undefined,
            url: e.url ?? e.source_url ?? undefined,
            og_image: e.og_image ?? e.thumbnail_url ?? undefined,
            created_at: e.created_at ?? e.created ?? new Date().toISOString(),
            entities: e.entities ?? undefined,
            status: 'completed' as const,
            tags: tagsMap[e.id] ?? [],
          })
        )

        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setItems(prev => {
          const pending = prev.filter(i => i.status === 'pending')
          return [...pending, ...list.filter(ni => !pending.some(pi => pi.url === ni.url))]
        })
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('[CopEvidenceFeed] fetch error:', e)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchEvidence()
    return () => controller.abort()
  }, [sessionId, fetchTagsForItems])

  // Polling in monitor mode
  useEffect(() => {
    if (!monitorMode) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    const controller = new AbortController()
    pollingRef.current = setInterval(async () => {
      try {
        const headers = getCopHeaders()
        if (sessionId) headers['X-Workspace-ID'] = sessionId

        const res = await fetch(`/api/cop/${sessionId}/evidence`, { headers, signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        const evidenceData = data.evidence ?? data.items ?? []

        // Fetch tags for new items
        const tagsMap = await fetchTagsForItems(evidenceData.map((e: any) => e.id).filter(Boolean))

        const newItems: FeedItem[] = evidenceData.map((e: any) => ({
          id: e.id,
          type: 'evidence' as const,
          evidence_type: e.evidence_type ?? e.type,
          title: e.title ?? e.name ?? 'Untitled',
          description: e.description ?? e.content?.substring(0, 200),
          url: e.source_url ?? e.url,
          og_image: e.og_image ?? e.thumbnail_url ?? undefined,
          created_at: e.created_at ?? new Date().toISOString(),
          entities: e.entities,
          status: 'completed' as const,
          tags: tagsMap[e.id] ?? [],
        }))

        // Check for new items
        const currentCount = newItems.length
        if (currentCount > prevItemCountRef.current && prevItemCountRef.current > 0) {
          setNewItemCount(currentCount - prevItemCountRef.current)
        }
        prevItemCountRef.current = currentCount

        // Update items (preserve pending ones)
        setItems(prev => {
          const pending = prev.filter(i => i.status === 'pending')
          const filteredNew = newItems.filter(ni => !pending.some(pi => pi.url === ni.url))
          return [...pending, ...filteredNew]
        })
      } catch (e: any) {
        if (e?.name === 'AbortError') return
      }
    }, 30000)

    return () => {
      controller.abort()
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [monitorMode, sessionId, fetchTagsForItems])

  // Auto-dismiss handle detections after 8s
  useEffect(() => {
    if (handleDetections.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setHandleDetections((prev) => prev.filter((d) => d.dismissAt > now))
    }, 1000)
    return () => clearInterval(timer)
  }, [handleDetections.length])

  // ── URL analysis ────────────────────────────────────────────

  const analyzeUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    const tempId = crypto.randomUUID()
    const pendingItem: FeedItem = {
      id: tempId,
      type: 'url',
      title: trimmed,
      url: trimmed,
      created_at: new Date().toISOString(),
      status: 'pending',
    }

    setItems(prev => [pendingItem, ...prev])
    setUrl('')
    setError(null)

    try {
      const headers = getCopHeaders()
      if (sessionId) headers['X-Workspace-ID'] = sessionId

      const res = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmed, workspace_id: sessionId }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Analysis failed (${res.status})`)
      }

      const data = await res.json()

      // Persist the URL analysis to COP evidence_items so it's available to other panels
      let persistedId: string | number | undefined
      try {
        const persistRes = await fetch(`/api/cop/${sessionId}/evidence`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: data.title ?? trimmed,
            content: data.summary ?? data.description ?? '',
            url: trimmed,
            source_type: 'url_analysis',
            confidence: 'medium',
          }),
        })
        if (persistRes.ok) {
          const persistData = await persistRes.json()
          persistedId = persistData.id
        }
      } catch {
        // Non-fatal — URL was analyzed even if persistence fails
      }

      const newItem: FeedItem = {
        id: String(persistedId ?? data.id ?? data.analysis_id ?? tempId),
        type: 'url',
        title: data.title ?? trimmed,
        description: data.summary ?? data.description ?? undefined,
        url: trimmed,
        og_image: data.og_image ?? data.thumbnail_url ?? undefined,
        created_at: new Date().toISOString(),
        status: 'completed' as const,
      }

      setItems(prev => prev.map(item => item.id === tempId ? newItem : item))

      // Auto-geocode prompt: detect locations from analyze-url response
      const locations = data.entities?.locations as Array<{ name: string; count: number }> | undefined
      if (locations && locations.length > 0) {
        const top = locations.slice(0, 3).map(l => l.name).join(', ')
        const more = locations.length > 3 ? ` (+${locations.length - 3} more)` : ''
        toast({
          title: `${locations.length} location${locations.length > 1 ? 's' : ''} detected`,
          description: `${top}${more} — use Pin to Map to geolocate`,
        })
      }

      // Handle auto-extraction: scan the new evidence for social handles
      const textToScan = `${trimmed} ${data.title ?? ''} ${data.summary ?? ''}`
      const detected = extractHandles(textToScan)
      if (detected.length > 0) {
        const newDetections: HandleDetection[] = detected.map((d) => ({
          itemId: newItem.id,
          handle: d.handle,
          platform: d.platform,
          dismissAt: Date.now() + 8000,
        }))
        setHandleDetections((prev) => [...prev, ...newDetections])
        const handles = detected.map(d => `@${d.handle}`).join(', ')
        toast({ title: `${detected.length} handle${detected.length > 1 ? 's' : ''} detected`, description: handles })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      setItems(prev => prev.map(item =>
        item.id === tempId
          ? { ...item, status: 'failed', error: errorMessage, description: errorMessage }
          : item
      ))
    }
  }, [url, sessionId])

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

  // Gallery mode: only items with image URLs
  const galleryItems = filteredItems.filter((item) => isImageUrl(item.url))

  // Lightbox navigation
  const lightboxIndex = lightboxItem ? galleryItems.findIndex((i) => i.id === lightboxItem.id) : -1
  const handleLightboxPrev = lightboxIndex > 0 ? () => setLightboxItem(galleryItems[lightboxIndex - 1]) : undefined
  const handleLightboxNext = lightboxIndex < galleryItems.length - 1 ? () => setLightboxItem(galleryItems[lightboxIndex + 1]) : undefined

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">Evidence</h2>
        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLocalViewMode('feed')}
            className={cn(
              'p-1.5 rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500',
              viewMode === 'feed'
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200'
                : 'text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
            )}
            aria-label="Feed view"
            title="Feed view"
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setLocalViewMode('gallery')}
            className={cn(
              'p-1.5 rounded transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500',
              viewMode === 'gallery'
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200'
                : 'text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
            )}
            aria-label="Gallery view"
            title="Gallery view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
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
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button
              size="sm"
              onClick={analyzeUrl}
              disabled={!url.trim()}
              className="h-8 shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Type filter bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-thin">
          {['all', 'evidence', 'analysis', 'entity', 'url_analysis'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
                typeFilter === type
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-gray-700'
              )}
            >
              {type === 'all' ? `All (${items.length})` : type === 'url_analysis' ? 'URL Analysis' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Monitor mode controls */}
        {monitorMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            {newItemCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setNewItemCount(0)
                  const feedEl = document.getElementById('evidence-feed-scroll')
                  if (feedEl) feedEl.scrollTop = 0
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-medium motion-safe:animate-pulse cursor-pointer"
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
                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-500 focus:ring-blue-500 h-3 w-3"
              />
              Auto-scroll
            </label>
          </div>
        )}

        {/* Handle detection prompts */}
        {handleDetections.length > 0 && (
          <div className="space-y-1">
            {handleDetections.map((detection, i) => (
              <div
                key={`${detection.itemId}-${detection.handle}-${i}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-purple-500/20 bg-purple-500/5"
              >
                <AtSign className="h-3 w-3 text-purple-400 shrink-0" />
                <span className="text-[11px] text-purple-300 flex-1">
                  Detected <span className="font-medium">@{detection.handle}</span>
                  {detection.platform !== 'unknown' && (
                    <span className="text-purple-400/70"> on {detection.platform}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onLinkPersona?.(detection.handle, detection.platform, detection.itemId)
                    setHandleDetections((prev) => prev.filter((_, idx) => idx !== i))
                  }}
                  className="text-[10px] text-purple-400 hover:text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-500/10 transition-colors cursor-pointer"
                >
                  Link to Persona
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHandleDetections((prev) =>
                      prev.filter((_, idx) => idx !== i),
                    )
                  }
                  className="text-gray-500 hover:text-gray-400 p-0.5 cursor-pointer"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {viewMode === 'gallery' ? (
          /* ── Gallery View ────────────────────────────────────────── */
          galleryItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {galleryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxItem(item)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[10px] sm:text-[10px] text-gray-100 line-clamp-1" title={item.title}>{item.title}</p>
                    <p className="text-[9px] text-gray-300">{timeAgo(item.created_at)}</p>
                  </div>
                  {/* Pin indicator */}
                  {item.hasPinned && (
                    <div className="absolute top-1.5 right-1.5">
                      <MapPin className="h-3.5 w-3.5 text-green-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <LayoutGrid className="h-6 w-6 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">No visual evidence yet.</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                Drop an image URL into Quick Capture.
              </p>
            </div>
          )
        ) : (
          /* ── Feed View ───────────────────────────────────────────── */
          <>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            ) : visibleItems.length > 0 ? (
              <div className="space-y-1.5">
                {visibleItems.map(item => {
                  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.evidence
                  const Icon = cfg.icon

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2 transition-opacity",
                        item.status === 'pending' && "opacity-70",
                        item.status === 'failed' && "border-red-900/50 bg-red-900/10"
                      )}
                    >
                      {/* Type icon badge */}
                      <Badge
                        variant="secondary"
                        className={cn(
                          'h-6 w-6 p-0 flex items-center justify-center rounded-full shrink-0',
                          item.status === 'failed' ? 'bg-red-900/40 text-red-400' : cfg.color,
                          item.status === 'failed' ? '' : cfg.darkColor
                        )}
                      >
                        {item.status === 'pending' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Icon className="h-3 w-3" />
                        )}
                      </Badge>

                      {/* URL Thumbnail */}
                      {item.url && item.status !== 'pending' && (isImageUrl(item.url) || item.og_image) && (
                        <div
                          className="h-10 w-10 rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shrink-0 cursor-pointer"
                          onClick={() => {
                            if (isImageUrl(item.url)) setLightboxItem(item)
                          }}
                        >
                          <img
                            src={isImageUrl(item.url) ? item.url : item.og_image}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-xs font-medium line-clamp-2 sm:truncate flex-1",
                              item.status === 'failed' ? "text-red-400" : "text-gray-900 dark:text-gray-200"
                            )}
                            title={item.title}
                          >
                            {item.title}
                          </span>
                          {/* Pin to map button */}
                          {onPinToMap && item.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => onPinToMap(item)}
                              className={cn(
                                'p-0.5 rounded transition-colors shrink-0 cursor-pointer',
                                'focus-visible:ring-2 focus-visible:ring-blue-500',
                                item.hasPinned
                                  ? 'text-green-400'
                                  : 'text-gray-500 hover:text-green-400',
                              )}
                              title={item.hasPinned ? 'View on map' : 'Pin to map'}
                              aria-label={item.hasPinned ? 'View on map' : 'Pin to map'}
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onLinkEntity && item.status === 'completed' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onLinkEntity(item) }}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer shrink-0"
                              title="Link to entity"
                              aria-label="Link evidence to entity"
                            >
                              <Link2 className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                            </button>
                          )}
                          {item.url && item.status !== 'pending' && (
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
                        {/* URL domain badge */}
                        {item.url && item.status === 'completed' && !isImageUrl(item.url) && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block">
                            {(() => { try { return new URL(item.url).hostname.replace('www.', '') } catch { return '' } })()}
                          </span>
                        )}
                        {expanded && item.description && (
                          <p className={cn(
                            "text-[11px] mt-0.5 line-clamp-2",
                            item.status === 'failed' ? "text-red-400/70" : "text-gray-600 dark:text-gray-400"
                          )}>
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
                              <span className="px-1.5 py-0.5 rounded text-[9px] text-gray-500 dark:text-gray-400">
                                +{item.entities.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">
                            {timeAgo(item.created_at)}
                          </span>
                          {item.status === 'pending' && (
                            <span className="text-[10px] text-blue-400 motion-safe:animate-pulse">
                              Analyzing...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">No evidence yet</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  Paste a URL above or add evidence from the dashboard.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxItem && (
        <CopArtifactLightbox
          item={lightboxItem}
          sessionId={sessionId}
          open={!!lightboxItem}
          onOpenChange={(open) => { if (!open) setLightboxItem(null) }}
          onPinToMap={onPinToMap}
          onPrev={handleLightboxPrev}
          onNext={handleLightboxNext}
          tags={lightboxItem.tags}
          onTagUpdate={() => handleTagUpdate(lightboxItem.id)}
        />
      )}
    </div>
  )
}
