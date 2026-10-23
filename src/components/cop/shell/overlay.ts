/**
 * Modal behaviour shared by the COP side menu and sheets.
 *
 * Radix Dialog would trap focus too, but it hides the rest of the page from
 * assistive tech for as long as its content is mounted, and these overlays stay
 * mounted while closed (the evidence form keeps its draft). So: while an overlay
 * is open the app root (#root) is `inert` and the page can't scroll; focus moves
 * into the overlay, Tab cycles inside it, Escape and the browser's Back close it,
 * and focus returns to whatever opened it.
 */
import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

export function focusableIn(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  )
}

// Several overlays may be open at once (a sheet over the side menu): the root
// stays inert and the page locked until the last one closes.
let openOverlays = 0
let savedOverflow = ''
// Only the topmost overlay answers Escape and Tab.
const overlayStack: string[] = []

function acquirePageLock() {
  openOverlays += 1
  if (openOverlays > 1) return
  document.getElementById('root')?.setAttribute('inert', '')
  savedOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
}

function releasePageLock() {
  openOverlays = Math.max(0, openOverlays - 1)
  if (openOverlays > 0) return
  document.getElementById('root')?.removeAttribute('inert')
  document.documentElement.style.overflow = savedOverflow
}

/**
 * While `open`, the browser's Back closes the overlay instead of leaving the page.
 * Opening pushes a same-URL history entry (keeping the router's own state so it
 * sees no navigation); closing from the UI pops it again.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const id = useId()
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const base = (window.history.state ?? {}) as Record<string, unknown>
    window.history.pushState({ ...base, copOverlay: id }, '')
    let pushed = true
    const onPop = () => {
      if (!pushed) return
      pushed = false
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Closed from the UI: drop our entry, unless something navigated on top of it.
      if (pushed && (window.history.state as { copOverlay?: string } | null)?.copOverlay === id) {
        window.history.back()
      }
      pushed = false
    }
  }, [open, id])
}

interface ModalOverlayOptions {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  /** Element to focus on open; default: the first focusable element, else the container. */
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function useModalOverlay({ open, onClose, containerRef, initialFocusRef }: ModalOverlayOptions) {
  const overlayId = useId()
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    acquirePageLock()
    overlayStack.push(overlayId)

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      const target = initialFocusRef?.current ?? focusableIn(container)[0] ?? container
      target?.focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current
      if (!container || overlayStack[overlayStack.length - 1] !== overlayId) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusableIn(container)
      if (items.length === 0) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !container.contains(active)
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      const index = overlayStack.lastIndexOf(overlayId)
      if (index !== -1) overlayStack.splice(index, 1)
      releasePageLock()
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [open, overlayId, containerRef, initialFocusRef])

  useBackToClose(open, () => onCloseRef.current())
}
