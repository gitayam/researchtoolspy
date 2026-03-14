/**
 * CopSidebar — Persistent sidebar navigation for COP workspace
 *
 * Responsive:
 *   - Collapsed icon rail by default (48px)
 *   - Expandable to full labels (200px) via toggle
 *   - Hidden on mobile (< 768px)
 *
 * Features:
 *   - Panel jump-links (click → scroll to panel via data-panel attribute)
 *   - Live stat counts
 *   - Active panel tracking (highlights nearest panel in viewport)
 *   - Reflects dynamic panel order from usePanelLayout
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Database,
  Map as MapIcon,
  Network,
  Clock,
  Users,
  HelpCircle,
  Brain,
  ClipboardList,
  FileText,
  Activity,
  Inbox,
  Package,
  Zap,
  FileWarning,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CopWorkspaceMode } from '@/types/cop'

// ── Panel metadata for sidebar ──────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: typeof Database
  color: string
  modes: CopWorkspaceMode[]
  /** Stat key used to look up badge count */
  statKey?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'entities', label: 'Entities',      icon: Database,      color: 'text-purple-500 dark:text-purple-400', modes: ['progress'], statKey: 'entity_count' },
  { id: 'map',      label: 'Map',           icon: MapIcon,       color: 'text-green-500 dark:text-green-400',   modes: ['progress', 'monitor'] },
  { id: 'graph',    label: 'Relationships',  icon: Network,       color: 'text-purple-500 dark:text-purple-400', modes: ['progress'] },
  { id: 'timeline', label: 'Timeline',      icon: Clock,         color: 'text-blue-500 dark:text-blue-400',     modes: ['progress'] },
  { id: 'actors',   label: 'Actors',        icon: Users,         color: 'text-purple-500 dark:text-purple-400', modes: ['progress', 'monitor'] },
  { id: 'rfi',      label: 'Questions',     icon: HelpCircle,    color: 'text-amber-500 dark:text-amber-400',   modes: ['progress', 'monitor'], statKey: 'open_rfis' },
  { id: 'analysis', label: 'Analysis',      icon: Brain,         color: 'text-emerald-500 dark:text-emerald-400', modes: ['progress', 'monitor'], statKey: 'hypothesis_count' },
  { id: 'tasks',    label: 'Tasks',         icon: ClipboardList, color: 'text-orange-500 dark:text-orange-400', modes: ['progress', 'monitor'] },
  { id: 'submissions', label: 'Inbox',      icon: Inbox,         color: 'text-cyan-500 dark:text-cyan-400',     modes: ['progress'] },
  { id: 'assets',   label: 'Assets',        icon: Package,       color: 'text-teal-500 dark:text-teal-400',     modes: ['progress', 'monitor'] },
  { id: 'playbooks', label: 'Playbooks',    icon: Zap,           color: 'text-yellow-500 dark:text-yellow-400', modes: ['progress'] },
  { id: 'claims',    label: 'Claims',       icon: FileWarning,   color: 'text-indigo-500 dark:text-indigo-400', modes: ['progress'] },
  { id: 'evidence', label: 'Evidence',      icon: FileText,      color: 'text-blue-500 dark:text-blue-400',     modes: ['progress', 'monitor'], statKey: 'evidence_count' },
  { id: 'activity', label: 'Activity',      icon: Activity,      color: 'text-slate-500 dark:text-slate-400',   modes: ['progress'] },
]

// Build a lookup for ordering
const NAV_ITEM_MAP = new Map(NAV_ITEMS.map((item) => [item.id, item]))

// ── Props ────────────────────────────────────────────────────────

interface CopSidebarProps {
  mode: CopWorkspaceMode
  stats?: Record<string, number | undefined>
  /** Panel order from usePanelLayout — sidebar mirrors this order */
  panelOrder?: string[]
  onResetLayout?: () => void
  /** Override container classes (e.g. for mobile drawer where hidden md:flex is unwanted) */
  className?: string
  /** Called when a nav item is clicked — useful for closing mobile drawer */
  onNavClick?: () => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopSidebar({ mode, stats, panelOrder, onResetLayout, className, onNavClick }: CopSidebarProps) {
  const [activePanel, setActivePanel] = useState<string>('')
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('cop_sidebar_collapsed')
    // Default to collapsed for more content space
    return saved === null ? true : saved === 'true'
  })
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Build nav items: pinned items (entities, map) first, then dynamic order
  const pinnedIds = ['entities', 'map']
  const dynamicItems = panelOrder
    ? panelOrder.filter((id) => !pinnedIds.includes(id)).map((id) => NAV_ITEM_MAP.get(id)).filter(Boolean) as NavItem[]
    : NAV_ITEMS.filter((item) => !pinnedIds.includes(item.id))

  const orderedItems = [
    ...pinnedIds.map((id) => NAV_ITEM_MAP.get(id)!),
    ...dynamicItems,
  ].filter((item) => item.modes.includes(mode))

  // Track which panel is currently in view
  useEffect(() => {
    const panels = document.querySelectorAll('[data-panel]')
    if (panels.length === 0) return

    const visiblePanels = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const panelId = (entry.target as HTMLElement).dataset.panel
          if (!panelId) continue
          if (entry.isIntersecting) {
            visiblePanels.set(panelId, entry.intersectionRatio)
          } else {
            visiblePanels.delete(panelId)
          }
        }
        let bestId = ''
        let bestRatio = 0
        for (const [id, ratio] of visiblePanels) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }
        if (bestId) setActivePanel(bestId)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-80px 0px -40% 0px' }
    )

    panels.forEach(panel => observerRef.current?.observe(panel))

    return () => {
      observerRef.current?.disconnect()
    }
  }, [mode, panelOrder])

  const handleNavClick = useCallback((panelId: string) => {
    const el = document.querySelector(`[data-panel="${panelId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActivePanel(panelId)
    }
    onNavClick?.()
  }, [onNavClick])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('cop_sidebar_collapsed', String(next))
      return next
    })
  }, [])

  const getBadge = (item: NavItem): number | undefined => {
    if (!stats || !item.statKey) return undefined
    const val = stats[item.statKey]
    return typeof val === 'number' && val > 0 ? val : undefined
  }

  return (
    <aside
      className={className ?? cn(
        'hidden md:flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-200 motion-reduce:transition-none',
        collapsed ? 'w-11' : 'w-[180px]',
      )}
      role="navigation"
      aria-label="Panel navigation"
    >
      {/* ── Nav items ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        <ul className="space-y-px px-1">
          {orderedItems.map(item => {
            const Icon = item.icon
            const isActive = activePanel === item.id
            const badge = getBadge(item)

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-md transition-colors duration-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
                    collapsed ? 'justify-center px-1 py-1.5' : 'px-2 py-1.5',
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? item.color : '')} />
                  {!collapsed && (
                    <>
                      <span className="text-[11px] font-medium truncate flex-1 text-left">
                        {item.label}
                      </span>
                      {badge != null && (
                        <span className={cn(
                          'text-[9px] tabular-nums font-semibold min-w-[16px] text-center rounded-full px-1',
                          item.statKey === 'open_rfis'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-500',
                        )}>
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && badge != null && (
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-1 py-1.5 flex flex-col gap-1">
        {!collapsed && onResetLayout && (
          <button
            type="button"
            onClick={onResetLayout}
            className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            title="Reset panel layout"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset layout</span>
          </button>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </aside>
  )
}
