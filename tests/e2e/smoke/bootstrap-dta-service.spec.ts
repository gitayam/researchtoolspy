import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/internal/bootstrap-dta-service'

const KEY = 'bootstrap-key-that-is-only-bound-for-provisioning-00001'
const HASH_KEY = 'integration-signing-key-for-test-only-000001'

function context(header?: string, enabled = true, existing = false) {
  const statements: Array<{ sql: string; values: unknown[] }> = []
  const db = {
    prepare(sql: string) {
      const statement = { sql, values: [] as unknown[], bind(...values: unknown[]) {
        statement.values = values
        return statement
      }, async first() { return existing ? { id: 'dta_admin_portal_01' } : null } }
      statements.push(statement)
      return statement
    },
    async batch() { return [] },
  }
  return {
    context: {
      request: new Request('https://researchtools.net/api/internal/bootstrap-dta-service', {
        method: 'POST', headers: header ? { 'X-Service-Client-Bootstrap-Key': header } : {},
      }),
      env: { DB: db, INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
        SERVICE_CLIENT_BOOTSTRAP_KEY: enabled ? KEY : undefined },
    },
    statements,
  }
}

test('@smoke DTA bootstrap is inert without its temporary key and refuses the wrong key', async () => {
  expect((await onRequestPost(context(KEY, false).context as never)).status).toBe(404)
  expect((await onRequestPost(context('wrong-key').context as never)).status).toBe(403)
})

test('@smoke DTA bootstrap creates only a private, scoped, one-year service token', async () => {
  const { context: ctx, statements } = context(KEY)
  const result = await onRequestPost(ctx as never)
  expect(result.status).toBe(201)
  expect(result.headers.get('Cache-Control')).toBe('no-store')
  const body = await result.json() as { token: string; scope: string; expiresInDays: number }
  expect(body.scope).toBe('community.research.execute')
  expect(body.expiresInDays).toBe(365)
  const [, secret] = /^rt_svc_dta_admin_portal_01\.([A-Za-z0-9_-]{43})$/.exec(body.token) ?? []
  expect(secret).toBeTruthy()
  const tokenInsert = statements.find(s => s.sql.includes('INSERT INTO integration_client_tokens'))!
  const expected = createHmac('sha256', HASH_KEY)
    .update(`rt-service-token.v1\0dta_admin_portal_01\0${secret}`).digest('hex')
  expect(tokenInsert.values[2]).toBe(expected)
  expect(statements.find(s => s.sql.includes('INSERT INTO integration_clients'))?.values.slice(0, 2))
    .toEqual(['dta_admin_portal_01', 'faydta'])
  expect(statements.find(s => s.sql.includes('INSERT INTO integration_client_token_scopes'))?.values[1])
    .toBe('community.research.execute')
  expect((await onRequestPost(context(KEY, true, true).context as never)).status).toBe(409)
})
