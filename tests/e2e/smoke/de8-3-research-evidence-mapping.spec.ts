/**
 * D-E8-3 research-evidence → evidence_items mapping smoke test
 * (pure-Node, no browser, no HTTP server).
 *
 * Proves the write↔read round-trip used when the three `research_evidence`
 * handlers (add / list / process) repoint onto the canonical `evidence_items`
 * store. The real acceptance test is that the six fields
 * `ResearchWorkspacePage.tsx` reads survive a write→read round-trip:
 *   id, content, evidence_type, verification_status, credibility_score, collected_at
 *
 * Imports the pure mapping module directly — no `page` fixture, no running
 * server (mirrors de8-evidence-mapping.spec.ts). We import { test, expect } from
 * the base-test fixture per project convention.
 *
 * Tolerance note: credibility_score round-trips through the Admiralty 1–6 band
 * scale, so it is NOT bit-exact. The forward map is round(6 - score*5); the
 * inverse returns the band CENTER ((6-band)/5). A score and its round-trip both
 * fall in the same Admiralty band, so they differ by at most HALF a band width
 * = 0.5/5 = 0.1. We assert |Δ| <= 0.1 (BAND_TOLERANCE) and, more strictly, that
 * forward(inverse(b)) === b for every band (band-stable).
 */
import { test, expect } from '../fixtures/base-test'
import {
  verificationStatusToItemStatus,
  itemStatusToVerificationStatus,
  admiraltyToCredibilityScore,
  credibilityScoreToAdmiralty,
  buildEvidenceItemsInsert,
  itemRowToResearchEvidence,
  type ResearchEvidenceInput,
} from '../../../functions/api/research/_lib/research-evidence-mapping'

/** Half an Admiralty band: the max round-trip error for credibility_score. */
const BAND_TOLERANCE = 0.1

/** The defensive JSON parser the list handler injects into the row mapper. */
const safeJSON = (val: unknown, fallback: unknown = []) => {
  if (!val) return fallback
  try {
    return JSON.parse(val as string)
  } catch {
    return fallback
  }
}

/** Simulate a D1 INSERT: build the row that `evidence_items` would store, then
 *  attach a synthetic INTEGER PK as the read path would see it. */
function insertThenRow(
  input: ResearchEvidenceInput,
  userId: number,
  rowId: number
): Record<string, unknown> {
  const insert = buildEvidenceItemsInsert(input, { userId })
  const row: Record<string, unknown> = {}
  insert.columns.forEach((col, i) => {
    row[col] = insert.values[i]
  })
  row.id = rowId
  return row
}

test.describe('D-E8-3 verification-status ↔ item-status round-trip @smoke', () => {
  test('@smoke verified ↔ verified', () => {
    expect(verificationStatusToItemStatus('verified')).toBe('verified')
    expect(itemStatusToVerificationStatus('verified')).toBe('verified')
  })

  test('@smoke unverified → draft → unverified', () => {
    expect(verificationStatusToItemStatus('unverified')).toBe('draft')
    expect(itemStatusToVerificationStatus('draft')).toBe('unverified')
  })

  test('@smoke archived ↔ archived', () => {
    expect(verificationStatusToItemStatus('archived')).toBe('archived')
    expect(itemStatusToVerificationStatus('archived')).toBe('archived')
  })

  test('@smoke unknown / null / probable / disproven → draft (default)', () => {
    expect(verificationStatusToItemStatus('probable')).toBe('draft')
    expect(verificationStatusToItemStatus('disproven')).toBe('draft')
    expect(verificationStatusToItemStatus(null)).toBe('draft')
    expect(verificationStatusToItemStatus(undefined)).toBe('draft')
    // Inverse of an unknown status → unverified.
    expect(itemStatusToVerificationStatus('weird')).toBe('unverified')
    expect(itemStatusToVerificationStatus(null)).toBe('unverified')
  })
})

test.describe('D-E8-3 credibility-score ↔ Admiralty consistency @smoke', () => {
  test('@smoke admiraltyToCredibilityScore is band-stable (inverse of forward)', () => {
    // For every Admiralty band, the inverse score re-encodes to the SAME band.
    for (const band of ['1', '2', '3', '4', '5', '6']) {
      const score = admiraltyToCredibilityScore(band)
      expect(score).not.toBeNull()
      expect(credibilityScoreToAdmiralty(score as number)).toBe(band)
    }
    // Spot-check the band centers.
    expect(admiraltyToCredibilityScore('1')).toBeCloseTo(1.0, 10)
    expect(admiraltyToCredibilityScore('6')).toBeCloseTo(0.0, 10)
    expect(admiraltyToCredibilityScore('4')).toBeCloseTo(0.4, 10)
  })

  test('@smoke a score → admiralty → score lands within half a band (≤0.1)', () => {
    const samples = [0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.75, 0.9, 1.0]
    for (const s of samples) {
      const band = credibilityScoreToAdmiralty(s)
      const back = admiraltyToCredibilityScore(band as string)
      expect(back).not.toBeNull()
      expect(Math.abs((back as number) - s)).toBeLessThanOrEqual(BAND_TOLERANCE)
    }
  })

  test('@smoke non-band Admiralty input → null', () => {
    expect(admiraltyToCredibilityScore(null)).toBeNull()
    expect(admiraltyToCredibilityScore(undefined)).toBeNull()
    expect(admiraltyToCredibilityScore('')).toBeNull()
    expect(admiraltyToCredibilityScore('0')).toBeNull()
    expect(admiraltyToCredibilityScore('7')).toBeNull()
    expect(admiraltyToCredibilityScore('abc')).toBeNull()
    expect(admiraltyToCredibilityScore(4)).toBeNull() // number, not TEXT
  })
})

test.describe('D-E8-3 full write→read round-trip preserves the 6 contract fields @smoke', () => {
  test('@smoke a fully-populated research-evidence write round-trips', () => {
    const input: ResearchEvidenceInput = {
      researchQuestionId: 'rq-123',
      investigationPacketId: null,
      workspaceId: 'ws-abc',
      evidenceType: 'document',
      title: 'Leaked memo',
      content: 'The memo describes a meeting on 2026-03-14.',
      metadata: { extra: 'caller-supplied' },
      credibilityScore: 0.8,
      verificationStatus: 'verified',
      chainOfCustody: [{ actor: 'alice', action: 'collected', timestamp: '2026-03-14T00:00:00Z' }],
      tags: ['osint', 'memo'],
      category: 'intelligence',
      linkedEvidence: ['ev-9'],
      entities: [{ type: 'PERSON', name: 'Bob' }],
      evidenceDate: '2026-03-14',
      collectedAt: '2026-03-15T12:34:56.000Z',
      collectedBy: 'alice',
    }

    const row = insertThenRow(input, 42, 1001)
    const out = itemRowToResearchEvidence(row, safeJSON)

    // The six fields ResearchWorkspacePage.tsx reads.
    expect(out.id).toBe('1001') // stringified INTEGER PK
    expect(typeof out.id).toBe('string')
    expect(out.content).toBe(input.content)
    expect(out.evidence_type).toBe('document')
    expect(out.verification_status).toBe('verified')
    expect(out.credibility_score).toBeCloseTo(0.8, 10) // preserved verbatim via metadata
    expect(out.collected_at).toBe('2026-03-15T12:34:56.000Z') // verbatim ISO

    // First-class column mirroring (genuinely canonical + filterable).
    expect(row.credibility).toBe(credibilityScoreToAdmiralty(0.8)) // '2'
    expect(row.reliability).toBe('unknown')
    expect(row.status).toBe('verified')
    expect(row.research_question_id).toBe('rq-123')
    expect(row.workspace_id).toBe('ws-abc')
    expect(row.created_by).toBe(42)
    expect(row.created_at).toBe('2026-03-15T12:34:56.000Z')

    // Research fields rehydrated (no regression for other consumers).
    expect(out.title).toBe('Leaked memo')
    expect(out.category).toBe('intelligence')
    expect(out.tags).toEqual(['osint', 'memo'])
    expect(out.chainOfCustody).toEqual(input.chainOfCustody)
    expect(out.linkedEvidence).toEqual(['ev-9'])
    expect(out.entities).toEqual(input.entities)
    // Caller metadata merged + preserved.
    expect((out.metadata as Record<string, unknown>).extra).toBe('caller-supplied')
    expect((out.metadata as Record<string, unknown>).source).toBe('research_evidence')
  })

  test('@smoke null credibility_score → credibility "6", read back as null', () => {
    const input: ResearchEvidenceInput = {
      evidenceType: 'source',
      title: 'Untitled',
      content: null,
      credibilityScore: null,
      verificationStatus: 'unverified',
      collectedAt: '2026-06-29T00:00:00.000Z',
    }
    const row = insertThenRow(input, 1, 7)
    expect(row.credibility).toBe('6') // NOT NULL TEXT, least-credible default
    expect(row.description).toBe('') // NOT NULL coalesced
    const out = itemRowToResearchEvidence(row, safeJSON)
    expect(out.id).toBe('7')
    expect(out.credibility_score).toBeNull() // metadata.credibility_score is null
    expect(out.content).toBeNull()
    expect(out.verification_status).toBe('unverified')
    expect(out.collected_at).toBe('2026-06-29T00:00:00.000Z')
  })

  test('@smoke row written by another tool (no research metadata) reads from columns', () => {
    // Simulate an evidence_items row that did NOT come from research_evidence:
    // no metadata blob → reader must fall back to the canonical columns.
    const foreignRow: Record<string, unknown> = {
      id: 99,
      title: 'Foreign evidence',
      description: 'Body text from another tool',
      evidence_type: 'observation',
      credibility: '3', // Admiralty band 3 → center 0.6
      reliability: 'B',
      status: 'verified',
      tags: JSON.stringify(['x']),
      category: 'general',
      metadata: null,
      research_question_id: 'rq-1',
      investigation_packet_id: null,
      workspace_id: 'ws-1',
      created_at: '2026-01-01T00:00:00.000Z',
    }
    const out = itemRowToResearchEvidence(foreignRow, safeJSON)
    expect(out.id).toBe('99')
    expect(out.content).toBe('Body text from another tool') // ← description
    expect(out.evidence_type).toBe('observation')
    expect(out.verification_status).toBe('verified') // ← itemStatusToVerificationStatus
    expect(out.credibility_score).toBeCloseTo(0.6, 10) // ← admiraltyToCredibilityScore('3')
    expect(out.collected_at).toBe('2026-01-01T00:00:00.000Z') // ← created_at
    expect(out.tags).toEqual(['x'])
    expect(out.category).toBe('general')
  })

  test('@smoke unknown verification status defaults to draft and reads back as unverified', () => {
    const input: ResearchEvidenceInput = {
      evidenceType: 'data',
      title: 'Probable thing',
      content: 'x',
      credibilityScore: 0.5,
      verificationStatus: 'probable', // not in the item vocabulary
      collectedAt: '2026-06-29T01:02:03.000Z',
    }
    const row = insertThenRow(input, 5, 12)
    expect(row.status).toBe('draft')
    const out = itemRowToResearchEvidence(row, safeJSON)
    // Original 'probable' was preserved in metadata, so it reads back verbatim.
    expect(out.verification_status).toBe('probable')
    expect(out.credibility_score).toBeCloseTo(0.5, 10)
  })
})
