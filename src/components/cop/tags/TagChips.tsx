/**
 * TagChips -- an item's tags as small chips.
 *
 * Optional actions: tap a chip to filter by it (`onSelect`), or remove it
 * (`onRemove`). The remove control is small to look at but its hit area is
 * extended to 44px, so it can be used on a phone without crowding a card.
 */
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tagChipClasses } from './tag-names'

export interface TagChipsProps {
  tags: readonly string[]
  /** Stored colours by tag key (lowercase name), from the vocabulary. */
  colors?: ReadonlyMap<string, string | null>
  onSelect?: (name: string) => void
  onRemove?: (name: string) => void
  /** Show at most this many, then "+n". */
  max?: number
  /** Tags currently used as a filter, drawn pressed. */
  active?: readonly string[]
  className?: string
  size?: 'sm' | 'md'
}

export default function TagChips({ tags, colors, onSelect, onRemove, max, active, className, size = 'sm' }: TagChipsProps) {
  if (tags.length === 0) return null
  const shown = max && tags.length > max ? tags.slice(0, max) : tags
  const hidden = tags.length - shown.length
  const activeKeys = new Set((active ?? []).map(t => t.toLowerCase()))
  const text = size === 'md' ? 'text-xs' : 'text-[11px]'

  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Tags">
      {shown.map(name => {
        const pressed = activeKeys.has(name.toLowerCase())
        const chip = cn(
          'inline-flex max-w-[12rem] items-center gap-1 rounded-full border px-2 py-0.5 font-medium leading-5',
          text,
          tagChipClasses(name, colors?.get(name.toLowerCase())),
          pressed && 'ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-900',
        )
        return (
          <li key={name} className={chip}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(name)}
                aria-pressed={pressed}
                title={pressed ? `Stop filtering by ${name}` : `Show items tagged ${name}`}
                className="relative truncate rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']"
              >
                #{name}
              </button>
            ) : (
              <span className="truncate">#{name}</span>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(name)}
                aria-label={`Remove tag ${name}`}
                className="relative -mr-1 rounded-full p-0.5 opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 after:absolute after:-inset-3 after:content-['']"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </li>
        )
      })}
      {hidden > 0 && (
        <li className={cn('px-1 text-gray-500 dark:text-gray-400', text)} aria-label={`${hidden} more tags`}>
          +{hidden}
        </li>
      )}
    </ul>
  )
}
