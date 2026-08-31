import { expect, test } from '@playwright/test'
import { extractionFailureLog } from '../../../functions/api/content-intelligence/_extraction-log'

const RAW_URL = 'https://secret.example/private/path?token=do-not-log'
const FIXED_CORRELATION = '018f6d5e-4d58-7ef0-8d12-a4e3aee55301'

function assertForbiddenValuesAbsent(value: unknown): void {
  const serialized = JSON.stringify(value)
  for (const forbidden of [
    RAW_URL,
    'secret.example',
    '/private/path',
    'token=do-not-log',
    'workspace-sensitive-42',
    'user-123',
    'upstream body contained private customer material',
  ]) {
    expect(serialized).not.toContain(forbidden)
  }

  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object') return
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      expect(key).not.toMatch(/^(url|host|query|reason|message_detail|user|workspace)$/i)
      visit(child)
    }
  }
  visit(value)
}

test.describe('Extraction-failure event-log payload @smoke', () => {
  test('@smoke omits URL/domain identifiers when the dedicated key is absent', async () => {
    const entry = await extractionFailureLog({
      url: RAW_URL,
      errorCode: 'timeout',
      tenantScope: 'workspace-sensitive-42',
      correlationId: FIXED_CORRELATION,
    })

    expect(entry).toEqual({
      level: 'warn',
      source: 'content-intelligence/analyze-url',
      message: 'URL extraction failed',
      context: {
        correlation_id: FIXED_CORRELATION,
        error_code: 'timeout',
      },
    })
    assertForbiddenValuesAbsent(entry.context)
  })

  test('@smoke emits only keyed opaque correlation, URL, and domain identifiers with the dedicated key', async () => {
    const entry = await extractionFailureLog({
      url: RAW_URL,
      errorCode: 'dns_denied',
      tenantScope: 'workspace-sensitive-42',
      telemetryKey: 'dedicated-scrape-telemetry-key',
      correlationId: FIXED_CORRELATION,
    })

    expect(entry.context).toEqual({
      correlation_id: expect.stringMatching(/^[a-f0-9]{64}$/),
      error_code: 'dns_denied',
      url_id: expect.stringMatching(/^[a-f0-9]{64}$/),
      domain_id: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(new Set([
      entry.context.correlation_id,
      entry.context.url_id,
      entry.context.domain_id,
    ]).size).toBe(3)
    assertForbiddenValuesAbsent(entry.context)
  })

  test('@smoke malformed URLs fail closed to random correlation without raw details', async () => {
    const entry = await extractionFailureLog({
      url: 'not a URL containing secret.example',
      errorCode: 'policy_denied',
      tenantScope: 'user-123',
      telemetryKey: 'dedicated-scrape-telemetry-key',
    })

    expect(entry.context.correlation_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(entry.context.url_id).toBeUndefined()
    expect(entry.context.domain_id).toBeUndefined()
    assertForbiddenValuesAbsent(entry.context)
  })
})
