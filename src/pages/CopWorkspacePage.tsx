/**
 * CopWorkspacePage — Multi-panel investigation workspace
 *
 * Replaces the old map-only COP view with a scrollable panel grid.
 * Two modes:
 *   - Progress: entity graph, timeline, questions/RFIs, analysis, evidence feed, optional map
 *   - Monitor: evidence feed, optional map, key questions
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  MonitorPlay,
  UserPlus,
  Share2,
  Radio,
  Loader2,
  Map,
  Network,
  Clock,
  HelpCircle,
  Brain,
  FileText,
  Plus,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import CopStatusStrip from '@/components/cop/CopStatusStrip'
import CopPanelExpander from '@/components/cop/CopPanelExpander'
import CopMiniGraph from '@/components/cop/CopMiniGraph'
import CopTimelinePanel from '@/components/cop/CopTimelinePanel'
import CopAnalysisSummary from '@/components/cop/CopAnalysisSummary'
import CopEvidenceFeed from '@/components/cop/CopEvidenceFeed'
import CopQuestionsTab from '@/components/cop/CopQuestionsTab'
import CopRfiTab from '@/components/cop/CopRfiTab'
import CopMap from '@/components/cop/CopMap'
import CopLayerPanel from '@/components/cop/CopLayerPanel'
import CopActivityPanel from '@/components/cop/CopActivityPanel'
import CopInviteDialog from '@/components/cop/CopInviteDialog'
import CopGapAnalysis from '@/components/cop/CopGapAnalysis'
import { getLayerById } from '@/components/cop/CopLayerCatalog'
import type { CopSession, CopFeatureCollection, CopLayerDef, CopWorkspaceMode } from '@/types/cop'

// ── Template labels ──────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
}

// ── Auth headers ──────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
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
  const [showMap, setShowMap] = useState(false)

  // ── RFI badge count ────────────────────────────────────────────
  const [rfiCount, setRfiCount] = useState(0)

  // ── Invite dialog state ───────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false)

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
      const res = await fetch(`/api/cop/sessions/${id}`, { headers: getHeaders(), signal })
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

  // ── Fetch a single layer as GeoJSON ────────────────────────────

  const fetchLayerData = useCallback(
    async (layerDef: CopLayerDef) => {
      if (!id) return
      if (layerDef.source.type === 'static') return

      try {
        const endpoint = `/api/cop/${id}${layerDef.source.endpoint}`
        const res = await fetch(endpoint, { headers: getHeaders() })
        if (!res.ok) return

        const fc: CopFeatureCollection = await res.json()
        setLayerData((prev) => ({ ...prev, [layerDef.id]: fc }))
        setLayerCounts((prev) => ({
          ...prev,
          [layerDef.id]: fc.features?.length ?? 0,
        }))
      } catch {
        // Silently skip failed layers
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
            headers: getHeaders(),
            body: JSON.stringify({ active_layers: newLayers }),
          })
        } catch {
          setActiveLayers(prevLayers)
        }
      }
    },
    [activeLayers, id],
  )

  // ── Share handler ──────────────────────────────────────────────

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard/cop/${id}`
    navigator.clipboard.writeText(url).catch(() => {})
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
    <div className="flex flex-col bg-background min-h-[calc(100dvh_-_4rem)] sm:min-h-[calc(100dvh_-_4.5rem)]">
      {/* ── Header bar ──────────────────────────────────────────── */}
      <header className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-background border-b shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/cop')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Back</span>
        </Button>

        {/* Session name + template badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="font-semibold text-sm truncate">{session.name}</h1>
          <Badge variant="secondary" className="shrink-0 text-[10px] hidden sm:inline-flex">
            {TEMPLATE_LABELS[session.template_type] ?? session.template_type}
          </Badge>
        </div>

        {/* Mode toggle (segmented control) */}
        <div className="flex items-center bg-muted rounded-md p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode('progress')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              mode === 'progress'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Progress</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('monitor')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              mode === 'monitor'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Monitor</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" title="Invite collaborator" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} title="Copy share link">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/cop/${id}/cot`, '_blank')}
            title="Export as Cursor-on-Target (ATAK compatible)"
          >
            <Radio className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Status strip ────────────────────────────────────────── */}
      <CopStatusStrip sessionId={id!} />

      {/* ── Panel grid ──────────────────────────────────────────── */}
      <div className="overflow-y-auto p-3 md:p-4 lg:p-6 flex-1">
        <div className="max-w-7xl mx-auto space-y-4">
          {mode === 'progress' ? (
            <ProgressLayout
              sessionId={id!}
              session={session}
              showMap={showMap}
              setShowMap={setShowMap}
              rfiCount={rfiCount}
              setRfiCount={setRfiCount}
              activeLayers={activeLayers}
              onToggleLayer={handleToggleLayer}
              layerData={layerData}
              layerCounts={layerCounts}
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
            />
          )}
        </div>
      </div>

      {/* Invite dialog */}
      <CopInviteDialog
        sessionId={id!}
        sessionName={session.name}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  )
}

// ── Progress Mode Layout ────────────────────────────────────────

interface ProgressLayoutProps {
  sessionId: string
  session: CopSession
  showMap: boolean
  setShowMap: (v: boolean) => void
  rfiCount: number
  setRfiCount: (v: number) => void
  activeLayers: string[]
  onToggleLayer: (id: string) => void
  layerData: Record<string, CopFeatureCollection>
  layerCounts: Record<string, number>
}

function ProgressLayout({
  sessionId,
  session,
  showMap,
  setShowMap,
  rfiCount,
  setRfiCount,
  activeLayers,
  onToggleLayer,
  layerData,
  layerCounts,
}: ProgressLayoutProps) {
  return (
    <>
      {/* Row 1: Entity Relationships + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CopPanelExpander
          title="Entity Relationships"
          icon={<Network className="h-4 w-4 text-purple-400" />}
        >
          {(expanded) => (
            <CopMiniGraph sessionId={sessionId} expanded={expanded} />
          )}
        </CopPanelExpander>

        <CopPanelExpander
          title="Timeline"
          icon={<Clock className="h-4 w-4 text-blue-400" />}
        >
          {(expanded) => (
            <CopTimelinePanel sessionId={sessionId} expanded={expanded} />
          )}
        </CopPanelExpander>
      </div>

      {/* Row 2: Key Questions & RFIs + Analysis Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CopPanelExpander
          title="Key Questions & RFIs"
          icon={<HelpCircle className="h-4 w-4 text-amber-400" />}
          badge={rfiCount > 0 ? rfiCount : undefined}
          badgeVariant="destructive"
        >
          {(expanded) => (
            <div className="flex flex-col h-full gap-4">
              <div className={expanded ? '' : 'flex-1 overflow-hidden'}>
                <CopQuestionsTab session={session} />
              </div>
              {expanded && (
                <>
                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Requests for Information
                    </h3>
                    <CopRfiTab sessionId={sessionId} onRfiCountChange={setRfiCount} />
                  </div>
                  <div className="border-t border-gray-700 pt-4">
                    <CopGapAnalysis sessionId={sessionId} />
                  </div>
                </>
              )}
            </div>
          )}
        </CopPanelExpander>

        <CopPanelExpander
          title="Analysis Summary"
          icon={<Brain className="h-4 w-4 text-emerald-400" />}
        >
          {(expanded) => (
            <CopAnalysisSummary sessionId={sessionId} expanded={expanded} />
          )}
        </CopPanelExpander>
      </div>

      {/* Row 3: Evidence & Intel Feed (full-width) */}
      <CopPanelExpander
        title="Evidence & Intel Feed"
        icon={<FileText className="h-4 w-4 text-blue-400" />}
        collapsedHeight="h-[280px]"
      >
        {(expanded) => (
          <CopEvidenceFeed sessionId={sessionId} expanded={expanded} />
        )}
      </CopPanelExpander>

      {/* Activity Log */}
      <CopPanelExpander
        title="Activity Log"
        icon={<Activity className="h-4 w-4 text-gray-400" />}
        collapsedHeight="h-[200px]"
      >
        {(expanded) => (
          <CopActivityPanel sessionId={sessionId} expanded={expanded} />
        )}
      </CopPanelExpander>

      {/* Row 4: Map (optional) */}
      {showMap ? (
        <CopPanelExpander
          title="Map"
          icon={<Map className="h-4 w-4 text-green-400" />}
          collapsedHeight="h-[400px]"
        >
          {(expanded) => (
            <div className={cn('flex h-full', expanded ? 'min-h-[600px]' : '')}>
              {expanded && (
                <CopLayerPanel
                  activeLayers={activeLayers}
                  onToggleLayer={onToggleLayer}
                  layerCounts={layerCounts}
                />
              )}
              <div className="flex-1">
                <CopMap session={session} layers={layerData} />
              </div>
            </div>
          )}
        </CopPanelExpander>
      ) : (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Show Map Panel</span>
        </button>
      )}
    </>
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
}: MonitorLayoutProps) {
  return (
    <>
      {/* Evidence Feed (tall) */}
      <CopPanelExpander
        title="Evidence & Intel Feed"
        icon={<FileText className="h-4 w-4 text-blue-400" />}
        collapsedHeight="h-[500px]"
      >
        {(expanded) => (
          <CopEvidenceFeed sessionId={sessionId} expanded={expanded} monitorMode />
        )}
      </CopPanelExpander>

      {/* Map (optional) */}
      {showMap ? (
        <CopPanelExpander
          title="Map"
          icon={<Map className="h-4 w-4 text-green-400" />}
          collapsedHeight="h-[400px]"
        >
          {(expanded) => (
            <div className={cn('flex h-full', expanded ? 'min-h-[600px]' : '')}>
              {expanded && (
                <CopLayerPanel
                  activeLayers={activeLayers}
                  onToggleLayer={onToggleLayer}
                  layerCounts={layerCounts}
                />
              )}
              <div className="flex-1">
                <CopMap session={session} layers={layerData} />
              </div>
            </div>
          )}
        </CopPanelExpander>
      ) : (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Show Map Panel</span>
        </button>
      )}

      {/* Key Questions */}
      <CopPanelExpander
        title="Key Questions"
        icon={<HelpCircle className="h-4 w-4 text-amber-400" />}
      >
        {() => (
          <CopQuestionsTab session={session} />
        )}
      </CopPanelExpander>
    </>
  )
}
