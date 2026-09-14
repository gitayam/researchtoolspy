import { useEffect, useId, useState } from 'react'
import { reviewTimelineOverlaps } from '@/lib/timeline-overlap'
import { timelineEventAnchor, timelineEventTemporalLabel } from '@/lib/timeline-workspace'
import type { TimelineWorkspaceEvent } from '@/types/timeline-workspace'

const labels = { possible: 'Potential overlaps', unresolved: 'Cannot compare', disjoint: 'Separate dates', all: 'All other events' } as const
const reasons = { overlap: 'Recorded windows could overlap; this does not establish concurrency.', separate: 'Recorded windows do not intersect.', 'missing-date': 'A recorded date is missing.', 'invalid-date': 'Recorded dates or clocks cannot be compared.', 'ambiguous-event': 'The event identity is missing or ambiguous.' } as const
const anchorReasons = { 'missing-anchor': 'Choose an event to compare.', 'ambiguous-anchor': 'The selected event cannot be identified uniquely.', 'missing-date': 'The selected event has no recorded date.', 'invalid-date': 'The selected event has an invalid recorded date or clock.' } as const
export function TimelineOverlapReview({ events }: { events: readonly TimelineWorkspaceEvent[] }) {
  const id = useId()
  const [anchorId, setAnchorId] = useState('')
  const [filter, setFilter] = useState<keyof typeof labels>('possible')
  const [limit, setLimit] = useState(20)
  const counts = new Map<string, number>()
  for (const event of events) counts.set(event.id, (counts.get(event.id) ?? 0) + 1)
  const unique = new Map(events.filter(event => event.id.trim() && counts.get(event.id) === 1).map(event => [event.id, event]))
  useEffect(() => { if (anchorId && !events.some(event => event.id === anchorId)) setAnchorId(''); setLimit(20) }, [events, anchorId])
  const result = reviewTimelineOverlaps(events, anchorId)
  const selected = unique.get(anchorId)
  const rows = result.rows.filter(row => filter === 'all' || row.status === filter)
  const control = 'min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm'
  return <details className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
    <summary className="min-h-11 cursor-pointer font-semibold leading-relaxed">Find overlapping dates</summary>
    <p className="mt-2 text-sm text-muted-foreground">Broad or partial dates indicate potential matches, not confirmed overlap.</p>
    <details className="mt-2 text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">How dates are compared</summary><p>Partial dates indicate possible overlap only, not confirmed concurrency or evidence agreement. Recorded clocks are not timezone-normalized. Placement, sequence and presentation schedules do not supply dates.</p></details>
    <label htmlFor={`${id}-anchor`} className="mt-3 block text-sm font-medium">Compare recorded dates for</label>
    <div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><select id={`${id}-anchor`} className={control} value={anchorId} onChange={e => { setAnchorId(e.target.value); setLimit(20) }}>
      <option value="">Choose an event</option>
      {events.map((event, index) => <option key={index} value={event.id} disabled={!event.id.trim() || counts.get(event.id) !== 1}>{index + 1}. {event.title}</option>)}
    </select></div><button type="button" className="min-h-11 shrink-0 rounded-md border bg-background px-3 text-sm" onClick={() => { setAnchorId(''); setFilter('possible'); setLimit(20) }}>Clear query</button></div>
    {selected && <p className="mt-2 break-words text-sm">Selected recorded window: {timelineEventTemporalLabel(selected)}</p>}
    <p role="status" className="mt-3 text-sm" aria-live="polite">{result.anchorStatus === 'ready' ? `${result.rows.filter(row => row.status === 'possible').length} potential overlaps · ${result.rows.filter(row => row.status === 'unresolved').length} cannot compare · ${result.rows.filter(row => row.status === 'disjoint').length} separate dates` : anchorReasons[result.anchorStatus]}</p>
    {result.anchorStatus === 'ready' && <>
      <label htmlFor={`${id}-filter`} className="mt-3 block text-sm font-medium">Show date comparisons</label>
      <select id={`${id}-filter`} className={control} value={filter} onChange={e => { setFilter(e.target.value as keyof typeof labels); setLimit(20) }}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <p className="mt-2 text-sm text-muted-foreground">Showing {Math.min(limit, rows.length)} of {rows.length} matching events.</p>
      <ul className="mt-3 space-y-3">
        {rows.slice(0, limit).map((row, index) => {
          const event = unique.get(row.eventId)
          return <li key={`${row.eventId}-${index}`} aria-label={`Date comparison for ${event?.title ?? 'Ambiguous event'}`} className="min-w-0 rounded-lg border bg-background p-3 text-sm">
            <p className={`inline-block rounded-md border px-2 py-1 font-semibold ${row.status === 'possible' ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200' : row.status === 'unresolved' ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200' : 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>{labels[row.status]}</p>
            {event && row.reason !== 'ambiguous-event' ? <a className="inline-flex min-h-11 max-w-full items-center break-words text-blue-700 underline dark:text-blue-300" href={`#${timelineEventAnchor(event.id)}`} aria-label={`Review event ${event.title}`} onClick={e => {
              e.preventDefault(); const target = timelineEventAnchor(event.id); window.location.hash = target
              const element = document.getElementById(target); element?.focus({ preventScroll: true }); element?.scrollIntoView({ behavior: 'instant', block: 'start' })
            }}>{event.title}</a> : <p>Event unavailable or ambiguous</p>}
            {event && <p className="break-words text-muted-foreground">Recorded: {timelineEventTemporalLabel(event)}</p>}
            <p className="mt-2">{reasons[row.reason]}</p>
          </li>
        })}
      </ul>
      {rows.length === 0 && <p className="mt-3 text-sm">No events match this filter.</p>}
      {limit < rows.length && <button type="button" className="mt-3 min-h-11 rounded-md border px-3 text-sm" onClick={() => setLimit(value => value + 20)}>Show more</button>}
    </>}
  </details>
}
