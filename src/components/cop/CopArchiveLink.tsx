/**
 * An evidence item's original (Silo for room members, or PeerTube) and its held state.
 * Renders nothing when there is neither; see src/lib/cop-archive-link.ts.
 */
import { Archive, ExternalLink, ShieldAlert, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { archiveLinkFor, HELD_LABEL, isHeld } from '@/lib/cop-archive-link'

interface CopArchiveLinkProps {
  item: { archive_url?: unknown; archived_in?: unknown; held?: unknown } | null | undefined
  className?: string
}

export function CopArchiveLink({ item, className }: CopArchiveLinkProps) {
  const held = isHeld(item)
  const link = archiveLinkFor(item)
  if (!held && !link) return null
  const Icon = link?.kind === 'peertube' ? Video : Archive
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      {held && (
        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          {HELD_LABEL}
        </span>
      )}
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          title={link.hint}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded text-blue-700 hover:underline dark:text-blue-400 pointer-coarse:min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{link.label}</span>
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  )
}
