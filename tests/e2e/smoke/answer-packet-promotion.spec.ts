import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

import {
  AnswerPacketInputError,
  buildAnswerPacketGraph,
  parseCreateAnswerPacketInput,
} from '../../../functions/api/_shared/answer-packet-builder'
import { isGroundedAnswerPacket } from '../../../functions/api/_shared/answer-packet-contract'

const fullText = 'The report begins. The operation started on Tuesday. Independent confirmation is pending.'
const analysis = {
  id: 42,
  user_id: 7,
  workspace_id: 'workspace-1',
  url: 'https://example.com/report#details',
  content_hash: 'c'.repeat(64),
  title: 'Operational report',
  author: 'Analyst',
  publish_date: '2026-09-03T12:00:00Z',
  is_social_media: 0,
  extracted_text: fullText,
  created_at: '2026-09-04 12:00:00',
}

function request(excerpt = 'The operation started on Tuesday.') {
  return parseCreateAnswerPacketInput({
    analysis_id: 42,
    investigation_id: 'investigation-1',
    question: 'When did the operation start?',
    answer: 'The report says it started Tuesday.',
    claims: [{
      statement: 'The operation started on Tuesday.',
      status: 'supported',
      confidence: 0.9,
      evidence: [{ excerpt, stance: 'supports', relevance: 1, confidence: 0.95 }],
    }],
    limitations: ['The source does not give a calendar date.'],
    collection_gaps: ['Find independent confirmation.'],
  })
}

test.describe('Content Intelligence Answer Packet promotion @smoke', () => {
  test('@smoke builds a grounded graph from exact stored source text', async () => {
    const graph = await buildAnswerPacketGraph({
      packetId: 'packet-1', userId: 7, analysis, request: request(),
      investigationQuestionId: 'question-1', generatedAt: '2026-09-04T13:00:00Z',
    })
    expect(graph.artifact.id).toMatch(/^ca:42:[a-f0-9]{32}$/)
    expect(graph.passages[0]).toMatchObject({
      text: 'The operation started on Tuesday.',
      startOffset: fullText.indexOf('The operation started on Tuesday.'),
    })
    expect(graph.packet.claims[0].evidenceLinkIds).toEqual([graph.links[0].id])
    expect(isGroundedAnswerPacket(graph.packet, graph.links, graph.passages, [graph.artifact])).toBe(true)
  })

  test('@smoke reuses stable artifact and passage identities across packet retries', async () => {
    const first = await buildAnswerPacketGraph({ packetId: 'packet-a', userId: 7, analysis, request: request() })
    const second = await buildAnswerPacketGraph({ packetId: 'packet-b', userId: 7, analysis, request: request() })
    expect(second.artifact.id).toBe(first.artifact.id)
    expect(second.passages[0].id).toBe(first.passages[0].id)
  })

  test('@smoke rejects generated citations that are not verbatim source passages', async () => {
    await expect(buildAnswerPacketGraph({
      packetId: 'packet-2', userId: 7, analysis,
      request: request('The operation definitely began Monday.'),
    })).rejects.toMatchObject<Partial<AnswerPacketInputError>>({ code: 'excerpt_not_found' })
  })

  test('@smoke rejects supported claims without evidence and invalid confidence', () => {
    expect(() => parseCreateAnswerPacketInput({
      analysis_id: 42, investigation_id: 'investigation-1', question: 'What happened?', answer: 'An event.',
      claims: [{ statement: 'An event happened.', status: 'supported', confidence: 1.2, evidence: [] }],
    })).toThrow(AnswerPacketInputError)
  })

  test('@smoke bounds packet write amplification', () => {
    const claims = Array.from({ length: 26 }, (_, index) => ({
      statement: `Claim ${index}`, status: 'insufficient', confidence: 0, evidence: [],
    }))
    expect(() => parseCreateAnswerPacketInput({
      analysis_id: 42, investigation_id: 'investigation-1',
      question: 'What happened?', answer: 'Collection is incomplete.', claims,
    })).toThrow('claims must contain 1-25 entries')
  })

  test('@smoke create and read endpoints enforce workspace roles and scoped records', () => {
    const create = readFileSync(new URL('../../../functions/api/answer-packets/index.ts', import.meta.url), 'utf8')
    const read = readFileSync(new URL('../../../functions/api/answer-packets/[id].ts', import.meta.url), 'utf8')
    expect(create).toContain('WHERE id = ? AND user_id = ?')
    expect(create).toContain("checkWorkspaceAccess(investigation.workspace_id, userId, context.env, 'EDITOR')")
    expect(create).toContain('investigation.workspace_id !== analysis.workspace_id')
    expect(read).toContain("checkWorkspaceAccess(packetRow.workspace_id, userId, context.env, 'VIEWER')")
    expect(read).toContain('WHERE id = ? AND workspace_id = ? AND investigation_id = ?')
  })
})
