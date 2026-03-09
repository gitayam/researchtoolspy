/**
 * CopBlockerStrip -- Blocker alert banner shown between CopStatusStrip and panel grid.
 *
 * Only renders when there are active blockers (RFIs with is_blocker=1 and status !== 'closed').
 * Shows up to 2 inline with "+N more" overflow.
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CopRfi } from '@/types/cop'

// ── Props ────────────────────────────────────────────────────────

interface CopBlockerStripProps {
  sessionId: string
  onGoToBlocker?: (rfiId: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

// ── Component ────────────────────────────────────────────────────

export default function CopBlockerStrip({ sessionId, onGoToBlocker }: CopBlockerStripProps) {
  const [blockers, setBlockers] = useState<CopRfi[]>([])

  const fetchBlockers = useCallback(async () => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`, { headers: getHeaders() })
      if (!res.ok) return
      const data = await res.json()
      const rfis: CopRfi[] = data.rfis ?? data ?? []
      // Filter to blocker RFIs that are not closed
      const active = rfis.filter(
        (r: any) => r.is_blocker === 1 && r.status !== 'closed',
      )
      setBlockers(active)
    } catch {
      // Silent failure
    }
  }, [sessionId])

  useEffect(() => {
    fetchBlockers()
    const interval = setInterval(fetchBlockers, 30_000)
    return () => clearInterval(interval)
  }, [fetchBlockers])

  // Don't render if no blockers
  if (blockers.length === 0) return null

  const visible = blockers.slice(0, 2)
  const overflow = blockers.length - visible.length

  return (
    <div
      className={cn(
        'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/30 rounded-lg mx-3 md:mx-4 lg:mx-6 mt-2 px-4 py-2 shrink-0',
        'flex items-center gap-3 flex-wrap',
      )}
      role="alert"
      aria-label={`${blockers.length} active blocker${blockers.length !== 1 ? 's' : ''}`}
    >
      {/* Pulsing red dot + label */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full bg-red-500',
            'motion-safe:animate-pulse',
          )}
          aria-hidden="true"
        />
        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
          Blocker
        </span>
      </div>

      {/* Blocker items */}
      <div className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden">
        {visible.map((blocker) => (
          <div
            key={blocker.id}
            className="flex items-center gap-2 min-w-0"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-200 truncate max-w-[300px]">
              {blocker.question}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGoToBlocker?.(blocker.id)}
              className="h-6 text-[10px] px-2 border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-200 shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Go to Blocker
            </Button>
          </div>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-red-600 dark:text-red-400 shrink-0">
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  )
}
