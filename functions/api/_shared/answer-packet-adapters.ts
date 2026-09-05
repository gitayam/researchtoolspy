import {
  CLAIM_EVIDENCE_SCHEMA_VERSION,
  SOURCE_ARTIFACT_SCHEMA_VERSION,
  SOURCE_PASSAGE_SCHEMA_VERSION,
  type ClaimEvidenceLinkV1,
  type SourceArtifactKind,
  type SourceArtifactV1,
  type SourcePassageV1,
} from './answer-packet-contract'
import type { ScrapeProvenanceV1 } from './scrape-contract'

export interface LegacyContentAnalysisRow {
  id: string | number
  url: string
  content_hash: string
  title?: string | null
  author?: string | null
  publish_date?: string | null
  is_social_media?: number | boolean | null
  extracted_text?: string | null
}

export interface LegacyClaimEvidenceRow {
  id: string
  claim_adjustment_id: string
  relationship: string
  relevance_score?: number | null
  confidence?: number | null
  notes?: string | null
  linked_by: string
  created_at: string
}

function canonicalUrl(value: string): string {
  const url = new URL(value)
  url.hash = ''
  return url.toString()
}

function artifactKind(row: LegacyContentAnalysisRow): SourceArtifactKind {
  if (row.is_social_media) return 'social'
  return new URL(row.url).pathname.toLowerCase().endsWith('.pdf') ? 'pdf' : 'web'
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function contentAnalysisArtifact(
  row: LegacyContentAnalysisRow,
  context: {
    artifactId?: string
    workspaceId: string
    investigationId: string
    observedAt: string
    provenance: ScrapeProvenanceV1
    contentType?: string
  },
): SourceArtifactV1 {
  const url = canonicalUrl(row.url)
  return {
    schemaVersion: SOURCE_ARTIFACT_SCHEMA_VERSION,
    id: context.artifactId || `content-analysis:${row.id}`,
    workspaceId: context.workspaceId,
    investigationId: context.investigationId,
    kind: artifactKind(row),
    sourceIdentity: url,
    canonicalUrl: url,
    finalUrl: url,
    title: row.title?.trim() || new URL(url).hostname,
    author: row.author?.trim() || undefined,
    publishedAt: row.publish_date || undefined,
    observedAt: context.observedAt,
    contentHash: row.content_hash,
    contentType: context.contentType || (artifactKind(row) === 'pdf' ? 'application/pdf' : 'text/html'),
    provenance: context.provenance,
  }
}

export async function contentExcerptsToPassages(
  artifactId: string,
  fullText: string,
  excerpts: readonly { text: string; heading?: string }[],
): Promise<SourcePassageV1[]> {
  let cursor = 0
  const passages: SourcePassageV1[] = []
  for (const [ordinal, excerpt] of excerpts.entries()) {
    const text = excerpt.text.trim()
    if (!text) continue
    let startOffset = fullText.indexOf(text, cursor)
    if (startOffset < 0) startOffset = fullText.indexOf(text)
    if (startOffset < 0) throw new Error(`Excerpt ${ordinal} is not an exact source passage`)
    const endOffset = startOffset + text.length
    passages.push({
      schemaVersion: SOURCE_PASSAGE_SCHEMA_VERSION,
      id: `${artifactId}:passage:${startOffset}:${endOffset}`,
      artifactId,
      ordinal: startOffset,
      startOffset,
      endOffset,
      text,
      textHash: await sha256(text),
      heading: excerpt.heading?.trim() || undefined,
    })
    cursor = endOffset
  }
  return passages
}

export function legacyClaimEvidenceToPassageLink(
  row: LegacyClaimEvidenceRow,
  passageId: string,
): ClaimEvidenceLinkV1 {
  const stance = row.relationship === 'provides_context' ? 'contextualizes' : row.relationship
  if (stance !== 'supports' && stance !== 'contradicts' && stance !== 'contextualizes') {
    throw new Error(`Unsupported legacy evidence relationship: ${row.relationship}`)
  }
  return {
    schemaVersion: CLAIM_EVIDENCE_SCHEMA_VERSION,
    id: row.id,
    claimId: row.claim_adjustment_id,
    passageId,
    stance,
    relevance: Math.max(0, Math.min(1, (row.relevance_score ?? 50) / 100)),
    confidence: Math.max(0, Math.min(1, (row.confidence ?? 50) / 100)),
    rationale: row.notes?.trim() || undefined,
    linkedBy: row.linked_by,
    createdAt: row.created_at,
  }
}
