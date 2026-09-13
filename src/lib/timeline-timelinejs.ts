import type { TimelineWorkspaceExport } from '../types/timeline-workspace'
import { narrativeTimelineEvents } from './timeline-workspace'
import { timelineAssessmentLabel } from './timeline-evidence'

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
  if (!record(value) || Object.keys(value).some(key => !['defaultDate', 'events'].includes(key)) || !fullDate(value.defaultDate) || !record(value.events)) {
    return ['Presentation schedule requires a complete valid default date (YYYY-MM-DD) and event settings.']
  }
  const events = new Map(snapshot.analystWorkspace.events.map(event => [event.id, event]))
  for (const [id, settings] of Object.entries(value.events)) {
    const event = events.get(id)
    if (!event || !record(settings) || Object.keys(settings).some(key => !['date', 'time', 'meaning'].includes(key))) return ['Presentation schedule contains invalid event settings.']
    if (settings.date !== undefined && settings.date !== '' && !fullDate(settings.date)) return [`Presentation date for “${event.title}” must be a complete valid date (YYYY-MM-DD).`]
    if (settings.time !== undefined && settings.time !== '' && (typeof settings.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(settings.time))) return [`Presentation time for “${event.title}” must be HH:mm or HH:mm:ss.`]
    if (settings.meaning !== undefined && !['start', 'action', 'arrive'].includes(settings.meaning as string)) return ['Presentation meaning must be Start, Do the action, or Arrive.']
    if (settings.time && event.eventDate && !fullDate(event.eventDate) && !settings.date) return [`A time override for “${event.title}” requires an explicit complete presentation date.`]
  }
  return []
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
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
  const errors = schedule === undefined ? [] : scheduleErrors(schedule, snapshot)
  const eventDetails: TimelineJSExport['eventDetails'] = {}
  let scheduledCount = 0
  let hasTimes = false, omittedTimes = false
  for (const event of errors.length ? [] : selected) {
    const settings = schedule && Object.prototype.hasOwnProperty.call(schedule.events, event.id) ? schedule.events[event.id] : undefined
    const date = settings?.date || event.eventDate || schedule?.defaultDate
    const clock = settings?.time || event.eventTime
    const scheduled = Boolean(schedule && (!event.eventDate || settings?.date || settings?.time || (settings?.meaning && settings.meaning !== 'action')))
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
    if (scheduled) {
      paragraphs.push(`<p><strong>Presentation schedule:</strong> ${escapeHTML(display)}. This does not change the recorded event.</p>`)
      paragraphs.push(`<p><strong>Original recorded date/time:</strong> ${escapeHTML(event.eventDate || 'date not recorded')}; ${escapeHTML(event.eventTime || 'time not recorded')}.</p>`)
    }
    if (placementLabel) paragraphs.push(`<p>${escapeHTML(placementLabel)}</p>`)
    const chapter = narrative?.chapters.find(item => item.id === event.chapterId)
    const unique_id = `event-${encodeURIComponent(event.id)}`
    eventDetails[unique_id] = { dateLabel: display, ...(placementLabel ? { placementLabel } : {}), scheduled }
    events.push({
      start_date,
      text: { headline: escapeHTML(event.title), text: paragraphs.join('') },
      unique_id,
      display_date: escapeHTML(display),
      ...(chapter ? { group: escapeHTML(`${chapter.title || 'Untitled chapter'} [${chapter.id}]`) } : {}),
      autolink: false,
    })
  }
  if (hasTimes) notices.push(schedule === undefined
    ? 'Times keep their recorded clock values and show the narrative timezone, or “timezone not recorded”. TimelineJS does not encode a timezone or convert these times.'
    : 'Times use explicit presentation overrides or their recorded clock values and show the narrative timezone, or “timezone not recorded”. TimelineJS does not encode a timezone or convert these times.')
  if (omittedTimes) notices.push('Recorded times on year- or month-precision events are omitted because a complete day was not recorded.')
  if (schedule !== undefined) notices.push('Presentation schedule dates and times are temporary assumptions, not recorded facts. No durations or relative timing are inferred; chronology can differ from narrative placement. The ResearchTools backup excludes these temporary settings.')
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
