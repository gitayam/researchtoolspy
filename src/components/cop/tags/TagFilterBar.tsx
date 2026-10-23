/**
 * TagFilterBar -- filter a panel (or the whole COP) by tag.
 *
 * The session's tags as toggles, most used first, scrolling sideways on a phone
 * rather than wrapping into a wall. An item shows when it carries ANY active tag
 * (`match="any"`) or ALL of them (`match="all"`); the caller does the filtering
 * with `useCopTags().itemsWithTag`, this only holds the choice.
 */
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CopTag } from '@/types/cop'
import { tagChipClasses, tagKey } from './tag-names'

export interface TagFilterBarProps {
  tags: readonly CopTag[]
  active: readonly string[]
  onChange: (active: string[]) => void
  match?: 'any' | 'all'
  onMatchChange?: (match: 'any' | 'all') => void
  /** Hide tags no item carries. */
  hideUnused?: boolean
  className?: string
}

export default function TagFilterBar({ tags, active, onChange, match = 'any', onMatchChange, hideUnused = true, className }: TagFilterBarProps) {
  const shown = hideUnused ? tags.filter(t => (t.count ?? 0) > 0 || active.some(a => tagKey(a) === tagKey(t.name))) : tags
  if (shown.length === 0) return null
  const activeKeys = new Set(active.map(tagKey))

  const toggle = (name: string) => {
    const key = tagKey(name)
    onChange(activeKeys.has(key) ? active.filter(a => tagKey(a) !== key) : [...active, name])
  }

  return (
    <div className={cn('flex items-center gap-2', className)} role="group" aria-label="Filter by tag">
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:thin]">
        {shown.map(tag => {
          const pressed = activeKeys.has(tagKey(tag.name))
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.name)}
              aria-pressed={pressed}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
                pressed
                  ? tagChipClasses(tag.name, tag.color)
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
                // An enlarged hit area without a taller bar.
                "relative after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
              )}
            >
              <span className="max-w-[10rem] truncate">#{tag.name}</span>
              <span className="tabular-nums opacity-70">{tag.count}</span>
            </button>
          )
        })}
      </div>
      {active.length > 1 && onMatchChange && (
        <button
          type="button"
          onClick={() => onMatchChange(match === 'any' ? 'all' : 'any')}
          className="min-h-9 shrink-0 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
          title={match === 'any' ? 'Showing items with any of these tags' : 'Showing items with all of these tags'}
        >
          {match === 'any' ? 'Any of' : 'All of'}
        </button>
      )}
      {active.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  )
}

