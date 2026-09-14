import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TimelineJSPreview } from '@/components/timeline/TimelineJSPreview'
import { Button } from '@/components/ui/button'
import { readPresentation } from '@/lib/timeline-presentation-client'
import { presentationPlainText, type TimelinePresentation } from '@/lib/timeline-presentation-contract'

export function PublicTimelinePresentationPage() {
  const { token = '' } = useParams<{ token: string }>()
  return <PublicPresentation key={token} token={token} />
}
function PublicPresentation({ token }: { token: string }) {
  const [revision, setRevision] = useState(0), [value, setValue] = useState<TimelinePresentation | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  useEffect(() => {
    const abort = new AbortController(); setValue(null); setStatus('loading')
    readPresentation(token, abort.signal).then(result => { if (!abort.signal.aborted) { setValue(result); setStatus('ready') } }, () => { if (!abort.signal.aborted) { setValue(null); setStatus('unavailable') } })
    return () => abort.abort()
  }, [token, revision])
  return <main className="mx-auto flex h-[100dvh] min-h-[600px] max-h-[1000px] max-w-6xl flex-col gap-4 bg-background p-4 text-foreground sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold">{value ? presentationPlainText(value.timeline.title.text.headline) : 'Shared timeline presentation'}</h1><p className="mt-1 text-sm text-muted-foreground">Read-only presentation · Available to anyone with this link until revoked.</p></div><Button type="button" variant="outline" disabled={status === 'loading'} onClick={() => { setValue(null); setStatus('loading'); setRevision(current => current + 1) }}>Refresh</Button></header>
    {status === 'loading' && <p role="status">Loading presentation…</p>}
    {status === 'unavailable' && <div role="alert"><p>This presentation is unavailable. It may have been revoked or the link may be invalid.</p><Button type="button" className="mt-3" onClick={() => setRevision(current => current + 1)}>Retry</Button></div>}
    {value && <TimelineJSPreview timeline={value.timeline} />}
  </main>
}
