/**
 * Active COP View Page
 *
 * Full-screen map with layer sidebar, header bar with controls,
 * and KPI strip showing key questions + feature counts.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Share2,
  Radio,
  Loader2,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CopMap from '@/components/cop/CopMap'
import CopLayerPanel from '@/components/cop/CopLayerPanel'
import { COP_LAYERS, getLayerById } from '@/components/cop/CopLayerCatalog'
import type { CopSession, CopFeatureCollection, CopLayerDef } from '@/types/cop'

// ── Template labels ──────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  custom: 'Custom',
}

// ── Component ────────────────────────────────────────────────────

export default function CopPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<CopSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeLayers, setActiveLayers] = useState<string[]>([])
  const [layerData, setLayerData] = useState<Record<string, CopFeatureCollection>>({})
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({})
  const [refreshing, setRefreshing] = useState(false)

  // Auto-refresh timer refs
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  // ── Auth headers ────────────────────────────────────────────────

  function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (userHash) headers['X-User-Hash'] = userHash
    return headers
  }

  // ── Fetch session ───────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cop/sessions/${id}`, { headers: getHeaders() })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)
      const data = await res.json()
      const sess: CopSession = data.session ?? data
      setSession(sess)
      setActiveLayers(sess.active_layers ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // ── Fetch a single layer as GeoJSON ─────────────────────────────

  const fetchLayerData = useCallback(
    async (layerDef: CopLayerDef) => {
      if (!id) return
      if (layerDef.source.type === 'static') return // client-side only

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

  // ── Fetch all active layers ─────────────────────────────────────

  const fetchAllLayers = useCallback(async () => {
    setRefreshing(true)
    const promises = activeLayers
      .map(getLayerById)
      .filter((l): l is CopLayerDef => l != null)
      .map(fetchLayerData)
    await Promise.allSettled(promises)
    setRefreshing(false)
  }, [activeLayers, fetchLayerData])

  // Fetch layers whenever activeLayers change
  useEffect(() => {
    if (activeLayers.length > 0) {
      fetchAllLayers()
    }
  }, [activeLayers, fetchAllLayers])

  // ── Auto-refresh layers ─────────────────────────────────────────

  useEffect(() => {
    // Clear all existing timers
    for (const timer of timersRef.current.values()) {
      clearInterval(timer)
    }
    timersRef.current.clear()

    // Set up new timers for active layers with refresh intervals
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

  // ── Toggle layer (optimistic + persist) ─────────────────────────

  const handleToggleLayer = useCallback(
    async (layerId: string) => {
      const newLayers = activeLayers.includes(layerId)
        ? activeLayers.filter((l) => l !== layerId)
        : [...activeLayers, layerId]

      setActiveLayers(newLayers)

      // Persist to server
      if (id) {
        try {
          await fetch(`/api/cop/sessions/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ active_layers: newLayers }),
          })
        } catch {
          // Revert on failure
          setActiveLayers(activeLayers)
        }
      }
    },
    [activeLayers, id],
  )

  // ── Share handler ───────────────────────────────────────────────

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/dashboard/cop/${id}`
    navigator.clipboard.writeText(url).catch(() => {})
  }, [id])

  // ── Total feature count ─────────────────────────────────────────

  const totalFeatures = Object.values(layerCounts).reduce((sum, c) => sum + c, 0)

  // ── Loading state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────

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

  // ── Main layout ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* ── Header bar ──────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2 bg-background border-b shrink-0">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/cop')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {/* Name + template badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="font-semibold text-sm truncate">{session.name}</h1>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {TEMPLATE_LABELS[session.template_type] ?? session.template_type}
          </Badge>
        </div>

        {/* Key questions indicator */}
        {session.key_questions?.length > 0 && (
          <span
            className="hidden md:flex items-center gap-1 text-xs text-muted-foreground"
            title={session.key_questions.join('\n')}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {session.key_questions.length} question{session.key_questions.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAllLayers}
            disabled={refreshing}
            title="Refresh all layers"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>

          {/* ATAK / CoT export */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/cop/${id}/cot`, '_blank')}
            title="Export as Cursor-on-Target (ATAK compatible)"
          >
            <Radio className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={handleShare} title="Copy share link">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Body: sidebar + map ─────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Layer panel sidebar */}
        <CopLayerPanel
          activeLayers={activeLayers}
          onToggleLayer={handleToggleLayer}
          layerCounts={layerCounts}
        />

        {/* Map */}
        <div className="flex-1 relative">
          <CopMap session={session} layers={layerData} />
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────── */}
      <footer className="flex items-center gap-4 px-4 py-2 bg-muted/50 border-t text-xs text-muted-foreground shrink-0 overflow-x-auto">
        <span className="flex items-center gap-1 font-medium text-foreground">
          <Layers className="h-3.5 w-3.5" />
          {activeLayers.length} active layer{activeLayers.length !== 1 ? 's' : ''}
        </span>
        <span className="text-border">|</span>
        <span>{totalFeatures} total feature{totalFeatures !== 1 ? 's' : ''}</span>

        {session.key_questions?.length > 0 && (
          <>
            <span className="text-border">|</span>
            {session.key_questions.map((q, i) => (
              <span key={i} className="flex items-center gap-1">
                <HelpCircle className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[200px]">{q}</span>
              </span>
            ))}
          </>
        )}
      </footer>
    </div>
  )
}
