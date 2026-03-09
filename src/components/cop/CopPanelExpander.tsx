import { type ReactNode, useState, useCallback, useEffect, useRef } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Props ────────────────────────────────────────────────────────

export type PanelHeight = 'compact' | 'standard' | 'tall' | string

interface CopPanelExpanderProps {
  id: string // Required for persistence and data-panel attribute
  title: string
  icon: ReactNode
  badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  children: (expanded: boolean) => ReactNode
  className?: string
  height?: PanelHeight
  defaultHidden?: boolean
}

const HEIGHT_MAP: Record<string, string> = {
  compact: 'h-[200px]',
  standard: 'h-[320px]',
  tall: 'h-[480px]',
}

// ── Component ────────────────────────────────────────────────────

export default function CopPanelExpander({
  id,
  title,
  icon,
  badge,
  badgeVariant = 'secondary',
  children,
  className,
  height = 'standard',
  defaultHidden = false,
}: CopPanelExpanderProps) {
  const storageKey = `cop_panel_${id}_expanded`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Initialize from localStorage if available
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved === 'true'
  })
  const [hidden] = useState(defaultHidden)

  const handleExpand = useCallback(() => {
    setExpanded(true)
    localStorage.setItem(storageKey, 'true')
  }, [storageKey])

  const handleCollapse = useCallback(() => {
    setExpanded(false)
    localStorage.setItem(storageKey, 'false')
  }, [storageKey])

  // Focus management: focus overlay on expand, restore trigger on collapse
  useEffect(() => {
    if (expanded && overlayRef.current) {
      overlayRef.current.focus()
    } else if (!expanded && triggerRef.current) {
      triggerRef.current.focus()
    }
  }, [expanded])

  // Keyboard: Escape to collapse expanded overlay
  useEffect(() => {
    if (!expanded) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCollapse()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [expanded, handleCollapse])

  // Sync with localStorage if external changes happen (rare but good for consistency)
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) {
      setExpanded(saved === 'true')
    }
  }, [storageKey])

  if (hidden) return null

  // ── Expanded: full-screen overlay ────────────────────────────

  if (expanded) {
    return (
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-background flex flex-col"
        data-panel={id}
        role="dialog"
        aria-label={`${title} — expanded`}
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Unified Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span className="shrink-0">{icon}</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {title}
            </h3>
            {badge != null && (
              <Badge variant={badgeVariant} className="text-[10px] px-1.5 h-4">
                {badge}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
              onClick={handleCollapse}
              aria-label="Minimize panel"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
              onClick={handleCollapse}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 bg-slate-50/30 dark:bg-slate-950/30">
          <div className="max-w-7xl mx-auto">
            {children(true)}
          </div>
        </div>
      </div>
    )
  }

  // ── Collapsed: compact card ──────────────────────────────────

  const resolvedHeight = HEIGHT_MAP[height] || height

  return (
    <div
      className={cn(
        'group flex flex-col relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition-all duration-200 motion-reduce:transition-none',
        resolvedHeight,
        className
      )}
      data-panel={id}
      role="region"
      aria-label={title}
    >
      {/* Unified Header */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="shrink-0">{icon}</span>
          <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
            {title}
          </h3>
          {badge != null && (
            <Badge variant={badgeVariant} className="text-[10px] px-1.5 h-4">
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity motion-reduce:transition-none hover:bg-slate-200 dark:hover:bg-slate-700"
            onClick={handleExpand}
            aria-label={`Expand ${title} panel`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4">
        {children(false)}
      </div>

      {/* Fade-out gradient at bottom of collapsed card */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none" />
    </div>
  )
}
