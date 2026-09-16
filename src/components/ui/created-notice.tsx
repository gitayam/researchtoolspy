import { ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Reports that something was created, and says where it went, without taking the reader
 * anywhere.
 *
 * This replaces a pattern that appeared in several tools: finish a job, then `alert()` or
 * `confirm()` the reader into either navigating away or dismissing the only reference to
 * what was just made. Both outcomes are bad — a browser modal blocks the page, and the
 * "yes, go there" branch discards whatever the reader had in progress, which in a wizard
 * is every step they had completed.
 *
 * So: it persists rather than auto-dismissing like a toast, because the reader may want to
 * finish first and follow the link later; and the link opens in a new tab, so following it
 * costs them nothing.
 */
export function CreatedNotice({
  title,
  detail,
  href,
  linkLabel,
  onDismiss,
}: {
  title: string
  detail?: string
  href: string
  linkLabel: string
  onDismiss?: () => void
}) {
  return (
    <div className="mt-3 rounded-md border border-border p-3" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {detail && <p className="mt-1 break-words text-xs text-muted-foreground">{detail}</p>}
          <a
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-blue-600 underline hover:no-underline dark:text-blue-400"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkLabel}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
        {onDismiss && (
          <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={onDismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
