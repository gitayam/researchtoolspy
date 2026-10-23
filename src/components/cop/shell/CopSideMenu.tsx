/**
 * CopSideMenu — the COP's phone navigation: an iOS-style side menu that slides over
 * the full-bleed map from the leading edge, over a dimmed backdrop.
 *
 * Interaction (after the slide-over side menus in awesome-ios-animation, e.g.
 * RESideMenu / Yalantis Side-Menu, without their parallax or scaling — the map
 * underneath is too heavy to scale and the effect adds nothing):
 *   - opens from the menu button, or by dragging right across `openGestureRef`
 *     (the top bar): the panel follows the finger and opens past a third of its
 *     width or on a flick. Not from the screen edge itself: iOS Safari and Chrome
 *     use that swipe for Back, and the map uses horizontal drags to pan.
 *   - closes by dragging it left, tapping the backdrop, Escape, the close button
 *     or the browser's Back.
 *   - modal while open (focus trapped, page inert); focus returns to the opener.
 *   - reduced motion: no slide; it appears and disappears.
 *   - stays mounted after the first open, so panel state and scroll survive.
 */
import { useCallback, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModalOverlay } from './overlay'
import { useDragGesture } from './useDragGesture'
import { prefersReducedMotion } from './useMediaQuery'

interface CopSideMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible name and header text. */
  title: string
  /** Shown under the title (e.g. "Shared view · live"). */
  subtitle?: ReactNode
  children: ReactNode
  /** An element (the top bar) where dragging right opens the menu. */
  openGestureRef?: RefObject<HTMLElement | null>
  /** Colours for the panel; default follows the app theme. */
  panelClassName?: string
  /** Extra classes on the portal root (e.g. `dark` to force the dark palette). */
  rootClassName?: string
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)' // iOS-like deceleration
const DURATION_MS = 320

export default function CopSideMenu({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  openGestureRef,
  panelClassName,
  rootClassName,
}: CopSideMenuProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Mounted from the first open (or the first drag) on; hidden when settled closed.
  const [mounted, setMounted] = useState(open)
  const [settledClosed, setSettledClosed] = useState(!open)
  const [dragging, setDragging] = useState(false)

  // Opening mounts it and clears the "settled closed" state (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setMounted(true)
      setSettledClosed(false)
    }
  }

  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  useModalOverlay({ open, onClose: close, containerRef: panelRef, initialFocusRef: closeRef })

  const width = () => panelRef.current?.getBoundingClientRect().width || Math.min(window.innerWidth * 0.85, 360)

  // Direct manipulation: write transform/opacity straight to the DOM while dragging.
  const paint = (openFraction: number, animate: boolean) => {
    const panel = panelRef.current
    const backdrop = backdropRef.current
    if (!panel || !backdrop) return
    const transition = animate && !prefersReducedMotion() ? `${DURATION_MS}ms ${EASE}` : 'none'
    panel.style.transition = `translate ${transition}`
    backdrop.style.transition = `opacity ${transition}`
    // Tailwind v4's translate-* utilities set `translate`; the drag overrides that same property.
    panel.style.translate = `${(openFraction - 1) * 100}% 0`
    backdrop.style.opacity = String(openFraction)
  }

  const clearPaint = () => {
    const panel = panelRef.current
    const backdrop = backdropRef.current
    if (panel) {
      panel.style.transition = ''
      panel.style.translate = ''
    }
    if (backdrop) {
      backdrop.style.transition = ''
      backdrop.style.opacity = ''
    }
  }

  // Drag the open menu left to close it.
  useDragGesture({
    handleRef: panelRef,
    axis: 'x',
    direction: -1,
    enabled: mounted && open,
    size: width,
    onStart: () => setDragging(true),
    onMove: (offset) => paint(1 - offset / width(), false),
    onEnd: (commit) => {
      setDragging(false)
      clearPaint()
      if (commit) close()
    },
  })

  // Drag right across the top bar to open it.
  const fallbackRef = useRef<HTMLElement>(null)
  useDragGesture({
    handleRef: openGestureRef ?? fallbackRef,
    axis: 'x',
    direction: 1,
    enabled: !!openGestureRef && !open,
    size: width,
    onStart: () => {
      setMounted(true)
      setSettledClosed(false)
      setDragging(true)
    },
    onMove: (offset) => paint(offset / width(), false),
    onEnd: (commit) => {
      setDragging(false)
      clearPaint()
      if (commit) onOpenChange(true)
      // Otherwise it slides back and onTransitionEnd hides it; with no transition, hide now.
      else if (prefersReducedMotion()) setSettledClosed(true)
    },
  })

  if (!mounted || typeof document === 'undefined') return null

  const visible = open || dragging
  return createPortal(
    <div
      className={cn('fixed inset-0 z-[60]', !visible && 'pointer-events-none', settledClosed && !visible && 'invisible', rootClassName)}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
    >
      <div
        ref={backdropRef}
        className={cn(
          'absolute inset-0 bg-black/55 transition-opacity motion-reduce:transition-none',
          open ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${DURATION_MS}ms`, transitionTimingFunction: EASE }}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onTransitionEnd={(event) => {
          if (event.target === panelRef.current && (event.propertyName === 'translate' || event.propertyName === 'transform') && !open) setSettledClosed(true)
        }}
        className={cn(
          'absolute inset-y-0 left-0 flex w-[min(85vw,360px)] flex-col shadow-2xl outline-none',
          'transition-transform motion-reduce:transition-none [touch-action:pan-y] overscroll-contain',
          open ? 'translate-x-0' : '-translate-x-full',
          panelClassName ?? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100',
        )}
        style={{
          transitionDuration: `${DURATION_MS}ms`,
          transitionTimingFunction: EASE,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        <div className="flex items-center gap-2 border-b border-black/10 py-1.5 pl-4 pr-1.5 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <div className="truncate text-xs opacity-70">{subtitle}</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
