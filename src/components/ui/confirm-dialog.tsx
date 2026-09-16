import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * One confirmation, instead of twenty-five.
 *
 * `if (!confirm('Delete this analysis?')) return` appeared across roughly
 * twenty-five files. Each was the same interaction and each had the same two
 * problems.
 *
 * The first is that `confirm()` cannot distinguish Cancel from Escape from a
 * click outside, so a reader who dismisses a dialog they did not read gets the
 * same answer as one who deliberately declined. That is the right default for a
 * destructive action, but it is an accident rather than a decision, and some of
 * these call sites treated the negative branch as "do the other thing" rather
 * than "do nothing".
 *
 * The second is that a browser dialog is drawn by the browser, outside the
 * page: it cannot show what is about to be deleted, cannot be styled to signal
 * severity, ignores the app's dark mode, and on mobile is a system sheet with
 * the origin printed on it.
 *
 * `useConfirm()` keeps the shape of the call it replaces — it returns a promise
 * of a boolean, so `if (!(await confirm({...}))) return` is a one-line swap —
 * while rendering a real dialog that can name the thing and label its own
 * buttons.
 */

export interface ConfirmOptions {
  title: string
  /** What happens, and whether it can be undone. Worth saying for a delete. */
  description?: ReactNode
  /** Defaults to "Confirm" — prefer naming the action, e.g. "Delete analysis". */
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button as destructive. Default true, because that is
   *  what nearly every caller is doing. */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  // Held in a ref rather than state: settling the promise must not depend on a
  // render having happened, and a dialog that never settles leaves the caller
  // awaiting forever.
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const settle = useCallback((value: boolean) => {
    const resolve = resolveRef.current
    resolveRef.current = null
    setPending(null)
    resolve?.(value)
  }, [])

  const confirm = useCallback<ConfirmFn>((options) => {
    // A second request while one is open answers the first with "no" rather
    // than stranding it.
    resolveRef.current?.(false)
    setPending(options)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) settle(false) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description && (
              <AlertDialogDescription>{pending.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {pending?.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                pending?.destructive === false
                  ? undefined
                  : 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
              }
              onClick={(event) => { event.preventDefault(); settle(true) }}
            >
              {pending?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

/**
 * Ask the reader to confirm something. Resolves false on Cancel, Escape, or a
 * click outside — the safe answer for the destructive actions this replaces.
 */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>')
  }
  return confirm
}
