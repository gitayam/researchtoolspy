import {
  isGroundedAnswerPacket,
  type AnswerPacketV1,
  type ClaimEvidenceLinkV1,
  type SourceArtifactV1,
  type SourcePassageV1,
} from './answer-packet-contract'

export async function persistAnswerPacketGraph(
  db: D1Database,
  createdBy: number,
  graph: {
    artifact: SourceArtifactV1
    passages: readonly SourcePassageV1[]
    links: readonly ClaimEvidenceLinkV1[]
    packet: AnswerPacketV1
    expiresAt?: string | null
    legacyAttachment?: {
      contentAnalysisId?: number
      evidenceItemId?: number
      userId: number
    }
  },
): Promise<void> {
  const { artifact, passages, links, packet } = graph
  if (artifact.workspaceId !== packet.workspaceId || artifact.investigationId !== packet.investigationId
    || !isGroundedAnswerPacket(packet, links, passages, [artifact])) {
    throw new Error('Invalid or cross-scope Answer Packet graph')
  }

  const statements: D1PreparedStatement[] = [db.prepare(`
    INSERT OR IGNORE INTO source_artifacts (
      id, schema_version, workspace_id, investigation_id, kind, source_identity,
      canonical_url, final_url, object_key, title, author, published_at, observed_at,
      content_hash, content_type, language, provenance_json, created_by, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    artifact.id, artifact.schemaVersion, artifact.workspaceId, artifact.investigationId,
    artifact.kind, artifact.sourceIdentity, artifact.canonicalUrl ?? null, artifact.finalUrl ?? null,
    artifact.objectKey ?? null, artifact.title, artifact.author ?? null, artifact.publishedAt ?? null,
    artifact.observedAt, artifact.contentHash, artifact.contentType, artifact.language ?? null,
    JSON.stringify(artifact.provenance), createdBy, graph.expiresAt ?? null,
  )]

  for (const passage of passages) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO source_passages (
        id, schema_version, artifact_id, ordinal, start_offset, end_offset, text, text_hash, heading
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      passage.id, passage.schemaVersion, passage.artifactId, passage.ordinal,
      passage.startOffset, passage.endOffset, passage.text, passage.textHash, passage.heading ?? null,
    ))
  }

  for (const link of links) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO source_claim_links (
        id, schema_version, workspace_id, investigation_id, claim_id, passage_id,
        stance, relevance, confidence, rationale, linked_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      link.id, link.schemaVersion, packet.workspaceId, packet.investigationId,
      link.claimId, link.passageId, link.stance, link.relevance, link.confidence,
      link.rationale ?? null, link.linkedBy, link.createdAt,
    ))
  }

  statements.push(db.prepare(`
    INSERT OR IGNORE INTO answer_packets (
      id, schema_version, workspace_id, investigation_id, primary_artifact_id,
      question_id, question, answer, limitations_json, collection_gaps_json,
      generated_at, created_by, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    packet.id, packet.schemaVersion, packet.workspaceId, packet.investigationId,
    artifact.id, packet.questionId, packet.question, packet.answer, JSON.stringify(packet.limitations),
    JSON.stringify(packet.collectionGaps), packet.generatedAt, createdBy, graph.expiresAt ?? null,
  ))

  packet.claims.forEach((claim, ordinal) => statements.push(db.prepare(`
    INSERT OR IGNORE INTO answer_packet_claims (
      id, packet_id, statement, status, confidence, evidence_link_ids_json, ordinal
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    claim.id, packet.id, claim.statement, claim.status, claim.confidence,
    JSON.stringify(claim.evidenceLinkIds), ordinal,
  )))

  if (graph.legacyAttachment?.contentAnalysisId !== undefined) {
    statements.push(db.prepare(`
      UPDATE content_analysis SET source_artifact_id = ?
      WHERE id = ? AND user_id = ? AND workspace_id = ?
    `).bind(
      artifact.id, graph.legacyAttachment.contentAnalysisId,
      graph.legacyAttachment.userId, packet.workspaceId,
    ))
  }
  if (graph.legacyAttachment?.evidenceItemId !== undefined) {
    statements.push(db.prepare(`
      UPDATE evidence_items SET source_artifact_id = ?
      WHERE id = ? AND created_by = ? AND workspace_id = ?
    `).bind(
      artifact.id, graph.legacyAttachment.evidenceItemId,
      graph.legacyAttachment.userId, packet.workspaceId,
    ))
  }

  await db.batch(statements)
}

export async function attachSourceArtifactToLegacyRows(
  db: D1Database,
  input: { artifactId: string; contentAnalysisId?: number; evidenceItemId?: number; userId: number; workspaceId: string },
): Promise<void> {
  const statements: D1PreparedStatement[] = []
  if (input.contentAnalysisId !== undefined) {
    statements.push(db.prepare(`
      UPDATE content_analysis SET source_artifact_id = ?
      WHERE id = ? AND user_id = ? AND workspace_id = ?
    `).bind(input.artifactId, input.contentAnalysisId, input.userId, input.workspaceId))
  }
  if (input.evidenceItemId !== undefined) {
    statements.push(db.prepare(`
      UPDATE evidence_items SET source_artifact_id = ?
      WHERE id = ? AND created_by = ? AND workspace_id = ?
    `).bind(input.artifactId, input.evidenceItemId, input.userId, input.workspaceId))
  }
  if (statements.length > 0) await db.batch(statements)
}
