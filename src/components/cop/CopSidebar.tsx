/**
 * CopSidebar — Persistent sidebar navigation for COP workspace
 *
 * Responsive:
 *   - 240px full sidebar on lg+ (1024px+)
 *   - 48px icon rail on md (768–1023px)
 *   - Hidden on mobile (< 768px) — Phase 4 adds bottom tab bar
 *
 * Features:
 *   - Panel jump-links (click → scroll to panel via data-panel attribute)
 *   - Live stat counts in footer
 *   - Active panel tracking (highlights nearest panel in viewport)
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CopWorkspaceMode } from '@/types/cop'

// ── Nav items ────────────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: typeof Database
  color: string
  modes: CopWorkspaceMode[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'entities', label: 'Entities', icon: Database, color: 'text-purple-500 dark:text-purple-400', modes: ['progress'] },
  { id: 'map', label: 'Map', icon: MapIcon, color: 'text-green-500 dark:text-green-400', modes: ['progress', 'monitor'] },
  { id: 'graph', label: 'Relationships', icon: Network, color: 'text-purple-500 dark:text-purple-400', modes: ['progress'] },
  { id: 'timeline', label: 'Timeline', icon: Clock, color: 'text-blue-500 dark:text-blue-400', modes: ['progress'] },
  { id: 'actors', label: 'Actors', icon: Users, color: 'text-purple-500 dark:text-purple-400', modes: ['progress', 'monitor'] },
  { id: 'rfi', label: 'Questions & RFIs', icon: HelpCircle, color: 'text-amber-500 dark:text-amber-400', modes: ['progress', 'monitor'] },
  { id: 'analysis', label: 'Analysis', icon: Brain, color: 'text-emerald-500 dark:text-emerald-400', modes: ['progress', 'monitor'] },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList, color: 'text-orange-500 dark:text-orange-400', modes: ['progress', 'monitor'] },
  { id: 'evidence', label: 'Evidence', icon: FileText, color: 'text-blue-500 dark:text-blue-400', modes: ['progress', 'monitor'] },
  { id: 'activity', label: 'Activity', icon: Activity, color: 'text-slate-500 dark:text-slate-400', modes: ['progress'] },
]

// ── Props ────────────────────────────────────────────────────────

interface CopSidebarProps {
  mode: CopWorkspaceMode
  stats?: {
    evidence_count?: number
    entity_count?: number
    open_rfis?: number
    blocker_count?: number
    hypothesis_count?: number
  }
}

// ── Component ────────────────────────────────────────────────────

export default function CopSidebar({ mode, stats }: CopSidebarProps) {
  const [activePanel, setActivePanel] = useState<string>('')
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('cop_sidebar_collapsed')
    return saved === 'true'
  })
  const observerRef = useRef<IntersectionObserver | null>(null)

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
        // Set the most visible panel as active
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
  }, [mode])

  const handleNavClick = useCallback((panelId: string) => {
    const el = document.querySelector(`[data-panel="${panelId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActivePanel(panelId)
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('cop_sidebar_collapsed', String(next))
      return next
    })
  }, [])

  const filteredItems = NAV_ITEMS.filter(item => item.modes.includes(mode))

  // Stat badges for nav items
  const getBadge = (id: string): number | undefined => {
    if (!stats) return undefined
    switch (id) {
      case 'entities': return stats.entity_count
      case 'evidence': return stats.evidence_count
      case 'rfi': return stats.open_rfis
      case 'analysis': return stats.hypothesis_count
      default: return undefined
    }
  }

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-200 motion-reduce:transition-none',
        collapsed ? 'w-12' : 'w-[220px] lg:w-[240px]',
      )}
      role="navigation"
      aria-label="Panel navigation"
    >
      {/* ── Nav items ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-1.5">
          {filteredItems.map(item => {
            const Icon = item.icon
            const isActive = activePanel === item.id
            const badge = getBadge(item.id)

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-md transition-colors duration-150 cursor-pointer',
                    collapsed ? 'justify-center px-1.5 py-2' : 'px-2.5 py-1.5',
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? item.color : '')} />
                  {!collapsed && (
                    <>
                      <span className="text-xs font-medium truncate flex-1 text-left">
                        {item.label}
                      </span>
                      {badge != null && badge > 0 && (
                        <span className="text-[10px] tabular-nums font-medium text-slate-500 dark:text-slate-400">
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Footer: stats summary + collapse toggle ───────────── */}
      <div className="border-t border-slate-100 dark:border-slate-800 px-2 py-2">
        {!collapsed && stats && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 px-1">
            {stats.blocker_count != null && stats.blocker_count > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                  {stats.blocker_count} blocker{stats.blocker_count !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {stats.open_rfis != null && stats.open_rfis > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  {stats.open_rfis} open RFI{stats.open_rfis !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  )
}
