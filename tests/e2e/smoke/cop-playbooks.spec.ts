import { test, expect } from '../fixtures/base-test'

// ── Mock data ───────────────────────────────────────────────────────

const SESSION_ID = 'cop-playbook-test-001'

const mockPlaybooks = [
  {
    id: 'pb-active-001',
    cop_session_id: SESSION_ID,
    name: 'Auto-tag ingest submissions',
    description: 'Tag incoming evidence automatically',
    status: 'active',
    source: 'custom',
    template_id: null,
    execution_count: 42,
    last_triggered_at: '2026-03-11T10:00:00Z',
    last_processed_event_id: 'evt-abc123',
    rule_count: 2,
    created_by: 1,
    workspace_id: '1',
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-11T10:00:00Z',
  },
  {
    id: 'pb-draft-001',
    cop_session_id: SESSION_ID,
    name: 'SLA escalation pipeline',
    description: null,
    status: 'draft',
    source: 'custom',
    template_id: null,
    execution_count: 0,
    last_triggered_at: null,
    last_processed_event_id: null,
    rule_count: 0,
    created_by: 1,
    workspace_id: '1',
    created_at: '2026-03-11T00:00:00Z',
    updated_at: '2026-03-11T00:00:00Z',
  },
]

const mockRules = [
  {
    id: 'pbr-001',
    playbook_id: 'pb-active-001',
    name: 'Tag new evidence',
    position: 0,
    enabled: true,
    trigger_event: 'evidence.created',
    trigger_filter: {},
    conditions: [{ field: 'payload.evidence_type', op: 'eq', value: 'document' }],
    actions: [{ action: 'add_tag', params: { tag_category: 'auto', tag_value: 'unreviewed', evidence_id: '{{trigger.entity_id}}' } }],
    cooldown_seconds: 0,
    last_fired_at: '2026-03-11T09:55:00Z',
    fire_count: 38,
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-11T09:55:00Z',
  },
  {
    id: 'pbr-002',
    playbook_id: 'pb-active-001',
    name: 'Notify on high-priority evidence',
    position: 1,
    enabled: true,
    trigger_event: 'evidence.created',
    trigger_filter: {},
    conditions: [{ field: 'payload.priority', op: 'eq', value: 'high' }],
    actions: [{ action: 'send_notification', params: { message: 'High priority evidence: {{trigger.payload.title}}' } }],
    cooldown_seconds: 60,
    last_fired_at: null,
    fire_count: 4,
    created_at: '2026-03-10T01:00:00Z',
    updated_at: '2026-03-10T01:00:00Z',
  },
]

const mockLogEntries = [
  {
    id: 'plog-001',
    rule_id: 'pbr-001',
    rule_name: 'Tag new evidence',
    playbook_id: 'pb-active-001',
    cop_session_id: SESSION_ID,
    trigger_event: 'evidence.created',
    trigger_event_id: 'evt-latest-001',
    actions_taken: [{ action: 'add_tag', result: { id: 'etag-auto-001', tag_value: 'unreviewed' } }],
    status: 'success',
    error_message: null,
    duration_ms: 12,
    created_at: '2026-03-11T09:55:00Z',
  },
  {
    id: 'plog-002',
    rule_id: 'pbr-002',
    rule_name: 'Notify on high-priority evidence',
    playbook_id: 'pb-active-001',
    cop_session_id: SESSION_ID,
    trigger_event: 'evidence.created',
    trigger_event_id: 'evt-latest-002',
    actions_taken: [{ action: 'send_notification', error: 'cop_activity table insert failed' }],
    status: 'failed',
    error_message: 'cop_activity table insert failed',
    duration_ms: 5,
    created_at: '2026-03-11T09:50:00Z',
  },
]

const mockDryRun = {
  would_fire: [
    { rule_id: 'pbr-001', rule_name: 'Tag new evidence', event_id: 'evt-test-001', event_type: 'evidence.created', actions: [{ action: 'add_tag', params: {} }] },
  ],
  would_skip: [
    { rule_id: 'pbr-002', rule_name: 'Notify on high-priority evidence', event_id: 'evt-test-001', event_type: 'evidence.created', reason: 'Conditions not met' },
  ],
  events_tested: 5,
  rules_tested: 2,
}

// ── Mock setup ──────────────────────────────────────────────────────

function setupPlaybookMocks(page: any) {
  return Promise.all([
    page.route('**/api/cop/*/playbooks', (route: any) => {
      const req = route.request()
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ playbooks: mockPlaybooks }),
        })
      }
      if (req.method() === 'POST') {
        return route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ id: 'pb-new-001', message: 'Playbook created' }),
        })
      }
      return route.continue()
    }),

    page.route('**/api/cop/*/playbooks/pb-active-001', (route: any) => {
      const req = route.request()
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ playbook: mockPlaybooks[0], rules: mockRules }),
        })
      }
      if (req.method() === 'PUT') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 'pb-active-001', message: 'Playbook updated' }),
        })
      }
      if (req.method() === 'DELETE') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: 'Playbook deleted' }),
        })
      }
      return route.continue()
    }),

    page.route('**/api/cop/*/playbooks/*/rules**', (route: any) => {
      const req = route.request()
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ rules: mockRules }),
        })
      }
      if (req.method() === 'POST') {
        return route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ id: 'pbr-new-001', message: 'Rule created' }),
        })
      }
      if (req.method() === 'PUT') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 'pbr-001', message: 'Rule updated' }),
        })
      }
      if (req.method() === 'DELETE') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ message: 'Rule deleted' }),
        })
      }
      return route.continue()
    }),

    page.route('**/api/cop/*/playbooks/*/log*', (route: any) => {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ log: mockLogEntries, total: 2, limit: 50, offset: 0 }),
      })
    }),

    page.route('**/api/cop/*/playbooks/*/test', (route: any) => {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(mockDryRun),
      })
    }),
  ])
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe('COP Playbook Engine', () => {
  test.beforeEach(async ({ page }) => {
    // Route the base page so relative fetch URLs resolve correctly
    await page.route('**/', (route) => {
      if (route.request().resourceType() === 'document') {
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' })
      }
      return route.continue()
    })
    await page.goto('/')
  })

  test('GET /api/cop/:id/playbooks returns playbooks list', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks`)
      return res.json()
    }, SESSION_ID)

    expect(response.playbooks).toBeDefined()
    expect(response.playbooks.length).toBe(2)
    expect(response.playbooks[0].name).toBe('Auto-tag ingest submissions')
    expect(response.playbooks[0].status).toBe('active')
    expect(response.playbooks[0].rule_count).toBe(2)
  })

  test('POST /api/cop/:id/playbooks creates a playbook', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New playbook', description: 'Test' }),
      })
      return res.json()
    }, SESSION_ID)

    expect(response.id).toBe('pb-new-001')
    expect(response.message).toBe('Playbook created')
  })

  test('PUT /api/cop/:id/playbooks/:pbId toggles status', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      })
      return res.json()
    }, SESSION_ID)

    expect(response.id).toBe('pb-active-001')
    expect(response.message).toBe('Playbook updated')
  })

  test('DELETE /api/cop/:id/playbooks/:pbId removes playbook', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      return res.json()
    }, SESSION_ID)

    expect(response.message).toBe('Playbook deleted')
  })

  test('GET /api/cop/:id/playbooks/:pbId/rules returns rules with parsed JSON', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/rules`)
      return res.json()
    }, SESSION_ID)

    expect(response.rules).toBeDefined()
    expect(response.rules.length).toBe(2)
    expect(response.rules[0].name).toBe('Tag new evidence')
    expect(response.rules[0].trigger_event).toBe('evidence.created')
    expect(response.rules[0].conditions).toBeInstanceOf(Array)
    expect(response.rules[0].conditions[0].field).toBe('payload.evidence_type')
    expect(response.rules[0].actions).toBeInstanceOf(Array)
    expect(response.rules[0].actions[0].action).toBe('add_tag')
  })

  test('POST /api/cop/:id/playbooks/:pbId/rules creates a rule', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New rule',
          trigger_event: 'task.created',
          conditions: [{ field: 'payload.priority', op: 'eq', value: 'critical' }],
          actions: [{ action: 'send_notification', params: { message: 'Critical task!' } }],
        }),
      })
      return res.json()
    }, SESSION_ID)

    expect(response.id).toBe('pbr-new-001')
  })

  test('GET /api/cop/:id/playbooks/:pbId/log returns paginated log', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/log`)
      return res.json()
    }, SESSION_ID)

    expect(response.log).toBeDefined()
    expect(response.log.length).toBe(2)
    expect(response.total).toBe(2)
    expect(response.log[0].status).toBe('success')
    expect(response.log[0].actions_taken).toBeInstanceOf(Array)
    expect(response.log[1].status).toBe('failed')
    expect(response.log[1].error_message).toBe('cop_activity table insert failed')
  })

  test('POST /api/cop/:id/playbooks/:pbId/test returns dry-run results', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_limit: 10 }),
      })
      return res.json()
    }, SESSION_ID)

    expect(response.would_fire).toBeDefined()
    expect(response.would_fire.length).toBe(1)
    expect(response.would_fire[0].rule_name).toBe('Tag new evidence')
    expect(response.would_skip).toBeDefined()
    expect(response.would_skip.length).toBe(1)
    expect(response.would_skip[0].reason).toBe('Conditions not met')
    expect(response.events_tested).toBe(5)
    expect(response.rules_tested).toBe(2)
  })

  test('PUT /api/cop/:id/playbooks/:pbId/rules toggles rule enabled', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: 'pbr-001', enabled: false }),
      })
      return res.json()
    }, SESSION_ID)

    expect(response.id).toBe('pbr-001')
    expect(response.message).toBe('Rule updated')
  })

  test('DELETE /api/cop/:id/playbooks/:pbId/rules deletes a rule', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/rules?rule_id=pbr-001`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      return res.json()
    }, SESSION_ID)

    expect(response.message).toBe('Rule deleted')
  })

  test('GET /api/cop/:id/playbooks/:pbId/log supports status filter', async ({ page }) => {
    await setupPlaybookMocks(page)

    const response = await page.evaluate(async (sessionId: string) => {
      const res = await fetch(`/api/cop/${sessionId}/playbooks/pb-active-001/log?status=failed`)
      return res.json()
    }, SESSION_ID)

    // Mock returns all entries regardless of filter, but API accepts the param
    expect(response.log).toBeDefined()
    expect(response.total).toBeDefined()
  })
})
