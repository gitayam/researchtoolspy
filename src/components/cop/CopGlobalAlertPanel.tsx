/**
 * CopGlobalAlertPanel — Real-time intelligence alert feed from REDSIGHT
 *
 * Displays global alerts with severity indicators, credibility scores,
 * and action workflows (dismiss, mark for action/analysis, link to RFI).
 * Auto-refreshes every 60 seconds when the panel is expanded.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Radio,
  Loader2,
  X,
  CheckSquare,
  Search,
  Link2,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  Shield,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

interface AlertItem {
  incident_id: string
  incident_type?: string
  severity?: string
  location_name?: string
  country_code?: string
  summary?: string
  damage_assessment?: string
  credibility?: number
  source_types?: string[]
  event_occurred_at?: string
  lat?: number
  lon?: number
  status: 'new' | 'dismissed' | 'action' | 'analysis'
  linked_rfi_id?: string | null
  linked_task_id?: string | null
  notes?: string | null
}

interface CopGlobalAlertPanelProps {
  sessionId: string
  expanded: boolean
  onScrollToPanel?: (panelId: string, entityId: string) => void
}

type SeverityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type StatusFilter = 'all' | 'new' | 'actioned' | 'dismissed'

// ── Constants ────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  LOW: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  dismissed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  action: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  analysis: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

const AUTO_REFRESH_MS = 60_000

// ── Helpers ──────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const now = Date.now()
  const diff = now - d.getTime()

  if (diff < 0) return 'just now'
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000)
    return `${mins}m ago`
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000)
    return `${hrs}h ago`
  }
  const days = Math.floor(diff / 86_400_000)
  return `${days}d ago`
}

function formatCredibility(value: number | undefined): string {
  if (value == null) return '--'
  return `${Math.round(value * 100)}%`
}

// ── Component ────────────────────────────────────────────────────

export default function CopGlobalAlertPanel({ sessionId, expanded, onScrollToPanel }: CopGlobalAlertPanelProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [enabled, setEnabled] = useState(false)
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('new')
  const [showFilters, setShowFilters] = useState(false)

  // Expanded alert card
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  // RFI link dialog
  const [linkingRfiFor, setLinkingRfiFor] = useState<string | null>(null)
  const [rfiIdInput, setRfiIdInput] = useState('')

  // Region edit
  const [editingRegion, setEditingRegion] = useState(false)
  const [regionDraft, setRegionDraft] = useState('')

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch alerts ─────────────────────────────────────────────

  const fetchAlerts = useCallback(async (showLoader = false, signal?: AbortSignal) => {
    if (showLoader) setLoading(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/alerts`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAlerts(data.alerts ?? [])
      setEnabled(!!data.enabled)
      if (data.region) {
        setRegion(data.region)
        setRegionDraft(data.region)
      }
      setError(null)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      if (showLoader) setError('Failed to load alerts')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [sessionId])

  // Initial load + auto-refresh every 60s when expanded and enabled
  useEffect(() => {
    const controller = new AbortController()
    fetchAlerts(true, controller.signal)

    if (expanded && enabled) {
      intervalRef.current = setInterval(() => fetchAlerts(false, controller.signal), AUTO_REFRESH_MS)
    }

    return () => {
      controller.abort()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [expanded, enabled, fetchAlerts])

  // ── Toggle enabled ───────────────────────────────────────────

  const handleToggleEnabled = useCallback(async () => {
    setToggling(true)
    const newEnabled = !enabled
    try {
      const res = await fetch(`/api/cop/sessions/${sessionId}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({
          global_alerts_enabled: newEnabled ? 1 : 0,
          global_alerts_region: region || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to update session')
      setEnabled(newEnabled)
      if (newEnabled) {
        // Fetch alerts now that it's enabled
        await fetchAlerts(true)
      }
    } catch {
      setError('Failed to toggle alerts')
    } finally {
      setToggling(false)
    }
  }, [enabled, region, sessionId, fetchAlerts])

  // ── Save region ──────────────────────────────────────────────

  const handleSaveRegion = useCallback(async () => {
    const trimmed = regionDraft.trim()
    try {
      const res = await fetch(`/api/cop/sessions/${sessionId}`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({
          global_alerts_enabled: enabled ? 1 : 0,
          global_alerts_region: trimmed || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to update region')
      setRegion(trimmed)
      setEditingRegion(false)
      await fetchAlerts(false)
    } catch {
      setError('Failed to save region filter')
    }
  }, [regionDraft, sessionId, fetchAlerts])

  // ── Alert actions ────────────────────────────────────────────

  const handleAction = useCallback(async (
    incidentId: string,
    action: 'dismiss' | 'mark_action' | 'mark_analysis' | 'link_rfi',
    extra?: Record<string, string>
  ) => {
    setActionLoading(incidentId)
    try {
      const res = await fetch(`/api/cop/${sessionId}/alerts`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ action, incident_id: incidentId, ...extra }),
      })
      if (!res.ok) throw new Error('Action failed')

      // Optimistic update
      setAlerts(prev => prev.map(a => {
        if (a.incident_id !== incidentId) return a
        switch (action) {
          case 'dismiss': return { ...a, status: 'dismissed' as const }
          case 'mark_action': return { ...a, status: 'action' as const }
          case 'mark_analysis': return { ...a, status: 'analysis' as const }
          case 'link_rfi': return { ...a, linked_rfi_id: extra?.rfi_id ?? null }
          default: return a
        }
      }))
    } catch {
      setError('Action failed. Please try again.')
    } finally {
      setActionLoading(null)
      setLinkingRfiFor(null)
      setRfiIdInput('')
    }
  }, [sessionId])

  // ── Filtered alerts ──────────────────────────────────────────

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (severityFilter !== 'all' && a.severity?.toUpperCase() !== severityFilter) return false
      if (statusFilter === 'new' && a.status !== 'new') return false
      if (statusFilter === 'actioned' && a.status !== 'action' && a.status !== 'analysis') return false
      if (statusFilter === 'dismissed' && a.status !== 'dismissed') return false
      return true
    })
  }, [alerts, severityFilter, statusFilter])

  const newCount = alerts.filter(a => a.status === 'new').length

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="text-xs text-slate-500">Loading alerts...</span>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Enable/disable toggle + region */}
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">REDSIGHT Feed</span>
            {enabled && newCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {newCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {enabled && (
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'h-7 w-7 flex items-center justify-center rounded-md border transition-colors cursor-pointer',
                  showFilters
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600'
                )}
                title="Toggle filters"
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleEnabled}
              disabled={toggling}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                enabled ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'
              )}
              role="switch"
              aria-checked={enabled}
              aria-label="Toggle global alerts"
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
                  enabled ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </div>

        {/* Region filter */}
        {enabled && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            {editingRegion ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={regionDraft}
                  onChange={(e) => setRegionDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRegion(); if (e.key === 'Escape') setEditingRegion(false) }}
                  placeholder="e.g., Ukraine, Middle East, Global"
                  className="flex-1 h-6 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSaveRegion}
                  className="h-6 text-[10px] px-2 cursor-pointer"
                >
                  Save
                </Button>
                <button
                  type="button"
                  onClick={() => { setEditingRegion(false); setRegionDraft(region) }}
                  className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditingRegion(true); setRegionDraft(region) }}
                className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer truncate"
              >
                {region || 'All regions (click to filter)'}
              </button>
            )}
          </div>
        )}

        {/* Filters row */}
        {enabled && showFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="h-6 px-1.5 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All severity</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-6 px-1.5 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All status</option>
              <option value="new">New only</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <span className="text-[10px] text-slate-400 ml-auto">
              {filteredAlerts.length} of {alerts.length}
            </span>
          </div>
        )}

        {error && (
          <p className="text-[10px] text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {!enabled ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Radio className="h-6 w-6 text-slate-400 dark:text-slate-600" />
            <p className="text-xs text-slate-500">Global alert feed is disabled</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[240px]">
              Enable the REDSIGHT feed to receive real-time intelligence alerts for your area of interest.
            </p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Shield className="h-6 w-6 text-slate-400 dark:text-slate-600" />
            <p className="text-xs text-slate-500">No alerts match your filters</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[220px]">
              {alerts.length > 0
                ? 'Try adjusting severity or status filters to see more alerts.'
                : 'No alerts received yet. The feed auto-refreshes every 60 seconds.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlerts.map((alert) => {
              const isExpanded = expandedAlert === alert.incident_id
              const isActioning = actionLoading === alert.incident_id
              const severityKey = alert.severity?.toUpperCase() ?? 'LOW'
              const severityClass = SEVERITY_COLORS[severityKey] ?? SEVERITY_COLORS.LOW
              const statusClass = STATUS_COLORS[alert.status] ?? STATUS_COLORS.new

              return (
                <div
                  key={alert.incident_id}
                  className={cn(
                    'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden transition-all',
                    alert.status === 'dismissed' && 'opacity-60'
                  )}
                >
                  {/* Alert header — clickable to expand */}
                  <button
                    type="button"
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.incident_id)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer min-h-[44px]"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Top row: severity + type + location */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={cn('text-[9px] px-1.5 py-0 leading-4 border', severityClass)}>
                          {severityKey}
                        </Badge>
                        {alert.incident_type && (
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                            {alert.incident_type}
                          </span>
                        )}
                        {alert.location_name && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {alert.location_name}
                            {alert.country_code ? ` (${alert.country_code})` : ''}
                          </span>
                        )}
                      </div>

                      {/* Summary (truncated in collapsed) */}
                      {alert.summary && (
                        <p className={cn(
                          'text-xs text-slate-600 dark:text-slate-300 leading-relaxed',
                          !isExpanded && 'line-clamp-2'
                        )}>
                          {alert.summary}
                        </p>
                      )}

                      {/* Meta row: credibility, time, status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {alert.credibility != null && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                            <Shield className="h-2.5 w-2.5" />
                            {formatCredibility(alert.credibility)}
                          </span>
                        )}
                        {alert.event_occurred_at && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime(alert.event_occurred_at)}
                          </span>
                        )}
                        <Badge className={cn('text-[9px] px-1.5 py-0 leading-4 border-transparent', statusClass)}>
                          {alert.status}
                        </Badge>
                        {alert.linked_rfi_id && (
                          <span className="text-[10px] text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
                            <Link2 className="h-2.5 w-2.5" />
                            RFI linked
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2.5 space-y-2.5">
                      {/* Damage assessment */}
                      {alert.damage_assessment && (
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Damage Assessment
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            {alert.damage_assessment}
                          </p>
                        </div>
                      )}

                      {/* Source types */}
                      {alert.source_types && alert.source_types.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-0.5">Sources:</span>
                          {alert.source_types.map((src) => (
                            <Badge
                              key={src}
                              variant="outline"
                              className="text-[8px] px-1 py-0 leading-3 text-slate-600 dark:text-slate-400"
                            >
                              {src}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Coordinates */}
                      {alert.lat != null && alert.lon != null && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {alert.lat.toFixed(4)}, {alert.lon.toFixed(4)}
                        </div>
                      )}

                      {/* Notes */}
                      {alert.notes && (
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Notes
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            {alert.notes}
                          </p>
                        </div>
                      )}

                      {/* RFI link dialog */}
                      {linkingRfiFor === alert.incident_id && (
                        <div className="flex items-center gap-1.5 p-2 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <input
                            type="text"
                            value={rfiIdInput}
                            onChange={(e) => setRfiIdInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && rfiIdInput.trim()) {
                                handleAction(alert.incident_id, 'link_rfi', { rfi_id: rfiIdInput.trim() })
                              }
                              if (e.key === 'Escape') { setLinkingRfiFor(null); setRfiIdInput('') }
                            }}
                            placeholder="RFI ID..."
                            className="flex-1 h-7 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (rfiIdInput.trim()) handleAction(alert.incident_id, 'link_rfi', { rfi_id: rfiIdInput.trim() })
                            }}
                            disabled={!rfiIdInput.trim() || isActioning}
                            className="h-7 text-[10px] px-2 cursor-pointer"
                          >
                            {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Link'}
                          </Button>
                          <button
                            type="button"
                            onClick={() => { setLinkingRfiFor(null); setRfiIdInput('') }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {alert.status !== 'dismissed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleAction(alert.incident_id, 'dismiss') }}
                            disabled={isActioning}
                            className="h-8 min-w-[44px] text-[10px] px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                            title="Dismiss alert"
                          >
                            {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-0.5" />}
                            Dismiss
                          </Button>
                        )}
                        {alert.status !== 'action' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleAction(alert.incident_id, 'mark_action') }}
                            disabled={isActioning}
                            className="h-8 min-w-[44px] text-[10px] px-2 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 border-amber-200 dark:border-amber-800 cursor-pointer"
                            title="Mark for action"
                          >
                            {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckSquare className="h-3 w-3 mr-0.5" />}
                            Action
                          </Button>
                        )}
                        {alert.status !== 'analysis' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleAction(alert.incident_id, 'mark_analysis') }}
                            disabled={isActioning}
                            className="h-8 min-w-[44px] text-[10px] px-2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 border-purple-200 dark:border-purple-800 cursor-pointer"
                            title="Mark for analysis"
                          >
                            {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-0.5" />}
                            Analyze
                          </Button>
                        )}
                        {!alert.linked_rfi_id && linkingRfiFor !== alert.incident_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); setLinkingRfiFor(alert.incident_id) }}
                            disabled={isActioning}
                            className="h-8 min-w-[44px] text-[10px] px-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 border-blue-200 dark:border-blue-800 cursor-pointer"
                            title="Link to RFI"
                          >
                            <Link2 className="h-3 w-3 mr-0.5" />
                            Link RFI
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
