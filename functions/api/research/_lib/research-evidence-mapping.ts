/**
 * research_evidence → evidence_items mapping (D-E8-3).
 *
 * The legacy `research_evidence` table is being collapsed onto the canonical
 * `evidence_items` store (D-E8 "make evidence_items canonical"). These pure
 * mappers let the three research-evidence handlers (add / list / process) write
 * to and read from `evidence_items` while preserving the exact frontend contract
 * `ResearchWorkspacePage.tsx` consumes:
 *   { id, content, evidence_type, verification_status, credibility_score, collected_at }
 *
 * Strategy: mirror the first-class fields onto real `evidence_items` columns
 * (so research evidence is genuinely canonical + filterable + reusable across
 * tools), and stash the research-specific originals in the `metadata` JSON column
 * (migration 110) so the write↔read round-trip is lossless.
 *
 * Kept free of D1 / Request / framework imports so the mapping is unit-testable
 * in pure Node (see tests/e2e/smoke/de8-3-research-evidence-mapping.spec.ts).
 *
 * Reuses `credibilityScoreToAdmiralty` (the 0–1 → Admiralty '1'–'6' helper that
 * D-E8-1 introduced) and adds its inverse `admiraltyToCredibilityScore`; the two
 * are demonstrably consistent (a score round-trips into the same Admiralty band).
 */

import { credibilityScoreToAdmiralty } from '../../ach/from-content-intelligence'

export { credibilityScoreToAdmiralty }

/**
 * evidence_items.status vocabulary: 'draft' | 'verified' | 'archived'.
 *
 * research_evidence.verification_status is free-form-ish ('verified',
 * 'probable', 'unverified', 'disproven', null). We map:
 *   'verified'  → 'verified'
 *   'archived'  → 'archived'   (round-trip stability for archived rows)
 *   everything else / null → 'draft'
 */
export function verificationStatusToItemStatus(
  verificationStatus: unknown
): 'draft' | 'verified' | 'archived' {
  if (verificationStatus === 'verified') return 'verified'
  if (verificationStatus === 'archived') return 'archived'
  return 'draft'
}

/**
 * Inverse of {@link verificationStatusToItemStatus} for the read path, used when
 * the original `verification_status` was NOT preserved in metadata:
 *   'verified'  → 'verified'
 *   'archived'  → 'archived'
 *   'draft' / anything else → 'unverified'
 */
export function itemStatusToVerificationStatus(status: unknown): string {
  if (status === 'verified') return 'verified'
  if (status === 'archived') return 'archived'
  return 'unverified'
}

/**
 * Inverse of {@link credibilityScoreToAdmiralty}: Admiralty '1'–'6' TEXT → a
 * representative 0–1 float at the CENTER of the band, so that
 * `credibilityScoreToAdmiralty(admiraltyToCredibilityScore(b)) === b` for every
 * band b in 1..6 (round-trip-stable; proven in the smoke test).
 *
 * The forward map is `round(6 - score*5)`, so band b covers the scores that
 * round to b. The band center inverts cleanly: `score = (6 - b) / 5`.
 *   '1' → 1.0, '2' → 0.8, '3' → 0.6, '4' → 0.4, '5' → 0.2, '6' → 0.0
 * Non-'1'..'6' input (null, '', unknown) → null (caller falls back / omits).
 */
export function admiraltyToCredibilityScore(admiralty: unknown): number | null {
  if (typeof admiralty !== 'string') return null
  const band = Number(admiralty)
  if (!Number.isInteger(band) || band < 1 || band > 6) return null
  return (6 - band) / 5
}

/** Input fields for a research-evidence write (the union add.ts + process.ts need). */
export interface ResearchEvidenceInput {
  researchQuestionId?: string | null
  investigationPacketId?: string | null
  workspaceId?: string | null

  evidenceType: string
  title: string
  content?: string | null

  /** Caller-supplied extra metadata; merged into the stashed metadata blob. */
  metadata?: Record<string, unknown> | null

  /** 0–1 float (or null). */
  credibilityScore?: number | null
  verificationStatus?: string | null

  chainOfCustody?: unknown
  tags?: unknown
  category?: string | null

  linkedEvidence?: unknown
  entities?: unknown

  evidenceDate?: string | null
  /** ISO string preserved verbatim for the reader to echo back as collected_at. */
  collectedAt: string
  collectedBy?: string | null
}

/** The column/value bag for the `evidence_items` INSERT (column order matches `columns`). */
export interface EvidenceItemsInsert {
  columns: string[]
  values: unknown[]
  /** The stashed metadata object (also serialized into `values`); exposed for tests. */
  metadata: Record<string, unknown>
}

/**
 * Build the `evidence_items` INSERT bag from a research-evidence input.
 *
 * First-class fields → real columns; research-specific originals → `metadata`
 * JSON so the read path can rehydrate the exact frontend contract.
 *
 *   title            → title
 *   content          → description (NOT NULL; coalesced to '')
 *   evidenceType     → evidence_type (NOT NULL)
 *   credibilityScore → credibility (Admiralty '1'–'6'; defaults to '6' when absent)
 *   reliability      = 'unknown'  (A–F NOT NULL; unknown source, mirrors D-E8-1)
 *   verificationStatus → status   (via verificationStatusToItemStatus)
 *   research_question_id / investigation_packet_id / workspace_id → direct columns
 *   tags             → tags (JSON); category → category
 *   created_by       ← auth userId (INTEGER)
 *   metadata JSON    ← { source:'research_evidence', content, credibility_score,
 *                        verification_status, chain_of_custody, linked_evidence,
 *                        entities, evidence_date, collected_at, collected_by,
 *                        category, ...caller metadata }
 */
export function buildEvidenceItemsInsert(
  input: ResearchEvidenceInput,
  opts: { userId: number }
): EvidenceItemsInsert {
  // credibility is NOT NULL TEXT '1'–'6'. A null/absent score → least-credible '6'.
  const credibility = credibilityScoreToAdmiralty(input.credibilityScore) ?? '6'
  const status = verificationStatusToItemStatus(input.verificationStatus)

  // Lossless originals for the round-trip. Caller metadata is merged FIRST so the
  // canonical keys below always win (they are what the reader reads back).
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    source: 'research_evidence',
    content: input.content ?? null,
    credibility_score:
      typeof input.credibilityScore === 'number' ? input.credibilityScore : null,
    verification_status: input.verificationStatus ?? null,
    chain_of_custody: input.chainOfCustody ?? null,
    linked_evidence: input.linkedEvidence ?? null,
    entities: input.entities ?? null,
    evidence_date: input.evidenceDate ?? null,
    collected_at: input.collectedAt,
    collected_by: input.collectedBy ?? null,
    category: input.category ?? null,
  }

  const columns = [
    'title',
    'description',
    'evidence_type',
    'credibility',
    'reliability',
    'status',
    'research_question_id',
    'investigation_packet_id',
    'workspace_id',
    'tags',
    'category',
    'metadata',
    'created_by',
    'created_at',
    'updated_at',
  ]

  const values = [
    input.title,
    input.content ?? '', // description is NOT NULL
    input.evidenceType,
    credibility,
    'unknown', // reliability A–F NOT NULL
    status,
    input.researchQuestionId ?? null,
    input.investigationPacketId ?? null,
    input.workspaceId ?? null,
    input.tags != null ? JSON.stringify(input.tags) : null,
    input.category ?? null,
    JSON.stringify(metadata),
    opts.userId,
    input.collectedAt,
    input.collectedAt,
  ]

  return { columns, values, metadata }
}

/** The frontend-contract shape a list-evidence response item must carry. */
export interface ResearchEvidenceResponseItem {
  id: string
  content: string | null
  evidence_type: string
  verification_status: string
  credibility_score: number | null
  collected_at: string | null
  // Rehydrated research fields (so nothing regresses for other consumers).
  title: string
  category: string | null
  tags: unknown
  chainOfCustody: unknown
  linkedEvidence: unknown
  entities: unknown
  metadata: Record<string, unknown> | null
  research_question_id: string | null
  investigation_packet_id: string | null
  workspace_id: string | null
  [key: string]: unknown
}

/**
 * Map an `evidence_items` row → the research-evidence list response item.
 *
 * Prefers the lossless `metadata` originals (written by
 * {@link buildEvidenceItemsInsert}); falls back to the canonical columns when a
 * row was written by another tool (no research metadata).
 *
 * `safeJSON` is injected so this stays free of any parsing-policy assumptions
 * and reuses the handler's existing helper.
 */
export function itemRowToResearchEvidence(
  row: Record<string, unknown>,
  safeJSON: (val: unknown, fallback?: unknown) => unknown
): ResearchEvidenceResponseItem {
  const metadata = safeJSON(row.metadata, null) as Record<string, unknown> | null
  const meta = metadata ?? {}

  // Honor an explicit metadata value (including a stored `null` = "no
  // credibility known" — do NOT fabricate a score from the '6' default the
  // writer stored in the NOT NULL column). Only fall back to the column when the
  // row carries no research metadata at all (e.g. written by another tool).
  const credibilityScore =
    'credibility_score' in meta
      ? typeof meta.credibility_score === 'number'
        ? meta.credibility_score
        : null
      : admiraltyToCredibilityScore(row.credibility)

  return {
    id: String(row.id),
    // Honor the metadata original (including a stored `null`); the writer
    // coalesces a null content to '' for the NOT NULL `description` column, so
    // only fall back to `description` for foreign rows with no research metadata.
    content:
      'content' in meta
        ? typeof meta.content === 'string'
          ? meta.content
          : null
        : ((row.description as string | null) ?? null),
    evidence_type: (row.evidence_type as string) ?? null,
    verification_status:
      (typeof meta.verification_status === 'string' && meta.verification_status) ||
      itemStatusToVerificationStatus(row.status),
    credibility_score: credibilityScore,
    collected_at:
      (typeof meta.collected_at === 'string' ? meta.collected_at : undefined) ??
      (row.created_at as string | null) ??
      null,
    // Rehydrated research-specific fields.
    title: (row.title as string) ?? '',
    category: ('category' in meta ? (meta.category as string | null) : (row.category as string | null)) ?? null,
    tags: 'tags' in meta && meta.tags != null ? meta.tags : safeJSON(row.tags, []),
    chainOfCustody: meta.chain_of_custody ?? null,
    linkedEvidence: meta.linked_evidence ?? [],
    entities: meta.entities ?? [],
    metadata,
    research_question_id: (row.research_question_id as string | null) ?? null,
    investigation_packet_id: (row.investigation_packet_id as string | null) ?? null,
    workspace_id: (row.workspace_id as string | null) ?? null,
  }
}
