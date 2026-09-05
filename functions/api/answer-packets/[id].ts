import type { PagesFunction } from '@cloudflare/workers-types'

import { requireAuth } from '../_shared/auth-helpers'
import type { AnswerPacketV1, ClaimEvidenceLinkV1, SourceArtifactV1, SourcePassageV1 } from '../_shared/answer-packet-contract'
import { isGroundedAnswerPacket } from '../_shared/answer-packet-contract'
import { JSON_HEADERS, optionsResponse, safeJsonParse } from '../_shared/api-utils'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface PacketRow {
  id: string
  schema_version: 'answer-packet.v1'
  workspace_id: string
  investigation_id: string
  primary_artifact_id: string
  question_id: string
  question: string
  answer: string
  limitations_json: string
  collection_gaps_json: string
  generated_at: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',')
}

function chunks<T>(values: readonly T[], size = 80): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

export const onRequestGet: PagesFunction<Env, 'id'> = async context => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const packetRow = await context.env.DB.prepare(`
      SELECT id, schema_version, workspace_id, investigation_id, primary_artifact_id,
        question_id, question, answer, limitations_json, collection_gaps_json, generated_at
      FROM answer_packets WHERE id = ?
    `).bind(context.params.id).first<PacketRow>()
    if (!packetRow) return json({ error: 'Answer Packet not found' }, 404)
    if (!await checkWorkspaceAccess(packetRow.workspace_id, userId, context.env, 'VIEWER')) {
      return json({ error: 'Access denied to Answer Packet workspace' }, 403)
    }

    const claimRows = await context.env.DB.prepare(`
      SELECT id, statement, status, confidence, evidence_link_ids_json, ordinal
      FROM answer_packet_claims WHERE packet_id = ? ORDER BY ordinal
    `).bind(packetRow.id).all()
    const claims = (claimRows.results || []).map(row => ({
      id: String(row.id),
      statement: String(row.statement),
      status: row.status as AnswerPacketV1['claims'][number]['status'],
      confidence: Number(row.confidence),
      evidenceLinkIds: safeJsonParse(row.evidence_link_ids_json, []) as string[],
    }))
    const linkIds = claims.flatMap(claim => claim.evidenceLinkIds)
    const linkRows = (await Promise.all(chunks(linkIds).map(async ids => {
      const result = await context.env.DB.prepare(`
        SELECT id, schema_version, claim_id, passage_id, stance, relevance,
          confidence, rationale, linked_by, created_at
        FROM source_claim_links
        WHERE workspace_id = ? AND investigation_id = ?
          AND id IN (${placeholders(ids.length)})
      `).bind(packetRow.workspace_id, packetRow.investigation_id, ...ids).all()
      return result.results || []
    }))).flat()
    const links: ClaimEvidenceLinkV1[] = linkRows.map(row => ({
      schemaVersion: row.schema_version as 'claim-evidence.v1',
      id: String(row.id), claimId: String(row.claim_id), passageId: String(row.passage_id),
      stance: row.stance as ClaimEvidenceLinkV1['stance'], relevance: Number(row.relevance),
      confidence: Number(row.confidence), rationale: row.rationale ? String(row.rationale) : undefined,
      linkedBy: String(row.linked_by), createdAt: String(row.created_at),
    }))
    const passageIds = [...new Set(links.map(link => link.passageId))]
    const passageRows = (await Promise.all(chunks(passageIds).map(async ids => {
      const result = await context.env.DB.prepare(`
        SELECT id, schema_version, artifact_id, ordinal, start_offset, end_offset,
          text, text_hash, heading
        FROM source_passages WHERE id IN (${placeholders(ids.length)})
      `).bind(...ids).all()
      return result.results || []
    }))).flat()
    const passages: SourcePassageV1[] = passageRows.map(row => ({
      schemaVersion: row.schema_version as 'source-passage.v1', id: String(row.id),
      artifactId: String(row.artifact_id), ordinal: Number(row.ordinal),
      startOffset: Number(row.start_offset), endOffset: Number(row.end_offset),
      text: String(row.text), textHash: String(row.text_hash),
      heading: row.heading ? String(row.heading) : undefined,
    }))
    const artifactRow = await context.env.DB.prepare(`
      SELECT id, schema_version, workspace_id, investigation_id, kind, source_identity,
        canonical_url, final_url, object_key, title, author, published_at, observed_at,
        content_hash, content_type, language, provenance_json
      FROM source_artifacts
      WHERE id = ? AND workspace_id = ? AND investigation_id = ?
    `).bind(packetRow.primary_artifact_id, packetRow.workspace_id, packetRow.investigation_id).first()
    if (!artifactRow) return json({ error: 'Answer Packet source artifact is missing' }, 409)
    const artifact: SourceArtifactV1 = {
      schemaVersion: artifactRow.schema_version as 'source-artifact.v1', id: String(artifactRow.id),
      workspaceId: String(artifactRow.workspace_id), investigationId: String(artifactRow.investigation_id),
      kind: artifactRow.kind as SourceArtifactV1['kind'], sourceIdentity: String(artifactRow.source_identity),
      canonicalUrl: artifactRow.canonical_url ? String(artifactRow.canonical_url) : undefined,
      finalUrl: artifactRow.final_url ? String(artifactRow.final_url) : undefined,
      objectKey: artifactRow.object_key ? String(artifactRow.object_key) : undefined,
      title: String(artifactRow.title), author: artifactRow.author ? String(artifactRow.author) : undefined,
      publishedAt: artifactRow.published_at ? String(artifactRow.published_at) : undefined,
      observedAt: String(artifactRow.observed_at), contentHash: String(artifactRow.content_hash),
      contentType: String(artifactRow.content_type), language: artifactRow.language ? String(artifactRow.language) : undefined,
      provenance: safeJsonParse(artifactRow.provenance_json, null),
    }
    const packet: AnswerPacketV1 = {
      schemaVersion: packetRow.schema_version, id: packetRow.id,
      workspaceId: packetRow.workspace_id, investigationId: packetRow.investigation_id,
      questionId: packetRow.question_id, question: packetRow.question, answer: packetRow.answer,
      claims, limitations: safeJsonParse(packetRow.limitations_json, []),
      collectionGaps: safeJsonParse(packetRow.collection_gaps_json, []), generatedAt: packetRow.generated_at,
    }
    if (!isGroundedAnswerPacket(packet, links, passages, [artifact])) {
      return json({ error: 'Answer Packet evidence graph failed integrity validation' }, 409)
    }
    return json({ packet, artifact, passages, links })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Answer Packets] Read failed:', error)
    return json({ error: 'Failed to read Answer Packet' }, 500)
  }
}

export const onRequestOptions: PagesFunction = async () => optionsResponse()
