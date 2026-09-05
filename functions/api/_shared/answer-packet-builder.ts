import { contentAnalysisArtifact, contentExcerptsToPassages, type LegacyContentAnalysisRow } from './answer-packet-adapters'
import {
  ANSWER_PACKET_SCHEMA_VERSION,
  CLAIM_EVIDENCE_SCHEMA_VERSION,
  isGroundedAnswerPacket,
  type AnswerClaimStatus,
  type AnswerPacketV1,
  type ClaimEvidenceLinkV1,
  type ClaimEvidenceStance,
  type SourceArtifactV1,
  type SourcePassageV1,
} from './answer-packet-contract'
import { boundScrapeAttempts, SCRAPE_SCHEMA_VERSION } from './scrape-contract'

export interface AnswerPacketEvidenceInput {
  excerpt: string
  heading?: string
  stance: ClaimEvidenceStance
  relevance: number
  confidence: number
  rationale?: string
}

export interface AnswerPacketClaimInput {
  statement: string
  status: AnswerClaimStatus
  confidence: number
  evidence?: AnswerPacketEvidenceInput[]
}

export interface CreateAnswerPacketInput {
  analysis_id: number
  investigation_id: string
  question_id?: string
  question: string
  answer: string
  claims: AnswerPacketClaimInput[]
  limitations?: string[]
  collection_gaps?: string[]
  expires_at?: string | null
}

export interface PromotableContentAnalysisRow extends LegacyContentAnalysisRow {
  id: number
  user_id: number
  workspace_id: string | null
  created_at: string
}

export interface BuiltAnswerPacketGraph {
  artifact: SourceArtifactV1
  passages: SourcePassageV1[]
  links: ClaimEvidenceLinkV1[]
  packet: AnswerPacketV1
  expiresAt: string | null
}

export class AnswerPacketInputError extends Error {
  constructor(message: string, readonly code = 'invalid_answer_packet') {
    super(message)
    this.name = 'AnswerPacketInputError'
  }
}

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
const STANCES = new Set<ClaimEvidenceStance>(['supports', 'contradicts', 'contextualizes'])
const STATUSES = new Set<AnswerClaimStatus>(['supported', 'disputed', 'insufficient'])
export const MAX_PROMOTION_CLAIMS = 25
export const MAX_PROMOTION_EVIDENCE = 25
export const MAX_EVIDENCE_PER_CLAIM = 10

function text(value: unknown, name: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new AnswerPacketInputError(`${name} must be a string`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new AnswerPacketInputError(`${name} must contain ${minimum}-${maximum} characters`)
  }
  return normalized
}

function score(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new AnswerPacketInputError(`${name} must be a number between 0 and 1`)
  }
  return value
}

function optionalTextList(value: unknown, name: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 50) {
    throw new AnswerPacketInputError(`${name} must be an array with at most 50 entries`)
  }
  return value.map((item, index) => text(item, `${name}[${index}]`, 1, 2_000))
}

function isoTimestamp(value: string): string {
  const parsed = Date.parse(value.endsWith('Z') || value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString()
}

async function stableArtifactId(analysisId: number, investigationId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(investigationId))
  const suffix = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32)
  return `ca:${analysisId}:${suffix}`
}

export function parseCreateAnswerPacketInput(value: unknown): CreateAnswerPacketInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AnswerPacketInputError('Request body must be a JSON object')
  }
  const body = value as Record<string, unknown>
  if (!Number.isInteger(body.analysis_id) || (body.analysis_id as number) <= 0) {
    throw new AnswerPacketInputError('analysis_id must be a positive integer')
  }
  const investigationId = text(body.investigation_id, 'investigation_id', 1, 128)
  if (!ID_PATTERN.test(investigationId)) throw new AnswerPacketInputError('investigation_id has an invalid format')
  if (!Array.isArray(body.claims) || body.claims.length < 1 || body.claims.length > MAX_PROMOTION_CLAIMS) {
    throw new AnswerPacketInputError(`claims must contain 1-${MAX_PROMOTION_CLAIMS} entries`)
  }

  const claims = body.claims.map((item, claimIndex): AnswerPacketClaimInput => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AnswerPacketInputError(`claims[${claimIndex}] must be an object`)
    }
    const claim = item as Record<string, unknown>
    if (typeof claim.status !== 'string' || !STATUSES.has(claim.status as AnswerClaimStatus)) {
      throw new AnswerPacketInputError(`claims[${claimIndex}].status is invalid`)
    }
    const evidenceValue = claim.evidence ?? []
    if (!Array.isArray(evidenceValue) || evidenceValue.length > MAX_EVIDENCE_PER_CLAIM) {
      throw new AnswerPacketInputError(`claims[${claimIndex}].evidence must contain at most ${MAX_EVIDENCE_PER_CLAIM} entries`)
    }
    const evidence = evidenceValue.map((entry, evidenceIndex): AnswerPacketEvidenceInput => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new AnswerPacketInputError(`claims[${claimIndex}].evidence[${evidenceIndex}] must be an object`)
      }
      const source = entry as Record<string, unknown>
      if (typeof source.stance !== 'string' || !STANCES.has(source.stance as ClaimEvidenceStance)) {
        throw new AnswerPacketInputError(`claims[${claimIndex}].evidence[${evidenceIndex}].stance is invalid`)
      }
      return {
        excerpt: text(source.excerpt, `claims[${claimIndex}].evidence[${evidenceIndex}].excerpt`, 1, 4_000),
        heading: source.heading === undefined ? undefined : text(source.heading, 'heading', 1, 500),
        stance: source.stance as ClaimEvidenceStance,
        relevance: score(source.relevance, 'relevance'),
        confidence: score(source.confidence, 'evidence confidence'),
        rationale: source.rationale === undefined ? undefined : text(source.rationale, 'rationale', 1, 2_000),
      }
    })
    const status = claim.status as AnswerClaimStatus
    if (status === 'insufficient' && evidence.length > 0) {
      throw new AnswerPacketInputError(`claims[${claimIndex}] cannot cite evidence when status is insufficient`)
    }
    if (status !== 'insufficient' && evidence.length === 0) {
      throw new AnswerPacketInputError(`claims[${claimIndex}] requires evidence`)
    }
    return {
      statement: text(claim.statement, `claims[${claimIndex}].statement`, 1, 5_000),
      status,
      confidence: score(claim.confidence, `claims[${claimIndex}].confidence`),
      evidence,
    }
  })
  const evidenceCount = claims.reduce((total, claim) => total + (claim.evidence?.length || 0), 0)
  if (evidenceCount > MAX_PROMOTION_EVIDENCE) {
    throw new AnswerPacketInputError(`packet evidence must contain at most ${MAX_PROMOTION_EVIDENCE} entries`)
  }

  let expiresAt: string | null | undefined
  if (body.expires_at === null) expiresAt = null
  else if (body.expires_at !== undefined) {
    if (typeof body.expires_at !== 'string' || !Number.isFinite(Date.parse(body.expires_at))) {
      throw new AnswerPacketInputError('expires_at must be an ISO timestamp or null')
    }
    expiresAt = new Date(body.expires_at).toISOString()
  }

  const questionId = body.question_id === undefined ? undefined : text(body.question_id, 'question_id', 1, 128)
  if (questionId && !ID_PATTERN.test(questionId)) throw new AnswerPacketInputError('question_id has an invalid format')
  return {
    analysis_id: body.analysis_id as number,
    investigation_id: investigationId,
    question_id: questionId,
    question: text(body.question, 'question', 3, 2_000),
    answer: text(body.answer, 'answer', 1, 50_000),
    claims,
    limitations: optionalTextList(body.limitations, 'limitations'),
    collection_gaps: optionalTextList(body.collection_gaps, 'collection_gaps'),
    expires_at: expiresAt,
  }
}

export async function buildAnswerPacketGraph(input: {
  packetId: string
  userId: number
  analysis: PromotableContentAnalysisRow
  request: CreateAnswerPacketInput
  investigationQuestionId?: string | null
  generatedAt?: string
}): Promise<BuiltAnswerPacketGraph> {
  const { packetId, userId, analysis, request } = input
  const fullText = analysis.extracted_text || ''
  if (!analysis.workspace_id) throw new AnswerPacketInputError('Analysis has no writable workspace context', 'analysis_workspace_missing')
  if (!analysis.content_hash || !/^[a-f0-9]{64}$/.test(analysis.content_hash)) {
    throw new AnswerPacketInputError('Analysis has no valid content hash', 'analysis_hash_missing')
  }
  if (!fullText.trim()) throw new AnswerPacketInputError('Analysis has no extracted source text', 'analysis_text_missing')

  const generatedAt = input.generatedAt || new Date().toISOString()
  const provenance = {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    sourceMode: 'live' as const,
    fetchStrategy: 'direct' as const,
    extractorVersion: 'legacy-content-analysis.unknown',
    quality: { version: 'legacy-content-analysis.unknown', score: 0, accepted: true },
    contentHash: analysis.content_hash,
    attempts: boundScrapeAttempts([]),
  }
  const artifact = contentAnalysisArtifact(analysis, {
    artifactId: await stableArtifactId(analysis.id, request.investigation_id),
    workspaceId: analysis.workspace_id,
    investigationId: request.investigation_id,
    observedAt: isoTimestamp(analysis.created_at),
    provenance,
  })
  const evidenceInputs = request.claims.flatMap(claim => claim.evidence || [])
  let passages: SourcePassageV1[]
  try {
    passages = await contentExcerptsToPassages(artifact.id, fullText, evidenceInputs.map(item => ({
      text: item.excerpt,
      heading: item.heading,
    })))
  } catch (error) {
    throw new AnswerPacketInputError(
      error instanceof Error ? error.message : 'Evidence excerpt is not present in the source text',
      'excerpt_not_found',
    )
  }

  let evidenceOrdinal = 0
  const links: ClaimEvidenceLinkV1[] = []
  const claims = request.claims.map((claim, claimOrdinal) => {
    const claimId = `${packetId}:claim:${claimOrdinal}`
    const evidenceLinkIds = (claim.evidence || []).map(evidence => {
      const passage = passages[evidenceOrdinal]
      if (!passage) throw new AnswerPacketInputError('Evidence passage mapping failed')
      const link: ClaimEvidenceLinkV1 = {
        schemaVersion: CLAIM_EVIDENCE_SCHEMA_VERSION,
        id: `${packetId}:link:${evidenceOrdinal}`,
        claimId,
        passageId: passage.id,
        stance: evidence.stance,
        relevance: evidence.relevance,
        confidence: evidence.confidence,
        rationale: evidence.rationale,
        linkedBy: String(userId),
        createdAt: generatedAt,
      }
      links.push(link)
      evidenceOrdinal += 1
      return link.id
    })
    return {
      id: claimId,
      statement: claim.statement,
      status: claim.status,
      confidence: claim.confidence,
      evidenceLinkIds,
    }
  })

  const fallbackQuestionId = `answer-question:${packetId}`
  const candidateQuestionId = request.question_id || input.investigationQuestionId || fallbackQuestionId
  const questionId = ID_PATTERN.test(candidateQuestionId) ? candidateQuestionId : fallbackQuestionId
  const packet: AnswerPacketV1 = {
    schemaVersion: ANSWER_PACKET_SCHEMA_VERSION,
    id: packetId,
    workspaceId: analysis.workspace_id,
    investigationId: request.investigation_id,
    questionId,
    question: request.question,
    answer: request.answer,
    claims,
    limitations: request.limitations || [],
    collectionGaps: request.collection_gaps || [],
    generatedAt,
  }
  if (!isGroundedAnswerPacket(packet, links, passages, [artifact])) {
    throw new AnswerPacketInputError('Answer Packet failed grounded-record validation')
  }
  return { artifact, passages, links, packet, expiresAt: request.expires_at ?? null }
}
