import { expect, test } from '@playwright/test'
import worker from '../../../workers/browser-renderer/src/index'

type QuickAction = (action: string, input: Record<string, unknown>) => Promise<Response>

function call(body: unknown, quickAction: QuickAction) {
  return worker.fetch(
    new Request('https://browser-renderer.internal/render', { method: 'POST', body: JSON.stringify(body) }),
    { BROWSER: { quickAction } },
  )
}

const page = `<html><body>${'<p>product</p>'.repeat(30)}</body></html>`

test.describe('browser-renderer worker @smoke', () => {
  test('@smoke html mode returns the rendered DOM from the content quick action', async () => {
    const actions: Array<[string, Record<string, unknown>]> = []
    const response = await call({ url: 'https://shop.example/p/1', mode: 'html' }, async (action, input) => {
      actions.push([action, input])
      return Response.json({ success: true, result: page })
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ html: page, source: 'cloudflare-browser-run' })
    expect(actions).toHaveLength(1)
    expect(actions[0][0]).toBe('content')
    expect(actions[0][1]).toMatchObject({
      url: 'https://shop.example/p/1',
      rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'],
    })
  })

  test('@smoke markdown stays the default mode', async () => {
    const actions: string[] = []
    const response = await call({ url: 'https://shop.example/p/1' }, async action => {
      actions.push(action)
      return Response.json({ result: '# Product\n\nA long enough rendered markdown body for the check.' })
    })
    expect(response.status).toBe(200)
    expect(actions).toEqual(['markdown'])
  })

  test('@smoke bad modes, private URLs and empty renders are refused', async () => {
    const never: QuickAction = async () => { throw new Error('must not render') }
    expect((await call({ url: 'https://shop.example/p/1', mode: 'pdf' }, never)).status).toBe(400)
    expect((await call({ url: 'http://127.0.0.1/p', mode: 'html' }, never)).status).toBe(400)
    const empty = await call({ url: 'https://shop.example/p/1', mode: 'html' }, async () => Response.json({ result: '<html></html>' }))
    expect(empty.status).toBe(422)
    const failed = await call({ url: 'https://shop.example/p/1', mode: 'html' }, async () => new Response('x', { status: 500 }))
    expect(failed.status).toBe(502)
  })
})
