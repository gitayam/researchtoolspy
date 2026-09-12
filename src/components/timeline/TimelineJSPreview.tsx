import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { timelineAssessmentLabel } from '@/lib/timeline-evidence'
import type { buildTimelineJSExport } from '@/lib/timeline-timelinejs'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

type TimelineData = ReturnType<typeof buildTimelineJSExport>['timeline']

type FinderState = {
  query: string
  onQueryChange: (value: string) => void
  listOpen: boolean
  onListOpenChange: (value: boolean) => void
}

function PresentationFrame({ timeline, snapshot, theme, startAtEnd, query, onQueryChange, listOpen, onListOpenChange }: {
  timeline: TimelineData
  snapshot: TimelineWorkspaceExport
  theme: 'light' | 'dark'
  startAtEnd: boolean
} & FinderState) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [nonce] = useState(() => crypto.randomUUID())
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  useEffect(() => {
    let sent = false
    const timer = window.setTimeout(() => setStatus('error'), 10000)
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null' || event.data?.nonce !== nonce) return
      if (event.data.type === 'timelinejs:ready' && !sent) {
        sent = true
        frame.current?.contentWindow?.postMessage({ type: 'timelinejs:render', nonce, timeline, theme, startAtEnd }, '*')
      } else if (event.data.type === 'timelinejs:loaded' || event.data.type === 'timelinejs:error') {
        window.clearTimeout(timer)
        setStatus(event.data.type === 'timelinejs:loaded' ? 'loaded' : 'error')
      }
    }
    window.addEventListener('message', receive)
    return () => { window.clearTimeout(timer); window.removeEventListener('message', receive) }
  }, [nonce, timeline, theme, startAtEnd])
  const chronological = [...timeline.events].sort((a, b) => {
    for (const part of ['year', 'month', 'day', 'hour', 'minute', 'second'] as const) {
      const difference = (a.start_date[part] ?? (part === 'month' || part === 'day' ? 1 : 0)) - (b.start_date[part] ?? (part === 'month' || part === 'day' ? 1 : 0))
      if (difference) return difference
    }
    return 0
  })
  const originals = new Map(snapshot.analystWorkspace.events.map(event => [`event-${encodeURIComponent(event.id)}`, event]))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matching = chronological.filter(slide => {
    const event = originals.get(slide.unique_id)!
    return [event.title, event.eventDate, event.eventTime, event.description, event.whyItMatters]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(normalizedQuery)
  })
  const jump = (eventId: string) => {
    if (status !== 'loaded' || !timeline.events.some(event => event.unique_id === eventId)) return
    frame.current?.contentWindow?.postMessage({ type: 'timelinejs:navigate', nonce, eventId }, '*')
    onListOpenChange(false)
    window.requestAnimationFrame(() => {
      frame.current?.scrollIntoView({ block: 'nearest' })
      frame.current?.focus()
    })
  }
  return <><div className="relative min-h-[230px] flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
    {status === 'loading' && <p role="status" className="absolute left-4 top-4 z-10 rounded bg-white p-2 text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">Loading presentation…</p>}
    {status === 'error' && <p role="alert" className="absolute inset-x-4 top-4 z-10 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">Presentation could not load. Retry, or use the accessible event list below.</p>}
    <iframe ref={frame} title="TimelineJS narrative presentation" src={`/timelinejs/preview.html#${nonce}`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="absolute inset-0 block h-full w-full rounded-lg border-0" />
    <span className="sr-only" role="status">{status === 'loaded' ? 'TimelineJS presentation loaded' : ''}</span>
  </div>
    <details open={listOpen} onToggle={event => onListOpenChange(event.currentTarget.open)} className="max-h-72 shrink-0 overflow-y-auto rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700">
      <summary className="cursor-pointer font-medium"><span>Accessible event list ({chronological.length})</span><span className="ml-2 text-xs text-indigo-700 dark:text-indigo-300">Search and jump</span></summary>
      <div className="mt-3 space-y-2">
        <Label htmlFor="timelinejs-search">Search presentation events</Label>
        <div className="flex gap-2">
          <input id="timelinejs-search" type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Title, date or event text" className="min-w-0 flex-1 rounded border border-slate-400 bg-white px-3 py-2 text-slate-950 dark:bg-slate-900 dark:text-slate-100" />
          <Button variant="outline" size="sm" className="min-h-10" disabled={!query} onClick={() => onQueryChange('')}>Clear search</Button>
        </div>
        <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{matching.length} of {chronological.length} events · Search filters this list only.</p>
        {status !== 'loaded' && <p className="text-xs text-slate-600 dark:text-slate-300">Read the event list below. Jump controls become available when the presentation loads.</p>}
        {matching.length === 0 && <p className="rounded border border-slate-300 p-3 dark:border-slate-700">No events match this search. Clear it to see all presentation events.</p>}
      </div>
      <ol className="mt-3 space-y-3">{matching.map(slide => {
        const event = originals.get(slide.unique_id)!
        return <li key={slide.unique_id} data-event-id={event.id} className="break-words rounded border border-slate-200 p-3 dark:border-slate-700"><h3 className="font-semibold">{event.title}</h3><p>{event.eventDate}{event.eventTime && event.eventDate?.length === 10 ? ` ${event.eventTime} (${snapshot.analystWorkspace.narrative?.timezone || 'timezone not recorded'})` : ''} · {timelineAssessmentLabel(snapshot.analystWorkspace.evidence, event)}</p><p>{event.description}</p>{event.whyItMatters && <p>Why it matters: {event.whyItMatters}</p>}<Button variant="outline" size="sm" className="mt-2 min-h-10 border-indigo-400 text-indigo-800 dark:text-indigo-200" disabled={status !== 'loaded'} onClick={() => jump(slide.unique_id)}>Show in presentation</Button></li>
      })}</ol>
    </details>
  </>
}

export function TimelineJSPreview({ timeline, snapshot }: { timeline: TimelineData; snapshot: TimelineWorkspaceExport }) {
  const [startAtEnd, setStartAtEnd] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return <section aria-label="TimelineJS presentation" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
      <Label htmlFor="timelinejs-start">Open at</Label>
      <select id="timelinejs-start" className="rounded border border-slate-400 bg-white p-2 text-slate-950 dark:bg-slate-900 dark:text-slate-100" value={startAtEnd ? 'latest' : 'beginning'} onChange={event => setStartAtEnd(event.target.value === 'latest')}><option value="beginning">Beginning</option><option value="latest">Latest event</option></select>
      <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry presentation</Button>
      <span className="text-slate-600 dark:text-slate-300">{timeline.events.length} events · Chronological presentation</span>
    </div>
    <PresentationFrame key={`${theme}:${startAtEnd}:${attempt}`} timeline={timeline} snapshot={snapshot} theme={theme} startAtEnd={startAtEnd} query={query} onQueryChange={setQuery} listOpen={listOpen} onListOpenChange={setListOpen} />

  </section>
}
