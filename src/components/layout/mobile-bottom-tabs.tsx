/**
 * MobileBottomTabs — Persistent bottom tab bar for mobile/tablet (< lg)
 *
 * Provides one-tap access to the 5 most important dashboard sections.
 * Hidden on desktop (lg+) where the sidebar is always visible.
 */

import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Search,
  Map,
  Brain,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'home', label: 'Home', href: '/dashboard', icon: Home, exact: true },
  { id: 'tools', label: 'Tools', href: '/dashboard/tools', icon: Search },
  { id: 'cop', label: 'Workspaces', href: '/dashboard/cop', icon: Map },
  { id: 'frameworks', label: 'Analysis', href: '/dashboard/analysis-frameworks', icon: Brain },
] as const

interface MobileBottomTabsProps {
  onMoreClick: () => void
}

export function MobileBottomTabs({ onMoreClick }: MobileBottomTabsProps) {
  const { pathname } = useLocation()

  const isActive = (tab: typeof TABS[number]) => {
    if (tab.exact) return pathname === tab.href
    return pathname.startsWith(tab.href)
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)

          return (
            <Link
              key={tab.id}
              to={tab.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 transition-colors',
                active
                  ? 'text-[#4F5BFF] dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium truncate">{tab.label}</span>
            </Link>
          )
        })}

        {/* More button — opens the full sidebar drawer */}
        <button
          type="button"
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
          aria-label="More navigation options"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  )
}
