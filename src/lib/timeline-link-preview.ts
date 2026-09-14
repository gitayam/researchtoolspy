import { presentationPlainText, type TimelinePresentation } from './timeline-presentation-contract'

function bounded(value: string, limit: number): string {
  const points = Array.from(value)
  return points.length <= limit ? value : points.slice(0, limit - 1).join('') + '…'
}
function plain(value: string): string {
  return presentationPlainText(value).replace(/\s+/gu, ' ').trim()
}

/** Uses only the explicitly published title/framing and event count. */
export function timelineLinkPreview(timeline: TimelinePresentation['timeline']) {
  const title = bounded(plain(timeline.title.text.headline) || 'Timeline presentation', 150)
  const framing = plain(timeline.title.text.text) || 'Explore this shared timeline presentation.'
  const eventCount = timeline.events.length
  return {
    title,
    description: bounded(`${eventCount} ${eventCount === 1 ? 'event' : 'events'} · ${framing}`, 240),
    eventCount,
    imagePath: '/timeline-share-card.png',
    imageAlt: 'Timeline presentation card with connected events',
  }
}
