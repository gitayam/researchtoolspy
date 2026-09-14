import type { TimelineWorkspaceEvent, TimelineWorkspaceExport } from '../types/timeline-workspace'
import { narrativeTimelineEvents, timelineEventTemporalLabel } from './timeline-workspace'
import { timelineAssessmentLabel } from './timeline-evidence'
import { calendarLabelBounds, parseCalendarTemporalClaim, type CalendarLabel } from './timeline-temporal'

interface TimelineJSDate {
  year: number
  month?: number
  day?: number
  hour?: number
  minute?: number
  second?: number
}
interface TimelineJSEvent {
  start_date: TimelineJSDate
  end_date?: TimelineJSDate
  text: { headline: string; text: string }
  unique_id: string
  display_date: string
  group?: string
  autolink: false
}
interface TimelineJSExport {
  timeline: {
    title: { text: { headline: string; text: string }; unique_id: string; autolink: false }
    events: TimelineJSEvent[]
    scale: 'human'
  }
  selectedCount: number
  omitted: Array<{ eventId: string; title: string; reason: string }>
  notices: string[]
  errors: string[]
  scheduledCount: number
  eventDetails: Record<string, { dateLabel: string; placementLabel?: string; scheduled: boolean }>
}

export interface TimelinePresentationSchedule {
  defaultDate: string
  events: Record<string, { date?: string; time?: string; meaning?: 'start' | 'action' | 'arrive' }>
  automatic?: { startTime: string; intervalMinutes: number }
}

interface ResolvedPresentationSchedule {
  events: Record<string, { date?: string; time?: string; source: 'automatic' | 'override' | 'recorded' | 'default'; scheduled: boolean }>
  errors: string[]
  warnings: string[]
}

function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
}

function fullDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function scheduleErrors(value: unknown, snapshot: TimelineWorkspaceExport): string[] {
  if (!record(value) || Object.keys(value).some(key => !['defaultDate', 'events', 'automatic'].includes(key)) || !fullDate(value.defaultDate) || !record(value.events)) {
    return ['Presentation schedule requires a complete valid default date (YYYY-MM-DD) and event settings.']
  }
  if (value.automatic !== undefined) {
    const automatic = value.automatic
    if (!record(automatic) || Object.keys(automatic).some(key => !['startTime', 'intervalMinutes'].includes(key)) || !validTime(automatic.startTime) || typeof automatic.intervalMinutes !== 'number' || !Number.isInteger(automatic.intervalMinutes) || automatic.intervalMinutes < 1 || automatic.intervalMinutes > 1440) return ['Automatic scheduling requires a valid start time and an integer interval of 1–1440 minutes.']
  }
  const events = new Map(snapshot.analystWorkspace.events.map(event => [event.id, event]))
  for (const [id, settings] of Object.entries(value.events)) {
    const event = events.get(id)
    if (!event || !record(settings) || Object.keys(settings).some(key => !['date', 'time', 'meaning'].includes(key))) return ['Presentation schedule contains invalid event settings.']
    if (settings.date !== undefined && settings.date !== '' && !fullDate(settings.date)) return [`Presentation date for “${event.title}” must be a complete valid date (YYYY-MM-DD).`]
    if (settings.time !== undefined && settings.time !== '' && !validTime(settings.time)) return [`Presentation time for “${event.title}” must be HH:mm or HH:mm:ss.`]
    if (settings.meaning !== undefined && !['start', 'action', 'arrive'].includes(settings.meaning as string)) return ['Presentation meaning must be Start, Do the action, or Arrive.']
    if (event.recordedEnd !== undefined && (settings.date || settings.time || (settings.meaning && settings.meaning !== 'action'))) return [`Recorded interval endpoints for “${event.title}” cannot use presentation date, time or meaning overrides.`]
    if (settings.time && event.eventDate && !fullDate(event.eventDate) && !settings.date) return [`A time override for “${event.title}” requires an explicit complete presentation date.`]
  }
  return []
}

/** Calendar wall-clock arithmetic, without host timezone or DST interpretation. */
function advanceClock(date: string, time: string, minutes: number): { date?: string; time: string } {
  let [year, month, day] = date.split('-').map(Number)
  const parts = time.split(':').map(Number)
  const total = parts[0] * 60 + parts[1] + minutes
  if (total >= 1440) {
    day += 1
    const candidate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (!fullDate(candidate)) {
      day = 1
      month += 1
      if (month > 12) { month = 1; year += 1 }
    }
  }
  const clock = `${String(Math.floor(total % 1440 / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}${parts.length === 3 ? ':' + String(parts[2]).padStart(2, '0') : ''}`
  return { ...(year <= 9999 ? { date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` } : {}), time: clock }
}

/** Resolve only selected narrative events; the source workspace is never rewritten. */
export function resolveTimelinePresentationSchedule(snapshot: TimelineWorkspaceExport, schedule: TimelinePresentationSchedule): ResolvedPresentationSchedule {
  const errors = scheduleErrors(schedule, snapshot)
  const events: ResolvedPresentationSchedule['events'] = Object.create(null)
  if (errors.length) return { events, errors, warnings: [] }
  const warnings = new Set<string>()
  let anchor: { date: string; time: string } | undefined
  for (const event of narrativeTimelineEvents(snapshot.analystWorkspace.events)) {
    if (event.recordedEnd !== undefined) {
      const interval = recordedInterval(event)
      if (interval.ok === false) return { events: {}, errors: [`Invalid recorded interval for “${event.title}”: ${interval.reason}.`], warnings: [] }
      events[event.id] = { date: event.eventDate, ...(event.eventTime ? { time: event.eventTime } : {}), source: 'recorded', scheduled: false }
      if (schedule.automatic) {
        const end = event.recordedEnd
        if (fullDate(end.date) && end.time) {
          const stamp = end.date + 'T' + (end.time.length === 5 ? end.time + ':00' : end.time)
          if (anchor && stamp < anchor.date + 'T' + (anchor.time.length === 5 ? anchor.time + ':00' : anchor.time)) warnings.add('A manual or recorded anchor precedes the previous timed event. TimelineJS reorders events chronologically; original dates and overrides are retained.')
          anchor = { date: end.date, time: end.time }
        } else {
          warnings.add('A recorded interval without a complete end date and explicit end clock does not anchor automatic timing. Following undated steps use the previous usable timed anchor or the default presentation date and start time, not the interval start.')
        }
      }
      continue
    }
    const settings = Object.prototype.hasOwnProperty.call(schedule.events, event.id) ? schedule.events[event.id] : undefined
    const explicitDate = settings?.date || undefined
    const explicitTime = settings?.time || undefined
    let date = explicitDate || event.eventDate || schedule.defaultDate
    let time = explicitTime || event.eventTime
    let source: ResolvedPresentationSchedule['events'][string]['source'] = explicitDate || explicitTime ? 'override' : event.eventDate || event.eventTime ? 'recorded' : 'default'
    if (schedule.automatic && !event.eventDate) {
      // A fully explicit timestamp does not need an automatic candidate.
      const candidate = explicitDate && (explicitTime || event.eventTime)
        ? { date: explicitDate, time: explicitTime || event.eventTime! }
        : anchor ? advanceClock(anchor.date, anchor.time, schedule.automatic.intervalMinutes)
          : { date: schedule.defaultDate, time: schedule.automatic.startTime }
      const candidateDate = explicitDate || candidate.date
      if (!candidateDate) return { events: {}, errors: ['Automatic presentation schedule exceeds Gregorian year 9999. Change an anchor or interval.'], warnings: [] }
      date = candidateDate
      time = explicitTime || event.eventTime || candidate.time
      if (source === 'default') source = 'automatic'
    }
    const scheduled = Boolean(!event.eventDate || explicitDate || explicitTime || (settings?.meaning && settings.meaning !== 'action'))
    events[event.id] = { date, ...(time ? { time } : {}), source, scheduled }
    if (schedule.automatic) {
      if (fullDate(date) && time) {
        const stamp = date + 'T' + (time.length === 5 ? time + ':00' : time)
        if (anchor && stamp < anchor.date + 'T' + (anchor.time.length === 5 ? anchor.time + ':00' : anchor.time)) warnings.add('A manual or recorded anchor precedes the previous timed event. TimelineJS reorders events chronologically; original dates and overrides are retained.')
        anchor = { date, time }
      } else if (anchor) {
        warnings.add('An untimed or partial-date recorded event does not anchor an automatic clock. Following automatic events continue from the previous usable timed anchor, not from that event.')
      }
    }
  }
  return { events, errors: [], warnings: [...warnings] }
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function recordedInterval(event: TimelineWorkspaceEvent) {
  return parseCalendarTemporalClaim({
    schema: 'timeline-calendar-claim.v1', kind: 'interval', displayText: '',
    start: { date: event.eventDate, ...(event.datePrecision !== undefined ? { precision: event.datePrecision } : {}), ...(event.eventTime ? { time: event.eventTime } : {}) },
    end: event.recordedEnd,
  })
}

function recordedDate(label: CalendarLabel): TimelineJSDate {
  const parts = label.date.split('-').map(Number)
  const clock = label.time?.split(':').map(Number)
  return { year: parts[0], ...(parts.length >= 2 ? { month: parts[1] } : {}), ...(parts.length === 3 ? { day: parts[2] } : {}),
    ...(clock ? { hour: clock[0], minute: clock[1], ...(clock.length === 3 ? { second: clock[2] } : {}) } : {}) }
}

/** Pure presentation adapter for an already validated workspace; never applies import defaults. */
export function buildTimelineJSExport(snapshot: TimelineWorkspaceExport, schedule?: TimelinePresentationSchedule): TimelineJSExport {
  const workspace = snapshot.analystWorkspace
  const narrative = workspace.narrative
  const selected = narrativeTimelineEvents(workspace.events)
  const omitted: TimelineJSExport['omitted'] = []
  const notices = [
    'TimelineJS sorts chronologically; narrative sequence and transitions may change. Transitions are omitted.',
    'This file cannot restore your workspace. The ResearchTools backup keeps all events, evidence, retained reviews and questions.',
    'Title, framing, chapter labels and the displayed timezone are included. Other narrative metadata and chapter claims stay in the backup.',
  ]
  const events: TimelineJSEvent[] = []
  const resolved = schedule === undefined ? undefined : resolveTimelinePresentationSchedule(snapshot, schedule)
  const errors = resolved?.errors || []
  for (const event of selected) {
    if (event.recordedEnd !== undefined && recordedInterval(event).ok === false) errors.push(`Invalid recorded interval for “${event.title}”. Both recorded endpoints must form a valid calendar claim.`)
  }
  notices.push(...(resolved?.warnings || []))
  const eventDetails: TimelineJSExport['eventDetails'] = {}
  let scheduledCount = 0
  let hasTimes = false, omittedTimes = false
  for (const event of errors.length ? [] : selected) {
    const settings = schedule && Object.prototype.hasOwnProperty.call(schedule.events, event.id) ? schedule.events[event.id] : undefined
    const effective = resolved?.events[event.id]
    const date = effective?.date || event.eventDate
    const clock = effective?.time || event.eventTime
    const scheduled = effective?.scheduled || false
    if (!date) {
      omitted.push({ eventId: event.id, title: event.title, reason: 'No recorded absolute date; unknown dates are not invented.' })
      continue
    }
    const parts = date.split('-').map(Number)
    const start_date: TimelineJSDate = { year: parts[0] }
    if (parts.length >= 2) start_date.month = parts[1]
    if (parts.length === 3) start_date.day = parts[2]
    let display = date
    if (clock) {
      if (parts.length === 3) {
        const time = clock.split(':').map(Number)
        start_date.hour = time[0]; start_date.minute = time[1]
        if (time.length === 3) start_date.second = time[2]
        display += ` ${clock} (${narrative?.timezone || 'timezone not recorded'})`
        hasTimes = true
      } else omittedTimes = true
    }
    if (scheduled) {
      const meaning = settings?.meaning === 'start' ? 'Start' : settings?.meaning === 'arrive' ? 'Arrive' : 'Do the action'
      display = `${meaning}: ${display} (presentation assumption; temporary)`
      scheduledCount += 1
    }
    let end_date: TimelineJSDate | undefined
    let intervalNotice: string | undefined
    if (event.recordedEnd !== undefined) {
      const interval = recordedInterval(event)
      if (interval.ok === true && interval.claim.kind === 'interval') {
        const start = calendarLabelBounds(interval.claim.start)
        const end = calendarLabelBounds(interval.claim.end)
        if (!('reason' in start) && !('reason' in end) && end.start >= start.start) end_date = recordedDate(interval.claim.end)
        else {
          intervalNotice = 'Overlapping recorded endpoint precision would reverse TimelineJS\'s default-component geometry. The slide retains the complete recorded range label; its geometric end date is omitted. No endpoint or duration is inferred.'
          notices.push(`“${event.title}”: ${intervalNotice}`)
        }
        display = timelineEventTemporalLabel(event)
        if (event.eventTime || event.recordedEnd.time) {
          display += ` (${narrative?.timezone || 'timezone not recorded'})`
          hasTimes = true
        }
      }
    }
    let placementLabel: string | undefined
    if (event.placement?.mode === 'relative') {
      const anchorEventId = event.placement.anchorEventId
      const anchor = workspace.events.find(item => item.id === anchorEventId)
      placementLabel = `Relative placement: ${event.placement.relation} “${anchor?.title || event.placement.anchorEventId}”. This relation is not enforced as chronology.`
    } else if (event.placement?.mode === 'position') {
      placementLabel = `Sequence position: ${event.placement.position}. This position is not enforced as chronology.`
    }
    const paragraphs: string[] = []
    if (event.description) paragraphs.push(`<p>${escapeHTML(event.description)}</p>`)
    if (event.whyItMatters) paragraphs.push(`<p><strong>Why it matters:</strong> ${escapeHTML(event.whyItMatters)}</p>`)
    paragraphs.push(`<p><strong>Assessment:</strong> ${escapeHTML(timelineAssessmentLabel(workspace.evidence, event))}</p>`)
    if (event.recordedEnd !== undefined) paragraphs.push(`<p><strong>Recorded range:</strong> ${escapeHTML(display)}. Inclusive recorded units describe uncertain extent, not a measured duration.</p>`)
    if (intervalNotice) paragraphs.push(`<p>${escapeHTML(intervalNotice)}</p>`)
    if (scheduled) {
      paragraphs.push(`<p><strong>Presentation schedule:</strong> ${escapeHTML(display)}. This does not change the recorded event.</p>`)
      paragraphs.push(`<p><strong>Original recorded date/time:</strong> ${escapeHTML(event.eventDate || 'date not recorded')}; ${escapeHTML(event.eventTime || 'time not recorded')}.</p>`)
      if (schedule?.automatic) paragraphs.push(`<p><strong>Automatic presentation assumption:</strong> Effective timing source: ${escapeHTML(effective?.source || 'automatic')}. Undated events follow narrative selection order at a ${schedule.automatic.intervalMinutes}-minute interval from the previous usable timed anchor, unless overridden. This is not an inferred duration or an enforced before/after relationship.</p>`)
    }
    if (placementLabel) paragraphs.push(`<p>${escapeHTML(placementLabel)}</p>`)
    const chapter = narrative?.chapters.find(item => item.id === event.chapterId)
    const unique_id = `event-${encodeURIComponent(event.id)}`
    eventDetails[unique_id] = { dateLabel: display, ...(placementLabel ? { placementLabel } : {}), scheduled }
    events.push({
      start_date,
      ...(end_date ? { end_date } : {}),
      text: { headline: escapeHTML(event.title), text: paragraphs.join('') },
      unique_id,
      display_date: escapeHTML(display),
      ...(chapter ? { group: escapeHTML(`${chapter.title || 'Untitled chapter'} [${chapter.id}]`) } : {}),
      autolink: false,
    })
  }
  if (hasTimes) notices.push(schedule === undefined
    ? 'Times keep their recorded clock values and show the narrative timezone, or “timezone not recorded”. TimelineJS does not encode a timezone or convert these times.'
    : 'Times use presentation settings or their recorded clock values and show the narrative timezone, or “timezone not recorded”. TimelineJS does not encode a timezone or convert these times.')
  if (omittedTimes) notices.push('Recorded times on year- or month-precision events are omitted because a complete day was not recorded.')
  if (schedule !== undefined) notices.push(schedule?.automatic
    ? 'Automatic presentation spacing follows narrative selection order using calendar wall-clock arithmetic, without timezone or DST conversion. Dates and times are temporary assumptions, not recorded facts or inferred travel durations; before/after relationships are descriptive. Chronology can differ from narrative placement. The ResearchTools backup excludes these temporary settings.'
    : 'Presentation schedule dates and times are temporary assumptions, not recorded facts. No durations or relative timing are inferred; chronology can differ from narrative placement. The ResearchTools backup excludes these temporary settings.')
  return {
    timeline: {
      title: { text: { headline: escapeHTML(narrative?.title || 'Untitled narrative'), text: narrative?.framing ? `<p>${escapeHTML(narrative.framing)}</p>` : '' }, unique_id: 'narrative-title', autolink: false },
      events, scale: 'human',
    },
    selectedCount: selected.length,
    omitted,
    notices,
    errors,
    scheduledCount,
    eventDetails,
  }
}
