import type { ScrapeProvenanceV1 } from './scrape-contract'

export const SOURCE_ARTIFACT_SCHEMA_VERSION = 'source-artifact.v1' as const
export const SOURCE_PASSAGE_SCHEMA_VERSION = 'source-passage.v1' as const
export const CLAIM_EVIDENCE_SCHEMA_VERSION = 'claim-evidence.v1' as const
export const ANSWER_PACKET_SCHEMA_VERSION = 'answer-packet.v1' as const

export type SourceArtifactKind = 'web' | 'pdf' | 'social' | 'archive' | 'upload' | 'supplied'
export type ClaimEvidenceStance = 'supports' | 'contradicts' | 'contextualizes'
export type AnswerClaimStatus = 'supported' | 'disputed' | 'insufficient'

export interface SourceArtifactV1 {
  schemaVersion: typeof SOURCE_ARTIFACT_SCHEMA_VERSION
  id: string
  workspaceId: string
  investigationId: string
  kind: SourceArtifactKind
  sourceIdentity: string
  canonicalUrl?: string
  finalUrl?: string
  objectKey?: string
  title: string
  author?: string
  publishedAt?: string
  observedAt: string
  contentHash: string
  contentType: string
  language?: string
  provenance: ScrapeProvenanceV1
}

export interface SourcePassageV1 {
  schemaVersion: typeof SOURCE_PASSAGE_SCHEMA_VERSION
  id: string
  artifactId: string
  ordinal: number
  startOffset: number
  endOffset: number
  text: string
  textHash: string
  heading?: string
}

export interface ClaimEvidenceLinkV1 {
  schemaVersion: typeof CLAIM_EVIDENCE_SCHEMA_VERSION
  id: string
  claimId: string
  passageId: string
  stance: ClaimEvidenceStance
  relevance: number
  confidence: number
  rationale?: string
  linkedBy: string
  createdAt: string
}

export interface AnswerPacketClaimV1 {
  id: string
  statement: string
  status: AnswerClaimStatus
  confidence: number
  evidenceLinkIds: readonly string[]
}

export interface AnswerPacketV1 {
  schemaVersion: typeof ANSWER_PACKET_SCHEMA_VERSION
  id: string
  workspaceId: string
  investigationId: string
  questionId: string
  question: string
  answer: string
  claims: readonly AnswerPacketClaimV1[]
  limitations: readonly string[]
  collectionGaps: readonly string[]
  generatedAt: string
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const LANGUAGE_PATTERN = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/
const ARTIFACT_KINDS = new Set<SourceArtifactKind>(['web', 'pdf', 'social', 'archive', 'upload', 'supplied'])
const STANCES = new Set<ClaimEvidenceStance>(['supports', 'contradicts', 'contextualizes'])
const CLAIM_STATUSES = new Set<AnswerClaimStatus>(['supported', 'disputed', 'insufficient'])

function isId(value: string): boolean {
  return ID_PATTERN.test(value)
}

function isHash(value: string): boolean {
  return HASH_PATTERN.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isOptionalTimestamp(value: unknown): boolean {
  return value === undefined || isTimestamp(value)
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

function isBoundedText(value: string, minimum: number, maximum: number): boolean {
  const length = value.trim().length
  return length >= minimum && length <= maximum
}

function isCanonicalHttpUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.username
      && !url.password
      && !url.hash
      && url.toString() === value
  } catch {
    return false
  }
}

export function isValidSourceArtifact(artifact: SourceArtifactV1): boolean {
  const remote = artifact.kind === 'web' || artifact.kind === 'pdf'
    || artifact.kind === 'social' || artifact.kind === 'archive'
  const local = artifact.kind === 'upload'

  return artifact.schemaVersion === SOURCE_ARTIFACT_SCHEMA_VERSION
    && isId(artifact.id)
    && isId(artifact.workspaceId)
    && isId(artifact.investigationId)
    && ARTIFACT_KINDS.has(artifact.kind)
    && isBoundedText(artifact.sourceIdentity, 1, 1_000)
    && (!remote || isCanonicalHttpUrl(artifact.canonicalUrl))
    && (artifact.canonicalUrl === undefined || isCanonicalHttpUrl(artifact.canonicalUrl))
    && (artifact.finalUrl === undefined || isCanonicalHttpUrl(artifact.finalUrl))
    && (!local || (typeof artifact.objectKey === 'string' && artifact.objectKey.length > 0 && artifact.objectKey.length <= 512))
    && isBoundedText(artifact.title, 1, 500)
    && (artifact.author === undefined || isBoundedText(artifact.author, 1, 300))
    && isOptionalTimestamp(artifact.publishedAt)
    && isTimestamp(artifact.observedAt)
    && isHash(artifact.contentHash)
    && isBoundedText(artifact.contentType, 1, 200)
    && (artifact.language === undefined || LANGUAGE_PATTERN.test(artifact.language))
    && artifact.provenance?.schemaVersion === 'scrape.v1'
}

export function isValidSourcePassage(passage: SourcePassageV1): boolean {
  return passage.schemaVersion === SOURCE_PASSAGE_SCHEMA_VERSION
    && isId(passage.id)
    && isId(passage.artifactId)
    && Number.isInteger(passage.ordinal)
    && passage.ordinal >= 0
    && Number.isInteger(passage.startOffset)
    && passage.startOffset >= 0
    && Number.isInteger(passage.endOffset)
    && passage.endOffset > passage.startOffset
    && passage.endOffset - passage.startOffset === passage.text.length
    && isBoundedText(passage.text, 1, 4_000)
    && isHash(passage.textHash)
    && (passage.heading === undefined || isBoundedText(passage.heading, 1, 500))
}

export function isValidClaimEvidenceLink(link: ClaimEvidenceLinkV1): boolean {
  return link.schemaVersion === CLAIM_EVIDENCE_SCHEMA_VERSION
    && isId(link.id)
    && isId(link.claimId)
    && isId(link.passageId)
    && STANCES.has(link.stance)
    && isUnitInterval(link.relevance)
    && isUnitInterval(link.confidence)
    && (link.rationale === undefined || isBoundedText(link.rationale, 1, 2_000))
    && isId(link.linkedBy)
    && isTimestamp(link.createdAt)
}

export function isValidAnswerPacket(packet: AnswerPacketV1): boolean {
  const claimIds = packet.claims.map(claim => claim.id)
  return packet.schemaVersion === ANSWER_PACKET_SCHEMA_VERSION
    && isId(packet.id)
    && isId(packet.workspaceId)
    && isId(packet.investigationId)
    && isId(packet.questionId)
    && isBoundedText(packet.question, 3, 2_000)
    && isBoundedText(packet.answer, 1, 50_000)
    && packet.claims.length > 0
    && packet.claims.length <= 200
    && new Set(claimIds).size === claimIds.length
    && packet.claims.every(claim => {
      const evidenceIds = claim.evidenceLinkIds
      const grounded = evidenceIds.length > 0 && new Set(evidenceIds).size === evidenceIds.length
        && evidenceIds.every(isId)
      return isId(claim.id)
        && isBoundedText(claim.statement, 1, 5_000)
        && CLAIM_STATUSES.has(claim.status)
        && isUnitInterval(claim.confidence)
        && (claim.status === 'insufficient' ? evidenceIds.length === 0 : grounded)
    })
    && packet.limitations.length <= 50
    && packet.limitations.every(item => isBoundedText(item, 1, 2_000))
    && packet.collectionGaps.length <= 50
    && packet.collectionGaps.every(item => isBoundedText(item, 1, 2_000))
    && isTimestamp(packet.generatedAt)
}

/** Validate referential integrity for a packet assembled from stored records. */
export function isGroundedAnswerPacket(
  packet: AnswerPacketV1,
  links: readonly ClaimEvidenceLinkV1[],
  passages: readonly SourcePassageV1[],
  artifacts: readonly SourceArtifactV1[],
): boolean {
  if (!isValidAnswerPacket(packet)
    || !links.every(isValidClaimEvidenceLink)
    || !passages.every(isValidSourcePassage)
    || !artifacts.every(isValidSourceArtifact)) return false

  const artifactIds = new Set(artifacts.map(artifact => artifact.id))
  const passageIds = new Set(passages.filter(passage => artifactIds.has(passage.artifactId)).map(passage => passage.id))
  const linkById = new Map(links.filter(link => passageIds.has(link.passageId)).map(link => [link.id, link]))

  return packet.claims.every(claim => claim.evidenceLinkIds.every(linkId => {
    const link = linkById.get(linkId)
    return link?.claimId === claim.id
  }))
}
