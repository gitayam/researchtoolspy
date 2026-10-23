/**
 * Tags on one COP item, as every panel shows them: chips (tap one to filter the
 * whole page by it), a remove button on each, and "Tag" to add from the session's
 * vocabulary. Renders nothing while the server has no tag routes. Writes go
 * through the page's tags context, which announces them with `cop:changed`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Tag as TagIcon } from 'lucide-react'
import { TagChips, TagPicker, useCopTagsContext } from '@/components/cop/tags'
import { useCopTagFilter } from '@/components/cop/tag-filter-context'
import { cn } from '@/lib/utils'
import type { CopTagTarget, CopTagTargetType } from '@/types/cop'

export function CopItemTags({ targetType, targetId, label, editable = true, className, max = 4 }: {
  targetType: CopTagTargetType
  targetId: string | number
  /** What the item is, for the picker's accessible name ("evidence item", "task"). */
  label: string
  editable?: boolean
  className?: string
  max?: number
}) {
  const tags = useCopTagsContext()
  const filter = useCopTagFilter()
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const target = useMemo<CopTagTarget>(() => ({ target_type: targetType, target_id: String(targetId) }), [targetType, targetId])
  const current = tags?.tagsFor(targetType, String(targetId)) ?? []

  const toggleFilter = useCallback((name: string) => {
    const on = filter.active.some(a => a.toLowerCase() === name.toLowerCase())
    filter.setActive(on ? filter.active.filter(a => a.toLowerCase() !== name.toLowerCase()) : [...filter.active, name])
  }, [filter])

  if (!tags?.available) return null

  const change = async (next: string[]) => {
    setMessage(null)
    const added = next.filter(n => !current.some(c => c.toLowerCase() === n.toLowerCase()))
    const removed = current.filter(c => !next.some(n => n.toLowerCase() === c.toLowerCase()))
    if (added.length > 0) {
      const res = await tags.applyTags(target, added)
      if (res.ok === false) setMessage(res.message)
    }
    for (const name of removed) {
      const res = await tags.removeTag(target, name)
      if (res.ok === false) setMessage(res.message)
    }
  }

  const remove = async (name: string) => {
    setMessage(null)
    const res = await tags.removeTag(target, name)
    if (res.ok === false) setMessage(res.message)
  }

  if (current.length === 0 && !editable) return null

  return (
    <div className={cn('mt-1', className)}>
      {editing ? (
        <TagPicker
          vocabulary={tags.tags}
          selected={current}
          onChange={change}
          label={`Tags for this ${label}`}
          autoFocus
          className="max-w-full"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <TagChips
            tags={current}
            max={max}
            active={filter.active}
            onSelect={toggleFilter}
            onRemove={editable ? remove : undefined}
          />
          {editable && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="relative inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']"
              aria-label={`Tag this ${label}`}
            >
              <TagIcon className="h-3 w-3" aria-hidden="true" />
              {current.length === 0 && 'Tag'}
            </button>
          )}
        </div>
      )}
      {editing && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-1 rounded px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Done
        </button>
      )}
      {message && <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-400" role="alert">{message}</p>}
    </div>
  )
}
