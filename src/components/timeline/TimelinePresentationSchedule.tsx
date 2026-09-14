import { useId } from 'react'
import { CalendarClock } from 'lucide-react'
import { narrativeTimelineEvents } from '@/lib/timeline-workspace'
import { resolveTimelinePresentationSchedule, type TimelinePresentationSchedule as Schedule } from '@/lib/timeline-timelinejs'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'

/** Use the device's calendar day, including near UTC midnight. */
export function localPresentationDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const inputClass = 'min-h-10 w-full min-w-0 rounded-md border border-slate-400 bg-white px-2 py-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
const shortcutClass = 'min-h-9 rounded-md border border-indigo-300 bg-white px-3 text-xs font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-indigo-950'

export function TimelinePresentationSchedule({ snapshot, enabled, schedule, disabled, onChange }: {
  snapshot: TimelineWorkspaceExport
  enabled: boolean
  schedule: Schedule
  disabled: boolean
  onChange: (enabled: boolean, schedule: Schedule) => void
}) {
  const prefix = useId()
  const events = narrativeTimelineEvents(snapshot.analystWorkspace.events)
  const resolved = enabled ? resolveTimelinePresentationSchedule(snapshot, schedule) : null
  const update = (id: string, field: 'date' | 'time' | 'meaning', value: string) => {
    onChange(enabled, { ...schedule, events: { ...schedule.events, [id]: { ...schedule.events[id], [field]: value } } })
  }
  const reset = (id: string) => {
    const settings = { ...schedule.events }
    settings[id] = schedule.events[id]?.meaning ? { meaning: schedule.events[id].meaning } : {}
    onChange(enabled, { ...schedule, events: settings })
  }
  const chooseDay = (offset: number) => {
    const day = new Date()
    day.setDate(day.getDate() + offset)
    onChange(enabled, { ...schedule, defaultDate: localPresentationDate(day) })
  }
  return <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-lg border border-indigo-300 bg-indigo-50/60 p-3 dark:border-indigo-700 dark:bg-indigo-950/40">
    <legend className="px-1 text-sm font-semibold"><CalendarClock aria-hidden="true" className="mr-1 inline h-4 w-4" />Presentation schedule</legend>
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={enabled} onChange={event => onChange(event.target.checked, schedule)} className="h-4 w-4 accent-indigo-700" />Use presentation schedule
    </label>
    <p className="text-xs text-slate-600 dark:text-slate-300">Set a starting time, then adjust only the exceptions. These are presentation assumptions; recorded evidence stays unchanged.</p>
    {enabled && <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-40 space-y-1">
            <label htmlFor={`${prefix}-default`} className="block text-sm font-medium">Default presentation date</label>
            <input id={`${prefix}-default`} type="date" min="0001-01-01" max="9999-12-31" value={schedule.defaultDate} onChange={event => onChange(enabled, { ...schedule, defaultDate: event.target.value })} className={inputClass} />
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className={shortcutClass} onClick={() => chooseDay(0)}>Today</button>
            <button type="button" className={shortcutClass} onClick={() => chooseDay(1)}>Tomorrow</button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={Boolean(schedule.automatic)} onChange={event => onChange(enabled, { ...schedule, automatic: event.target.checked ? { startTime: '09:00', intervalMinutes: 15 } : undefined })} className="h-4 w-4 accent-indigo-700" />Adjust following events
        </label>
        {schedule.automatic && <>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1"><label htmlFor={`${prefix}-start`} className="block text-xs font-medium">Start time</label><input id={`${prefix}-start`} type="time" step="60" value={schedule.automatic.startTime} onChange={event => onChange(enabled, { ...schedule, automatic: { ...schedule.automatic!, startTime: event.target.value } })} className={inputClass} /></div>
            <div className="min-w-0 space-y-1"><label htmlFor={`${prefix}-gap`} className="block text-xs font-medium">Minutes between events</label><input id={`${prefix}-gap`} type="number" inputMode="numeric" min="1" max="1440" step="1" value={Number.isNaN(schedule.automatic.intervalMinutes) ? '' : schedule.automatic.intervalMinutes} onChange={event => onChange(enabled, { ...schedule, automatic: { ...schedule.automatic!, intervalMinutes: event.target.valueAsNumber } })} className={inputClass} /></div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">Changing a time moves the following automatic steps, including to the next day. Custom times and recorded dates stay as set.</p>
        </>}
      </div>
      {resolved && resolved.warnings.length > 0 && <div role="status" className="rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{resolved.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
      <details className="rounded-md border border-indigo-200 bg-white p-3 dark:border-indigo-800 dark:bg-slate-950" open>
        <summary className="cursor-pointer text-sm font-medium">Event dates and times ({events.length})</summary>
        <div className="mt-3 space-y-3">{events.map((event, index) => {
          const override = schedule.events[event.id]
          const effective = resolved?.events[event.id]
          const custom = Boolean(override?.date || override?.time)
          const automatic = effective?.source === 'automatic'
          const id = `${prefix}-${index}`
          const clock = override?.time || effective?.time || ''
          const date = override?.date || effective?.date || event.eventDate || schedule.defaultDate
          return <fieldset key={event.id} className={`min-w-0 space-y-2 rounded-md border border-l-4 p-3 ${custom ? 'border-amber-300 border-l-amber-500 bg-amber-50/40 dark:border-amber-800 dark:border-l-amber-500 dark:bg-amber-950/20' : automatic ? 'border-indigo-200 border-l-indigo-500 dark:border-indigo-900 dark:border-l-indigo-400' : 'border-slate-300 border-l-slate-500 dark:border-slate-700 dark:border-l-slate-400'}`}>
            <legend className="max-w-full break-words px-1 text-sm font-semibold">{index + 1}. {event.title}<span className="sr-only"> presentation schedule</span></legend>
            {event.description && <p className="line-clamp-2 break-words text-xs text-slate-700 dark:text-slate-300">{event.description}</p>}
            <p className="text-xs text-slate-600 dark:text-slate-300"><span className={`font-semibold ${custom ? 'text-amber-900 dark:text-amber-200' : automatic ? 'text-indigo-800 dark:text-indigo-200' : ''}`}>{custom ? 'Custom' : automatic ? 'Automatic' : event.eventDate ? 'Recorded' : 'Presentation date'}</span>{' · '}{date}{automatic && index > 0 ? ` · ${schedule.automatic!.intervalMinutes} min spacing` : ''}</p>
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <div className="min-w-0 space-y-1"><label htmlFor={`${id}-time`} className="block text-xs">Presentation time</label><input id={`${id}-time`} type="time" step={clock.split(':').length === 3 ? '1' : '60'} value={clock} onChange={e => update(event.id, 'time', e.target.value)} className={inputClass} /></div>
              <div className="min-w-0 space-y-1 text-xs"><label htmlFor={`${id}-meaning`} className="block">Time means</label><select id={`${id}-meaning`} value={override?.meaning || 'action'} onChange={e => update(event.id, 'meaning', e.target.value)} className={inputClass}><option value="action">Do the action</option><option value="start">Start</option><option value="arrive">Arrive</option></select></div>
            </div>
            <details className="text-xs">
              <summary className="min-h-8 cursor-pointer py-1 font-medium text-indigo-800 dark:text-indigo-200">Change date</summary>
              <label htmlFor={`${id}-date`} className="block space-y-1"><span>Date override</span><input id={`${id}-date`} type="date" min="0001-01-01" max="9999-12-31" value={/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : override?.date || ''} onChange={e => update(event.id, 'date', e.target.value)} className={inputClass} /></label>
            </details>
            {custom && <button type="button" className={shortcutClass} onClick={() => reset(event.id)}>{event.eventDate ? 'Use recorded date and time' : schedule.automatic ? 'Use automatic time' : 'Clear date and time overrides'}</button>}
            {event.eventDate && custom && <p className="text-xs text-slate-600 dark:text-slate-300">Recorded: {event.eventDate}{event.eventTime ? ` · ${event.eventTime}` : ''}</p>}
          </fieldset>
        })}</div>
      </details>
      <p className="text-xs text-slate-600 dark:text-slate-300">{schedule.automatic ? 'Spacing follows narrative order; it is an adjustable assumption, not estimated travel or action duration. Before/after relationships remain descriptive. Untimed recorded events keep their date precision; automatic steps follow the last timed step.' : 'Blank times keep recorded values. Undated events use the default date. Equal dates keep narrative order.'} TimelineJS sorts chronologically.</p>
      <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200">Temporary settings last until you close or refresh this preview. They appear in TimelineJS JSON, and are excluded from the ResearchTools backup.</p>
    </>}
  </fieldset>
}
