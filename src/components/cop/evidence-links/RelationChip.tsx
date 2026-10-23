/**
 * How a filed evidence item bears on its question: supports, contradicts or context.
 * Icon and word together, so the meaning never rests on colour alone.
 */
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RELATION_LABEL } from '@/lib/cop-evidence-links'
import type { CopEvidenceRelation } from '@/types/cop'

const STYLE: Record<CopEvidenceRelation, string> = {
  supports: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  contradicts: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  context: 'border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

/** For surfaces that are always dark (the shared view), whatever the app theme. */
const STYLE_ON_DARK: Record<CopEvidenceRelation, string> = {
  supports: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  contradicts: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
  context: 'border-slate-400/40 bg-slate-500/20 text-slate-200',
}

const ICON = { supports: CheckCircle2, contradicts: XCircle, context: Info } as const

export function RelationChip({ relation, className, onDark = false }: { relation: CopEvidenceRelation; className?: string; onDark?: boolean }) {
  const Icon = ICON[relation]
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-medium leading-4', (onDark ? STYLE_ON_DARK : STYLE)[relation], className)}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {RELATION_LABEL[relation]}
    </span>
  )
}

/** Three-way relation picker as a radio group (keyboard: arrows move, space selects). */
export function RelationPicker({ value, onChange, name, className }: {
  value: CopEvidenceRelation
  onChange: (value: CopEvidenceRelation) => void
  /** Unique per picker on the page (radio group name). */
  name: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label="How it bears on the question" className={cn('inline-flex flex-wrap gap-1', className)}>
      {(['supports', 'contradicts', 'context'] as const).map((option) => {
        const Icon = ICON[option]
        const checked = value === option
        return (
          <label
            key={option}
            className={cn(
              'relative inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium min-h-7 pointer-coarse:min-h-11 pointer-coarse:px-3',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500',
              checked ? STYLE[option] : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={checked}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <Icon className="h-3 w-3" aria-hidden="true" />
            {RELATION_LABEL[option]}
          </label>
        )
      })}
    </div>
  )
}
