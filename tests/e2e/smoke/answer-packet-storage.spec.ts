import { expect, test } from '@playwright/test'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

import { contentAnalysisArtifact, contentExcerptsToPassages, legacyClaimEvidenceToPassageLink } from '../../../functions/api/_shared/answer-packet-adapters'
import { boundScrapeAttempts, SCRAPE_SCHEMA_VERSION } from '../../../functions/api/_shared/scrape-contract'
import { isValidClaimEvidenceLink, isValidSourceArtifact, isValidSourcePassage } from '../../../functions/api/_shared/answer-packet-contract'

const migration = readFileSync(new URL('../../../schema/managed-migrations/0007_answer_packet_storage.sql', import.meta.url), 'utf8')
const hash = 'b'.repeat(64)
const provenance = {
  schemaVersion: SCRAPE_SCHEMA_VERSION, sourceMode: 'live' as const, fetchStrategy: 'direct' as const,
  extractorVersion: 'heuristic.v2', quality: { version: 'article-quality.v2', score: 88, accepted: true },
  contentHash: hash, attempts: boundScrapeAttempts([]),
}

test.describe('durable Answer Packet storage @smoke', () => {
  test('@smoke managed migration applies with foreign keys and additive legacy links', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE workspaces (id TEXT PRIMARY KEY);
      CREATE TABLE investigations (id TEXT PRIMARY KEY);
      CREATE TABLE content_analysis (id INTEGER PRIMARY KEY, user_id INTEGER, workspace_id TEXT);
      CREATE TABLE evidence_items (id INTEGER PRIMARY KEY, created_by INTEGER, workspace_id TEXT);
      CREATE TABLE claim_evidence_links (id TEXT PRIMARY KEY);
    `)
    db.exec(migration)
    for (const table of ['source_artifacts', 'source_passages', 'source_claim_links', 'answer_packets', 'answer_packet_claims']) {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)).toBeTruthy()
    }
    expect(db.prepare("SELECT name FROM pragma_table_info('content_analysis') WHERE name='source_artifact_id'").get()).toBeTruthy()
    expect(db.prepare("SELECT name FROM pragma_table_info('evidence_items') WHERE name='source_artifact_id'").get()).toBeTruthy()
    expect(db.prepare("SELECT name FROM pragma_table_info('claim_evidence_links') WHERE name='source_passage_id'").get()).toBeTruthy()
    expect(db.prepare("SELECT name FROM pragma_table_info('answer_packets') WHERE name='primary_artifact_id'").get()).toBeTruthy()
    db.close()
  })

  test('@smoke content analysis and exact excerpts adapt into valid lineage records', async () => {
    const artifact = contentAnalysisArtifact({
      id: 12, url: 'https://example.com/report#section', content_hash: hash,
      title: ' Report ', extracted_text: 'Before Exact passage After',
    }, { workspaceId: 'workspace-1', investigationId: 'investigation-1', observedAt: '2026-09-04T12:00:00Z', provenance })
    const passages = await contentExcerptsToPassages(artifact.id, 'Before Exact passage After', [{ text: 'Exact passage' }])
    expect(isValidSourceArtifact(artifact)).toBe(true)
    expect(passages).toHaveLength(1)
    expect(isValidSourcePassage(passages[0])).toBe(true)
    expect(passages[0]).toMatchObject({ startOffset: 7, endOffset: 20 })
  })

  test('@smoke legacy relationship vocabulary and percentage scores normalize safely', () => {
    const link = legacyClaimEvidenceToPassageLink({
      id: 'link-1', claim_adjustment_id: 'claim-1', relationship: 'provides_context',
      relevance_score: 125, confidence: -4, linked_by: 'user-7', created_at: '2026-09-04T12:00:00Z',
    }, 'passage-1')
    expect(link).toMatchObject({ stance: 'contextualizes', relevance: 1, confidence: 0 })
    expect(isValidClaimEvidenceLink(link)).toBe(true)
  })
})
