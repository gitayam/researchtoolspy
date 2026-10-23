/**
 * TagPicker -- choose tags from the session's vocabulary, or name a new one.
 *
 * A combobox: type to narrow the session's tags (most used first), arrows to
 * move, Enter or comma to add, Backspace on an empty field to drop the last one.
 * A name that is not in the vocabulary yet can be added as is; the server
 * creates the tag when it is applied. Suggestions only ever come from the
 * session's own tags, so a session keeps one vocabulary instead of five
 * spellings of the same thing.
 */
import { useId, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CopTag } from '@/types/cop'
import TagChips from './TagChips'
import { isValidTagName, normalizeTagName, TAG_MAX_LENGTH, TAG_MAX_PER_ITEM, tagChipClasses, tagKey, uniqueTagNames } from './tag-names'

export interface TagPickerProps {
  vocabulary: readonly CopTag[]
  selected: readonly string[]
  onChange: (names: string[]) => void
  /** Accessible name of the field ("Tags for this item"). */
  label: string
  /** Offer names that are not in the vocabulary yet. */
  allowCreate?: boolean
  placeholder?: string
  disabled?: boolean
  max?: number
  autoFocus?: boolean
  className?: string
}

type Option = { kind: 'existing'; tag: CopTag } | { kind: 'create'; name: string }

const SHOWN = 8

export default function TagPicker({
  vocabulary, selected, onChange, label, allowCreate = true, placeholder = 'Add a tag…',
  disabled, max = TAG_MAX_PER_ITEM, autoFocus, className,
}: TagPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** Arrowed into the list, so Enter on an empty field picks the highlighted tag. */
  const navigated = useRef(false)
  const listId = useId()
  const hintId = useId()

  const selectedKeys = useMemo(() => new Set(selected.map(tagKey)), [selected])
  const colors = useMemo(() => new Map(vocabulary.map(t => [tagKey(t.name), t.color])), [vocabulary])
  const typed = normalizeTagName(query.replace(/^#+/, ''))
  const full = selected.length >= max

  const options: Option[] = useMemo(() => {
    const needle = typed.toLowerCase()
    const matches = vocabulary
      .filter(t => !selectedKeys.has(tagKey(t.name)))
      .filter(t => !needle || t.name.toLowerCase().includes(needle))
      // Names that start with what was typed before ones that merely contain it.
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(needle)) - Number(a.name.toLowerCase().startsWith(needle)))
      .slice(0, SHOWN)
      .map(tag => ({ kind: 'existing' as const, tag }))
    const exact = vocabulary.some(t => tagKey(t.name) === needle)
    if (allowCreate && needle && !exact && !selectedKeys.has(needle) && isValidTagName(typed)) {
      return [...matches, { kind: 'create' as const, name: typed }]
    }
    return matches
  }, [vocabulary, selectedKeys, typed, allowCreate])

  const add = (name: string) => {
    if (full) {
      setHint(`At most ${max} tags here.`)
      return
    }
    const next = uniqueTagNames([...selected, name], max)
    if (next.length === selected.length) {
      setHint(isValidTagName(name) ? `"${name}" is already added.` : `Tags use letters, numbers, spaces, _ . - and up to ${TAG_MAX_LENGTH} characters.`)
      return
    }
    onChange(next)
    setQuery('')
    setActive(0)
    setHint(null)
    navigated.current = false
  }

  const remove = (name: string) => {
    onChange(selected.filter(s => tagKey(s) !== tagKey(name)))
    inputRef.current?.focus()
  }

  const choose = (option: Option | undefined) => {
    if (option?.kind === 'existing') add(option.tag.name)
    else if (option?.kind === 'create') add(option.name)
    else if (typed) add(typed)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      navigated.current = true
      setActive(i => Math.min(i + 1, Math.max(options.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigated.current = true
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ',') {
      // Nothing typed and nothing highlighted: let a surrounding form submit.
      if (!typed && !(open && navigated.current && options[active])) return
      e.preventDefault()
      e.stopPropagation()
      choose(open ? options[active] : undefined)
    } else if (e.key === 'Backspace' && !query && selected.length > 0) {
      remove(selected[selected.length - 1])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  const activeId = open && options[active] ? `${listId}-${active}` : undefined

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900',
          'focus-within:ring-2 focus-within:ring-blue-500/60',
          disabled && 'opacity-60',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <TagChips tags={selected} colors={colors} onRemove={disabled ? undefined : remove} size="md" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); setHint(null); navigated.current = false }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          disabled={disabled || full}
          autoFocus={autoFocus}
          maxLength={TAG_MAX_LENGTH + 1}
          role="combobox"
          aria-label={label}
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-describedby={hint ? hintId : undefined}
          placeholder={full ? `${max} tags (the most)` : selected.length ? '' : placeholder}
          className="h-9 min-w-[7rem] flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-gray-100 dark:placeholder:text-gray-400"
        />
      </div>

      {open && options.length > 0 && !disabled && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label}: suggestions`}
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {options.map((option, i) => (
            <li
              key={option.kind === 'existing' ? option.tag.id : `create-${option.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, so the choice lands before the input's blur closes the list
              onMouseDown={e => { e.preventDefault(); choose(option) }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-gray-900 dark:text-gray-100',
                i === active && 'bg-gray-100 dark:bg-gray-800',
              )}
            >
              {option.kind === 'existing' ? (
                <>
                  <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full border', tagChipClasses(option.tag.name, option.tag.color))} aria-hidden="true" />
                  <span className="truncate">#{option.tag.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400">{option.tag.count}</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                  <span className="truncate">New tag <strong>#{option.name}</strong></span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {hint && (
        <p id={hintId} className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="status">{hint}</p>
      )}
    </div>
  )
}
