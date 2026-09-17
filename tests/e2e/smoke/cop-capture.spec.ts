import { test, expect } from '@playwright/test'
import { noteTitle, parseCapture } from '../../../src/lib/cop-capture'

/**
 * Where a captured line goes.
 *
 * An analyst working a live picture types fast, in fragments, and finds out
 * afterwards where it landed. Misrouting a request for information into the
 * evidence feed is not cosmetic — it is a question nobody will answer.
 */
test.describe('COP capture routing @smoke', () => {
  test('an RFI is routed as one, at the priority its punctuation asks for', () => {
    expect(parseCapture('rfi: who controls the bridge')).toMatchObject({
      kind: 'rfi', body: 'who controls the bridge', priority: 'medium', isBlocker: false,
    })
    expect(parseCapture('rfi!: who controls the bridge')).toMatchObject({
      kind: 'rfi', priority: 'high', isBlocker: false,
    })
    // Two marks is the one that stops work, so it is also a blocker.
    expect(parseCapture('rfi!!: who controls the bridge')).toMatchObject({
      kind: 'rfi', priority: 'critical', isBlocker: true,
    })
  })

  test('prefixes tolerate the spacing and case of fast typing', () => {
    for (const raw of ['RFI: x', 'rfi:x', 'rfi : x', '  Rfi:   x  ']) {
      expect(parseCapture(raw), raw).toMatchObject({ kind: 'rfi', body: 'x' })
    }
    for (const raw of ['hyp: y', 'Hypothesis: y', 'maybe: y']) {
      expect(parseCapture(raw), raw).toMatchObject({ kind: 'hypothesis', body: 'y' })
    }
    for (const raw of ['survey: z', 'form: z', 'DROP: z']) {
      expect(parseCapture(raw), raw).toMatchObject({ kind: 'survey', body: 'z' })
    }
  })

  test('a prefix with nothing after it is not a capture', () => {
    // Half-typed, then Enter. Sending an empty RFI would put a blank question
    // in front of whoever works the queue.
    for (const raw of ['rfi:', 'rfi!!:', 'hyp:', 'note:', '   ']) {
      expect(parseCapture(raw), raw).toBeNull()
    }
    // A survey is the exception: it is a container, and an unnamed one is still
    // usable. It gets a name rather than being refused.
    expect(parseCapture('survey:')).toMatchObject({ kind: 'survey', body: 'Untitled Drop' })
  })

  test('a link is fetched, and a bare host still counts as one', () => {
    expect(parseCapture('https://example.com/report')).toMatchObject({
      kind: 'url', url: 'https://example.com/report',
    })
    expect(parseCapture('example.com/report')).toMatchObject({
      kind: 'url', url: 'https://example.com/report',
    })
  })

  test('an explicit note beats link detection', () => {
    // Filing a link without fetching it: the analyst said note, so it is a note.
    expect(parseCapture('note: https://example.com/report')).toMatchObject({
      kind: 'note', body: 'https://example.com/report',
    })
  })

  test('ordinary prose is a note, and is never mistaken for a link', () => {
    expect(parseCapture('two vehicles at the north gate, 0840')).toMatchObject({ kind: 'note' })
    expect(parseCapture('checkpoint alpha quiet')).toMatchObject({ kind: 'note' })
  })

  test('a multi-line note is titled by its first line', () => {
    const body = 'Two vehicles at the north gate\nBoth white, no plates observed\nDriver spoke to the guard'
    expect(noteTitle(body)).toBe('Two vehicles at the north gate')
  })

  test('a long first line is cut at a word, not mid-syllable', () => {
    const title = noteTitle('a'.repeat(30) + ' ' + 'b'.repeat(30) + ' ' + 'c'.repeat(40))
    expect(title.length).toBeLessThanOrEqual(81)
    expect(title.endsWith('…')).toBe(true)
    expect(title).not.toContain('cccc')
  })

  test('every captured kind carries a label the analyst sees before sending', () => {
    for (const raw of ['rfi: a', 'hyp: a', 'survey: a', 'note: a', 'https://example.com', 'plain text']) {
      const parsed = parseCapture(raw)
      expect(parsed, raw).not.toBeNull()
      expect(parsed!.label.length, raw).toBeGreaterThan(0)
    }
    // The label names the consequence, because priority is the thing most worth
    // catching before it is sent.
    expect(parseCapture('rfi!!: x')!.label).toContain('blocking')
  })
})
