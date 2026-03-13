/**
 * CopWorkspacePage — Multi-panel investigation workspace
 *
 * Replaces the old map-only COP view with a scrollable panel grid.
 * Two modes:
 *   - Progress: entity graph, timeline, questions/RFIs, analysis, evidence feed, optional map
 *   - Monitor: evidence feed, optional map, key questions
 */

import { type ReactNode, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  MonitorPlay,
  UserPlus,
  Share2,
  Radio,
  Loader2,
  Map as MapIcon,
  Network,
  Clock,
  HelpCircle,
  Brain,
  FileText,
  Plus,
  Activity,
  Users,
  Database,
  Briefcase,
  Calendar,
  MapPinned,
  BookOpen,
  Eye,
  ClipboardList,
  Inbox,
  Package,
  Zap,
  FileWarning,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ThemeToggle'

import CopStatusStrip from '@/components/cop/CopStatusStrip'
import CopPanelExpander from '@/components/cop/CopPanelExpander'
import CopMiniGraph from '@/components/cop/CopMiniGraph'
import CopTimelinePanel from '@/components/cop/CopTimelinePanel'
import CopAnalysisSummary from '@/components/cop/CopAnalysisSummary'
import CopEvidenceFeed from '@/components/cop/CopEvidenceFeed'
import CopQuestionsTab from '@/components/cop/CopQuestionsTab'
import CopHypothesisTab from '@/components/cop/CopHypothesisTab'
import CopRfiTab from '@/components/cop/CopRfiTab'
import CopMapWithLayers from '@/components/cop/CopMapWithLayers'
import CopActivityPanel from '@/components/cop/CopActivityPanel'
import CopGlobalCaptureBar from '@/components/cop/CopGlobalCaptureBar'
import CopBlockerStrip from '@/components/cop/CopBlockerStrip'

// Lazy-loaded panels and dialogs (not needed on initial render)
const CopInviteDialog = lazy(() => import('@/components/cop/CopInviteDialog'))
const CopGapAnalysis = lazy(() => import('@/components/cop/CopGapAnalysis'))
const CopPersonaPanel = lazy(() => import('@/components/cop/CopPersonaPanel'))
const CopEvidencePersonaLinkDialog = lazy(() => import('@/components/cop/CopEvidencePersonaLinkDialog'))
const CopEntityDrawer = lazy(() => import('@/components/cop/CopEntityDrawer'))
const CopTaskBoard = lazy(() => import('@/components/cop/CopTaskBoard'))
const CopSubmissionInbox = lazy(() => import('@/components/cop/CopSubmissionInbox'))
const CopAssetPanel = lazy(() => import('@/components/cop/CopAssetPanel'))
const CopExportDialog = lazy(() => import('@/components/cop/CopExportDialog'))
const CopPlaybookPanel = lazy(() => import('@/components/cop/CopPlaybookPanel'))
const CopClaimsPanel = lazy(() => import('@/components/cop/CopClaimsPanel'))

/** Suspense wrapper for lazy-loaded panels — shows a subtle loading indicator */
function LazyPanel({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-8 text-xs text-gray-400"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...</div>}>
      {children}
    </Suspense>
  )
}

import CopSidebar from '@/components/cop/CopSidebar'
import { getLayerById } from '@/components/cop/CopLayerCatalog'
import { usePanelLayout } from '@/hooks/usePanelLayout'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { CopSession, CopFeatureCollection, CopLayerDef, CopWorkspaceMode } from '@/types/cop'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Template labels ──────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
}

// ── Entities Quick-Access Panel ──────────────────────────────────

const ENTITY_TABS = [
  { key: 'actors', label: 'Actors', icon: Briefcase, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800/40', hoverBg: 'hover:bg-blue-100 dark:hover:bg-blue-900/40' },
  { key: 'events', label: 'Events', icon: Calendar, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/40', hoverBg: 'hover:bg-amber-100 dark:hover:bg-amber-900/40' },
  { key: 'places', label: 'Places', icon: MapPinned, color: 'text-green-500 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800/40', hoverBg: 'hover:bg-green-100 dark:hover:bg-green-900/40' },
  { key: 'sources', label: 'Sources', icon: BookOpen, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800/40', hoverBg: 'hover:bg-purple-100 dark:hover:bg-purple-900/40' },
  { key: 'behaviors', label: 'Behaviors', icon: Eye, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800/40', hoverBg: 'hover:bg-red-100 dark:hover:bg-red-900/40' },
] as const

function CopEntitiesPanel({ stats, onOpenEntityDrawer }: {
  stats?: Record<string, number | undefined>
  onOpenEntityDrawer?: (tab?: string, prefill?: any) => void
}) {
  // Map stats endpoint field names to entity tab keys
  const STAT_KEY_MAP: Record<string, string> = {
    actors: 'actor_count',
    events: 'event_count',
    places: 'place_count',
    sources: 'source_count',
    behaviors: 'behavior_count',
  }

  const counts: Record<string, number> = {}
  for (const tab of ENTITY_TABS) {
    const statKey = STAT_KEY_MAP[tab.key]
    counts[tab.key] = (stats?.[statKey] as number) ?? 0
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
      data-panel="entities"
      role="region"
      aria-label="Entities"
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Entities
          </h3>
          {totalCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-purple-500/30 text-purple-600 dark:text-purple-400">
              {totalCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenEntityDrawer?.()}
          className="h-6 text-[10px] px-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
        >
          Open Drawer
          <span className="ml-1 text-[9px] text-slate-400 dark:text-slate-500 font-mono">⌘E</span>
        </Button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 p-2 sm:p-3">
        {ENTITY_TABS.map(({ key, label, icon: Icon, color, bg, border, hoverBg }) => (
          <button
            key={key}
            type="button"
            onClick={() => onOpenEntityDrawer?.(key)}
            className={cn(
              'flex flex-col items-center gap-1 sm:gap-1.5 rounded-lg border p-2 sm:p-3 transition-all duration-200 cursor-pointer',
              bg, border, hoverBg,
              'hover:shadow-sm hover:scale-[1.02]',
            )}
          >
            <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', color)} />
            <span className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
            <span className={cn('text-base sm:text-lg font-bold tabular-nums', color)}>
              {counts[key] ?? '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────

export default function CopWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // ── Session state ──────────────────────────────────────────────
  const [session, setSession] = useState<CopSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Mode & map state ───────────────────────────────────────────
  const [mode, setMode] = useState<CopWorkspaceMode>('progress')
  const [showMap, setShowMap] = useState(true)

  // ── RFI badge count ────────────────────────────────────────────
  const [rfiCount, setRfiCount] = useState(0)

  // ── Workspace stats (shared by sidebar + entities panel) ─────
  const [workspaceStats, setWorkspaceStats] = useState<{
    evidence_count?: number
    entity_count?: number
    actor_count?: number
    source_count?: number
    event_count?: number
    place_count?: number
    behavior_count?: number
    open_rfis?: number
    blocker_count?: number
    hypothesis_count?: number
  }>({})

  // ── Invite dialog state ───────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false)

  // ── Export dialog state ──────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false)

  // ── Panel layout (shared between sidebar + ProgressLayout) ──
  const panelLayout = usePanelLayout(id!)

  // ── Entity Drawer state ────────────────────────────────────
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false)
  const [entityDrawerTab, setEntityDrawerTab] = useState<string | undefined>()
  const [entityDrawerPrefill, setEntityDrawerPrefill] = useState<any>(undefined)

  // ── Persona linking state ───────────────────────────────────
  const [personaLinkData, setPersonaLinkData] = useState<{ handle: string; platform: string; itemId: string } | null>(null)

  // ── Pin placement state ─────────────────────────────────────
  const [pinPlacementMode, setPinPlacementMode] = useState(false)
  const pinSourceRef = useRef<{ type: 'evidence' | 'hypothesis'; id: string; text: string } | null>(null)

  // ── Layer state ────────────────────────────────────────────────
  const [activeLayers, setActiveLayers] = useState<string[]>([])
  const [layerData, setLayerData] = useState<Record<string, CopFeatureCollection>>({})
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({})

  // Auto-refresh timer refs
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  // ── Fetch session ──────────────────────────────────────────────

  const fetchSession = useCallback(async (signal?: AbortSignal) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cop/sessions/${id}`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)
      const data = await res.json()
      const sess: CopSession = data.session ?? data
      setSession(sess)
      setActiveLayers(sess.active_layers ?? [])

      // Auto-show map if session has geo data
      if (sess.center_lat && sess.center_lon) {
        setShowMap(true)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const controller = new AbortController()
    fetchSession(controller.signal)
    return () => controller.abort()
  }, [fetchSession])

  // Fetch workspace stats (shared by sidebar + entities panel)
  useEffect(() => {
    if (!id) return
    fetch(`/api/cop/${id}/stats`, { headers: getCopHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.stats) setWorkspaceStats(data.stats) })
      .catch((err) => { console.error('Failed to fetch workspace stats:', err) })
  }, [id])

  // ── Fetch a single layer as GeoJSON ────────────────────────────

  const fetchLayerData = useCallback(
    async (layerDef: CopLayerDef) => {
      if (!id) return
      if (layerDef.source.type === 'static') return

      try {
        const endpoint = `/api/cop/${id}${layerDef.source.endpoint}`
        const res = await fetch(endpoint, { headers: getCopHeaders() })
        if (!res.ok) return

        const fc: CopFeatureCollection = await res.json()
        setLayerData((prev) => ({ ...prev, [layerDef.id]: fc }))
        setLayerCounts((prev) => ({
          ...prev,
          [layerDef.id]: fc.features?.length ?? 0,
        }))
      } catch (err) {
        console.error(`Failed to fetch layer data for "${layerDef.id}":`, err)
      }
    },
    [id],
  )

  // ── Fetch all active layers ────────────────────────────────────

  const fetchAllLayers = useCallback(async () => {
    const promises = activeLayers
      .map(getLayerById)
      .filter((l): l is CopLayerDef => l != null)
      .map(fetchLayerData)
    await Promise.allSettled(promises)
  }, [activeLayers, fetchLayerData])

  useEffect(() => {
    if (activeLayers.length > 0) {
      fetchAllLayers()
    }
  }, [activeLayers, fetchAllLayers])

  // ── Auto-refresh layers ────────────────────────────────────────

  useEffect(() => {
    for (const timer of timersRef.current.values()) {
      clearInterval(timer)
    }
    timersRef.current.clear()

    for (const layerId of activeLayers) {
      const def = getLayerById(layerId)
      if (!def || !def.source.refreshSeconds) continue

      const timer = setInterval(() => {
        fetchLayerData(def)
      }, def.source.refreshSeconds * 1000)

      timersRef.current.set(layerId, timer)
    }

    return () => {
      for (const timer of timersRef.current.values()) {
        clearInterval(timer)
      }
      timersRef.current.clear()
    }
  }, [activeLayers, fetchLayerData])

  // ── Keyboard shortcuts ────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Cmd/Ctrl+E -> Toggle Entity Drawer
      if (e.key === 'e') {
        e.preventDefault()
        setEntityDrawerOpen((prev) => !prev)
        return
      }
      // Cmd/Ctrl+M -> Toggle map
      if (e.key === 'm') {
        e.preventDefault()
        setShowMap((prev) => !prev)
        return
      }
      // Cmd/Ctrl+1 -> Progress mode
      if (e.key === '1') {
        e.preventDefault()
        setMode('progress')
        return
      }
      // Cmd/Ctrl+2 -> Monitor mode
      if (e.key === '2') {
        e.preventDefault()
        setMode('monitor')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Pin placement handlers ──────────────────────────────────

  const handlePinToMapFromFeed = useCallback(
    (item: { id: string; title: string }) => {
      pinSourceRef.current = { type: 'evidence', id: item.id, text: item.title }
      setPinPlacementMode(true)
      setShowMap(true)
    },
    [],
  )

  const handlePinToMapFromHypothesis = useCallback(
    (hypothesisId: string, text: string) => {
      pinSourceRef.current = { type: 'hypothesis', id: hypothesisId, text }
      setPinPlacementMode(true)
      setShowMap(true)
    },
    [],
  )

  const handleLinkPersona = useCallback(
    (handle: string, platform: string, itemId: string) => {
      setPersonaLinkData({ handle, platform, itemId })
    },
    [],
  )

  const handleMarkerOpenInFeed = useCallback(
    (_sourceType: string, _sourceId: string) => {
      // Scroll to evidence feed panel
      const feedEl = document.querySelector('[data-panel="evidence"]') ??
        document.querySelector('h3:has(~ div)')
      // Find the Evidence & Intel Feed heading and scroll to it
      const headings = document.querySelectorAll('h3')
      for (const h of headings) {
        if (h.textContent?.includes('Evidence & Intel Feed')) {
          h.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      }
      feedEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [],
  )

  const handlePinPlaced = useCallback(
    async (lat: number, lon: number) => {
      setPinPlacementMode(false)
      const source = pinSourceRef.current
      pinSourceRef.current = null

      if (!source || !id) return

      try {
        await fetch(`/api/cop/${id}/markers`, {
          method: 'POST',
          headers: getCopHeaders(),
          body: JSON.stringify({
            lat,
            lon,
            callsign: source.text.slice(0, 50),
            label: source.text.slice(0, 100),
            source_type: source.type === 'evidence' ? 'EVIDENCE' : 'HYPOTHESIS',
            source_id: source.id,
          }),
        })
      } catch (err) {
        console.error('Failed to place map pin marker:', err)
      }
    },
    [id],
  )

  const handleGoToBlocker = useCallback(
    (rfiId: string) => {
      // Switch to progress mode where RFIs are visible, then scroll to the RFI panel
      setMode('progress')
      requestAnimationFrame(() => {
        const rfiPanel = document.querySelector('[data-panel="rfi"]')
        if (rfiPanel) {
          rfiPanel.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    },
    [],
  )

  const handleLocationDetected = useCallback(
    (location: string, evidenceId: string) => {
      // Trigger pin placement mode using the detected location text as label
      handlePinToMapFromFeed({ id: evidenceId, title: `📍 Detected: ${location}` })
    },
    [handlePinToMapFromFeed],
  )

  // ── Toggle layer (optimistic + persist) ────────────────────────

  const handleToggleLayer = useCallback(
    async (layerId: string) => {
      const prevLayers = activeLayers
      const newLayers = activeLayers.includes(layerId)
        ? activeLayers.filter((l) => l !== layerId)
        : [...activeLayers, layerId]

      setActiveLayers(newLayers)

      if (id) {
        try {
          await fetch(`/api/cop/sessions/${id}`, {
            method: 'PUT',
            headers: getCopHeaders(),
            body: JSON.stringify({ active_layers: newLayers }),
          })
        } catch (err) {
          console.error('Failed to persist layer toggle:', err)
          setActiveLayers(prevLayers)
        }
      }
    },
    [activeLayers, id],
  )

  // ── Mission Brief handler ──────────────────────────────────────

  const handleUpdateMissionBrief = useCallback(
    async (brief: string) => {
      if (!id || !session) return
      
      const prevSession = session
      setSession(prev => prev ? { ...prev, mission_brief: brief } : null)

      try {
        const res = await fetch(`/api/cop/sessions/${id}`, {
          method: 'PUT',
          headers: getCopHeaders(),
          body: JSON.stringify({ mission_brief: brief }),
        })
        if (!res.ok) throw new Error('Failed to update mission brief')
      } catch (err) {
        console.error('Failed to update mission brief:', err)
        setSession(prevSession)
      }
    },
    [id, session],
  )

  // ── Share handler ──────────────────────────────────────────────

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard/cop/${id}`
    navigator.clipboard.writeText(url).catch((err) => { console.error('Failed to copy share link to clipboard:', err) })
  }, [id])

  // ── Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────

  if (error || !session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">
          {error ?? 'Session not found'}
        </div>
        <Button onClick={() => navigate('/dashboard/cop')} variant="outline">
          Back to Sessions
        </Button>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-background min-h-dvh">
      {/* ── Header bar ──────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-3 px-2 sm:px-3 md:px-4 py-2 bg-background border-b shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/cop')}
          className="shrink-0 cursor-pointer h-8 w-8 sm:h-auto sm:w-auto p-0 sm:px-3"
          aria-label="Back to sessions"
        >
          <ArrowLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        {/* Session name + template badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <h1 className="font-semibold text-xs sm:text-sm truncate text-gray-900 dark:text-gray-100">{session.name}</h1>
          <Badge variant="secondary" className="shrink-0 text-[10px] hidden sm:inline-flex">
            {TEMPLATE_LABELS[session.template_type] ?? session.template_type}
          </Badge>
          {session.status === 'ACTIVE' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              <span className="hidden sm:inline">Live</span>
            </span>
          )}
        </div>

        {/* Mode toggle (segmented control) */}
        <div className="flex items-center bg-muted rounded-md p-0.5 shrink-0">
          <button
            type="button"
            data-testid="mode-progress"
            onClick={() => setMode('progress')}
            className={cn(
              'flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
              mode === 'progress'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Progress</span>
          </button>
          <button
            type="button"
            data-testid="mode-monitor"
            onClick={() => setMode('monitor')}
            className={cn(
              'flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
              mode === 'monitor'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Monitor</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEntityDrawerOpen(true)}
            title="Entity Drawer (Cmd+E)"
            className="h-7 text-[11px] px-1.5 sm:px-2.5 gap-1 sm:gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer"
          >
            <Database className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Entities</span>
          </Button>
          <Button variant="ghost" size="sm" title="Invite collaborator" onClick={() => setInviteOpen(true)} className="cursor-pointer h-7 w-7 sm:h-auto sm:w-auto p-0 sm:p-2" aria-label="Invite collaborator">
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} title="Copy share link" className="cursor-pointer h-7 w-7 sm:h-auto sm:w-auto p-0 sm:p-2" aria-label="Copy share link">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExportOpen(true)}
            title="Export data"
            className="cursor-pointer h-7 w-7 sm:h-auto sm:w-auto p-0 sm:p-2"
            aria-label="Export data"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/cop/${id}/cot`, '_blank')}
            title="Export as Cursor-on-Target (ATAK compatible)"
            className="cursor-pointer hidden sm:inline-flex"
            aria-label="Export as Cursor-on-Target"
          >
            <Radio className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Status strip ────────────────────────────────────────── */}
      <CopStatusStrip
        sessionId={id!}
        missionBrief={session.mission_brief ?? undefined}
        onUpdateMissionBrief={handleUpdateMissionBrief}
        />

        {/* ── Global Quick Capture Bar ────────────────────────────── */}
        <CopGlobalCaptureBar 
          sessionId={id!} 
          onLocationDetected={handleLocationDetected}
        />

        {/* ── Panel grid ──────────────────────────────────────────── */}

      <CopBlockerStrip sessionId={id!} onGoToBlocker={handleGoToBlocker} />

      {/* ── Sidebar + Panel grid ────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Persistent sidebar (hidden on mobile, icon rail on md, full on lg+) */}
        <CopSidebar
          mode={mode}
          stats={workspaceStats}
          panelOrder={panelLayout.visiblePanels.map((p) => p.id)}
          onResetLayout={panelLayout.resetLayout}
        />

        {/* Panel grid (scrollable main area) */}
        <main className="overflow-y-auto p-2 sm:p-3 md:p-3 flex-1 min-w-0" role="main" aria-label="COP workspace panels">
          <div className="space-y-3">
            {mode === 'progress' ? (
              <ProgressLayout
                sessionId={id!}
                session={session}
                stats={workspaceStats}
                rfiCount={rfiCount}
                setRfiCount={setRfiCount}
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                layerData={layerData}
                layerCounts={layerCounts}
                pinPlacementMode={pinPlacementMode}
                onPinPlaced={handlePinPlaced}
                onPinToMapFromFeed={handlePinToMapFromFeed}
                onPinToMapFromHypothesis={handlePinToMapFromHypothesis}
                onLinkPersona={handleLinkPersona}
                onMarkerOpenInFeed={handleMarkerOpenInFeed}
                onOpenEntityDrawer={(tab?: string, prefill?: any) => {
                  if (tab) setEntityDrawerTab(tab)
                  if (prefill) setEntityDrawerPrefill(prefill)
                  setEntityDrawerOpen(true)
                }}
                panelLayout={panelLayout}
              />
            ) : (
              <MonitorLayout
                sessionId={id!}
                session={session}
                showMap={showMap}
                setShowMap={setShowMap}
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                layerData={layerData}
                layerCounts={layerCounts}
                pinPlacementMode={pinPlacementMode}
                onPinPlaced={handlePinPlaced}
                onPinToMapFromFeed={handlePinToMapFromFeed}
                onLinkPersona={handleLinkPersona}
                onMarkerOpenInFeed={handleMarkerOpenInFeed}
                onOpenEntityDrawer={(tab?: string, prefill?: any) => {
                  if (tab) setEntityDrawerTab(tab)
                  if (prefill) setEntityDrawerPrefill(prefill)
                  setEntityDrawerOpen(true)
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Persona Link dialog */}
      {personaLinkData && (
        <LazyPanel>
          <CopEvidencePersonaLinkDialog
            sessionId={id!}
            open={!!personaLinkData}
            onOpenChange={(open) => { if (!open) setPersonaLinkData(null) }}
            handle={personaLinkData?.handle ?? ''}
            platform={personaLinkData?.platform ?? ''}
            evidenceId={personaLinkData?.itemId ?? ''}
          />
        </LazyPanel>
      )}

      {/* Invite dialog */}
      {inviteOpen && (
        <LazyPanel>
          <CopInviteDialog
            sessionId={id!}
            sessionName={session.name}
            open={inviteOpen}
            onOpenChange={setInviteOpen}
          />
        </LazyPanel>
      )}

      {/* Export dialog */}
      {exportOpen && (
        <LazyPanel>
          <CopExportDialog
            sessionId={id!}
            sessionName={session.name}
            open={exportOpen}
            onOpenChange={setExportOpen}
          />
        </LazyPanel>
      )}

      {/* Entity Drawer */}
      {entityDrawerOpen && (
        <LazyPanel>
          <CopEntityDrawer
            sessionId={id!}
            workspaceId={session?.workspace_id}
            open={entityDrawerOpen}
            onOpenChange={(open) => {
              setEntityDrawerOpen(open)
              if (!open) {
                setEntityDrawerTab(undefined)
                setEntityDrawerPrefill(undefined)
              }
            }}
            initialTab={entityDrawerTab as any}
            prefill={entityDrawerPrefill}
            onPinToMap={(lat, lon, label) => {
              setShowMap(true)
              fetch(`/api/cop/${id}/markers`, {
                method: 'POST',
                headers: getCopHeaders(),
                body: JSON.stringify({
                  lat, lon,
                  label,
                  callsign: label,
                  cot_type: 'a-f-G',
                  source_type: 'ENTITY',
                  description: `Pinned from Entity Drawer: ${label}`,
                }),
              }).catch((err) => { console.error('Failed to create entity pin marker:', err) })
            }}
          />
        </LazyPanel>
      )}
    </div>
  )
}

// ── Progress Mode Layout ────────────────────────────────────────

interface ProgressLayoutProps {
  sessionId: string
  session: CopSession
  stats?: Record<string, number | undefined>
  rfiCount: number
  setRfiCount: (v: number) => void
  activeLayers: string[]
  onToggleLayer: (id: string) => void
  layerData: Record<string, CopFeatureCollection>
  layerCounts: Record<string, number>
  pinPlacementMode?: boolean
  onPinPlaced?: (lat: number, lon: number) => void
  onPinToMapFromFeed?: (item: { id: string; title: string }) => void
  onPinToMapFromHypothesis?: (hypothesisId: string, text: string) => void
  onLinkPersona?: (handle: string, platform: string, itemId: string) => void
  onOpenEntityDrawer?: (tab?: string, prefill?: any) => void
  onMarkerOpenInFeed?: (sourceType: string, sourceId: string) => void
  panelLayout: ReturnType<typeof usePanelLayout>
}

/** Panel metadata — icon, title, height, render function */
interface PanelDef {
  id: string
  title: string
  icon: ReactNode
  height: string
  badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  render: (expanded: boolean) => ReactNode
  /** If true, hide on 2xl (shown in sidebar instead) */
  hideOn2xl?: boolean
}

function ProgressLayout({
  sessionId,
  session,
  stats,
  rfiCount,
  setRfiCount,
  activeLayers,
  onToggleLayer,
  layerData,
  layerCounts,
  pinPlacementMode,
  onPinPlaced,
  onPinToMapFromFeed,
  onPinToMapFromHypothesis,
  onLinkPersona,
  onOpenEntityDrawer,
  onMarkerOpenInFeed,
  panelLayout,
}: ProgressLayoutProps) {
  const { visiblePanels, hiddenPanels, movePanel, toggleWidth, toggleVisible, resetLayout } = panelLayout
  const is2xl = useMediaQuery('(min-width: 1536px)')

  // ── Panel definitions (render functions keyed by id) ──────────

  const panelDefs: Record<string, PanelDef> = {
    graph: {
      id: 'graph',
      title: 'Entity Relationships',
      icon: <Network className="h-4 w-4 text-purple-400" />,
      height: 'standard',
      render: (expanded) => (
        <CopMiniGraph sessionId={sessionId} workspaceId={session.workspace_id} expanded={expanded} />
      ),
    },
    timeline: {
      id: 'timeline',
      title: 'Timeline',
      icon: <Clock className="h-4 w-4 text-blue-400" />,
      height: 'standard',
      render: (expanded) => (
        <CopTimelinePanel sessionId={sessionId} expanded={expanded} />
      ),
    },
    actors: {
      id: 'actors',
      title: 'Actors',
      icon: <Users className="h-4 w-4 text-purple-400" />,
      height: 'standard',
      render: (expanded) => (
        <LazyPanel><CopPersonaPanel sessionId={sessionId} expanded={expanded} /></LazyPanel>
      ),
    },
    rfi: {
      id: 'rfi',
      title: 'Key Questions & RFIs',
      icon: <HelpCircle className="h-4 w-4 text-amber-400" />,
      height: 'tall',
      badge: rfiCount > 0 ? rfiCount : undefined,
      badgeVariant: 'destructive' as const,
      render: (expanded) => (
        <div className="flex flex-col h-full gap-4">
          <CopQuestionsTab session={session} />
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Requests for Information
            </h3>
            <CopRfiTab sessionId={sessionId} onRfiCountChange={setRfiCount} />
          </div>
          {expanded && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <LazyPanel><CopGapAnalysis sessionId={sessionId} /></LazyPanel>
            </div>
          )}
        </div>
      ),
    },
    analysis: {
      id: 'analysis',
      title: 'Analysis & Hypotheses',
      icon: <Brain className="h-4 w-4 text-emerald-400" />,
      height: 'tall',
      render: (expanded) => (
        <div className="flex flex-col h-full gap-4">
          <CopAnalysisSummary sessionId={sessionId} expanded={expanded} />
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <CopHypothesisTab sessionId={sessionId} onPinToMap={onPinToMapFromHypothesis} />
          </div>
        </div>
      ),
    },
    tasks: {
      id: 'tasks',
      title: 'Task Board',
      icon: <ClipboardList className="h-4 w-4 text-orange-400" />,
      height: 'standard',
      render: (expanded) => (
        <LazyPanel><CopTaskBoard sessionId={sessionId} expanded={expanded} /></LazyPanel>
      ),
    },
    submissions: {
      id: 'submissions',
      title: 'Submission Inbox',
      icon: <Inbox className="h-4 w-4 text-cyan-400" />,
      height: 'standard',
      render: (expanded) => (
        <LazyPanel><CopSubmissionInbox sessionId={sessionId} expanded={expanded} /></LazyPanel>
      ),
    },
    assets: {
      id: 'assets',
      title: 'Assets & Resources',
      icon: <Package className="h-4 w-4 text-teal-400" />,
      height: 'standard',
      render: (expanded) => (
        <LazyPanel><CopAssetPanel sessionId={sessionId} expanded={expanded} /></LazyPanel>
      ),
    },
    playbooks: {
      id: 'playbooks',
      title: 'Playbook Automation',
      icon: <Zap className="h-4 w-4 text-yellow-400" />,
      height: 'standard',
      render: () => (
        <LazyPanel><CopPlaybookPanel sessionId={sessionId} /></LazyPanel>
      ),
    },
    claims: {
      id: 'claims',
      title: 'Claims Analysis',
      icon: <FileWarning className="h-4 w-4 text-indigo-400" />,
      height: 'tall',
      render: (expanded) => (
        <LazyPanel><CopClaimsPanel sessionId={sessionId} expanded={expanded} /></LazyPanel>
      ),
    },
    evidence: {
      id: 'evidence',
      title: 'Evidence & Intel Feed',
      icon: <FileText className="h-4 w-4 text-blue-400" />,
      height: 'standard',
      hideOn2xl: true,
      render: (expanded) => (
        <CopEvidenceFeed
          sessionId={sessionId}
          expanded={expanded}
          onPinToMap={onPinToMapFromFeed}
          onLinkPersona={onLinkPersona}
        />
      ),
    },
    activity: {
      id: 'activity',
      title: 'Activity Log',
      icon: <Activity className="h-4 w-4 text-slate-400" />,
      height: 'compact',
      hideOn2xl: true,
      render: (expanded) => (
        <CopActivityPanel sessionId={sessionId} expanded={expanded} />
      ),
    },
  }

  // ── Build rows from visible panels ──────────────────────────

  // Group consecutive half-width panels into grid rows, full-width panels get their own row
  const rows: PanelDef[][] = []
  let halfBuf: PanelDef[] = []

  for (const cfg of visiblePanels) {
    const def = panelDefs[cfg.id]
    if (!def) continue

    if (cfg.width === 'half') {
      halfBuf.push(def)
      if (halfBuf.length === 2) {
        rows.push(halfBuf)
        halfBuf = []
      }
    } else {
      if (halfBuf.length > 0) {
        rows.push(halfBuf)
        halfBuf = []
      }
      rows.push([def])
    }
  }
  if (halfBuf.length > 0) rows.push(halfBuf)

  return (
    <div className="2xl:flex 2xl:gap-4">
      {/* ── Left column: main content panels ── */}
      <div className="2xl:flex-1 2xl:min-w-0 space-y-3">
        {/* Pinned: Entities Quick-Access Panel */}
        <div data-panel="entities">
          <CopEntitiesPanel stats={stats} onOpenEntityDrawer={onOpenEntityDrawer} />
        </div>

        {/* Pinned: Map */}
        <CopPanelExpander
          id="map"
          title="Map"
          icon={<MapIcon className="h-4 w-4 text-green-400" />}
          height="h-[320px] sm:h-[400px]"
        >
          {(expanded) => (
            <CopMapWithLayers
              expanded={expanded}
              mapProps={{
                session,
                layers: layerData,
                pinPlacementMode,
                onPinPlaced,
                onMarkerOpenInFeed,
              }}
              layerProps={{
                activeLayers,
                onToggleLayer,
                layerCounts,
              }}
            />
          )}
        </CopPanelExpander>

        {/* Hidden panels restore bar */}
        {hiddenPanels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Hidden:</span>
            {hiddenPanels.map((p) => {
              const def = panelDefs[p.id]
              return def ? (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleVisible(p.id)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title={`Show ${def.title}`}
                >
                  {def.icon}
                  <span>{def.title}</span>
                </button>
              ) : null
            })}
            <button
              type="button"
              onClick={resetLayout}
              className="text-[10px] text-blue-500 hover:text-blue-400 ml-auto cursor-pointer"
              title="Reset panel layout to defaults"
            >
              Reset layout
            </button>
          </div>
        )}

        {/* Dynamic panel rows */}
        {rows.map((row, rowIdx) => {
          if (row.length === 2) {
            // Two half-width panels in a grid
            return (
              <div key={`row-${row[0]?.id ?? rowIdx}-${row[1]?.id ?? `${rowIdx}b`}`} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {row.map((def) => {
                  if (!def?.id) return null
                  if (def.hideOn2xl && is2xl) return null
                  const panelCfg = visiblePanels.find((p) => p.id === def.id)
                  const idx = visiblePanels.findIndex((p) => p.id === def.id)
                  return (
                    <div key={def.id} data-panel={def.id}>
                      <CopPanelExpander
                        id={def.id}
                        title={def.title}
                        icon={def.icon}
                        height={def.height}
                        badge={def.badge}
                        badgeVariant={def.badgeVariant}
                        panelWidth={panelCfg?.width}
                        onMoveUp={() => movePanel(def.id, 'up')}
                        onMoveDown={() => movePanel(def.id, 'down')}
                        onToggleWidth={() => toggleWidth(def.id)}
                        onHide={() => toggleVisible(def.id)}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < visiblePanels.length - 1}
                      >
                        {def.render}
                      </CopPanelExpander>
                    </div>
                  )
                })}
              </div>
            )
          }

          // Single panel (full-width or lone half)
          const def = row[0]
          if (!def?.id) return null
          if (def.hideOn2xl && is2xl) return null
          const panelCfg = visiblePanels.find((p) => p.id === def.id)
          const idx = visiblePanels.findIndex((p) => p.id === def.id)
          return (
            <div key={def.id} data-panel={def.id}>
              <CopPanelExpander
                id={def.id}
                title={def.title}
                icon={def.icon}
                height={def.height}
                badge={def.badge}
                badgeVariant={def.badgeVariant}
                panelWidth={panelCfg?.width}
                onMoveUp={() => movePanel(def.id, 'up')}
                onMoveDown={() => movePanel(def.id, 'down')}
                onToggleWidth={() => toggleWidth(def.id)}
                onHide={() => toggleVisible(def.id)}
                canMoveUp={idx > 0}
                canMoveDown={idx < visiblePanels.length - 1}
              >
                {def.render}
              </CopPanelExpander>
            </div>
          )
        })}
      </div>

      {/* ── Right column: Evidence + Activity sidebar (2xl+ only) ── */}
      {is2xl && (
        <div className="flex flex-col w-[400px] shrink-0 sticky top-0 h-[calc(100vh-200px)] gap-4">
          {/* Evidence & Intel Feed — scrollable, takes remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CopPanelExpander
              id="evidence-sidebar"
              title="Evidence & Intel Feed"
              icon={<FileText className="h-4 w-4 text-blue-400" />}
              height="tall"
            >
              {(expanded) => (
                <CopEvidenceFeed
                  sessionId={sessionId}
                  expanded={expanded}
                  onPinToMap={onPinToMapFromFeed}
                  onLinkPersona={onLinkPersona}
                />
              )}
            </CopPanelExpander>
          </div>

          {/* Activity Log — compact at bottom */}
          <div className="shrink-0">
            <CopPanelExpander
              id="activity-sidebar"
              title="Activity Log"
              icon={<Activity className="h-4 w-4 text-slate-400" />}
              height="compact"
            >
              {(expanded) => (
                <CopActivityPanel sessionId={sessionId} expanded={expanded} />
              )}
            </CopPanelExpander>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Monitor Mode Layout ─────────────────────────────────────────

interface MonitorLayoutProps {
  sessionId: string
  session: CopSession
  showMap: boolean
  setShowMap: (v: boolean) => void
  activeLayers: string[]
  onToggleLayer: (id: string) => void
  layerData: Record<string, CopFeatureCollection>
  layerCounts: Record<string, number>
  pinPlacementMode?: boolean
  onPinPlaced?: (lat: number, lon: number) => void
  onPinToMapFromFeed?: (item: { id: string; title: string }) => void
  onPinToMapFromHypothesis?: (hypothesisId: string, text: string) => void
  onLinkPersona?: (handle: string, platform: string, itemId: string) => void
  onOpenEntityDrawer?: (tab?: string, prefill?: any) => void
  onMarkerOpenInFeed?: (sourceType: string, sourceId: string) => void
}

function MonitorLayout({
  sessionId,
  session,
  showMap,
  setShowMap,
  activeLayers,
  onToggleLayer,
  layerData,
  layerCounts,
  pinPlacementMode,
  onPinPlaced,
  onPinToMapFromFeed,
  onPinToMapFromHypothesis,
  onLinkPersona,
  onOpenEntityDrawer,
  onMarkerOpenInFeed,
}: MonitorLayoutProps) {
  return (
    <>
      {/* Evidence Feed (tall) */}
      <CopPanelExpander
        id="evidence"
        title="Evidence & Intel Feed"
        icon={<FileText className="h-4 w-4 text-blue-400" />}
        height="tall"
      >
        {(expanded) => (
          <CopEvidenceFeed 
            sessionId={sessionId} 
            expanded={expanded} 
            monitorMode 
            onPinToMap={onPinToMapFromFeed} 
            onLinkPersona={onLinkPersona}
          />
        )}
      </CopPanelExpander>

      {/* Map (optional) */}
      {showMap ? (
        <CopPanelExpander
          id="map"
          title="Map"
          icon={<MapIcon className="h-4 w-4 text-green-400" />}
          height="tall"
        >
          {(expanded) => (
            <CopMapWithLayers
              expanded={expanded}
              mapProps={{
                session,
                layers: layerData,
                pinPlacementMode,
                onPinPlaced,
                onMarkerOpenInFeed,
              }}
              layerProps={{
                activeLayers,
                onToggleLayer,
                layerCounts,
              }}
            />
          )}
        </CopPanelExpander>
      ) : (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Show Map Panel</span>
        </button>
      )}

      {/* Key Questions & Hypotheses */}
      <CopPanelExpander
        id="analysis"
        title="Intel & Hypotheses"
        icon={<HelpCircle className="h-4 w-4 text-amber-400" />}
        height="tall"
      >
        {() => (
          <div className="flex flex-col h-full gap-4">
            <CopQuestionsTab session={session} />
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <CopHypothesisTab sessionId={sessionId} onPinToMap={onPinToMapFromHypothesis} />
            </div>
          </div>
        )}
      </CopPanelExpander>

      {/* Task Board (compact in monitor mode) */}
      <CopPanelExpander
        id="tasks"
        title="Task Board"
        icon={<ClipboardList className="h-4 w-4 text-orange-400" />}
        height="compact"
      >
        {(expanded) => (
          <LazyPanel><CopTaskBoard sessionId={sessionId} expanded={expanded} /></LazyPanel>
        )}
      </CopPanelExpander>

      {/* Assets (compact in monitor mode) */}
      <CopPanelExpander
        id="assets"
        title="Assets & Resources"
        icon={<Package className="h-4 w-4 text-teal-400" />}
        height="compact"
      >
        {(expanded) => (
          <LazyPanel><CopAssetPanel sessionId={sessionId} expanded={expanded} /></LazyPanel>
        )}
      </CopPanelExpander>

      {/* Actors (research targets) — full width */}
      <CopPanelExpander
        id="actors"
        title="Actors"
        icon={<Users className="h-4 w-4 text-purple-400" />}
        height="standard"
      >
        {(expanded) => (
          <LazyPanel><CopPersonaPanel sessionId={sessionId} expanded={expanded} /></LazyPanel>
        )}
      </CopPanelExpander>

    </>
  )
}
