/**
 * Executable D1 contract tests for routes that had drifted from the live schema.
 *
 * These use the real Pages handlers against in-memory D1 so nonexistent columns,
 * ownership type mismatches, and partial packet writes fail the test.
 */
import { test, expect } from '@playwright/test'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { onRequest as handleDatasets } from '../../../functions/api/datasets'
import { onRequestPost as handleCreatePacket } from '../../../functions/api/investigation-packets/create'
import { onRequestGet as handleListPackets } from '../../../functions/api/investigation-packets/list'
import { onRequestPost as handleAddPacketContent } from '../../../functions/api/investigation-packets/add-content/[id]'
import { onRequestGet as handlePacketDetail } from '../../../functions/api/investigation-packets/[id]'
import { executeAction } from '../../../functions/api/_shared/playbook-engine/action-executor'
import { requireAuth } from '../../../functions/api/_shared/auth-helpers'

const USER_HASH = 'schema-contract-test-hash-0001'
const WORKSPACE_ID = 'workspace-contract'

const SCHEMA = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    user_hash TEXT UNIQUE
  );

  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    owner_id INTEGER,
    is_public INTEGER DEFAULT 0
  );

  CREATE TABLE workspace_members (
    workspace_id TEXT,
    user_id INTEGER,
    role TEXT
  );

  CREATE TABLE datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    source TEXT NOT NULL,
    tags TEXT,
    metadata TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    source_name TEXT,
    source_url TEXT,
    author TEXT,
    organization TEXT,
    publication_date TEXT,
    access_date TEXT,
    reliability_rating TEXT,
    is_public INTEGER DEFAULT 0,
    shared_by_user_id INTEGER
  );

  CREATE TABLE investigation_packets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    investigation_type TEXT,
    priority TEXT,
    status TEXT,
    lead_investigator TEXT,
    assigned_team TEXT,
    deadline TEXT,
    tags TEXT,
    category TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    is_public INTEGER DEFAULT 0,
    share_token TEXT
  );

  CREATE TABLE investigation_activity_log (
    id TEXT PRIMARY KEY,
    packet_id TEXT NOT NULL,
    claim_adjustment_id TEXT,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE content_analysis (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    workspace_id TEXT,
    url TEXT,
    title TEXT,
    publication_date TEXT,
    processed_at TEXT
  );

  CREATE TABLE claim_adjustments (
    id TEXT PRIMARY KEY,
    content_analysis_id INTEGER NOT NULL,
    claim_index INTEGER NOT NULL,
    claim_text TEXT NOT NULL,
    claim_category TEXT,
    original_risk_score INTEGER NOT NULL,
    original_overall_risk TEXT NOT NULL,
    adjusted_risk_score INTEGER,
    user_comment TEXT,
    verification_status TEXT,
    adjusted_by TEXT NOT NULL,
    workspace_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE packet_claims (
    id TEXT PRIMARY KEY,
    packet_id TEXT NOT NULL,
    claim_adjustment_id TEXT NOT NULL,
    priority TEXT,
    order_num INTEGER,
    investigation_notes TEXT,
    assigned_to TEXT,
    verification_status TEXT,
    verification_confidence INTEGER,
    final_conclusion TEXT,
    added_at TEXT NOT NULL,
    status_updated_at TEXT
  );

  CREATE TABLE claim_evidence_links (
    id TEXT PRIMARY KEY,
    claim_adjustment_id TEXT NOT NULL
  );

  CREATE TABLE claim_entity_mentions (
    id TEXT PRIMARY KEY,
    claim_adjustment_id TEXT NOT NULL
  );

  CREATE TABLE cop_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL
  );

  CREATE TABLE cop_tasks (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT,
    title TEXT,
    description TEXT,
    status TEXT,
    priority TEXT,
    task_type TEXT,
    assigned_to TEXT,
    created_by INTEGER,
    workspace_id TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE evidence_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    source_url TEXT,
    evidence_type TEXT,
    credibility TEXT,
    reliability TEXT,
    confidence_level TEXT,
    status TEXT,
    metadata TEXT,
    created_by INTEGER,
    workspace_id TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE cop_activity (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    user_id INTEGER,
    action TEXT NOT NULL,
    summary TEXT,
    details TEXT,
    created_at TEXT
  );

  INSERT INTO users (id, user_hash) VALUES (42, '${USER_HASH}');
  INSERT INTO workspaces (id, owner_id, is_public) VALUES ('${WORKSPACE_ID}', 42, 0);
  INSERT INTO cop_sessions (id, workspace_id) VALUES ('cop-contract', '${WORKSPACE_ID}');
`

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://researchtools.net${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Hash': USER_HASH,
      'X-Workspace-ID': WORKSPACE_ID,
      ...init.headers,
    },
  })
}

async function executeSql(db: D1Database, sql: string) {
  const executableSql = sql.replace(/^--.*$/gm, '')
  for (const statement of executableSql.split(';').map((value) => value.trim()).filter(Boolean)) {
    await db.prepare(statement).run()
  }
}

test.describe('reconciled live-schema contracts @smoke', () => {
  test('@smoke datasets, packets, and playbook actions execute against canonical D1 columns', async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: { DB: 'schema-contract-reconciliation-test' },
    })

    try {
      const db = await mf.getD1Database('DB')
      await executeSql(db, SCHEMA)

      const createDataset = await handleDatasets({
        request: request('/api/datasets', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Canonical dataset',
            type: 'article',
            source_name: 'Example source',
            source_url: 'https://example.com/report',
            tags: ['verified'],
            sats_evaluation: { score: 4 },
            key_points: ['One'],
            contradictions: ['Two'],
            version: 3,
          }),
        }),
        env: { DB: db },
      })
      expect(createDataset.status).toBe(201)
      const datasetId = ((await createDataset.json()) as { id: number }).id

      const getDataset = await handleDatasets({
        request: request(`/api/datasets?id=${datasetId}`),
        env: { DB: db },
      })
      expect(getDataset.status).toBe(200)
      expect(await getDataset.json()).toMatchObject({
        id: datasetId,
        source_name: 'Example source',
        key_points: ['One'],
        contradictions: ['Two'],
        version: 3,
        sats_evaluation: { score: 4 },
      })

      const updateDataset = await handleDatasets({
        request: request(`/api/datasets?id=${datasetId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: 'Canonical dataset updated',
            description: 'Basic field edit',
            content: '',
            type: 'article',
            status: 'verified',
            source_name: 'Example source',
            source_url: 'https://example.com/report',
            tags: ['verified'],
          }),
        }),
        env: { DB: db },
      })
      expect(updateDataset.status).toBe(200)
      const preservedDataset = await handleDatasets({
        request: request(`/api/datasets?id=${datasetId}`),
        env: { DB: db },
      })
      expect(await preservedDataset.json()).toMatchObject({
        title: 'Canonical dataset updated',
        key_points: ['One'],
        contradictions: ['Two'],
        version: 3,
        sats_evaluation: { score: 4 },
      })

      const invalidDataset = await handleDatasets({
        request: request('/api/datasets', {
          method: 'POST',
          body: JSON.stringify({ title: 'Missing type' }),
        }),
        env: { DB: db },
      })
      expect(invalidDataset.status).toBe(400)

      const createPacket = await handleCreatePacket({
        request: request('/api/investigation-packets/create', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Contract packet',
            priority: 'high',
            tags: ['contract'],
          }),
        }),
        env: { DB: db },
      } as any)
      expect(createPacket.status).toBe(200)
      const packetId = ((await createPacket.json()) as { packet: { id: string } }).packet.id
      const storedPacketOwner = await db.prepare(
        'SELECT user_id FROM investigation_packets WHERE id = ?',
      ).bind(packetId).first<{ user_id: string }>()
      expect(Number(storedPacketOwner?.user_id)).toBe(42)

      const auditAfterCreate = await db.prepare(
        'SELECT COUNT(*) as count FROM investigation_activity_log WHERE packet_id = ?',
      ).bind(packetId).first<{ count: number }>()
      expect(auditAfterCreate?.count).toBe(1)
      expect(await requireAuth(request('/auth-check'), { DB: db })).toBe(42)

      await db.prepare(`
        INSERT INTO content_analysis (
          id, user_id, workspace_id, url, title, publication_date, processed_at
        ) VALUES (7, 42, ?, 'https://example.com/item', 'Analyzed item', '2026-07-20', '2026-07-21')
      `).bind(WORKSPACE_ID).run()
      await db.batch([
        db.prepare(`
          INSERT INTO claim_adjustments (
            id, content_analysis_id, claim_index, claim_text,
            original_risk_score, original_overall_risk,
            verification_status, adjusted_by, workspace_id, created_at, updated_at
          ) VALUES ('claim-1', 7, 0, 'First claim', 60, 'medium', 'pending', '42', ?, 'now', 'now')
        `).bind(WORKSPACE_ID),
        db.prepare(`
          INSERT INTO claim_adjustments (
            id, content_analysis_id, claim_index, claim_text,
            original_risk_score, original_overall_risk,
            verification_status, adjusted_by, workspace_id, created_at, updated_at
          ) VALUES ('claim-2', 7, 1, 'Second claim', 80, 'high', 'pending', '42', ?, 'now', 'now')
        `).bind(WORKSPACE_ID),
      ])

      const addContent = await handleAddPacketContent({
        request: request(`/api/investigation-packets/add-content/${packetId}`, {
          method: 'POST',
          body: JSON.stringify({ content_analysis_id: 7, notes: 'Review both claims' }),
        }),
        env: { DB: db },
        params: { id: packetId },
      } as any)
      const addContentBody = await addContent.json()
      expect(addContent.status, JSON.stringify(addContentBody)).toBe(200)
      expect(addContentBody).toMatchObject({ success: true, claims_added: 2 })

      const listPackets = await handleListPackets({
        request: request('/api/investigation-packets/list'),
        env: { DB: db },
      } as any)
      expect(listPackets.status).toBe(200)
      expect(await listPackets.json()).toMatchObject({
        packets: [{ id: packetId, content_count: 1, claim_count: 2 }],
      })

      const packetDetail = await handlePacketDetail({
        request: request(`/api/investigation-packets/${packetId}`),
        env: { DB: db },
        params: { id: packetId },
      } as any)
      expect(packetDetail.status).toBe(200)
      expect(await packetDetail.json()).toMatchObject({
        statistics: { total_content: 1, total_claims: 2 },
        content: [{ content_analysis_id: 7, claim_count: 2 }],
      })

      expect(await executeAction(
        db,
        'cop-contract',
        'create_task',
        { title: 'Workspace-safe task' },
        42,
      )).toMatchObject({ title: 'Workspace-safe task' })
      expect(await db.prepare('SELECT workspace_id FROM cop_tasks').first())
        .toMatchObject({ workspace_id: WORKSPACE_ID })

      expect(await executeAction(
        db,
        'cop-contract',
        'create_evidence',
        { title: 'Playbook evidence', content: 'Canonical columns' },
        42,
      )).toHaveProperty('id')
      expect(await db.prepare('SELECT workspace_id, metadata FROM evidence_items').first())
        .toMatchObject({ workspace_id: WORKSPACE_ID })

      expect(await executeAction(
        db,
        'cop-contract',
        'send_notification',
        { message: 'Canonical activity' },
        42,
      )).toHaveProperty('id')
      expect(await db.prepare('SELECT action, summary FROM cop_activity').first())
        .toMatchObject({ action: 'playbook_notification', summary: 'Canonical activity' })
    } finally {
      await mf.dispose()
    }
  })
})
