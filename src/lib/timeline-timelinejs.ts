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
}

function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

/** Pure presentation adapter for an already validated workspace; never applies import defaults. */
export function buildTimelineJSExport(snapshot: TimelineWorkspaceExport): TimelineJSExport {
  const workspace = snapshot.analystWorkspace
  const narrative = workspace.narrative
  const selected = narrativeTimelineEvents(workspace.events)
  const omitted: TimelineJSExport['omitted'] = []
  const notices = [
    'TimelineJS sorts chronologically; narrative sequence and transitions may change. Transitions are omitted.',
    'This presentation is not round-trip. The matching ResearchTools companion retains the complete workspace, unselected events, evidence, retained review history and questions.',
    'Chapter claims and narrative metadata other than title, framing, chapter labels and the displayed timezone are absent from this presentation.',
  ]
  const events: TimelineJSEvent[] = []
  let hasTimes = false, omittedTimes = false
  for (const event of selected) {
    if (event.placement && event.placement.mode !== 'absolute') {
      omitted.push({ eventId: event.id, title: event.title, reason: event.placement.mode === 'relative' ? 'Relative placement cannot be represented as a recorded absolute date.' : 'Position-only placement cannot be represented as a recorded absolute date.' })
      continue
    }
    if (!event.eventDate) {
      omitted.push({ eventId: event.id, title: event.title, reason: 'No recorded absolute date; unknown dates are not invented.' })
      continue
    }
    const parts = event.eventDate.split('-').map(Number)
    const start_date: TimelineJSDate = { year: parts[0] }
    if (parts.length >= 2) start_date.month = parts[1]
    if (parts.length === 3) start_date.day = parts[2]
    let display = event.eventDate
    if (event.eventTime) {
      if (parts.length === 3) {
        const time = event.eventTime.split(':').map(Number)
        start_date.hour = time[0]; start_date.minute = time[1]
        if (time.length === 3) start_date.second = time[2]
        display += ` ${event.eventTime} (${narrative?.timezone || 'timezone not recorded'})`
        hasTimes = true
      } else omittedTimes = true
    }
    const paragraphs: string[] = []
    if (event.description) paragraphs.push(`<p>${escapeHTML(event.description)}</p>`)
    if (event.whyItMatters) paragraphs.push(`<p><strong>Why it matters:</strong> ${escapeHTML(event.whyItMatters)}</p>`)
    paragraphs.push(`<p><strong>Assessment:</strong> ${escapeHTML(timelineAssessmentLabel(workspace.evidence, event))}</p>`)
    const chapter = narrative?.chapters.find(item => item.id === event.chapterId)
    events.push({
      start_date,
      text: { headline: escapeHTML(event.title), text: paragraphs.join('') },
      unique_id: `event-${encodeURIComponent(event.id)}`,
      display_date: escapeHTML(display),
      ...(chapter ? { group: escapeHTML(`${chapter.title || 'Untitled chapter'} [${chapter.id}]`) } : {}),
      autolink: false,
    })
  }
  if (hasTimes) notices.push('Recorded times are exported as wallclock values without timezone conversion. The display label names the narrative timezone, or states that it was not recorded; TimelineJS date fields do not encode a timezone.')
  if (omittedTimes) notices.push('Recorded times on year- or month-precision events are omitted because a complete day was not recorded.')
  return {
    timeline: {
      title: { text: { headline: escapeHTML(narrative?.title || 'Untitled narrative'), text: narrative?.framing ? `<p>${escapeHTML(narrative.framing)}</p>` : '' }, unique_id: 'narrative-title', autolink: false },
      events, scale: 'human',
    },
    selectedCount: selected.length,
    omitted,
    notices,
  }
}
