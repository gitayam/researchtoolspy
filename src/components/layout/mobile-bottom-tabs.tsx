/**
 * MobileBottomTabs — iOS/Android-style context-aware bottom tab bar
 *
 * Native-feel bottom navigation with:
 * - Frosted glass background (like iOS tab bar)
 * - Active pill indicator + filled icons
 * - Safe area padding for notched devices
 * - Context-aware tabs that adapt based on current route
 *
 * Tab contexts:
 * - Global: Home, Tools, Surveys, Spaces, Analysis
 * - Survey Detail: Builder, Responses, Settings, Back
 * - COP Workspace: Map, Evidence, RFI, Tasks, More
 * - Frameworks: shows global tabs (no special context needed)
 */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Map,
  Brain,
  Menu,
  ClipboardList,
  Wrench,
  ArrowLeft,
  Settings,
  Inbox,
  FileText,
  HelpCircle,
  Clock,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tab definitions ─────────────────────────────────────────────

interface Tab {
  id: string
  label: string
  icon: typeof Home
  href?: string         // Link destination (if navigation tab)
  action?: string       // For callback-based tabs
  exact?: boolean
}

// Global tabs — shown on most pages
const GLOBAL_TABS: Tab[] = [
  { id: 'home', label: 'Home', href: '/dashboard', icon: Home, exact: true },
  { id: 'tools', label: 'Tools', href: '/dashboard/tools', icon: Wrench },
  { id: 'surveys', label: 'Surveys', href: '/dashboard/surveys', icon: ClipboardList },
  { id: 'cop', label: 'Spaces', href: '/dashboard/cop', icon: Map },
  { id: 'analysis', label: 'Analysis', href: '/dashboard/analysis-frameworks', icon: Brain },
]

// Survey detail tabs — shown on /dashboard/surveys/:id
const SURVEY_DETAIL_TABS: Tab[] = [
  { id: 'back', label: 'Surveys', href: '/dashboard/surveys', icon: ArrowLeft },
  { id: 'builder', label: 'Builder', action: 'builder', icon: Wrench },
  { id: 'responses', label: 'Responses', action: 'responses', icon: Inbox },
  { id: 'analytics', label: 'Analytics', action: 'analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', action: 'settings', icon: Settings },
]

// COP workspace tabs — shown on /dashboard/cop/:id
const COP_TABS: Tab[] = [
  { id: 'back', label: 'Spaces', href: '/dashboard/cop', icon: ArrowLeft },
  { id: 'map', label: 'Map', action: 'map', icon: Map },
  { id: 'evidence', label: 'Evidence', action: 'evidence', icon: FileText },
  { id: 'rfi', label: 'Questions', action: 'rfi', icon: HelpCircle },
  { id: 'timeline', label: 'Timeline', action: 'timeline', icon: Clock },
]

// ── Context detection ───────────────────────────────────────────

type TabContext = 'global' | 'survey-detail' | 'cop-workspace'

function detectContext(pathname: string): TabContext {
  // /dashboard/surveys/:id (but not /dashboard/surveys alone)
  if (/^\/dashboard\/surveys\/[^/]+/.test(pathname)) return 'survey-detail'
  // /dashboard/cop/:id (COP workspace — has its own layout, but we support it)
  if (/^\/dashboard\/cop\/[^/]+/.test(pathname)) return 'cop-workspace'
  return 'global'
}

function getTabsForContext(context: TabContext): Tab[] {
  switch (context) {
    case 'survey-detail': return SURVEY_DETAIL_TABS
    case 'cop-workspace': return COP_TABS
    default: return GLOBAL_TABS
  }
}

// ── Component ───────────────────────────────────────────────────

interface MobileBottomTabsProps {
  onMoreClick?: () => void
}

export function MobileBottomTabs({ onMoreClick }: MobileBottomTabsProps) {
  const { pathname } = useLocation()
  const context = detectContext(pathname)
  const tabs = getTabsForContext(context)
  const [activeActionTab, setActiveActionTab] = useState<string>('builder')

  // Listen for tab state from survey detail page
  useEffect(() => {
    const handler = (e: Event) => {
      setActiveActionTab((e as CustomEvent).detail)
    }
    window.addEventListener('survey-tab-change', handler)
    return () => window.removeEventListener('survey-tab-change', handler)
  }, [])

  // Reset active tab when context changes
  useEffect(() => {
    if (context === 'cop-workspace') setActiveActionTab('map')
    else if (context === 'survey-detail') setActiveActionTab('builder')
  }, [context])

  const isActive = (tab: Tab) => {
    // Action-based tabs: check internal state
    if (tab.action) return activeActionTab === tab.action
    // Link-based tabs: check pathname
    if (tab.exact) return pathname === tab.href
    if (tab.href) return pathname.startsWith(tab.href)
    return false
  }

  const handleActionTab = (action: string) => {
    setActiveActionTab(action)
    window.dispatchEvent(new CustomEvent('bottom-nav-tab-select', { detail: action }))
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-700/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)

          // Link-based tab (navigation)
          if (tab.href) {
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={cn(
                  'relative flex flex-col items-center justify-center min-w-[56px] py-1 gap-0.5 rounded-xl transition-all duration-200 active:scale-95',
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span className="absolute inset-x-1 top-0.5 bottom-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl -z-10" />
                )}
                <Icon
                  className={cn('h-6 w-6 transition-all duration-200', active && 'scale-110')}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span className={cn(
                  'text-[10px] leading-tight transition-all duration-200',
                  active ? 'font-semibold' : 'font-medium'
                )}>
                  {tab.label}
                </span>
              </Link>
            )
          }

          // Action-based tab (in-page navigation like survey tabs)
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleActionTab(tab.action!)}
              className={cn(
                'relative flex flex-col items-center justify-center min-w-[56px] py-1 gap-0.5 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer',
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span className="absolute inset-x-1 top-0.5 bottom-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl -z-10" />
              )}
              <Icon
                className={cn('h-6 w-6 transition-all duration-200', active && 'scale-110')}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className={cn(
                'text-[10px] leading-tight transition-all duration-200',
                active ? 'font-semibold' : 'font-medium'
              )}>
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* More button — only on global context */}
        {context === 'global' && onMoreClick && (
          <button
            type="button"
            onClick={onMoreClick}
            className="relative flex flex-col items-center justify-center min-w-[56px] py-1 gap-0.5 rounded-xl text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300 transition-all duration-200 active:scale-95 cursor-pointer"
            aria-label="More navigation options"
          >
            <Menu className="h-6 w-6" strokeWidth={1.75} />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        )}
      </div>
    </nav>
  )
}
