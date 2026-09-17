import { test, expect } from '@playwright/test'
import { DISCOVERY_ENTRIES } from '../../../src/config/discovery-catalog'
import { rankEntries, scoreEntry } from '../../../src/lib/discovery-rank'

/**
 * The reported case: typing "ach" in Cmd+K returned Citation Library first, and
 * ACH — a framework whose name begins with those three letters — was somewhere
 * below forty results. Two causes, both pinned here.
 */
const top = (query: string) => rankEntries(DISCOVERY_ENTRIES, query)[0]?.label
const find = (label: string) => {
  const entry = DISCOVERY_ENTRIES.find(e => e.label === label)
  if (!entry) throw new Error(`no catalogue entry "${label}"`)
  return entry
}

test.describe('command palette ranking @smoke', () => {
  test('an acronym returns its framework first', () => {
    expect(top('ach')).toBe('ACH Analysis')
    expect(top('ACH')).toBe('ACH Analysis')
    expect(top('swot')).toBe('SWOT Analysis')
    expect(top('cog')).toBe('Center of Gravity Analysis')
    expect(top('dime')).toBe('DIME Framework')
    expect(top('pmesii')).toBe('PMESII-PT')
    expect(top('dotmlpf')).toBe('DOTMLPF')
    expect(top('pest')).toBe('PEST Analysis')
  })

  test('a description no longer out-ranks a name it merely contains letters of', () => {
    // "Create, m(a)nage, and export resear(ch) citations" is a subsequence
    // match for "ach" and was winning. A subsequence is not a match here.
    const citation = find('Citation Library')
    const ach = find('ACH Analysis')
    expect(scoreEntry(ach, 'ach')).toBeGreaterThan(scoreEntry(citation, 'ach'))
    expect(scoreEntry(citation, 'ach')).toBe(0)
  })

  test('every framework is reachable by each acronym it declares', () => {
    for (const entry of DISCOVERY_ENTRIES) {
      for (const acronym of entry.acronyms ?? []) {
        const results = rankEntries(DISCOVERY_ENTRIES, acronym)
        expect(results.map(e => e.label), `${acronym} -> ${entry.label}`).toContain(entry.label)
      }
    }
  })

  test('partial acronyms still reach the framework', () => {
    expect(top('pmes')).toBe('PMESII-PT')
    expect(top('dotm')).toBe('DOTMLPF')
  })

  test('hyphens and word starts are reachable', () => {
    // "PMESII-PT" splits, so "pt" finds it; "gravity" is a word in the middle
    // of its label; "com-b" carries a hyphen of its own.
    expect(rankEntries(DISCOVERY_ENTRIES, 'pt').map(e => e.label)).toContain('PMESII-PT')
    expect(top('gravity')).toBe('Center of Gravity Analysis')
    expect(top('com-b')).toBe('COM-B & Behaviour Change Wheel')
  })

  test('tool names still win for tools', () => {
    expect(top('timeline')).toBe('Timeline Analysis')
    expect(top('citation')).toBe('Citation Library')
    expect(top('batch')).toBe('Batch Processing')
  })

  test('a framework outranks a tool only on a tie, never across tiers', () => {
    // The group bonus is 50 and the tiers are 100 apart, so it can break a tie
    // and nothing else.
    const framework = find('SWOT Analysis')
    const tool = find('Citation Library')
    // "library" is a word-start on the tool and matches no framework at all.
    expect(scoreEntry(tool, 'library')).toBeGreaterThan(scoreEntry(framework, 'library'))
  })

  test('no query matches nothing, and nonsense matches nothing', () => {
    expect(rankEntries(DISCOVERY_ENTRIES, '')).toEqual([])
    expect(rankEntries(DISCOVERY_ENTRIES, '   ')).toEqual([])
    expect(rankEntries(DISCOVERY_ENTRIES, 'zzzzqqq')).toEqual([])
  })

  test('ordering is stable between keystrokes', () => {
    const once = rankEntries(DISCOVERY_ENTRIES, 'analysis').map(e => e.label)
    const twice = rankEntries(DISCOVERY_ENTRIES, 'analysis').map(e => e.label)
    expect(once).toEqual(twice)
  })

  test('multi-word queries match on every word, not on a literal phrase', () => {
    // These are the searches the old fuzzy filter did allow and a naive
    // substring rewrite would have broken: the words are right, the phrase is
    // not. "behaviour change wheel" does not contain "behavior wheel".
    expect(rankEntries(DISCOVERY_ENTRIES, 'behavior wheel').map(e => e.label))
      .toContain('COM-B & Behaviour Change Wheel')
    expect(rankEntries(DISCOVERY_ENTRIES, 'coping branch').map(e => e.label))
      .toContain('Behavior Decision Analysis')
    expect(rankEntries(DISCOVERY_ENTRIES, 'safe fetch').map(e => e.label))
      .toContain('Web Scraping')
  })

  test('a phrase still beats the same words scattered', () => {
    expect(top('center of gravity')).toBe('Center of Gravity Analysis')
  })

  test('every word must match, or the result is noise', () => {
    // One good word plus one bad one is not a match — otherwise any query
    // containing a common word returns half the catalogue.
    expect(rankEntries(DISCOVERY_ENTRIES, 'timeline zzzzqqq')).toEqual([])
  })
})
