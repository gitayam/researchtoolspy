import { useState, useEffect, useCallback, useRef } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import type { CopAsset, AssetType, AssetStatus } from '@/types/cop'
import { ASSET_TYPE_CONFIG, ASSET_STATUS_CONFIG } from '@/types/cop'
import CopResourceGauge from './CopResourceGauge'
import {
  Plus,
  Loader2,
  Briefcase,
  User,
  Radio,
  Server,
  HardDrive,
  MapPin,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface CopAssetPanelProps {
  sessionId: string
  expanded?: boolean
  onSelectAsset?: (asset: CopAsset) => void
}

const TABS: { key: AssetType; label: string; icon: typeof Briefcase }[] = [
  { key: 'human', label: 'People', icon: User },
  { key: 'source', label: 'Sources', icon: Radio },
  { key: 'infrastructure', label: 'Infra', icon: Server },
  { key: 'digital', label: 'Digital', icon: HardDrive },
]

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'offline', label: 'Offline' },
  { value: 'compromised', label: 'Compromised' },
  { value: 'exhausted', label: 'Exhausted' },
]

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: 'human', label: 'People' },
  { value: 'source', label: 'Source' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'digital', label: 'Digital' },
]

// ── Component ─────────────────────────────────────────────────────

export default function CopAssetPanel({ sessionId, expanded = true, onSelectAsset }: CopAssetPanelProps) {
  const [assets, setAssets] = useState<CopAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [activeTab, setActiveTab] = useState<AssetType>('human')
  const [statusFilter, setStatusFilter] = useState<AssetStatus | ''>('')
  const [showFilters, setShowFilters] = useState(false)

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AssetType>('human')
  const [newLocation, setNewLocation] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch assets ──────────────────────────────────────────────

  const fetchAssets = useCallback(async (isBackground = false, signal?: AbortSignal) => {
    if (isBackground) setPolling(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/assets`, { headers: getCopHeaders(), signal })
      if (!res.ok) throw new Error('Failed to fetch assets')
      const data = await res.json()
      const items: CopAsset[] = data.assets ?? data ?? []
      setAssets(items)
      setFetchError(false)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (!isBackground) setFetchError(true)
    } finally {
      setLoading(false)
      setPolling(false)
    }
  }, [sessionId])

  useEffect(() => {
    const controller = new AbortController()
    fetchAssets(false, controller.signal)
    intervalRef.current = setInterval(() => fetchAssets(true, controller.signal), 30000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAssets])

  // ── Create asset ──────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/assets`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({
          name: trimmed,
          asset_type: newType,
          location: newLocation.trim() || null,
          notes: newNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create asset')
      setNewName('')
      setNewLocation('')
      setNewNotes('')
      setShowForm(false)
      await fetchAssets()
    } catch (err) {
      console.error('[CopAssetPanel] Create asset failed:', err)
    } finally {
      setSubmitting(false)
    }
  }, [newName, newType, newLocation, newNotes, sessionId, fetchAssets])

  // ── Quick status change ───────────────────────────────────────

  const handleStatusChange = useCallback(async (assetId: string, newStatus: AssetStatus) => {
    // Optimistic update
    setAssets(prev =>
      prev.map(a =>
        a.id === assetId ? { ...a, status: newStatus } : a
      )
    )
    try {
      const res = await fetch(`/api/cop/${sessionId}/assets/${assetId}/check-in`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      await fetchAssets()
    } catch {
      await fetchAssets()
    }
  }, [sessionId, fetchAssets])

  // ── Derived data ─────────────────────────────────────────────

  const filteredAssets = assets.filter(a => {
    if (a.asset_type !== activeTab) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })

  const tabCounts: Record<AssetType, number> = {
    human: assets.filter(a => a.asset_type === 'human').length,
    source: assets.filter(a => a.asset_type === 'source').length,
    infrastructure: assets.filter(a => a.asset_type === 'infrastructure').length,
    digital: assets.filter(a => a.asset_type === 'digital').length,
  }

  const totalCount = assets.length

  // ── Asset card renderer ───────────────────────────────────────

  const renderAssetCard = (asset: CopAsset) => {
    const statusConfig = ASSET_STATUS_CONFIG[asset.status]
    const details = asset.details as any

    return (
      <div
        key={asset.id}
        className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 transition-colors duration-200"
      >
        <button
          type="button"
          onClick={() => onSelectAsset?.(asset)}
          className="w-full flex items-start gap-2 px-2.5 py-2 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors duration-200"
        >
          {/* Status dot */}
          <span
            className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${statusConfig.color}`}
            title={statusConfig.label}
          />

          <div className="flex-1 min-w-0">
            {/* Name */}
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-200 truncate leading-snug">
              {asset.name}
            </p>

            {/* Info row */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] font-medium px-1.5 py-0 leading-4 rounded border bg-gray-200/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                {statusConfig.label}
              </span>

              {asset.location && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-500">
                  <MapPin className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[80px]">{asset.location}</span>
                </span>
              )}
            </div>

            {/* Digital asset quota gauge */}
            {asset.asset_type === 'digital' && details?.total_units > 0 && (
              <div className="mt-1.5">
                <CopResourceGauge
                  used={details.used_units || 0}
                  total={details.total_units}
                  label={details.resource_type || 'Usage'}
                />
              </div>
            )}
          </div>

          <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 shrink-0" />
        </button>

        {/* Quick status buttons */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-2.5 py-1.5 flex flex-wrap gap-1">
          {STATUS_OPTIONS.filter(s => s.value !== asset.status).slice(0, 3).map(s => (
            <button
              key={s.value}
              type="button"
              onClick={e => { e.stopPropagation(); handleStatusChange(asset.id, s.value) }}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Compact view (expanded=false) ────────────────────────────

  if (!expanded) {
    return (
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {totalCount === 0 ? (
            <span className="text-[10px] text-gray-500">No assets</span>
          ) : (
            <>
              {TABS.map(tab => {
                const count = tabCounts[tab.key]
                if (count === 0) return null
                const config = ASSET_TYPE_CONFIG[tab.key]
                return (
                  <span key={tab.key} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${config.color}`}>
                    {count} {tab.label}
                  </span>
                )
              })}
            </>
          )}
          {polling && <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />}
        </div>
      </div>
    )
  }

  // ── Full view (expanded=true) ─────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 uppercase tracking-wider">
            Assets
          </h2>
          {totalCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-teal-500 text-white text-[10px] font-bold px-1">
              {totalCount}
            </span>
          )}
          {polling && <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center h-6 text-[10px] font-medium px-2 rounded border cursor-pointer transition-colors duration-200 ${
              showFilters || statusFilter
                ? 'border-teal-500/30 text-teal-400 bg-teal-500/10'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center h-6 text-[10px] font-medium px-2 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex gap-1">
        {TABS.map(tab => {
          const TabIcon = tab.icon
          const isActive = activeTab === tab.key
          const count = tabCounts[tab.key]

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded cursor-pointer transition-colors duration-200 ${
                isActive
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
              }`}
            >
              <TabIcon className="h-3 w-3" />
              {tab.label}
              {count > 0 && (
                <span className={`text-[8px] font-bold px-1 rounded-full ${
                  isActive ? 'bg-teal-500/20' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {/* Status filter */}
        {showFilters && (
          <div className="flex items-center gap-1.5 pb-1">
            <span className="text-[9px] text-gray-500 shrink-0">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-200 ${
                !statusFilter ? 'bg-teal-500/10 text-teal-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              All
            </button>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}
                className={`text-[9px] font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-200 ${
                  statusFilter === s.value ? 'bg-teal-500/10 text-teal-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Asset name"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as AssetType)}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {ASSET_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewName(''); setNewLocation(''); setNewNotes('') }}
                className="h-6 text-[10px] font-medium px-2 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || !newName.trim()}
                className="h-6 text-[10px] font-medium px-2 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Loading / Error / Empty */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
            <span className="text-xs text-gray-500">Loading assets...</span>
          </div>
        ) : fetchError ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-500 mb-2">Failed to load assets.</p>
            <button
              type="button"
              onClick={() => { setLoading(true); setFetchError(false); fetchAssets() }}
              className="text-xs text-teal-400 hover:text-teal-300 cursor-pointer transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : filteredAssets.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <Briefcase className="h-6 w-6 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {statusFilter
                ? `No ${ASSET_TYPE_CONFIG[activeTab].label.toLowerCase()} with status "${statusFilter}".`
                : `No ${ASSET_TYPE_CONFIG[activeTab].label.toLowerCase()} tracked yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredAssets.map(renderAssetCard)}
          </div>
        )}
      </div>
    </div>
  )
}
