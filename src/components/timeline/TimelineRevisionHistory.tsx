import { useEffect, useRef, useState } from 'react'
import { History, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineJSExport } from './TimelineJSExport'
import { loadTimelineRevisions, openTimelineRevision, type DurableIdentity, type TimelineRevisionPage, type TimelineRevisionSummary } from '@/lib/timeline-durable'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

export function TimelineRevisionHistory({ artifactId, identity }: { artifactId: string; identity: () => DurableIdentity }) {
  const [page, setPage] = useState<TimelineRevisionPage | null>(null)
  const [revisions, setRevisions] = useState<TimelineRevisionSummary[]>([])
  const [selected, setSelected] = useState<{ revision: TimelineRevisionSummary; snapshot: TimelineWorkspaceExport } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort()
    const current = new AbortController(); controller.current = current
    setBusy(true); setError(''); setSelected(null)
    try { await action(current.signal) }
    catch (error) {
      if (current.signal.aborted) return
      setPage(null); setRevisions([])
      setError(error instanceof Error ? error.message : 'Unable to read revision history. Your current work is unchanged.')
    } finally { if (!current.signal.aborted) setBusy(false) }
  }
  const load = (older = false) => void run(async signal => {
    const result = await loadTimelineRevisions(artifactId, identity(), signal, older && page ? page : undefined)
    if (signal.aborted) return
    const combined = older ? [...revisions, ...result.revisions] : result.revisions
    if (combined.length > 100 || new Set(combined.map(item => item.revisionId)).size !== combined.length) throw new Error('The history response repeated revisions or exceeded its limit. Refresh history to try again.')
    setPage(result); setRevisions(combined)
  })
  const inspect = (revision: TimelineRevisionSummary) => void run(async signal => {
    const snapshot = await openTimelineRevision(artifactId, revision, identity(), signal)
    if (!signal.aborted) setSelected({ revision, snapshot })
  })
  return <section aria-label="Saved revision history" className="min-w-0 space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
    <h3 className="flex items-center gap-2 font-semibold text-violet-950 dark:text-violet-200"><History aria-hidden="true" className="h-4 w-4" />Saved revision history</h3>
    <p className="text-sm leading-relaxed">Inspect an older save without replacing your current work. History stays fixed at the version first loaded; refresh to include newer saves.</p>
    <Button variant="outline" disabled={busy} onClick={() => load()}>{page ? 'Refresh history' : 'Load revision history'}</Button>
    {busy && <p role="status" className="text-sm">Reading saved revision…</p>}
    {error && <p role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{error}</p>}
    {page && <>
      <p className="text-xs text-muted-foreground">{revisions.length} revisions loaded · Newest first · Times in UTC</p>
      <ol className="max-h-80 space-y-2 overflow-y-auto rounded-md" aria-label="Saved revisions" tabIndex={0}>
        {revisions.map(revision => <li key={revision.revisionId} className="min-w-0 rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Revision {revision.sequence}</strong>{revision.revisionId === page.headRevisionId && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-950 dark:bg-violet-900 dark:text-violet-100">Head when loaded</span>}</div>
          <p className="mt-1 text-xs text-muted-foreground">{revision.createdAt.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{revision.revisionId}</p>
          <Button variant="outline" size="sm" className="mt-2 min-h-10" disabled={busy || revision.objectCount !== 1} onClick={() => inspect(revision)}><Eye aria-hidden="true" className="mr-2 h-4 w-4" />Inspect revision {revision.sequence}</Button>
          {revision.objectCount !== 1 && <p className="mt-1 text-xs text-muted-foreground">{revision.sequence === 0 ? 'Initial empty revision; no timeline to preview.' : 'This revision is not a single browser timeline.'}</p>}
        </li>)}
      </ol>
      {page.nextCursor && <Button variant="outline" disabled={busy || revisions.length >= 100} onClick={() => load(true)}>Load older revisions</Button>}
      {page.nextCursor && revisions.length >= 100 && <p className="text-xs text-muted-foreground">Showing the newest 100 revisions. Older revisions remain stored.</p>}
    </>}
    {selected && <section aria-label="Selected historical revision" className="space-y-2 rounded-md border border-indigo-300 bg-background p-3 dark:border-indigo-800">
      <h4 className="font-semibold">Revision {selected.revision.sequence} · Selected historical revision</h4>
      <p className="break-words text-sm">{selected.snapshot.analystWorkspace.narrative?.title || 'Untitled narrative'}</p>
      <p className="break-all text-xs text-muted-foreground">Revision ID: {selected.revision.revisionId}</p>
      <p className="text-sm">Your working copy and save destination are unchanged. This preview excludes current unsaved edits.</p>
      <TimelineJSExport key={selected.revision.revisionId} snapshot={selected.snapshot} savedRevision={{ revisionId: selected.revision.revisionId, sequence: selected.revision.sequence, historical: true }} />
    </section>}
  </section>
}
