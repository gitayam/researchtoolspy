/**
 * BulkTagBar -- tag (or untag) every selected item at once.
 *
 * Shown by a panel while items are selected. It owns only the choice of tags;
 * the panel owns the selection and passes the targets. Writes go through
 * `useCopTags().bulk`, which batches 100 targets per request.
 */
import { useState } from 'react'
import { Loader2, Tag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CopTag, CopTagTarget } from '@/types/cop'
import type { TagWriteResult } from '@/hooks/useCopTags'
import TagPicker from './TagPicker'

export interface BulkTagBarProps {
  targets: readonly CopTagTarget[]
  vocabulary: readonly CopTag[]
  onApply: (targets: CopTagTarget[], add: string[], remove: string[]) => Promise<TagWriteResult>
  onClearSelection: () => void
  className?: string
}

export default function BulkTagBar({ targets, vocabulary, onApply, onClearSelection, className }: BulkTagBarProps) {
  const [add, setAdd] = useState<string[]>([])
  const [remove, setRemove] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  if (targets.length === 0) return null

  const apply = async () => {
    setBusy(true)
    setMessage(null)
    const result = await onApply([...targets], add, remove)
    setBusy(false)
    if (result.ok === true) {
      setMessage({ ok: true, text: `Updated ${targets.length} item${targets.length === 1 ? '' : 's'}.` })
      setAdd([])
      setRemove([])
    } else {
      setMessage({ ok: false, text: result.message })
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
      role="region"
      aria-label="Tag selected items"
    >
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {targets.length} selected
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <TagPicker vocabulary={vocabulary} selected={add} onChange={setAdd} label="Tags to add" placeholder="Add tags…" />
        <TagPicker vocabulary={vocabulary} selected={remove} onChange={setRemove} label="Tags to remove" placeholder="Remove tags…" allowCreate={false} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={busy || (add.length === 0 && remove.length === 0)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Apply to {targets.length}
        </button>
        {message && (
          <p role="status" className={cn('text-xs', message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400')}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
