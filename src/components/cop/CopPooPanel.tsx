/**
 * CopPooPanel -- Create and manage Point of Origin (POO) estimates.
 *
 * Renders a list of existing estimates with inline editing, plus a form
 * for creating new estimates. Each estimate can have a max-range circle,
 * probability sector, and min-range ring rendered on the COP map.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Target,
  Plus,
  Trash2,
  Pencil,
  X,
  Compass,
  Navigation,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCopHeaders } from '@/lib/cop-auth'
import type { PooEstimate } from '@/components/cop/poo-geometry'

// ── Constants ────────────────────────────────────────────────────

const CONFIDENCE_OPTIONS = ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'DOUBTFUL'] as const
type Confidence = typeof CONFIDENCE_OPTIONS[number]

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  CONFIRMED: 'text-green-500 dark:text-green-400 bg-green-500/10',
  PROBABLE: 'text-blue-500 dark:text-blue-400 bg-blue-500/10',
  POSSIBLE: 'text-yellow-500 dark:text-yellow-400 bg-yellow-500/10',
  DOUBTFUL: 'text-red-500 dark:text-red-400 bg-red-500/10',
}

const BEARING_LABELS: Record<string, string> = {
  '0': 'N', '45': 'NE', '90': 'E', '135': 'SE',
  '180': 'S', '225': 'SW', '270': 'W', '315': 'NW',
}

function bearingToCardinal(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const idx = Math.round(((deg % 360 + 360) % 360) / 22.5) % 16
  return directions[idx]
}

// ── Form state ───────────────────────────────────────────────────

interface PooFormData {
  name: string
  description: string
  impact_lat: string
  impact_lon: string
  max_range_km: string
  min_range_km: string
  approach_bearing: string
  sector_width_deg: string
  confidence: string
  range_basis: string
  bearing_basis: string
}

const EMPTY_FORM: PooFormData = {
  name: '',
  description: '',
  impact_lat: '',
  impact_lon: '',
  max_range_km: '10',
  min_range_km: '0',
  approach_bearing: '',
  sector_width_deg: '90',
  confidence: 'POSSIBLE',
  range_basis: '',
  bearing_basis: '',
}

// ── Props ────────────────────────────────────────────────────────

interface CopPooPanelProps {
  sessionId: string
  onEstimateCreated?: () => void
  onPickFromMap?: () => void
  pickedLocation?: { lat: number; lon: number } | null
}

// ── Component ────────────────────────────────────────────────────

export default function CopPooPanel({
  sessionId,
  onEstimateCreated,
  onPickFromMap,
  pickedLocation,
}: CopPooPanelProps) {
  const [estimates, setEstimates] = useState<PooEstimate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PooFormData>(EMPTY_FORM)

  // ── Fetch estimates ──────────────────────────────────────────

  const fetchEstimates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cop/${sessionId}/poo-estimates`, {
        headers: getCopHeaders(),
      })
      if (!res.ok) throw new Error(`Failed to fetch POO estimates (${res.status})`)
      const data = await res.json()
      setEstimates(data.estimates ?? data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchEstimates()
  }, [fetchEstimates])

  // ── Apply picked location from map ───────────────────────────

  useEffect(() => {
    if (pickedLocation && showForm) {
      setForm((prev) => ({
        ...prev,
        impact_lat: pickedLocation.lat.toFixed(6),
        impact_lon: pickedLocation.lon.toFixed(6),
      }))
    }
  }, [pickedLocation, showForm])

  // ── Form field handler ───────────────────────────────────────

  const updateField = useCallback((field: keyof PooFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  // ── Save (create or update) ──────────────────────────────────

  const handleSave = useCallback(async () => {
    const lat = parseFloat(form.impact_lat)
    const lon = parseFloat(form.impact_lon)
    const maxRange = parseFloat(form.max_range_km)

    if (!form.name.trim()) { setError('Name is required'); return }
    if (isNaN(lat) || lat < -90 || lat > 90) { setError('Invalid latitude'); return }
    if (isNaN(lon) || lon < -180 || lon > 180) { setError('Invalid longitude'); return }
    if (isNaN(maxRange) || maxRange <= 0) { setError('Max range must be > 0'); return }

    setSaving(true)
    setError(null)

    const body = {
      estimate_id: editingId ?? undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      impact_lat: lat,
      impact_lon: lon,
      max_range_km: maxRange,
      min_range_km: parseFloat(form.min_range_km) || 0,
      approach_bearing: form.approach_bearing ? parseFloat(form.approach_bearing) : undefined,
      sector_width_deg: parseFloat(form.sector_width_deg) || 90,
      confidence: form.confidence || 'POSSIBLE',
      range_basis: form.range_basis.trim() || undefined,
      bearing_basis: form.bearing_basis.trim() || undefined,
    }

    try {
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(`/api/cop/${sessionId}/poo-estimates`, {
        method,
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)

      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await fetchEstimates()
      onEstimateCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [form, editingId, sessionId, fetchEstimates, onEstimateCreated])

  // ── Delete ───────────────────────────────────────────────────

  const handleDelete = useCallback(async (estimateId: string) => {
    try {
      const res = await fetch(
        `/api/cop/${sessionId}/poo-estimates?estimate_id=${estimateId}`,
        { method: 'DELETE', headers: getCopHeaders() },
      )
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      await fetchEstimates()
      onEstimateCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [sessionId, fetchEstimates, onEstimateCreated])

  // ── Edit: populate form from existing estimate ───────────────

  const handleEdit = useCallback((est: PooEstimate) => {
    setEditingId(est.id)
    setForm({
      name: est.name,
      description: est.description ?? '',
      impact_lat: String(est.impact_lat),
      impact_lon: String(est.impact_lon),
      max_range_km: String(est.max_range_km),
      min_range_km: String(est.min_range_km ?? 0),
      approach_bearing: est.approach_bearing != null ? String(est.approach_bearing) : '',
      sector_width_deg: String(est.sector_width_deg ?? 90),
      confidence: est.confidence ?? 'POSSIBLE',
      range_basis: est.range_basis ?? '',
      bearing_basis: est.bearing_basis ?? '',
    })
    setShowForm(true)
  }, [])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Header with New button */}
      {!showForm && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
          className="w-full h-9 text-xs cursor-pointer border-dashed border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-500/10"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Estimate
        </Button>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-500/10 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      {/* Creation / Edit form */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {editingId ? 'Edit Estimate' : 'New POO Estimate'}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 cursor-pointer"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Name */}
          <div>
            <Label className="text-[11px] text-slate-500 dark:text-slate-400">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. FPV Attack - VBC"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Impact Point */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500 dark:text-slate-400">Latitude</Label>
              <Input
                type="number"
                step="any"
                value={form.impact_lat}
                onChange={(e) => updateField('impact_lat', e.target.value)}
                placeholder="48.8566"
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 dark:text-slate-400">Longitude</Label>
              <Input
                type="number"
                step="any"
                value={form.impact_lon}
                onChange={(e) => updateField('impact_lon', e.target.value)}
                placeholder="2.3522"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>
          {onPickFromMap && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPickFromMap}
              className="w-full h-7 text-[11px] cursor-pointer"
            >
              <Navigation className="h-3 w-3 mr-1" />
              Pick from map
            </Button>
          )}

          {/* Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500 dark:text-slate-400">Max Range (km)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={form.max_range_km}
                onChange={(e) => updateField('max_range_km', e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 dark:text-slate-400">Min Range (km)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.min_range_km}
                onChange={(e) => updateField('min_range_km', e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* Range Basis */}
          <div>
            <Label className="text-[11px] text-slate-500 dark:text-slate-400">Range Basis</Label>
            <Input
              value={form.range_basis}
              onChange={(e) => updateField('range_basis', e.target.value)}
              placeholder="e.g. 10km fiber optic spool"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Bearing */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-500 dark:text-slate-400">
                Approach Bearing
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="360"
                  value={form.approach_bearing}
                  onChange={(e) => updateField('approach_bearing', e.target.value)}
                  placeholder="0-360"
                  className="h-8 text-xs pr-10"
                />
                {form.approach_bearing && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {bearingToCardinal(parseFloat(form.approach_bearing))}
                  </span>
                )}
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-slate-500 dark:text-slate-400">Sector Width</Label>
              <Input
                type="number"
                step="5"
                min="10"
                max="360"
                value={form.sector_width_deg}
                onChange={(e) => updateField('sector_width_deg', e.target.value)}
                placeholder="90"
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          {/* Bearing Basis */}
          <div>
            <Label className="text-[11px] text-slate-500 dark:text-slate-400">Bearing Basis</Label>
            <Input
              value={form.bearing_basis}
              onChange={(e) => updateField('bearing_basis', e.target.value)}
              placeholder="e.g. WNW approach observed in video"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Confidence */}
          <div>
            <Label className="text-[11px] text-slate-500 dark:text-slate-400">Confidence</Label>
            <Select value={form.confidence} onValueChange={(v) => updateField('confidence', v)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCE_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label className="text-[11px] text-slate-500 dark:text-slate-400">Description (optional)</Label>
            <Input
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Additional notes"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-8 text-xs cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              {editingId ? 'Update' : 'Create'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && estimates.length === 0 && (
        <div className="flex items-center justify-center py-4 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          Loading estimates...
        </div>
      )}

      {/* Empty state */}
      {!loading && estimates.length === 0 && !showForm && (
        <div className="text-center py-4">
          <Target className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No POO estimates yet.
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Create an estimate to visualize potential launch origins on the map.
          </p>
        </div>
      )}

      {/* Estimate cards */}
      {estimates.map((est) => (
        <div
          key={est.id}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-1.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Target className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {est.name}
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 cursor-pointer text-slate-400 hover:text-blue-500"
                onClick={() => handleEdit(est)}
                title="Edit estimate"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 cursor-pointer text-slate-400 hover:text-red-500"
                onClick={() => handleDelete(est.id)}
                title="Delete estimate"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Compass className="h-3 w-3 shrink-0" />
              <span>Range: {est.max_range_km}km{est.range_basis ? ` (${est.range_basis})` : ''}</span>
            </div>
            {est.approach_bearing != null && (
              <div className="flex items-center gap-1.5">
                <Navigation className="h-3 w-3 shrink-0" style={{ transform: `rotate(${est.approach_bearing}deg)` }} />
                <span>
                  Bearing: {est.approach_bearing} {bearingToCardinal(est.approach_bearing)}
                  {est.bearing_basis ? ` (${est.bearing_basis})` : ''}
                </span>
              </div>
            )}
            {est.sector_width_deg && est.approach_bearing != null && (
              <div className="flex items-center gap-1.5 pl-[18px]">
                <span>Sector: {est.sector_width_deg} cone</span>
              </div>
            )}
            {est.confidence && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span
                  className={cn(
                    'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                    CONFIDENCE_COLORS[est.confidence as Confidence] ?? 'text-slate-500 bg-slate-100 dark:bg-slate-800',
                  )}
                >
                  {est.confidence}
                </span>
              </div>
            )}
          </div>

          {est.description && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
              {est.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
