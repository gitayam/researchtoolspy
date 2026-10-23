/**
 * Live updates for a shared (public) COP view.
 *
 * Polls `GET /api/cop/public/:token/changes?since=<cursor>` every 7 s while the
 * page is visible (immediately when it becomes visible again) and reports the
 * entity types that changed. Servers without that route answer 404: the hook then
 * falls back to a full reload every 60 s, as the page did before. Errors back off
 * up to 60 s.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ChangeMode = 'starting' | 'live' | 'fallback'

interface ChangeEvent {
  id: string
  entity_type: string
  entity_id?: string | null
}

const LIVE_INTERVAL_MS = 7_000
const FALLBACK_INTERVAL_MS = 60_000
const MAX_BACKOFF_MS = 60_000

export function usePublicCopChanges(
  token: string | undefined,
  enabled: boolean,
  onChange: (types: Set<string>, entities: ChangeEvent[]) => void,
): { mode: ChangeMode; lastChecked: number | null } {
  const [mode, setMode] = useState<ChangeMode>('starting')
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!token || !enabled) return
    let cursor: string | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let delay = LIVE_INTERVAL_MS
    let fallback = false
    let controller: AbortController | null = null

    const schedule = (ms: number) => {
      if (stopped) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(tick, ms)
    }

    const tick = async () => {
      if (stopped) return
      if (document.visibilityState !== 'visible') return // resumed by visibilitychange
      if (fallback) {
        onChangeRef.current(new Set(['*']), [])
        setLastChecked(Date.now())
        schedule(FALLBACK_INTERVAL_MS)
        return
      }
      controller = new AbortController()
      try {
        const url = `/api/cop/public/${encodeURIComponent(token)}/changes?since=${encodeURIComponent(cursor ?? '')}`
        const res = await fetch(url, { signal: controller.signal })
        if (res.status === 404 || res.status === 405) {
          fallback = true
          setMode('fallback')
          schedule(FALLBACK_INTERVAL_MS)
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { events?: ChangeEvent[]; cursor?: string; has_more?: boolean }
        const events = Array.isArray(data.events) ? data.events : []
        const isFirst = cursor === null
        if (typeof data.cursor === 'string') cursor = data.cursor
        // The first answer is only a starting point; changes before it are already on screen.
        if (!isFirst && events.length > 0) {
          onChangeRef.current(new Set(events.map((e) => e.entity_type)), events)
        }
        setMode('live')
        setLastChecked(Date.now())
        delay = LIVE_INTERVAL_MS
        schedule(data.has_more ? 250 : delay)
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
        delay = Math.min(delay * 2, MAX_BACKOFF_MS)
        schedule(delay)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule(0)
    }
    document.addEventListener('visibilitychange', onVisibility)
    schedule(0)

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [token, enabled])

  return { mode, lastChecked }
}
