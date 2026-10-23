/**
 * CopSheet — a modal sheet for a short task over the COP (submitting evidence).
 *
 *   - phones: an iOS-style bottom sheet with a grabber; drag the grabber or header
 *     down to dismiss (or tap the backdrop, Escape, Back, Close). It sits above the
 *     software keyboard (visualViewport), so the focused field and the form's
 *     submit button stay reachable.
 *   - tablet/desktop: a sheet from the right edge, full height.
 *   - stays mounted after the first open: dismissing it by accident keeps whatever
 *     was typed; the caller decides when to reset.
 *   - reduced motion: no slide.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModalOverlay } from './overlay'
import { useDragGesture } from './useDragGesture'
import { useIsPhone } from './useMediaQuery'

interface CopSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** Buttons beside Close in the header (e.g. "Open in new window"). */
  headerActions?: ReactNode
  children: ReactNode
  /** Extra classes on the portal root (e.g. `dark`). */
  rootClassName?: string
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DURATION_MS = 320

/** Height of the visual viewport and how much of the layout viewport the keyboard covers. */
function useVisualViewport(active: boolean) {
  const [state, setState] = useState<{ height: number; keyboard: number } | null>(null)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) return
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setState({ height: vv.height, keyboard })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return state
}

export default function CopSheet({ open, onOpenChange, title, description, headerActions, children, rootClassName }: CopSheetProps) {
  const isPhone = useIsPhone()
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(open)
  const [settledClosed, setSettledClosed] = useState(!open)

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
  const viewport = useVisualViewport(open && isPhone)

  const height = () => panelRef.current?.getBoundingClientRect().height || window.innerHeight * 0.9
  useDragGesture({
    handleRef: dragHandleRef,
    axis: 'y',
    direction: 1,
    enabled: mounted && open && isPhone,
    size: height,
    onMove: (offset) => {
      const panel = panelRef.current
      const backdrop = backdropRef.current
      if (!panel || !backdrop) return
      panel.style.transition = 'none'
      backdrop.style.transition = 'none'
      panel.style.translate = `0 ${offset}px`
      backdrop.style.opacity = String(1 - offset / height())
    },
    onEnd: (commit) => {
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
      if (commit) close()
    },
  })

  if (!mounted || typeof document === 'undefined') return null

  const hiddenTransform = isPhone ? 'translate-y-full' : 'translate-x-full'
  const phoneStyle = isPhone
    ? {
        bottom: viewport?.keyboard ?? 0,
        maxHeight: viewport ? Math.max(240, viewport.height - 16) : 'calc(100dvh - 16px)',
        paddingBottom: viewport && viewport.keyboard > 0 ? 0 : 'env(safe-area-inset-bottom)',
      }
    : { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }

  return createPortal(
    <div
      className={cn('fixed inset-0 z-[70]', !open && 'pointer-events-none', settledClosed && !open && 'invisible', rootClassName)}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
    >
      <div
        ref={backdropRef}
        className={cn('absolute inset-0 bg-black/55 transition-opacity motion-reduce:transition-none', open ? 'opacity-100' : 'opacity-0')}
        style={{ transitionDuration: `${DURATION_MS}ms`, transitionTimingFunction: EASE }}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onTransitionEnd={(event) => {
          if (event.target === panelRef.current && (event.propertyName === 'translate' || event.propertyName === 'transform') && !open) setSettledClosed(true)
        }}
        className={cn(
          'absolute flex flex-col bg-white text-slate-900 shadow-2xl outline-none dark:bg-slate-900 dark:text-slate-100',
          'transition-transform motion-reduce:transition-none',
          isPhone
            ? 'inset-x-0 rounded-t-2xl'
            : 'inset-y-0 right-0 w-[min(480px,100vw)] border-l border-black/10 dark:border-white/10',
          open ? 'translate-x-0 translate-y-0' : hiddenTransform,
        )}
        style={{ transitionDuration: `${DURATION_MS}ms`, transitionTimingFunction: EASE, ...phoneStyle }}
      >
        <div ref={dragHandleRef} className={cn('shrink-0', isPhone && '[touch-action:none]')}>
          {isPhone && (
            <div className="flex justify-center pt-2" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          )}
          <div className="flex items-start gap-2 border-b border-black/10 py-2 pl-4 pr-1.5 dark:border-white/10">
            <div className="min-w-0 flex-1 py-1.5">
              <h2 id={titleId} className="text-base font-semibold leading-tight">{title}</h2>
              {description && (
                <div id={descriptionId} className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
              )}
            </div>
            {headerActions}
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

