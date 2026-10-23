/**
 * A one-axis drag for the COP side menu and sheets: the panel follows the finger,
 * and on release it commits (opens/closes) past a third of its size or on a flick,
 * otherwise it settles back. The gesture only starts once the pointer has moved
 * 8 px more along `axis` than across it, so vertical scrolling and taps keep
 * working; a drag that started on a button doesn't also click it.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

interface DragGestureOptions {
  handleRef: RefObject<HTMLElement | null>
  axis: 'x' | 'y'
  /** +1: right/down moves the panel along; -1: left/up. */
  direction: 1 | -1
  enabled: boolean
  /** Full travel in px (the panel's width or height). */
  size: () => number
  onStart?: () => void
  /** Offset along `direction`, 0..size. */
  onMove: (offset: number) => void
  onEnd: (commit: boolean) => void
}

const LOCK_PX = 8
const COMMIT_FRACTION = 0.35
const FLICK_PX_PER_MS = 0.5
const IGNORE = 'input, textarea, select, [contenteditable="true"], [data-no-drag]'

export function useDragGesture(options: DragGestureOptions) {
  const optionsRef = useRef(options)
  useLayoutEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const handle = options.handleRef.current
    if (!handle || !options.enabled) return

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let locked = false
    let abandoned = false
    let offset = 0
    let samples: { t: number; offset: number }[] = []

    const reset = () => {
      pointerId = null
      locked = false
      abandoned = false
      offset = 0
      samples = []
    }

    const suppressNextClick = () => {
      const stop = (event: MouseEvent) => {
        event.stopPropagation()
        event.preventDefault()
      }
      window.addEventListener('click', stop, { capture: true, once: true })
      // A drag that ends off the element produces no click; don't eat a later one.
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 400)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return
      if (event.target instanceof Element && event.target.closest(IGNORE)) return
      pointerId = event.pointerId
      startX = event.clientX
      startY = event.clientY
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId || abandoned) return
      const { axis, direction, size, onStart, onMove } = optionsRef.current
      const along = axis === 'x' ? event.clientX - startX : event.clientY - startY
      const across = axis === 'x' ? event.clientY - startY : event.clientX - startX
      if (!locked) {
        if (Math.abs(along) < LOCK_PX && Math.abs(across) < LOCK_PX) return
        if (Math.abs(across) >= Math.abs(along) || along * direction <= 0) {
          abandoned = true
          return
        }
        locked = true
        try { handle.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
        onStart?.()
      }
      offset = Math.min(Math.max(along * direction, 0), size())
      samples.push({ t: event.timeStamp, offset })
      if (samples.length > 6) samples.shift()
      onMove(offset)
    }

    const finish = (event: PointerEvent, cancelled: boolean) => {
      if (event.pointerId !== pointerId) return
      if (locked) {
        const { size, onEnd } = optionsRef.current
        const first = samples[0]
        const last = samples[samples.length - 1]
        const dt = first && last ? last.t - first.t : 0
        const velocity = dt > 0 ? (last.offset - first.offset) / dt : 0
        const commit = !cancelled && (offset > size() * COMMIT_FRACTION || (velocity > FLICK_PX_PER_MS && offset > 16))
        suppressNextClick()
        onEnd(commit)
      }
      reset()
    }

    const onPointerUp = (event: PointerEvent) => finish(event, false)
    const onPointerCancel = (event: PointerEvent) => finish(event, true)

    handle.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      handle.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [options.handleRef, options.enabled])
}
