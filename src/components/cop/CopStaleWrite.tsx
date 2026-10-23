/**
 * "Changed by someone else" for a task, claim or hypothesis edit the server refused
 * with 409 STALE_WRITE (see lib/cop-stale-write): Reload takes their version, Keep
 * mine sends the edit again without the check.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react'

export function StaleWriteNotice({ what, onReload, onKeepMine, onDismiss }: {
  /** "task", "claim", … */
  what: string
  onReload: () => void
  onKeepMine: () => void
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1 min-w-[12rem]">
        Changed by someone else since you opened this {what}. Reload to see their version, or keep yours to overwrite it.
      </span>
      <span className="flex gap-1.5">
        <button
          type="button"
          onClick={onReload}
          className="inline-flex min-h-[44px] sm:min-h-[30px] items-center gap-1 rounded border border-amber-600/40 px-2 py-1 font-medium hover:bg-amber-100 dark:hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Reload
        </button>
        <button
          type="button"
          onClick={onKeepMine}
          className="inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded bg-amber-700 px-2 py-1 font-medium text-white hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          Keep mine
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded px-2 py-1 hover:bg-amber-100 dark:hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            Dismiss
          </button>
        )}
      </span>
    </div>
  )
}
