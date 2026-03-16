/**
 * MobileBottomTabs — iOS/Android-style bottom tab bar
 *
 * Native-feel bottom navigation with:
 * - Frosted glass background (like iOS tab bar)
 * - Active pill indicator + filled icons
 * - Safe area padding for notched devices
 * - 5 quick-access tabs matching the most important sections
 */

import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Search,
  Map,
  Brain,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'home', label: 'Home', href: '/dashboard', icon: Home, exact: true },
  { id: 'tools', label: 'Tools', href: '/dashboard/tools', icon: Search, exact: false },
  { id: 'cop', label: 'Spaces', href: '/dashboard/cop', icon: Map, exact: false },
  { id: 'analysis', label: 'Analysis', href: '/dashboard/analysis-frameworks', icon: Brain, exact: false },
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
      className="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-700/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)

          return (
            <Link
              key={tab.id}
              to={tab.href}
              className={cn(
                'relative flex flex-col items-center justify-center min-w-[64px] py-1 gap-0.5 rounded-xl transition-all duration-200 active:scale-95',
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active background pill */}
              {active && (
                <span className="absolute inset-x-2 top-0.5 bottom-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl -z-10" />
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
        })}

        {/* More button — opens the full sidebar drawer */}
        <button
          type="button"
          onClick={onMoreClick}
          className="relative flex flex-col items-center justify-center min-w-[64px] py-1 gap-0.5 rounded-xl text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300 transition-all duration-200 active:scale-95 cursor-pointer"
          aria-label="More navigation options"
        >
          <Menu className="h-6 w-6" strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </div>
    </nav>
  )
}
