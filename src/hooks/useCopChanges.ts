/**
 * Live COP workspace.
 *
 * `useCopChanges(sessionId)` runs once per page: it polls
 * `GET /api/cop/:id/changes?since=<cursor>` every 5 s while the tab is visible
 * (at once on focus or when the tab shows again, straight away again while the
 * server says it has more) and announces the entity types that changed with the
 * window `cop:changed` event. Errors back off up to a minute. A server without
 * the feed (404/405, or Pages' HTML fallback) gets a full refresh of every panel
 * every 30 s instead.
 *
 * `useCopChangeListener(types, onChange)` is what a panel uses: it calls
 * `onChange` when one of its types changed (bursts folded into one call), and
 * every two minutes while visible in case an event was missed.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { COP_CHANGED_EVENT, notifyCopChanged } from '@/lib/cop-request'
import {
  CHANGES_LIVE_MS, concerns, interpretChangesResponse, PANEL_SAFETY_MS, planNextPoll, type ChangesOutcome,
} from '@/lib/cop-changes'
import type { CopChangedDetail, CopEntityType } from '@/types/cop'

export type CopChangesMode = 'starting' | 'live' | 'fallback' | 'retry'

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible'

export function useCopChanges(sessionId: string | undefined, opts: { enabled?: boolean } = {}): {
  mode: CopChangesMode
  lastChecked: number | null
} {
  const enabled = opts.enabled !== false && !!sessionId
  const [mode, setMode] = useState<CopChangesMode>('starting')
  const [lastChecked, setLastChecked] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || !sessionId) return
    let state = { cursor: null as string | null, delay: CHANGES_LIVE_MS, started: false }
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    let stopped = false
    let inFlight = false

    const schedule = (ms: number) => {
      if (stopped) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(tick, ms)
    }

    async function tick() {
      timer = null
      if (stopped || inFlight) return
      // Hidden tabs don't poll; becoming visible polls at once (see onVisible).
      if (!isVisible()) return
      inFlight = true
      controller = new AbortController()
      let outcome: ChangesOutcome
      try {
        const url = `/api/cop/${encodeURIComponent(sessionId!)}/changes?since=${encodeURIComponent(state.cursor ?? '')}&limit=200`
        const res = await fetch(url, { headers: getCopHeaders(), signal: controller.signal })
        const contentType = res.headers.get('content-type')
        const body = contentType?.includes('application/json') ? await res.json().catch(() => null) : null
        outcome = interpretChangesResponse(res.status, contentType, body)
      } catch (error) {
        inFlight = false
        if ((error as Error)?.name === 'AbortError') return
        outcome = { kind: 'error' }
      }
      inFlight = false
      if (stopped) return
      const next = planNextPoll(state, outcome)
      state = { cursor: next.cursor, delay: next.delay, started: next.started }
      if (next.notify.length > 0) notifyCopChanged(next.notify)
      setMode(next.mode)
      if (next.mode !== 'retry') setLastChecked(Date.now())
      schedule(next.delay)
    }

    const onVisible = () => {
      if (isVisible()) schedule(0)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    schedule(0)

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled, sessionId])

  return { mode, lastChecked }
}

/** Fold a burst of `cop:changed` events into one call. */
const LISTENER_DEBOUNCE_MS = 200

export function useCopChangeListener(
  types: readonly CopEntityType[] | '*',
  onChange: (changed: CopEntityType[]) => void,
  opts: { enabled?: boolean; safetyMs?: number | null } = {},
): void {
  const enabled = opts.enabled !== false
  const safetyMs = opts.safetyMs === undefined ? PANEL_SAFETY_MS : opts.safetyMs
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })
  // A stable key, so an inline array literal doesn't resubscribe every render.
  const typesKey = types === '*' ? '*' : [...types].sort().join(',')

  useEffect(() => {
    if (!enabled) return
    const wanted: readonly CopEntityType[] | '*' = typesKey === '*' ? '*' : (typesKey.split(',').filter(Boolean) as CopEntityType[])
    let pending = new Set<CopEntityType>()
    let debounce: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
      debounce = null
      const changed = [...pending]
      pending = new Set()
      onChangeRef.current(changed)
    }
    const onEvent = (event: Event) => {
      const changed = (event as CustomEvent<CopChangedDetail>).detail?.types ?? []
      if (!concerns(changed, wanted)) return
      for (const t of changed) pending.add(t)
      if (!debounce) debounce = setTimeout(flush, LISTENER_DEBOUNCE_MS)
    }
    window.addEventListener(COP_CHANGED_EVENT, onEvent)

    const safety = safetyMs
      ? setInterval(() => {
          if (isVisible()) onChangeRef.current([])
        }, safetyMs)
      : null

    return () => {
      window.removeEventListener(COP_CHANGED_EVENT, onEvent)
      if (debounce) clearTimeout(debounce)
      if (safety) clearInterval(safety)
    }
  }, [enabled, typesKey, safetyMs])
}

/** The window event a panel listens to for "scroll to and flash this item". */
export const COP_HIGHLIGHT_EVENT = 'cop:highlight'

export interface CopHighlightDetail {
  type: CopEntityType
  id: string
}

export function useCopHighlight(type: CopEntityType, onHighlight: (id: string) => void): void {
  const ref = useRef(onHighlight)
  useLayoutEffect(() => {
    ref.current = onHighlight
  })
  useEffect(() => {
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<CopHighlightDetail>).detail
      if (detail?.type === type && detail.id) ref.current(String(detail.id))
    }
    window.addEventListener(COP_HIGHLIGHT_EVENT, onEvent)
    return () => window.removeEventListener(COP_HIGHLIGHT_EVENT, onEvent)
  }, [type])
}
