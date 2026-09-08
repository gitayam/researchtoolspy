export type TimelineDatePrecision = 'day' | 'month' | 'year'
export type TimelineEventCategory =
  | 'event'
  | 'meeting'
  | 'communication'
  | 'financial'
  | 'legal'
  | 'travel'
  | 'publication'
  | 'military'
  | 'political'
export type TimelineEventImportance = 'low' | 'normal' | 'high' | 'critical'
export type TimelineSuppliedContentSource =
  | 'bot-scrape'
  | 'content-intelligence'
  | 'publisher-feed'
  | 'browser-render'

export interface TimelineEvent {
  eventDate: string
  datePrecision: TimelineDatePrecision
  title: string
  description: string | null
  category: TimelineEventCategory
  importance: TimelineEventImportance
}

export interface TimelineAnalysisResult {
  schemaVersion: 'timeline-analysis.v1'
  requestId: string
  outcome: 'events' | 'no_events'
  article: {
    url: string
    title: string
    domain: string
    publishedAt?: string
  }
  events: TimelineEvent[]
  extraction: {
    contentSource: string
    sourceMode: 'live' | 'supplied' | 'archive' | 'provider'
    method?: string
    wordCount: number
    quality: {
      version: string
      score: number
      accepted: boolean
      reason?: string
    }
    fallbackAttempts: string[]
  }
  model: {
    name: string
    status: 'ok' | 'no_events'
    rejectedEventCount: number
  }
}

export interface TimelineAnalysisInput {
  url: string
  content?: {
    text: string
    title?: string
    publishedAt?: string
    source: TimelineSuppliedContentSource
  }
}
