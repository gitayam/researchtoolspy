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

// ── History: the browser's Back closes the topmost overlay ──────────
//
// Opening an overlay pushes a same-URL history entry (keeping the router's state, so
// it sees no navigation); closing it from the UI pops that entry with history.back().
// That pop arrives asynchronously, which used to break two things:
//   - an overlay opened in the same moment (the side menu's "Submit evidence" closes
//     the menu and opens a sheet) pushed its entry first, so the pending pop removed
//     the NEW entry and closed the new overlay at once;
//   - the browser restored the scroll position of the entry it returned to, undoing a
//     scroll the menu had just started (the menu's "Jump to" did nothing).
// So one coordinator owns the entries: while our own pop is pending, other overlays
// ignore it and new ones wait to push; scroll restoration is manual while we hold
// entries; and a real Back closes only the overlays above the entry it returns to.

interface OverlayEntry {
  id: string
  onPop: () => void
}

const entries: OverlayEntry[] = []
let pendingBacks = 0
let pendingTimer: ReturnType<typeof setTimeout> | undefined
let settleWaiters: Array<() => void> = []
let savedRestoration: ScrollRestoration | null = null
let listening = false

function currentOverlayId(): string | undefined {
  return (window.history.state as { copOverlay?: string } | null)?.copOverlay
}

function holdScroll() {
  if (savedRestoration !== null || !('scrollRestoration' in window.history)) return
  savedRestoration = window.history.scrollRestoration
  window.history.scrollRestoration = 'manual'
}

function settleIfIdle() {
  if (pendingBacks > 0) return
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = undefined
  const waiters = settleWaiters
  settleWaiters = []
  waiters.forEach((resolve) => resolve())
  if (entries.length === 0 && savedRestoration !== null) {
    window.history.scrollRestoration = savedRestoration
    savedRestoration = null
  }
}

function onGlobalPop() {
  if (pendingBacks > 0) {
    // Our own history.back() from an overlay closed in the UI: not the user's Back.
    pendingBacks -= 1
    settleIfIdle()
    return
  }
  // The user's Back: close every overlay above the entry the browser returned to.
  const keep = entries.findIndex((entry) => entry.id === currentOverlayId())
  const closing = entries.splice(keep + 1)
  for (const entry of closing.reverse()) entry.onPop()
  settleIfIdle()
}

function popOwnEntry() {
  pendingBacks += 1
  if (pendingTimer) clearTimeout(pendingTimer)
  // A pop that never arrives (no earlier entry, a blocked traversal) must not leave
  // overlays waiting for ever.
  pendingTimer = setTimeout(() => {
    pendingBacks = 0
    settleIfIdle()
  }, 1500)
  window.history.back()
}

/** Resolves once no overlay's own history pop is pending (immediately when none is). */
export function whenHistorySettled(): Promise<void> {
  if (typeof window === 'undefined' || pendingBacks === 0) return Promise.resolve()
  return new Promise((resolve) => settleWaiters.push(resolve))
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const id = useId()
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    if (!listening) {
      window.addEventListener('popstate', onGlobalPop)
      listening = true
    }
    let cancelled = false
    let pushed = false
    const entry: OverlayEntry = {
      id,
      onPop: () => {
        pushed = false
        onCloseRef.current()
      },
    }
    const push = () => {
      if (cancelled) return
      holdScroll()
      const base = (window.history.state ?? {}) as Record<string, unknown>
      window.history.pushState({ ...base, copOverlay: id }, '')
      entries.push(entry)
      pushed = true
    }
    if (pendingBacks === 0) push()
    else void whenHistorySettled().then(push)

    return () => {
      cancelled = true
      if (!pushed) return
      pushed = false
      const index = entries.indexOf(entry)
      if (index !== -1) entries.splice(index, 1)
      // Closed from the UI: drop our entry, unless something navigated on top of it.
      if (currentOverlayId() === id) popOwnEntry()
      else settleIfIdle()
    }
  }, [open, id])
}

interface ModalOverlayOptions {
  open: boolean
  onClose: () => void
  containerRef: RefObject<HTMLElement | null>
  /** Element to focus on open; default: the first focusable element, else the container. */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Where focus goes on close when nothing was focused at open (Safari doesn't focus a tapped button). */
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function useModalOverlay({ open, onClose, containerRef, initialFocusRef, returnFocusRef }: ModalOverlayOptions) {
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
      const back = previouslyFocused && previouslyFocused !== document.body && document.contains(previouslyFocused)
        ? previouslyFocused
        : returnFocusRef?.current
      back?.focus({ preventScroll: true })
    }
  }, [open, overlayId, containerRef, initialFocusRef, returnFocusRef])

  useBackToClose(open, () => onCloseRef.current())
}
