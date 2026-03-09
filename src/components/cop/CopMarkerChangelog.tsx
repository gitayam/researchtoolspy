import { useCallback, useEffect, useState } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  MapPin,
  Shield,
  Move,
  Clock,
  Plus,
  Link2,
  Trash2,
  Loader2,
  ChevronDown,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangelogEntry {
  id: string
  action: string // 'created' | 'moved' | 'confidence_changed' | 'rationale_updated' | 'evidence_linked'
  old_value: string | null
  new_value: string | null
  rationale: string | null
  created_by_name: string | null
  created_at: string
}

interface CopMarkerChangelogProps {
  sessionId: string
  markerId: string
  markerLabel: string
  confidence: string // 'CONFIRMED' | 'PROBABLE' | 'POSSIBLE' | 'SUSPECTED' | 'DOUBTFUL'
  rationale: string | null
  onConfidenceChange?: (confidence: string, rationale: string) => void
}

// ---------------------------------------------------------------------------
// Confidence config (self-contained, mirrors ConfidenceDots pattern)
// ---------------------------------------------------------------------------

const CONFIDENCE_LEVELS = [
  { value: 'CONFIRMED', dots: 5, color: 'bg-green-500', textColor: 'text-green-500', label: 'Confirmed' },
  { value: 'PROBABLE', dots: 4, color: 'bg-blue-500', textColor: 'text-blue-500', label: 'Probable' },
  { value: 'POSSIBLE', dots: 3, color: 'bg-amber-500', textColor: 'text-amber-500', label: 'Possible' },
  { value: 'SUSPECTED', dots: 2, color: 'bg-orange-500', textColor: 'text-orange-500', label: 'Suspected' },
  { value: 'DOUBTFUL', dots: 1, color: 'bg-red-500', textColor: 'text-red-500', label: 'Doubtful' },
] as const

function getConfidenceConfig(level: string) {
  return CONFIDENCE_LEVELS.find((c) => c.value === level) ?? CONFIDENCE_LEVELS[2]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function actionIcon(action: string) {
  switch (action) {
    case 'created':
      return <Plus className="w-3.5 h-3.5 text-green-500" />
    case 'moved':
      return <Move className="w-3.5 h-3.5 text-blue-500" />
    case 'confidence_changed':
      return <Shield className="w-3.5 h-3.5 text-amber-500" />
    case 'rationale_updated':
      return <Clock className="w-3.5 h-3.5 text-purple-500" />
    case 'evidence_linked':
      return <Link2 className="w-3.5 h-3.5 text-cyan-500" />
    case 'deleted':
      return <Trash2 className="w-3.5 h-3.5 text-red-500" />
    default:
      return <MapPin className="w-3.5 h-3.5 text-gray-400" />
  }
}

function describeAction(entry: ChangelogEntry): string {
  switch (entry.action) {
    case 'created':
      return 'Marker created'
    case 'moved':
      return 'Position updated'
    case 'confidence_changed':
      return entry.old_value && entry.new_value
        ? `Confidence: ${entry.old_value} \u2192 ${entry.new_value}`
        : `Confidence set to ${entry.new_value ?? 'unknown'}`
    case 'rationale_updated':
      return 'Rationale updated'
    case 'evidence_linked':
      return entry.new_value ? `Evidence linked: ${entry.new_value}` : 'Evidence linked'
    case 'deleted':
      return 'Marker removed'
    default:
      return entry.action.replace(/_/g, ' ')
  }
}

// ---------------------------------------------------------------------------
// Confidence Dots (inline, self-contained)
// ---------------------------------------------------------------------------

function ConfidenceDotsInline({ level }: { level: string }) {
  const config = getConfidenceConfig(level)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              i < config.dots ? config.color : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
      <span className={`text-[10px] font-medium uppercase tracking-wider ${config.textColor}`}>
        {config.label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CopMarkerChangelog({
  sessionId,
  markerId,
  markerLabel,
  confidence,
  rationale,
  onConfidenceChange,
}: CopMarkerChangelogProps) {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Update form state
  const [selectedConfidence, setSelectedConfidence] = useState(confidence)
  const [newRationale, setNewRationale] = useState(rationale ?? '')
  const [updating, setUpdating] = useState(false)

  // Sync props into local state when they change externally
  useEffect(() => {
    setSelectedConfidence(confidence)
  }, [confidence])

  useEffect(() => {
    setNewRationale(rationale ?? '')
  }, [rationale])

  // Fetch changelog
  const fetchChangelog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/cop/${sessionId}/marker-changelog?marker_id=${encodeURIComponent(markerId)}`,
        { headers: getCopHeaders() },
      )
      if (!res.ok) throw new Error(`Failed to fetch changelog (${res.status})`)
      const data = await res.json()
      setChangelog(Array.isArray(data.changelog) ? data.changelog : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load changelog')
    } finally {
      setLoading(false)
    }
  }, [sessionId, markerId])

  useEffect(() => {
    fetchChangelog()
  }, [fetchChangelog])

  // Handle update
  const handleUpdate = async () => {
    if (!onConfidenceChange) return
    setUpdating(true)
    try {
      onConfidenceChange(selectedConfidence, newRationale)
      // Re-fetch changelog after a short delay to pick up the new entry
      setTimeout(() => fetchChangelog(), 500)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="w-72 max-h-96 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-gray-900 dark:text-gray-200 text-sm overflow-hidden">
      {/* ---- Header ---- */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="font-medium truncate">{markerLabel}</span>
        </div>
        <ConfidenceDotsInline level={confidence} />
      </div>

      {/* ---- Rationale ---- */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Rationale</p>
        {rationale ? (
          <p className="text-xs leading-relaxed">{rationale}</p>
        ) : (
          <p className="text-xs italic text-gray-400 dark:text-gray-500">No rationale set</p>
        )}
      </div>

      {/* ---- Update section (only when editable) ---- */}
      {onConfidenceChange && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
          {/* Confidence dropdown */}
          <div className="relative">
            <select
              value={selectedConfidence}
              onChange={(e) => setSelectedConfidence(e.target.value)}
              className="w-full appearance-none rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 pr-7 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {CONFIDENCE_LEVELS.map((cl) => (
                <option key={cl.value} value={cl.value}>
                  {cl.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          </div>

          {/* Rationale textarea */}
          <textarea
            value={newRationale}
            onChange={(e) => setNewRationale(e.target.value)}
            placeholder="Update rationale..."
            rows={2}
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* Update button */}
          <button
            onClick={handleUpdate}
            disabled={updating || (selectedConfidence === confidence && newRationale === (rationale ?? ''))}
            className="w-full flex items-center justify-center gap-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 text-xs font-medium text-white transition-colors"
          >
            {updating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Shield className="w-3 h-3" />
            )}
            Update
          </button>
        </div>
      )}

      {/* ---- Changelog ---- */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Change History
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="px-3 py-2 text-xs text-red-500">{error}</div>
        ) : changelog.length === 0 ? (
          <div className="px-3 py-2 text-xs italic text-gray-400 dark:text-gray-500">
            No changes recorded
          </div>
        ) : (
          <ul className="px-3 pb-2 space-y-1.5">
            {changelog.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-2 py-1 border-t border-gray-100 dark:border-gray-800 first:border-t-0"
              >
                <div className="mt-0.5 shrink-0">{actionIcon(entry.action)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug">{describeAction(entry)}</p>
                  {entry.rationale && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {entry.rationale}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                    {entry.created_by_name && <span>{entry.created_by_name}</span>}
                    {entry.created_by_name && <span>&middot;</span>}
                    <span>{timeAgo(entry.created_at)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
