import type { TimelineEvidenceSource } from './timeline-workspace'

export interface TimelineSourceImport {
  schemaVersion: 'timeline-source-import.v1'
  workspaceId: string
  analysisId: number
  contentHash: string
  quoteHash: string
  start: number
  end: number
  matchedAt: string
  source: TimelineEvidenceSource
  passage: { id: string; quote: string; locator: string }
}
