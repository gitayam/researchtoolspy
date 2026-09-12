import { timelineRendererShell } from '../../../scripts/timeline-renderer-shell.mjs'
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import { buildTimelineJSExport } from '../../../src/lib/timeline-timelinejs'

const root = 'public/vendor/timelinejs/3.9.13/'
const read = (path: string) => readFileSync(path, 'utf8')
const bridge = read('public/timelinejs/preview.js')
const nonce = 'bdc928fe-8cbf-4215-b5c8-e335b197aadb'
function projection() {
  return { scale: 'human', title: { text: { headline: 'Title', text: '<p>Framing</p>' }, unique_id: 'narrative-title', autolink: false }, events: [{ start_date: { year: 2026, month: 9, day: 12 }, text: { headline: '&lt;script&gt;', text: '<p>Description</p><p><strong>Assessment:</strong> Unreviewed</p>' }, unique_id: 'event-safe%3Aid', display_date: '2026-09-12', group: 'Chapter [chapter:one]', autolink: false }] }
}
function harness(options: { standalone?: boolean; hash?: string; reduced?: boolean; throws?: boolean } = {}) {
  const messages: Array<{ data: any; target: string }> = []
  const instances: Array<{ target: string; data: any; options: any }> = []
  const handlers = new Map<string, () => void>()
  const listeners = new Map<string, (event: any) => void>()
  const parent = { postMessage: (data: any, target: string) => messages.push({ data, target }) }
  const status = { textContent: 'Open a presentation', hidden: false }
  function button() {
    const callbacks = new Map<string, () => void>()
    return { disabled: true, addEventListener: (type: string, callback: () => void) => callbacks.set(type, callback), click: () => callbacks.get('click')?.() }
  }
  const controls = { hidden: true }, previous = button(), next = button(), position = { textContent: '' }
  const nodes: Record<string, any> = { 'preview-status': status, 'presentation-controls': controls, 'previous-slide': previous, 'next-slide': next, 'slide-position': position }
  const document = { getElementById: (id: string) => nodes[id], documentElement: { dataset: {} as Record<string, string> } }
  let currentId = 'narrative-title'
  let previousCalls = 0, nextCalls = 0
  class Timeline {
    constructor(target: string, data: any, config: any) {
      if (options.throws) throw new Error('Private content must not escape')
      instances.push({ target, data, options: config })
      if (config.start_at_end) currentId = data.events[data.events.length - 1].unique_id
    }
    on(type: string, handler: () => void) { handlers.set(type, handler) }
    getCurrentSlide() { return { data: { unique_id: currentId } } }
    goToPrev() { previousCalls++ }
    goToNext() { nextCalls++ }
  }
  const window: any = { parent, TL: { Timeline }, addEventListener: (type: string, handler: (event: any) => void) => listeners.set(type, handler), matchMedia: () => ({ matches: !!options.reduced }) }
  if (options.standalone) window.parent = window
  runInNewContext(bridge, { window, document, location: { hash: options.hash ?? `#${nonce}`, href: `https://research.example/timelinejs/preview.html#${nonce}` }, URL })
  const send = (data: any, source: any = parent) => listeners.get('message')?.({ data, source })
  const render = (timeline: any = projection()) => send({ type: 'timelinejs:render', nonce, timeline, theme: 'dark', startAtEnd: true })
  return { messages, instances, handlers, status, document, send, render, controls, previous, next, position,
    changeSlide: (id: string) => { currentId = id; handlers.get('change')?.() },
    navigationCalls: () => ({ previous: previousCalls, next: nextCalls }) }
}

test.describe('self-hosted TimelineJS renderer contract @smoke', () => {
  test('pinned vendor artifacts and license provenance match committed byte hashes', () => {
    const manifest = JSON.parse(read(`${root}manifest.json`))
    expect(manifest.package).toBe('@knight-lab/timelinejs')
    expect(manifest.version).toBe('3.9.13')
    expect(manifest.license).toBe('MPL-2.0')
    expect(manifest.sourceCommit).toBe('bdc928fe8cbf621575c8e335b197aadb0cfe1526')
    expect(manifest.tarballIntegrity).toBe('sha512-Bjf6LzJnfA947hUHOAfnYzPGRLZUOvXNn1za1FLyV88b/dFzxWeLA3KGpmK3oQGwx3aQRmoYPwkwcIUx6d9dqQ==')
    expect(manifest.tarballSha256).toBe('f5131f7f0dd8b06c80b44f1b00117c150329af13a26667ada03a645c6cd7f0bc')
    expect(manifest.files['timeline.js'].sha256).toBe('3d38229869a2d1d9f303626e141b02e9acd0fc972c1150bbf5b1e5655cc4d5b8')
    expect(manifest.files['timeline.css'].sha256).toBe('bf78018d195b3b47e934585b78da0c0b620868c3f29b923164dcf302235484f4')
    for (const [name, value] of Object.entries(manifest.files) as Array<[string, { bytes: number; sha256: string }]>) {
      const bytes = readFileSync(`${root}${name}`)
      expect(bytes.length).toBe(value.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(value.sha256)
    }
    expect(read(`${root}LICENSE`)).toContain('Mozilla Public License')
    expect(read(`${root}timeline.js.LICENSE.txt`)).toContain('DOMPurify')
  })

  test('shell declares restrictive CSP, local load ordering and only embedded icon fonts', () => {
    const html = read('public/timelinejs/preview.html')
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)![1]
    for (const directive of ["default-src 'none'", "style-src 'unsafe-inline'", 'font-src data:', 'img-src data:', "connect-src 'none'", "frame-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) expect(csp).toContain(directive)
    expect(csp).not.toContain('unsafe-eval')
    const scripts = [read(`${root}timeline.js`), bridge]
    const styles = [read(`${root}timeline.css`), read('public/timelinejs/preview-font.css'), read('public/timelinejs/preview.css')]
    expect(html).toBe(timelineRendererShell({ scripts, styles }))
    expect([...html.matchAll(/<script data-cfasync="false">([\s\S]*?)<\/script>/g)].map(match => match[1])).toEqual(scripts)
    expect(csp.match(/script-src ([^;]+)/)![1]).toBe(scripts.map(value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`).join(' '))
    expect(html).not.toMatch(/<(?:script|link)[^>]+(?:src|href)=/)
    const embeddedStyles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1])
    expect(embeddedStyles[0]).not.toContain('@font-face')
    expect(embeddedStyles[1]).toContain('base64,')
    expect(html).toContain('id="presentation-controls" aria-label="Presentation controls" hidden')
    expect(html).toContain('content="no-referrer"')
    const manifest = JSON.parse(read(`${root}manifest.json`)), css = read('public/timelinejs/preview-font.css')
    expect(createHash('sha256').update(css).digest('hex')).toBe(manifest.iconFont.localFileSha256)
    const encoded = css.match(/base64,([A-Za-z0-9+/=]+)/)![1], bytes = Buffer.from(encoded, 'base64')
    expect(bytes.length).toBe(manifest.iconFont.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.iconFont.sha256)
    expect(css).not.toMatch(/https?:\/\//)
    expect(read('public/timelinejs/preview.css')).toContain('prefers-reduced-motion')
    const rootPolicy = read('public/_headers').match(/Content-Security-Policy:\s*([^\n]+)/)![1]
    expect(rootPolicy.match(/(?:^|;)\s*frame-src\s+([^;]+)/)![1].trim()).toBe("'self'")
    expect(rootPolicy.match(/(?:^|;)\s*font-src\s+([^;]+)/)![1].trim().split(/\s+/)).toContain('data:')
  })

  test('direct or invalid-nonce shells stay explanatory; messages require parent and nonce', () => {
    for (const options of [{ standalone: true }, { hash: '' }, { hash: '#not-a-uuid' }]) {
      const frame = harness(options)
      expect(frame.messages).toEqual([])
      frame.render()
      expect(frame.instances).toEqual([])
    }
    const frame = harness()
    expect(frame.messages).toEqual([{ data: { type: 'timelinejs:ready', nonce }, target: '*' }])
    frame.send({ type: 'timelinejs:render', nonce, timeline: projection(), theme: 'light', startAtEnd: false }, {})
    frame.send({ type: 'timelinejs:render', nonce: 'wrong', timeline: projection(), theme: 'light', startAtEnd: false })
    expect(frame.instances).toEqual([])
    expect(frame.messages).toHaveLength(1)
  })

  test('one whitelisted cloned projection uses local, quiet and reduced-motion options', () => {
    const frame = harness({ reduced: true }), data = projection(), original = JSON.stringify(data)
    frame.render(data)
    expect(frame.instances).toHaveLength(1)
    expect(frame.document.documentElement.dataset.theme).toBe('dark')
    const instance = frame.instances[0]
    expect(instance.target).toBe('timeline')
    expect(JSON.parse(JSON.stringify(instance.data))).toEqual(JSON.parse(original))
    expect(instance.data).not.toBe(data)
    expect(instance.data.events[0].start_date).not.toBe(data.events[0].start_date)
    expect(instance.options).toMatchObject({ script_path: 'https://research.example/vendor/timelinejs/3.9.13/', font: null, theme: null, language: 'en', ga_measurement_id: null, ga_property_id: null, track_events: [], hash_bookmark: false, soundcite: false, start_at_end: true, duration: 0, timenav_height_min: 90, timenav_mobile_height_percentage: 30, slide_padding_lr: 24 })
    instance.data.events[0].text.headline = 'Renderer mutation'
    expect(JSON.stringify(data)).toBe(original)
    frame.render()
    expect(frame.instances).toHaveLength(1)
    frame.handlers.get('loaded')!()
    expect(frame.status.hidden).toBe(true)
    expect(frame.messages[1]).toEqual({ data: { type: 'timelinejs:loaded', nonce }, target: '*' })
    frame.handlers.get('loaded')!()
    expect(frame.messages).toHaveLength(2)
    expect(frame.controls.hidden).toBe(false)
    expect(frame.position.textContent).toBe('Slide 2 of 2')
    expect(frame.previous.disabled).toBe(false)
    expect(frame.next.disabled).toBe(true)
    frame.previous.click(); frame.next.click()
    expect(frame.navigationCalls()).toEqual({ previous: 1, next: 0 })
    frame.changeSlide('narrative-title')
    expect(frame.position.textContent).toBe('Slide 1 of 2')
    expect(frame.previous.disabled).toBe(true)
    expect(frame.next.disabled).toBe(false)
    frame.previous.click(); frame.next.click()
    expect(frame.navigationCalls()).toEqual({ previous: 1, next: 1 })
    const snapshot = decodeTimelineWorkspace(JSON.stringify({
      schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-12T00:00:00Z',
      source: { schemaVersion: 'timeline-manual.v1', title: 'Fixture' },
      analystWorkspace: {
        mode: 'basic', questions: [], hypotheses: [],
        narrative: { title: '"'.repeat(10000), framing: '', question: '', intendedUse: '', scope: '', timezone: '', dataThrough: '', chapters: [] },
        events: [{ id: 'event:one', title: '"'.repeat(1000), description: null, eventDate: '2026-09-12', datePrecision: 'day', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false, narrativeIncluded: true }]
      }
    }))
    const boundary = buildTimelineJSExport(snapshot).timeline
    expect(boundary.title.text.headline).toHaveLength(60000)
    expect(boundary.events[0].text.headline).toHaveLength(6000)
    const maxTitle = harness(); maxTitle.render(boundary)
    expect(maxTitle.instances).toHaveLength(1)
    const tooLongTitle = structuredClone(boundary); tooLongTitle.title.text.headline += 'x'
    const rejectedTitle = harness(); rejectedTitle.render(tooLongTitle)
    expect(rejectedTitle.instances).toHaveLength(0)
    expect(rejectedTitle.messages[1].data.type).toBe('timelinejs:error')
    const tooLongEvent = structuredClone(boundary); tooLongEvent.events[0].text.headline += 'x'
    const rejectedEvent = harness(); rejectedEvent.render(tooLongEvent)
    expect(rejectedEvent.instances).toHaveLength(0)
  })

  test('rejects URLs, extra payload structures, invalid dates/IDs, unsafe markup and oversized event sets', () => {
    const changes: Array<(value: any) => void> = [
      value => { value.media = { url: 'https://external.example/' } },
      value => { value.title.background = 'https://external.example/' },
      value => { value.events[0].media = { url: 'https://external.example/' } },
      value => { value.events[0].text.headline = '<img src=x onerror=alert(1)>' },
      value => { value.events[0].text.text = '<a href="https://external.example/">Link</a>' },
      value => { value.events[0].text.text = '<p onclick="alert(1)">Text</p>' },
      value => { value.events[0].autolink = true },
      value => { value.events[0].start_date = { year: 2026, month: 2, day: 29 } },
      value => { value.events[0].start_date = { year: 2026, month: 9, hour: 12, minute: 0 } },
      value => { value.events[0].start_date = { year: 2026, month: 9, day: 12, hour: 24, minute: 0 } },
      value => { value.events[0].start_date.year = '2026' },
      value => { value.events[0].unique_id = 'event-bad%2Fid' },
      value => { value.events.push(structuredClone(value.events[0])) },
      value => { value.events = [] },
      value => { value.events = Array.from({ length: 101 }, (_, index) => ({ ...value.events[0], unique_id: `event-${index}` })) },
      value => { value.title.text.headline = 'x'.repeat(60001) },
      value => { value.events[0].text.text = 123 },
    ]
    for (const mutate of changes) {
      const frame = harness(), value = projection(); mutate(value); frame.render(value)
      expect(frame.instances).toEqual([])
      expect(frame.messages[1]).toEqual({ data: { type: 'timelinejs:error', nonce }, target: '*' })
    }
    const urlFrame = harness(); urlFrame.render('https://external.example/data.json')
    expect(urlFrame.instances).toEqual([])
    expect(urlFrame.messages[1].data.type).toBe('timelinejs:error')
  })

  test('runtime failures expose only a protocol error and valid partial dates remain intact', () => {
    const broken = harness({ throws: true }); broken.render()
    expect(broken.messages[1]).toEqual({ data: { type: 'timelinejs:error', nonce }, target: '*' })
    expect(broken.status.textContent).not.toContain('Private content')
    const frame = harness(), data: any = projection()
    data.events = [{ ...data.events[0], start_date: { year: 2026 } }, { ...data.events[0], unique_id: 'event-month', start_date: { year: 2026, month: 9 } }]
    frame.send({ type: 'timelinejs:render', nonce, timeline: data, theme: 'light', startAtEnd: false })
    expect(frame.instances[0].data.events.map((item: any) => item.start_date)).toEqual([{ year: 2026 }, { year: 2026, month: 9 }])
    expect(frame.instances[0].options.duration).toBe(1000)
    expect(frame.instances[0].options.start_at_end).toBe(false)
    frame.handlers.get('error')!()
    expect(frame.messages[1].data).toEqual({ type: 'timelinejs:error', nonce })
    expect(frame.status.hidden).toBe(false)
    const ordered = harness(), reordered: any = projection()
    reordered.events = [
      { ...reordered.events[0], unique_id: 'event-october', start_date: { year: 2026, month: 10 } },
      { ...reordered.events[0], unique_id: 'event-year', start_date: { year: 2026 } },
      { ...reordered.events[0], unique_id: 'event-february', start_date: { year: 2026, month: 2 } },
    ]
    ordered.send({ type: 'timelinejs:render', nonce, timeline: reordered, theme: 'light', startAtEnd: false })
    expect(ordered.controls.hidden).toBe(true)
    ordered.handlers.get('loaded')!()
    expect(ordered.position.textContent).toBe('Slide 1 of 4')
    ordered.changeSlide('event-year')
    expect(ordered.position.textContent).toBe('Slide 2 of 4')
    ordered.changeSlide('event-february')
    expect(ordered.position.textContent).toBe('Slide 3 of 4')
    expect(ordered.previous.disabled).toBe(false)
    expect(ordered.next.disabled).toBe(false)
    ordered.changeSlide('event-october')
    expect(ordered.position.textContent).toBe('Slide 4 of 4')
    expect(ordered.next.disabled).toBe(true)
  })
})
