import { useId } from 'react'
import { CalendarClock } from 'lucide-react'
import { narrativeTimelineEvents } from '@/lib/timeline-workspace'
import type { TimelinePresentationSchedule as Schedule } from '@/lib/timeline-timelinejs'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

/** Use the device's calendar day, including near UTC midnight. */
export function localPresentationDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const inputClass = 'min-h-10 w-full min-w-0 rounded-md border border-slate-400 bg-white px-2 py-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

export function TimelinePresentationSchedule({ snapshot, enabled, schedule, disabled, onChange }: {
  snapshot: TimelineWorkspaceExport
  enabled: boolean
  schedule: Schedule
  disabled: boolean
  onChange: (enabled: boolean, schedule: Schedule) => void
}) {
  const prefix = useId()
  const events = narrativeTimelineEvents(snapshot.analystWorkspace.events)
  const update = (id: string, field: 'date' | 'time' | 'meaning', value: string) => {
    onChange(enabled, { ...schedule, events: { ...schedule.events, [id]: { ...schedule.events[id], [field]: value } } })
  }
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-lg border border-indigo-300 bg-indigo-50/60 p-3 dark:border-indigo-700 dark:bg-indigo-950/40">
    <legend className="px-1 text-sm font-semibold"><CalendarClock aria-hidden="true" className="mr-1 inline h-4 w-4" />Presentation schedule</legend>
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={enabled} onChange={event => onChange(event.target.checked, schedule)} className="h-4 w-4 accent-indigo-700" />Use presentation schedule
    </label>
    <p className="text-xs text-slate-600 dark:text-slate-300">Give undated events a date for this presentation, or override an event’s date and time. These are presentation assumptions; recorded evidence stays unchanged.</p>
    {enabled && <>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-default`} className="block text-sm font-medium">Default presentation date</label>
        <input id={`${prefix}-default`} type="date" min="0001-01-01" max="9999-12-31" value={schedule.defaultDate} onChange={event => onChange(enabled, { ...schedule, defaultDate: event.target.value })} className={inputClass} />
        <p className="text-xs text-slate-600 dark:text-slate-300">Starts with today on this device. Applies to events without a recorded date. Set an override to move a dated event.</p>
      </div>
      <details className="rounded-md border border-indigo-200 bg-white p-3 dark:border-indigo-800 dark:bg-slate-950" open>
        <summary className="cursor-pointer text-sm font-medium">Event dates and times ({events.length})</summary>
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">{events.map((event, index) => {
          const override = schedule.events[event.id]
          const id = `${prefix}-${index}`
          return <fieldset key={event.id} className="min-w-0 space-y-2 rounded-md border border-slate-300 p-3 dark:border-slate-700">
            <legend className="max-w-full break-words px-1 text-sm font-semibold">{index + 1}. {event.title}<span className="sr-only"> presentation schedule</span></legend>
            {event.description && <p className="line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">{event.description}</p>}
            <p className="text-xs text-slate-600 dark:text-slate-300">Recorded: {event.eventDate || 'date unknown'}{event.eventTime ? ` · ${event.eventTime}` : ''}</p>
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <label htmlFor={`${id}-date`} className="min-w-0 space-y-1 text-xs"><span>Date override</span><input id={`${id}-date`} type="date" min="0001-01-01" max="9999-12-31" value={override?.date || ''} onChange={e => update(event.id, 'date', e.target.value)} className={inputClass} /></label>
              <label htmlFor={`${id}-time`} className="min-w-0 space-y-1 text-xs"><span>Time override</span><input id={`${id}-time`} type="time" step="1" value={override?.time || ''} onChange={e => update(event.id, 'time', e.target.value)} className={inputClass} /></label>
              <div className="min-w-0 space-y-1 text-xs"><label htmlFor={`${id}-meaning`} className="block">Time means</label><select id={`${id}-meaning`} value={override?.meaning || 'action'} onChange={e => update(event.id, 'meaning', e.target.value)} className={inputClass}><option value="action">Do the action</option><option value="start">Start</option><option value="arrive">Arrive</option></select></div>
            </div>
          </fieldset>
        })}</div>
      </details>
      <p className="text-xs text-slate-600 dark:text-slate-300">Blank overrides keep the recorded date/time, or use the default date when unknown. No travel time or duration is inferred. Equal dates keep narrative order; different dates and times sort chronologically.</p>
      <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200">Temporary settings last until you close or refresh this preview. They appear in TimelineJS JSON, and are excluded from the ResearchTools backup.</p>
    </>}
  </fieldset>
}
