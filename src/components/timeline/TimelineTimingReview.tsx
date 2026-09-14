import { Clock3 } from 'lucide-react'
import { reviewTimelineTiming } from '@/lib/timeline-timing'
import { timelineEventAnchor, timelineEventTemporalLabel } from '@/lib/timeline-workspace'
import type { TimelineWorkspaceEvent } from '@/types/timeline-workspace'

const explanations = {
  ordered: 'The recorded date ranges support this placement.',
  reversed: 'The recorded date ranges put these events in the opposite order. Review the dates or placement.',
  overlap: 'The recorded ranges overlap. Their precision cannot establish which event came first.',
  'missing-date': 'A recorded date is missing. Placement alone does not establish when an event happened.',
  'invalid-date': 'A date or time cannot be compared at its recorded precision. Review the event details.',
  'missing-anchor': 'The linked event cannot be identified uniquely. Review the placement.',
} as const

export function TimelineTimingReview({ events }: { events: TimelineWorkspaceEvent[] }) {
  const rows = reviewTimelineTiming(events)
  if (!rows.length) return null
  const conflicts = rows.filter(row => row.status === 'conflict').length
  const unresolved = rows.filter(row => row.status === 'unresolved').length
  const counts = new Map<string, number>()
  for (const event of events) counts.set(event.id, (counts.get(event.id) ?? 0) + 1)
  const byId = new Map(events.filter(event => counts.get(event.id) === 1).map(event => [event.id, event]))
  function eventLink(id: string, role: 'event' | 'anchor') {
    const event = byId.get(id)
    if (!event) return <span className="text-muted-foreground">Event unavailable or ambiguous</span>
    return <a href={`#${timelineEventAnchor(id)}`} aria-label={`Review ${role} ${event.title}`}
      className="inline-flex min-h-11 items-center break-words font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300"
      onClick={click => {
        click.preventDefault()
        const anchor = timelineEventAnchor(id)
        window.location.hash = anchor
        const element = document.getElementById(anchor)
        element?.focus({ preventScroll: true })
        element?.scrollIntoView({ behavior: 'instant', block: 'start' })
      }}>{event.title}</a>
  }
  return <details className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
    <summary className="cursor-pointer leading-relaxed">
      <Clock3 aria-hidden="true" className="mr-2 inline h-4 w-4" />
      <strong>Timing review</strong>
      <span className="ml-2 text-sm text-muted-foreground">{conflicts} {conflicts === 1 ? 'disagreement' : 'disagreements'} · {unresolved} unresolved</span>
    </summary>
    <p className="mt-3 text-sm text-muted-foreground">Checks before/after placement against recorded calendar values. Dates agree means the placement fits those values; it does not verify the events. Timezones and daylight-saving changes are not resolved here. Original data and presentation schedules stay unchanged.</p>
    <ul className="mt-4 space-y-3">
      {rows.map((row, index) => {
        const event = byId.get(row.eventId)
        const anchor = byId.get(row.anchorEventId)
        const color = row.status === 'conflict' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
          : row.status === 'unresolved' ? 'border-slate-300 bg-background dark:border-slate-700' : 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
        return <li key={`${row.eventId}-${index}`} aria-label={`Timing for ${event?.title || 'Unavailable event'}`} className={`min-w-0 rounded-lg border p-3 text-sm ${color}`}>
          <p className="font-semibold">{row.status === 'conflict' ? 'Dates disagree' : row.status === 'unresolved' ? 'Order unresolved' : 'Dates agree'}</p>
          <div className="mt-1 break-words">{eventLink(row.eventId, 'event')} <span className="text-muted-foreground">placed {row.relation}</span> {eventLink(row.anchorEventId, 'anchor')}</div>
          <p className="mt-1 break-words text-xs text-muted-foreground">Recorded: {event ? timelineEventTemporalLabel(event) : 'unavailable'} · Anchor: {anchor ? timelineEventTemporalLabel(anchor) : 'unavailable'}</p>
          <p className="mt-2">{explanations[row.reason]}</p>
        </li>
      })}
    </ul>
  </details>
}
