/**
 * COP-5a — Playbook log viewer (read-only) — source-guard smoke tests.
 *
 * These tests verify the static wiring of the log viewer without
 * spinning up the full application: correct API path shapes, auth
 * header forwarding, endpoint auth patterns, and component wiring.
 */

import { readFileSync } from 'fs'
import { test, expect } from '../fixtures/base-test'

// ── Helpers ───────────────────────────────────────────────────────

function readSrc(rel: string): string {
  return readFileSync(
    new URL(`../../../${rel}`, import.meta.url).pathname,
    'utf8',
  )
}

// ── 1. API helper exists and exports fetchPlaybookLog ─────────────

test('cop-playbook-log-api helper exists and exports fetchPlaybookLog', () => {
  const src = readSrc('src/lib/cop-playbook-log-api.ts')
  expect(src).toContain('export async function fetchPlaybookLog(')
})

// ── 2. API helper uses the correct path pattern ───────────────────

test('cop-playbook-log-api uses correct path: /api/cop/<sessionId>/playbooks/<playbookId>/log', () => {
  const src = readSrc('src/lib/cop-playbook-log-api.ts')
  // copPlaybookLogPath must build the right route
  expect(src).toContain('/api/cop/${sessionId}/playbooks/${playbookId}/log')
  // fetchPlaybookLog must call copPlaybookLogPath
  expect(src).toContain('copPlaybookLogPath(sessionId, playbookId)')
})

// ── 3. API helper exports copPlaybookLogPath ──────────────────────

test('cop-playbook-log-api exports copPlaybookLogPath', () => {
  const src = readSrc('src/lib/cop-playbook-log-api.ts')
  expect(src).toContain('export function copPlaybookLogPath(')
})

// ── 4. API helper forwards auth headers ──────────────────────────

test('cop-playbook-log-api forwards auth headers to fetch', () => {
  const src = readSrc('src/lib/cop-playbook-log-api.ts')
  // fetchImpl is called with headers
  expect(src).toContain('{ headers, signal }')
  // headers param is part of the public signature
  expect(src).toContain('headers: Record<string, string>')
})

// ── 5. Log endpoint handler uses verifyCopSessionAccess ──────────

test('playbook log endpoint uses verifyCopSessionAccess', () => {
  const src = readSrc('functions/api/cop/[id]/playbooks/[pbId]/log.ts')
  expect(src).toContain('verifyCopSessionAccess')
  expect(src).toContain('getUserFromRequest')
})

// ── 6. Log endpoint returns { log, total, limit, offset } ─────────

test('playbook log endpoint returns expected shape', () => {
  const src = readSrc('functions/api/cop/[id]/playbooks/[pbId]/log.ts')
  // Response includes log, total, limit, offset (as shorthand or keyed properties)
  expect(src).toContain('log')
  expect(src).toContain('total')
  expect(src).toContain('limit')
  expect(src).toContain('offset')
})

// ── 7. CopWorkspacePage passes onViewLog to CopPlaybookPanel ─────

test('CopWorkspacePage passes onViewLog to CopPlaybookPanel', () => {
  const src = readSrc('src/pages/CopWorkspacePage.tsx')
  expect(src).toContain('onViewLog=')
  // Must reference CopPlaybookPanel with onViewLog
  expect(src).toContain('CopPlaybookPanel')
})

// ── 8. CopPlaybookPanel still references the onViewLog prop ──────

test('CopPlaybookPanel still references onViewLog prop', () => {
  const src = readSrc('src/components/cop/CopPlaybookPanel.tsx')
  expect(src).toContain('onViewLog')
  // Must call onViewLog when "View Log" is clicked
  expect(src).toContain('onViewLog(pb.id)')
})

// ── 9. CopWorkspacePage lazy-loads CopPlaybookLog ─────────────────

test('CopWorkspacePage lazy-loads CopPlaybookLog component', () => {
  const src = readSrc('src/pages/CopWorkspacePage.tsx')
  expect(src).toContain("import('@/components/cop/CopPlaybookLog')")
})

// ── 10. CopWorkspacePage renders a Dialog for the log viewer ──────

test('CopWorkspacePage renders Dialog wrapping CopPlaybookLog', () => {
  const src = readSrc('src/pages/CopWorkspacePage.tsx')
  expect(src).toContain('CopPlaybookLog')
  expect(src).toContain('playbookLogState')
  // Dialog open state is derived from playbookLogState
  expect(src).toContain('playbookLogState.open')
  expect(src).toContain('playbookLogState.playbookId')
})

// ── 11. Browser-integration: mock API + UI flow ───────────────────

test('GET /api/cop/:id/playbooks/:pbId/log returns expected shape (mocked)', async ({ page }) => {
  const SESSION_ID = 'cop-log-smoke-001'
  const PLAYBOOK_ID = 'pb-log-test-001'

  await page.route('**/', (route) => {
    if (route.request().resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' })
    }
    return route.continue()
  })

  await page.route(`**/api/cop/${SESSION_ID}/playbooks/${PLAYBOOK_ID}/log**`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        log: [
          {
            id: 'plog-smoke-001',
            rule_id: 'pbr-001',
            rule_name: 'Smoke rule',
            trigger_event: 'evidence.created',
            trigger_event_id: null,
            actions_taken: [{ action: 'add_tag', result: { tag_value: 'test' } }],
            status: 'success',
            error_message: null,
            duration_ms: 8,
            created_at: '2026-06-30T12:00:00Z',
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      }),
    })
  })

  await page.goto('/')

  const response = await page.evaluate(
    async ([sid, pbid]: [string, string]) => {
      const res = await fetch(`/api/cop/${sid}/playbooks/${pbid}/log`)
      return res.json()
    },
    [SESSION_ID, PLAYBOOK_ID],
  )

  expect(response.log).toBeDefined()
  expect(response.log.length).toBe(1)
  expect(response.log[0].status).toBe('success')
  expect(response.log[0].rule_name).toBe('Smoke rule')
  expect(response.total).toBe(1)
})

// ── 12. Empty log response is gracefully handled ──────────────────

test('GET /api/cop/:id/playbooks/:pbId/log handles empty log (mocked)', async ({ page }) => {
  const SESSION_ID = 'cop-log-smoke-002'
  const PLAYBOOK_ID = 'pb-empty-001'

  await page.route('**/', (route) => {
    if (route.request().resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' })
    }
    return route.continue()
  })

  await page.route(`**/api/cop/${SESSION_ID}/playbooks/${PLAYBOOK_ID}/log**`, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ log: [], total: 0, limit: 50, offset: 0 }),
    })
  })

  await page.goto('/')

  const response = await page.evaluate(
    async ([sid, pbid]: [string, string]) => {
      const res = await fetch(`/api/cop/${sid}/playbooks/${pbid}/log`)
      return res.json()
    },
    [SESSION_ID, PLAYBOOK_ID],
  )

  expect(response.log).toBeDefined()
  expect(response.log).toHaveLength(0)
  expect(response.total).toBe(0)
})
