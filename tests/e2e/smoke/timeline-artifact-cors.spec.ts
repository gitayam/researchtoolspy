import { test, expect } from '@playwright/test'
import { onRequest } from '../../../functions/api/_middleware'

test('timeline revision preflight permits conditional writes and exposes the head ETag', async () => {
  let reachedRoute = false
  const response = await onRequest({
    request: new Request('https://researchtools.net/api/timelines/timeline-test', {
      method: 'OPTIONS',
      headers: { Origin: 'https://researchtools.net', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'if-match,idempotency-key,authorization,content-type' },
    }),
    env: {},
    next: async () => { reachedRoute = true; return new Response('unexpected') },
  })
  expect(response.status).toBe(204)
  expect(reachedRoute).toBe(false)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://researchtools.net')
  expect(response.headers.get('Access-Control-Allow-Methods')?.split(/,\s*/)).toContain('PATCH')
  const headers = response.headers.get('Access-Control-Allow-Headers')?.toLowerCase().split(/,\s*/)
  expect(headers).toEqual(expect.arrayContaining(['if-match', 'idempotency-key', 'authorization', 'content-type']))
  expect(response.headers.get('Access-Control-Expose-Headers')?.toLowerCase().split(/,\s*/)).toContain('etag')
})
