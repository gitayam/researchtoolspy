import { useState, useEffect, useCallback, useRef } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import type {
  CopAsset,
  CopAssetLog,
  AssetStatus,
  HumanAssetDetails,
  SourceAssetDetails,
  InfraAssetDetails,
  DigitalAssetDetails,
} from '@/types/cop'
import { ASSET_TYPE_CONFIG, ASSET_STATUS_CONFIG } from '@/types/cop'
import CopResourceGauge from './CopResourceGauge'
import {
  X,
  Loader2,
  MapPin,
  Clock,
  ArrowRight,
  Shield,
  LinkIcon,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface CopAssetDetailDrawerProps {
  sessionId: string
  asset: CopAsset
  onClose: () => void
  onStatusChanged?: () => void
}

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'deployed', label: 'Deployed' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'offline', label: 'Offline' },
  { value: 'compromised', label: 'Compromised' },
  { value: 'exhausted', label: 'Exhausted' },
]

// ── Detail renderers ─────────────────────────────────────────────

function HumanDetails({ details }: { details: HumanAssetDetails }) {
  return (
    <div className="space-y-1.5 text-[11px]">
      {details.skills?.length > 0 && (
        <div>
          <span className="text-gray-500">Skills:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.skills.join(', ')}</span>
        </div>
      )}
      {details.languages?.length > 0 && (
        <div>
          <span className="text-gray-500">Languages:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.languages.join(', ')}</span>
        </div>
      )}
      {details.timezone && (
        <div>
          <span className="text-gray-500">Timezone:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.timezone}</span>
        </div>
      )}
      {details.hours_available_per_week != null && (
        <div>
          <span className="text-gray-500">Availability:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.hours_available_per_week}h/week</span>
        </div>
      )}
      {details.current_load != null && (
        <CopResourceGauge used={details.current_load} total={details.hours_available_per_week || 40} label="Current load" unit="h" />
      )}
    </div>
  )
}

function SourceDetails({ details }: { details: SourceAssetDetails }) {
  return (
    <div className="space-y-1.5 text-[11px]">
      {details.source_type && (
        <div>
          <span className="text-gray-500">Type:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200 uppercase">{details.source_type}</span>
        </div>
      )}
      {details.reliability_rating && (
        <div>
          <span className="text-gray-500">Reliability:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200 font-mono">{details.reliability_rating}</span>
        </div>
      )}
      {details.access_status && (
        <div>
          <span className="text-gray-500">Access:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.access_status}</span>
        </div>
      )}
      {details.coverage_area && (
        <div>
          <span className="text-gray-500">Coverage:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.coverage_area}</span>
        </div>
      )}
      {details.last_contact && (
        <div>
          <span className="text-gray-500">Last contact:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{new Date(details.last_contact).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  )
}

function InfraDetails({ details }: { details: InfraAssetDetails }) {
  return (
    <div className="space-y-1.5 text-[11px]">
      {details.infra_type && (
        <div>
          <span className="text-gray-500">Type:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.infra_type}</span>
        </div>
      )}
      {details.provider && (
        <div>
          <span className="text-gray-500">Provider:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.provider}</span>
        </div>
      )}
      {details.expiry_date && (
        <div>
          <span className="text-gray-500">Expires:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{new Date(details.expiry_date).toLocaleDateString()}</span>
        </div>
      )}
      {details.shared_by?.length > 0 && (
        <div>
          <span className="text-gray-500">Shared by:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.shared_by.join(', ')}</span>
        </div>
      )}
      {details.opsec_notes && (
        <div className="rounded bg-red-500/5 border border-red-500/20 px-2 py-1">
          <span className="text-red-400 text-[10px] font-medium">OPSEC:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.opsec_notes}</span>
        </div>
      )}
    </div>
  )
}

function DigitalDetails({ details }: { details: DigitalAssetDetails }) {
  return (
    <div className="space-y-1.5 text-[11px]">
      {details.resource_type && (
        <div>
          <span className="text-gray-500">Resource:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.resource_type.replace(/_/g, ' ')}</span>
        </div>
      )}
      {details.total_units > 0 && (
        <CopResourceGauge
          used={details.used_units || 0}
          total={details.total_units}
          label="Quota"
          unit={details.currency ? ` ${details.currency}` : ''}
        />
      )}
      {details.reset_date && (
        <div>
          <span className="text-gray-500">Resets:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{new Date(details.reset_date).toLocaleDateString()}</span>
        </div>
      )}
      {details.cost_per_unit != null && (
        <div>
          <span className="text-gray-500">Cost/unit:</span>{' '}
          <span className="text-gray-900 dark:text-gray-200">{details.cost_per_unit} {details.currency || ''}</span>
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────

export default function CopAssetDetailDrawer({ sessionId, asset, onClose, onStatusChanged }: CopAssetDetailDrawerProps) {
  const [log, setLog] = useState<CopAssetLog[]>([])
  const [logLoading, setLogLoading] = useState(true)
  const [newStatus, setNewStatus] = useState<AssetStatus>(asset.status)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch log ──────────────────────────────────────────────

  const fetchLog = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/assets/${asset.id}/log`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error('Failed to fetch log')
      const data = await res.json()
      setLog(data.log ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally {
      setLogLoading(false)
    }
  }, [sessionId, asset.id])

  useEffect(() => {
    const controller = new AbortController()
    fetchLog(controller.signal)
    intervalRef.current = setInterval(() => fetchLog(controller.signal), 30000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchLog])

  // ── Status change ──────────────────────────────────────────

  const handleCheckIn = useCallback(async () => {
    if (newStatus === asset.status && !reason.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/${sessionId}/assets/${asset.id}/check-in`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ status: newStatus, reason: reason.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to check in')
      setReason('')
      onStatusChanged?.()
      await fetchLog()
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, asset.id, asset.status, newStatus, reason, onStatusChanged, fetchLog])

  // ── Render ────────────────────────────────────────────────────

  const typeConfig = ASSET_TYPE_CONFIG[asset.asset_type]
  const statusConfig = ASSET_STATUS_CONFIG[asset.status]
  const details = asset.details as any

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200 truncate">
              {asset.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[9px] font-medium px-1.5 py-0 leading-4 rounded border ${typeConfig.color}`}>
                {typeConfig.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[9px]">
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.color}`} />
                <span className="text-gray-600 dark:text-gray-400">{statusConfig.label}</span>
              </span>
              {asset.sensitivity !== 'unclassified' && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-500">
                  <Shield className="h-2.5 w-2.5" />
                  {asset.sensitivity}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Location */}
          {asset.location && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{asset.location}</span>
              {asset.lat != null && asset.lon != null && (
                <span className="text-gray-400 font-mono text-[9px]">
                  ({asset.lat.toFixed(4)}, {asset.lon.toFixed(4)})
                </span>
              )}
            </div>
          )}

          {/* Task assignment */}
          {asset.assigned_to_task_id && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              <LinkIcon className="h-3 w-3 shrink-0" />
              <span>Assigned to task: <span className="font-mono">{asset.assigned_to_task_id}</span></span>
            </div>
          )}

          {/* Last checked */}
          {asset.last_checked_at && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Last checked: {new Date(asset.last_checked_at).toLocaleString()}</span>
            </div>
          )}

          {/* Notes */}
          {asset.notes && (
            <div className="rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-2.5 py-2">
              <p className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{asset.notes}</p>
            </div>
          )}

          {/* Type-specific details */}
          {details && Object.keys(details).length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Details</h4>
              <div className="rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-2.5 py-2">
                {asset.asset_type === 'human' && <HumanDetails details={details as HumanAssetDetails} />}
                {asset.asset_type === 'source' && <SourceDetails details={details as SourceAssetDetails} />}
                {asset.asset_type === 'infrastructure' && <InfraDetails details={details as InfraAssetDetails} />}
                {asset.asset_type === 'digital' && <DigitalDetails details={details as DigitalAssetDetails} />}
              </div>
            </div>
          )}

          {/* Status change form */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Update Status</h4>
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2 space-y-2">
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as AssetStatus)}
                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for status change (optional)"
                rows={2}
                className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={submitting || (newStatus === asset.status && !reason.trim())}
                  className="h-6 text-[10px] font-medium px-3 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Check In'}
                </button>
              </div>
            </div>
          </div>

          {/* Audit log timeline */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status History</h4>
            {logLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3 w-3 text-gray-500 animate-spin" />
                <span className="text-[10px] text-gray-500">Loading history...</span>
              </div>
            ) : log.length === 0 ? (
              <p className="text-[10px] text-gray-500 py-2">No status changes recorded.</p>
            ) : (
              <div className="space-y-0">
                {log.map((entry, idx) => {
                  const prevConfig = entry.previous_status ? ASSET_STATUS_CONFIG[entry.previous_status as AssetStatus] : null
                  const newConfig = ASSET_STATUS_CONFIG[entry.new_status as AssetStatus]

                  return (
                    <div key={entry.id} className="flex gap-2 py-1.5">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center w-3 shrink-0">
                        <div className={`h-2 w-2 rounded-full ${newConfig?.color || 'bg-gray-400'}`} />
                        {idx < log.length - 1 && (
                          <div className="flex-1 w-px bg-gray-200 dark:bg-gray-700 mt-0.5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 -mt-0.5">
                        <div className="flex items-center gap-1 text-[10px]">
                          {prevConfig && (
                            <>
                              <span className="text-gray-500">{prevConfig.label}</span>
                              <ArrowRight className="h-2.5 w-2.5 text-gray-400" />
                            </>
                          )}
                          <span className="font-medium text-gray-900 dark:text-gray-200">
                            {newConfig?.label || entry.new_status}
                          </span>
                        </div>
                        {entry.reason && (
                          <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{entry.reason}</p>
                        )}
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
