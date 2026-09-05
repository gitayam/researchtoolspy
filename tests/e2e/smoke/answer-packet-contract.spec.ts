import { expect, test } from '@playwright/test'

import {
  ANSWER_PACKET_SCHEMA_VERSION,
  CLAIM_EVIDENCE_SCHEMA_VERSION,
  SOURCE_ARTIFACT_SCHEMA_VERSION,
  SOURCE_PASSAGE_SCHEMA_VERSION,
  isGroundedAnswerPacket,
  isValidAnswerPacket,
  isValidClaimEvidenceLink,
  isValidSourceArtifact,
  isValidSourcePassage,
  type AnswerPacketV1,
  type ClaimEvidenceLinkV1,
  type SourceArtifactV1,
  type SourcePassageV1,
} from '../../../functions/api/_shared/answer-packet-contract'
import { boundScrapeAttempts, SCRAPE_SCHEMA_VERSION } from '../../../functions/api/_shared/scrape-contract'

const hash = 'a'.repeat(64)
const provenance = {
  schemaVersion: SCRAPE_SCHEMA_VERSION,
  sourceMode: 'live' as const,
  fetchStrategy: 'direct' as const,
  extractorVersion: 'heuristic.v2',
  quality: { version: 'article-quality.v2', score: 90, accepted: true },
  contentHash: hash,
  attempts: boundScrapeAttempts([]),
}

const artifact: SourceArtifactV1 = {
  schemaVersion: SOURCE_ARTIFACT_SCHEMA_VERSION,
  id: 'artifact-1', workspaceId: 'workspace-1', investigationId: 'investigation-1',
  kind: 'web', sourceIdentity: 'https://example.com/report',
  canonicalUrl: 'https://example.com/report', finalUrl: 'https://example.com/report',
  title: 'Source report', observedAt: '2026-09-04T12:00:00Z', contentHash: hash,
  contentType: 'text/html', language: 'en-US', provenance,
}
const passage: SourcePassageV1 = {
  schemaVersion: SOURCE_PASSAGE_SCHEMA_VERSION,
  id: 'passage-1', artifactId: artifact.id, ordinal: 0, startOffset: 10, endOffset: 23,
  text: 'Exact passage', textHash: hash,
}
const link: ClaimEvidenceLinkV1 = {
  schemaVersion: CLAIM_EVIDENCE_SCHEMA_VERSION,
  id: 'link-1', claimId: 'claim-1', passageId: passage.id, stance: 'supports',
  relevance: 0.95, confidence: 0.8, linkedBy: 'user-7', createdAt: '2026-09-04T12:01:00Z',
}
const packet: AnswerPacketV1 = {
  schemaVersion: ANSWER_PACKET_SCHEMA_VERSION,
  id: 'packet-1', workspaceId: artifact.workspaceId, investigationId: artifact.investigationId,
  questionId: 'question-1', question: 'What happened?', answer: 'The cited event happened.',
  claims: [{ id: 'claim-1', statement: 'The event happened.', status: 'supported', confidence: 0.8, evidenceLinkIds: [link.id] }],
  limitations: ['Only one source was reviewed.'], collectionGaps: ['Find an independent source.'],
  generatedAt: '2026-09-04T12:02:00Z',
}

test.describe('answer packet evidence contract @smoke', () => {
  test('@smoke accepts a complete grounded answer packet', () => {
    expect(isValidSourceArtifact(artifact)).toBe(true)
    expect(isValidSourcePassage(passage)).toBe(true)
    expect(isValidClaimEvidenceLink(link)).toBe(true)
    expect(isValidAnswerPacket(packet)).toBe(true)
    expect(isGroundedAnswerPacket(packet, [link], [passage], [artifact])).toBe(true)
  })

  test('@smoke rejects remote artifacts without canonical URL identity', () => {
    expect(isValidSourceArtifact({ ...artifact, canonicalUrl: 'https://user@example.com/report#fragment' })).toBe(false)
    expect(isValidSourceArtifact({ ...artifact, canonicalUrl: undefined })).toBe(false)
  })

  test('@smoke rejects passages whose exact offsets do not match text', () => {
    expect(isValidSourcePassage({ ...passage, endOffset: passage.endOffset + 1 })).toBe(false)
    expect(isValidSourcePassage({ ...passage, textHash: 'not-a-hash' })).toBe(false)
  })

  test('@smoke requires evidence for supported or disputed material claims', () => {
    const ungrounded = { ...packet, claims: [{ ...packet.claims[0], evidenceLinkIds: [] }] }
    expect(isValidAnswerPacket(ungrounded)).toBe(false)

    const explicitGap = { ...packet, claims: [{ ...packet.claims[0], status: 'insufficient' as const, evidenceLinkIds: [] }] }
    expect(isValidAnswerPacket(explicitGap)).toBe(true)
  })

  test('@smoke rejects broken claim, link, passage, or artifact references', () => {
    expect(isGroundedAnswerPacket(packet, [{ ...link, claimId: 'claim-other' }], [passage], [artifact])).toBe(false)
    expect(isGroundedAnswerPacket(packet, [link], [{ ...passage, artifactId: 'artifact-other' }], [artifact])).toBe(false)
  })
})
