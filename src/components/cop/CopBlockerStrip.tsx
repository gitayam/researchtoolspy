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
import { getCopHeaders } from '@/lib/cop-auth'

// ── Props ────────────────────────────────────────────────────────

interface CopBlockerStripProps {
  sessionId: string
  onGoToBlocker?: (rfiId: string) => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopBlockerStrip({ sessionId, onGoToBlocker }: CopBlockerStripProps) {
  const [blockers, setBlockers] = useState<CopRfi[]>([])

  const fetchBlockers = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/rfis`, { headers: getCopHeaders(), signal })
      if (!res.ok) return
      const data = await res.json()
      const rfis: CopRfi[] = data.rfis ?? data ?? []
      // Filter to blocker RFIs that are not closed
      const active = rfis.filter(
        (r: any) => r.is_blocker === 1 && r.status !== 'closed',
      )
      setBlockers(active)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // Silent failure
    }
  }, [sessionId])

  useEffect(() => {
    const controller = new AbortController()
    fetchBlockers(controller.signal)
    const interval = setInterval(() => fetchBlockers(controller.signal), 30_000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
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
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
        {visible.map((blocker) => (
          <div
            key={blocker.id}
            className="flex items-start sm:items-center gap-2 min-w-0"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-xs text-red-700 dark:text-red-200 line-clamp-2 sm:line-clamp-1 flex-1" title={blocker.question}>
              {blocker.question}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGoToBlocker?.(blocker.id)}
              className="h-8 sm:h-6 text-[10px] px-2 border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-200 shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
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
