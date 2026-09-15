import { useState } from 'react'
import { describeMappedWindow, projectMappedStep, resolveAnchorMapping, type TimelineAnchor } from '@/lib/timeline-anchor-mapping'
import { timelineEventTemporalLabel } from '@/lib/timeline-workspace'
import type { TimelineWorkspaceEvent } from '@/types/timeline-workspace'

const steps = [{ offset: 60, label: 'T+1 hour' }, { offset: 1440, label: 'T+1 day' }, { offset: 10080, label: 'T+1 week' }] as const
const names = (ids: readonly string[], titles: Map<string, string>) => {
  const list = ids.map(id => titles.get(id) ?? id)
  return list.length > 2 ? list.join(', ') : list.join(' and ')
}

/** Derived view: maps a relative offset sequence onto recorded host anchors. Never writes. */
export function TimelineAnchorMapping({ events }: { events: readonly TimelineWorkspaceEvent[] }) {
  const [offsets, setOffsets] = useState<Record<string, string>>({})
  const counts = new Map<string, number>()
  for (const event of events) counts.set(event.id, (counts.get(event.id) ?? 0) + 1)
  const hosts = events.filter(event => event.id.trim() && counts.get(event.id) === 1 && (event.eventDate ?? '').trim())
  const titles = new Map(hosts.map(event => [event.id, event.title]))
  if (!hosts.length) return null
  const anchors: TimelineAnchor[] = hosts.filter(event => offsets[event.id] !== undefined).map(event => ({
    eventId: event.id,
    label: { date: event.eventDate ?? '', ...(event.datePrecision ? { precision: event.datePrecision } : {}), ...(event.eventTime ? { time: event.eventTime } : {}) },
    ...(event.dateApproximate === true ? { approximate: true } : {}),
    childOffsetMinutes: Number(offsets[event.id]) || 0,
  }))
  const result = resolveAnchorMapping(anchors)
  // `in` narrowing, not the `ok` discriminant: this project compiles with strict mode off.
  const mapped = 't0' in result ? result : null
  const failed = 't0' in result ? null : result
  const control = 'min-h-11 w-24 shrink-0 rounded-md border border-input bg-background px-2 text-sm'
  return <details className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
    <summary className="min-h-11 cursor-pointer font-semibold leading-relaxed">Map a relative sequence to recorded anchors</summary>
    <p className="mt-2 text-sm text-muted-foreground">A relative sequence has no calendar position of its own. Choose host events that carry a recorded date and say how far into the sequence each one sits. This view is derived only: recorded events are unchanged and nothing here is saved or exported.</p>
    <fieldset className="mt-3 min-w-0 space-y-2">
      <legend className="text-sm font-medium">Host anchors with a recorded date</legend>
      {hosts.map(event => {
        const offset = offsets[event.id]
        return <div key={event.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-background p-2 text-sm">
          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={offset !== undefined} onChange={change => setOffsets(current => {
              const next = { ...current }
              if (change.target.checked) next[event.id] = '0'
              else delete next[event.id]
              return next
            })} />
            <span className="min-w-0 break-words"><span className="font-medium">{event.title}</span> <span className="text-muted-foreground">· Recorded: {timelineEventTemporalLabel(event)}</span></span>
          </label>
          <label className="flex min-h-11 shrink-0 items-center gap-2">
            <span className="text-muted-foreground">Offset (minutes)</span>
            <input type="number" step={1} className={control} value={offset ?? ''} disabled={offset === undefined}
              aria-label={`Offset in minutes into the sequence for ${event.title}`}
              onChange={change => setOffsets(current => ({ ...current, [event.id]: change.target.value }))} />
          </label>
        </div>
      })}
    </fieldset>
    <p role="status" aria-live="polite" className="mt-3 break-words text-sm">{mapped ? `Sequence T+0 falls within ${describeMappedWindow(mapped.t0)}` : failed.reason}</p>
    {failed?.conflict && <p className="mt-2 break-words rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">{names(failed.conflict.eventIds, titles)} cannot both anchor this sequence. Both records stand as recorded; the disagreement is not averaged away or resolved for you.</p>}
    {mapped && <>
      <ul className="mt-3 space-y-2">
        {steps.map(step => <li key={step.offset} className="min-w-0 rounded-lg border bg-background p-3 text-sm"><span className="font-medium">{step.label}</span> <span className="break-words text-muted-foreground">falls within {describeMappedWindow(projectMappedStep(mapped.t0, step.offset))}</span></li>)}
      </ul>
      <p className="mt-2 break-words text-xs text-muted-foreground">Constrained by {names(mapped.constrainedBy, titles)}. Every window is only as precise as the coarsest anchor allowed, and “circa” marks a window an approximate record placed.</p>
    </>}
  </details>
}
