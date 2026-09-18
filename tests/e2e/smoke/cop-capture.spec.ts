import { test, expect } from '@playwright/test'
import { noteTitle, parseCapture, HYPOTHESIS_CONFIDENCE, MARKER_CONFIDENCE, PANEL_FOR_KIND, PANEL_LABEL_FOR_KIND } from '../../../src/lib/cop-capture'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

  test('a named area of interest carries its location and its name', () => {
    expect(parseCapture('nai: 34.05,-118.24 North bridge crossing')).toMatchObject({
      kind: 'nai', location: '34.05,-118.24', body: 'North bridge crossing',
    })
    // MGRS is how a lot of this is actually written down.
    expect(parseCapture('nai: 18SUJ23480647 Bridge')).toMatchObject({
      kind: 'nai', location: '18SUJ23480647', body: 'Bridge',
    })
    // A map link pasted straight from a phone.
    expect(parseCapture('nai: https://maps.google.com/?q=34.05,-118.24 Ridge')).toMatchObject({
      kind: 'nai', body: 'Ridge',
    })
    expect(parseCapture('aoi: 34.05,-118.24 Ridge')).toMatchObject({ kind: 'nai' })
  })

  test('a named area with no area says so before it is sent', () => {
    // An NAI without coordinates is not one. Refusing at the endpoint would tell
    // the analyst after they had moved on to the next entry.
    const parsed = parseCapture('nai: somewhere near the north bridge')
    expect(parsed).toMatchObject({ kind: 'nai' })
    expect(parsed!.problem).toContain('Start with a location')
  })

  test('an unnamed area falls back to its coordinates for a name', () => {
    expect(parseCapture('nai: 34.05,-118.24')).toMatchObject({
      kind: 'nai', location: '34.05,-118.24', body: '34.05,-118.24',
    })
  })

  test('tasks take the same priority punctuation as RFIs', () => {
    // A convention that works in one place and not the next is worse than none.
    expect(parseCapture('task: confirm bridge status')).toMatchObject({ kind: 'task', priority: 'medium' })
    expect(parseCapture('task!: confirm bridge status')).toMatchObject({ kind: 'task', priority: 'high' })
    expect(parseCapture('task!!: confirm bridge status')).toMatchObject({ kind: 'task', priority: 'critical' })
  })

  test('a timeline entry defaults to today and accepts an explicit date', () => {
    expect(parseCapture('t: convoy departed the depot')).toMatchObject({
      kind: 'timeline', body: 'convoy departed the depot', eventDate: undefined,
    })
    expect(parseCapture('t: 2026-03-14 convoy departed the depot')).toMatchObject({
      kind: 'timeline', eventDate: '2026-03-14', body: 'convoy departed the depot',
    })
    for (const alias of ['time:', 'timeline:']) {
      expect(parseCapture(`${alias} something`), alias).toMatchObject({ kind: 'timeline' })
    }
  })

  test('a date with nothing after it is not a timeline entry', () => {
    expect(parseCapture('t: 2026-03-14')).toMatchObject({ kind: 'timeline', body: '2026-03-14' })
    expect(parseCapture('t:')).toBeNull()
  })

  test('the new prefixes do not shadow ordinary notes', () => {
    // "task" and "time" appear in prose constantly; only a real prefix routes.
    expect(parseCapture('taskings for tonight are unchanged')).toMatchObject({ kind: 'note' })
    expect(parseCapture('time on target was 0840')).toMatchObject({ kind: 'note' })
    expect(parseCapture('naive assessment of the crossing')).toMatchObject({ kind: 'note' })
  })

  test('every kind knows which panel it landed in', () => {
    const kinds = ['rfi', 'nai', 'task', 'timeline', 'hypothesis', 'survey', 'note', 'url'] as const
    for (const kind of kinds) {
      expect(PANEL_FOR_KIND[kind], kind).toBeTruthy()
      expect(PANEL_LABEL_FOR_KIND[kind], kind).toBeTruthy()
    }
  })

  test('every panel it points at actually exists in the workspace', () => {
    // The mapping is the half that rots silently: renaming a panel id leaves the
    // capture log pointing at a selector that matches nothing, and the click
    // just does nothing. Checked against the page's own panel definitions.
    const page = readFileSync(resolve(process.cwd(), 'src/pages/CopWorkspacePage.tsx'), 'utf8')
    for (const [kind, panelId] of Object.entries(PANEL_FOR_KIND)) {
      // Panels are declared as `id: 'tasks',` or, for the map, `id="map"`.
      const declared = page.includes(`id: '${panelId}'`) || page.includes(`id="${panelId}"`)
      expect(declared, `${kind} -> [data-panel="${panelId}"]`).toBe(true)
    }
  })

  test('the routing target and the jump target agree', () => {
    // A capture that posts to the tasks endpoint has to send the analyst to the
    // task board. These drift apart by living in different files, so they live
    // in the same one and this asserts they still match.
    expect(PANEL_FOR_KIND[parseCapture('task: x')!.kind]).toBe('tasks')
    expect(PANEL_FOR_KIND[parseCapture('rfi: x')!.kind]).toBe('rfi')
    expect(PANEL_FOR_KIND[parseCapture('t: x')!.kind]).toBe('timeline')
    expect(PANEL_FOR_KIND[parseCapture('nai: 34.05,-118.24 x')!.kind]).toBe('map')
    expect(PANEL_FOR_KIND[parseCapture('hyp: x')!.kind]).toBe('analysis')
    // A note and an analysed link both land in the evidence feed — one panel.
    expect(PANEL_FOR_KIND[parseCapture('plain note')!.kind]).toBe('evidence')
    expect(PANEL_FOR_KIND[parseCapture('https://example.com')!.kind]).toBe('evidence')
  })

  test('a trailing marker records how well corroborated it is', () => {
    // Every note used to be stored `unverified`, so a first-hand sighting and a
    // rumour were indistinguishable afterwards.
    expect(parseCapture('two vehicles at the north gate ~confirmed')).toMatchObject({
      kind: 'note', body: 'two vehicles at the north gate', credibility: 'confirmed',
    })
    for (const [marker, expected] of [
      ['~probable', 'probable'], ['~prob', 'probable'], ['~likely', 'probable'],
      ['~possible', 'possible'], ['~poss', 'possible'],
      ['~doubtful', 'doubtful'], ['~unlikely', 'doubtful'],
      ['~CONFIRMED', 'confirmed'],
    ] as const) {
      expect(parseCapture(`something ${marker}`)!.credibility, marker).toBe(expected)
    }
  })

  test('an unknown marker stays part of the text', () => {
    // Eating a trailing word the analyst meant to keep would be worse than
    // ignoring a marker they got wrong.
    const parsed = parseCapture('convoy seen near ~bridgehead')
    expect(parsed).toMatchObject({ kind: 'note', body: 'convoy seen near ~bridgehead' })
    expect(parsed!.credibility).toBeUndefined()
  })

  test('the marker applies to every kind, not just notes', () => {
    expect(parseCapture('rfi: who holds it ~probable')).toMatchObject({
      kind: 'rfi', body: 'who holds it', credibility: 'probable',
    })
    expect(parseCapture('nai: 34.05,-118.24 Bridge ~confirmed')).toMatchObject({
      kind: 'nai', body: 'Bridge', credibility: 'confirmed',
    })
    expect(parseCapture('hyp: they will cross tonight ~doubtful')).toMatchObject({
      kind: 'hypothesis', credibility: 'doubtful',
    })
  })

  test('the marker is visible in the routing label before sending', () => {
    expect(parseCapture('a note ~confirmed')!.label).toContain('confirmed')
  })

  test('each store gets the judgement in its own vocabulary', () => {
    // Markers keep an uppercase word, hypotheses a 0-100 number, evidence the
    // lowercase word. Said once by the analyst, translated in one place.
    expect(MARKER_CONFIDENCE.confirmed).toBe('CONFIRMED')
    expect(MARKER_CONFIDENCE.doubtful).toBe('DOUBTFUL')
    expect(HYPOTHESIS_CONFIDENCE.confirmed).toBeGreaterThan(HYPOTHESIS_CONFIDENCE.probable)
    expect(HYPOTHESIS_CONFIDENCE.probable).toBeGreaterThan(HYPOTHESIS_CONFIDENCE.possible)
    expect(HYPOTHESIS_CONFIDENCE.possible).toBeGreaterThan(HYPOTHESIS_CONFIDENCE.doubtful)
    // Never 100: a fresh hypothesis marked "confirmed" is well corroborated,
    // not certain, and a ledger starting at 100 has nowhere to go.
    expect(HYPOTHESIS_CONFIDENCE.confirmed).toBeLessThan(100)
    expect(HYPOTHESIS_CONFIDENCE.doubtful).toBeGreaterThan(0)
  })

  test('a tilde mid-sentence is left alone', () => {
    // Only a trailing marker counts; "~5 vehicles" is an approximation.
    expect(parseCapture('~5 vehicles at the gate')).toMatchObject({
      kind: 'note', body: '~5 vehicles at the gate',
    })
    expect(parseCapture('~5 vehicles at the gate')!.credibility).toBeUndefined()
  })
})
