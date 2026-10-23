/**
 * The team's verdict on one filed item: is it helpful for this question?
 *
 * Interactive for the COP's team (two toggle buttons, "Helpful" / "Not helpful", the
 * caller's own vote pressed; pressing it again clears it), read-only counts on a share.
 * Arrow and number together, so the meaning never rests on colour alone; the group's
 * label reads the counts out.
 */
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CopVoteValue } from '@/types/cop'

const votesLabel = (up: number, down: number) =>
  `Team votes: ${up} helpful, ${down} not helpful`

export function VoteControl({ up, down, myVote, onVote, busy = false, className }: {
  up: number
  down: number
  myVote: CopVoteValue
  onVote: (pressed: 1 | -1) => void
  /** A vote is being saved: further presses wait. */
  busy?: boolean
  className?: string
}) {
  const button = (value: 1 | -1) => {
    const pressed = myVote === value
    const Icon = value === 1 ? ChevronUp : ChevronDown
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={value === 1 ? 'Helpful' : 'Not helpful'}
        title={value === 1 ? 'Helpful for this question' : 'Not helpful for this question'}
        onClick={() => { if (!busy) onVote(value) }}
        className={cn(
          'inline-flex min-h-7 min-w-9 items-center justify-center gap-0.5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums transition-colors',
          'pointer-coarse:min-h-11 pointer-coarse:min-w-11',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500',
          pressed
            ? value === 1
              ? 'bg-emerald-700 text-white hover:bg-emerald-800'
              : 'bg-rose-600 text-white hover:bg-rose-700'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span aria-hidden="true">{value === 1 ? up : down}</span>
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={votesLabel(up, down)}
      aria-busy={busy || undefined}
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-gray-200 p-px dark:border-gray-700', className)}
    >
      {button(1)}
      {button(-1)}
    </div>
  )
}

/** Counts only (a share link): the team voted, visitors read. */
export function VoteCounts({ up, down, className }: { up: number; down: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={votesLabel(up, down)}
      className={cn('inline-flex items-center gap-1.5 text-xs tabular-nums text-gray-300', className)}
    >
      <span className="inline-flex items-center gap-0.5">
        <ChevronUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        {up}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <ChevronDown className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
        {down}
      </span>
    </span>
  )
}
