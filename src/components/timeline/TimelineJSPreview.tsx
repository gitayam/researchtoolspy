import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { timelineAssessmentLabel } from '@/lib/timeline-evidence'
import type { buildTimelineJSExport } from '@/lib/timeline-timelinejs'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

type TimelineData = ReturnType<typeof buildTimelineJSExport>['timeline']

function PresentationFrame({ timeline, theme, startAtEnd }: { timeline: TimelineData; theme: 'light' | 'dark'; startAtEnd: boolean }) {
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
  return <div className="relative min-h-0 flex-1 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
    {status === 'loading' && <p role="status" className="absolute left-4 top-4 z-10 rounded bg-white p-2 text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">Loading presentation…</p>}
    {status === 'error' && <p role="alert" className="absolute inset-x-4 top-4 z-10 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">Presentation could not load. Retry, or use the accessible event list below.</p>}
    <iframe ref={frame} title="TimelineJS narrative presentation" src={`/timelinejs/preview.html#${nonce}`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-full min-h-[230px] w-full rounded-lg border-0" />
    <span className="sr-only" role="status">{status === 'loaded' ? 'TimelineJS presentation loaded' : ''}</span>
  </div>
}

export function TimelineJSPreview({ timeline, snapshot }: { timeline: TimelineData; snapshot: TimelineWorkspaceExport }) {
  const [startAtEnd, setStartAtEnd] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  const chronological = [...timeline.events].sort((a, b) => {
    for (const part of ['year', 'month', 'day', 'hour', 'minute', 'second'] as const) {
      const difference = (a.start_date[part] ?? (part === 'month' || part === 'day' ? 1 : 0)) - (b.start_date[part] ?? (part === 'month' || part === 'day' ? 1 : 0))
      if (difference) return difference
    }
    return 0
  })
  const originals = new Map(snapshot.analystWorkspace.events.map(event => [`event-${encodeURIComponent(event.id)}`, event]))
  return <section aria-label="TimelineJS presentation" className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
      <Label htmlFor="timelinejs-start">Open at</Label>
      <select id="timelinejs-start" className="rounded border border-slate-400 bg-white p-2 text-slate-950 dark:bg-slate-900 dark:text-slate-100" value={startAtEnd ? 'latest' : 'beginning'} onChange={event => setStartAtEnd(event.target.value === 'latest')}><option value="beginning">Beginning</option><option value="latest">Latest event</option></select>
      <Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry presentation</Button>
      <span className="text-slate-600 dark:text-slate-300">{timeline.events.length} events · Chronological presentation</span>
    </div>
    <PresentationFrame key={`${theme}:${startAtEnd}:${attempt}`} timeline={timeline} theme={theme} startAtEnd={startAtEnd} />
    <details className="max-h-48 shrink-0 overflow-y-auto rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700">
      <summary className="cursor-pointer font-medium">Accessible event list ({chronological.length})</summary>
      <ol className="mt-3 space-y-3">{chronological.map(slide => {
        const event = originals.get(slide.unique_id)!
        return <li key={slide.unique_id} className="break-words"><h3 className="font-semibold">{event.title}</h3><p>{event.eventDate}{event.eventTime && event.eventDate?.length === 10 ? ` ${event.eventTime} (${snapshot.analystWorkspace.narrative?.timezone || 'timezone not recorded'})` : ''} · {timelineAssessmentLabel(snapshot.analystWorkspace.evidence, event)}</p><p>{event.description}</p>{event.whyItMatters && <p>Why it matters: {event.whyItMatters}</p>}</li>
      })}</ol>
    </details>
  </section>
}
