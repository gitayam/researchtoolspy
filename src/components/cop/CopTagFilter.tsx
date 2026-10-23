/**
 * One tag filter for the whole COP page: the feed, the task board, the timeline,
 * claims, hypotheses, cams and the map all show only items carrying the chosen
 * tags while it is set. The state lives here; tags themselves come from the
 * page's `CopTagsProvider`.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Filter, X } from 'lucide-react'
import { TagFilterBar, matchesTagFilter, useCopTagsContext } from '@/components/cop/tags'
import { CopTagFilterContext, useCopTagFilter, type CopTagFilterState } from '@/components/cop/tag-filter-context'
import { cn } from '@/lib/utils'
import type { CopTagTargetType } from '@/types/cop'

export function CopTagFilterProvider({ children }: { children: ReactNode }) {
  const tags = useCopTagsContext()
  const [active, setActive] = useState<string[]>([])
  const [match, setMatch] = useState<'any' | 'all'>('any')
  const tagsFor = tags?.tagsFor
  const enabled = !!tags?.available

  const passes = useCallback((targetType: CopTagTargetType, targetId: string | number) => {
    if (!enabled || active.length === 0 || !tagsFor) return true
    return matchesTagFilter(tagsFor(targetType, String(targetId)), active, match)
  }, [active, enabled, match, tagsFor])

  const value = useMemo<CopTagFilterState>(() => ({
    active,
    match,
    setActive,
    setMatch,
    clear: () => setActive([]),
    filtering: enabled && active.length > 0,
    passes,
  }), [active, enabled, match, passes])

  return <CopTagFilterContext.Provider value={value}>{children}</CopTagFilterContext.Provider>
}

/** The filter bar, shown once the session has tags in use. */
export function CopTagFilterStrip({ className }: { className?: string }) {
  const tags = useCopTagsContext()
  const filter = useCopTagFilter()
  if (!tags?.available || tags.tags.every(t => (t.count ?? 0) === 0 && !filter.active.includes(t.name))) return null

  return (
    <div
      className={cn('flex items-center gap-2 px-2 sm:px-3 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-background', className)}
      role="region"
      aria-label="Filter the COP by tag"
    >
      <Filter className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
      <TagFilterBar
        tags={tags.tags}
        active={filter.active}
        onChange={filter.setActive}
        match={filter.match}
        onMatchChange={filter.setMatch}
        className="flex-1 min-w-0"
      />
      {filter.filtering && (
        <button
          type="button"
          onClick={filter.clear}
          className="inline-flex min-h-[44px] sm:min-h-0 items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear filter
        </button>
      )}
    </div>
  )
}

/** "Showing n of m" note for a panel while the filter hides some of its items. */
export function TagFilterNote({ shown, total }: { shown: number; total: number }) {
  const filter = useCopTagFilter()
  if (!filter.filtering || shown === total) return null
  return (
    <p className="px-1 text-[11px] text-gray-500 dark:text-gray-400" role="status">
      Showing {shown} of {total} with the tag filter{' '}
      <button type="button" onClick={filter.clear} className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded">
        clear
      </button>
    </p>
  )
}
