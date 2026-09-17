import type { DiscoveryEntry } from '@/config/discovery-catalog'

/**
 * Ranking for the Cmd+K palette.
 *
 * Replaces cmdk's default filter, which scores a fuzzy *subsequence* across
 * every field. That is far too permissive on a catalogue whose descriptions are
 * full sentences: typing "ach" matched "Citation Library", because
 * "Create, m(a)nage, and export resear(ch) citations" contains a, c and h in
 * order. A framework's own acronym lost to a coincidence in someone else's prose.
 *
 * The rules here are ordered by how strongly a match identifies the thing, and
 * they are all substring or word-boundary tests — never subsequence:
 *
 *   1. An acronym the entry declares. Typing ACH means ACH.
 *   2. The label, exactly, then by word-start, then anywhere.
 *   3. A declared keyword, same order.
 *   4. The description, last, and only as a whole substring.
 *
 * Frameworks carry a tie-break bonus because they are the product's subject
 * matter: when a query matches a framework and a tool equally well, the
 * framework is what was meant.
 */

export const NO_MATCH = 0

const TIER = {
  acronymExact: 1000,
  labelExact: 900,
  acronymPrefix: 850,
  labelPrefix: 800,
  keywordExact: 700,
  labelWordStart: 600,
  keywordPrefix: 500,
  labelContains: 400,
  keywordContains: 300,
  descriptionContains: 200,
} as const

/** Frameworks win ties, and only ties — 50 cannot promote across a tier. */
const GROUP_BONUS: Record<DiscoveryEntry['group'], number> = {
  Frameworks: 50,
  Tools: 10,
  Navigate: 0,
}

const normalize = (value: string) => value.toLowerCase().trim()

/** Word starts, so "gravity" reaches "Center of Gravity Analysis". Hyphens split
 *  too, so "pt" reaches "PMESII-PT" and "b" reaches "COM-B". */
function wordStarts(haystack: string, needle: string): boolean {
  return haystack.split(/[\s\-&/]+/).some(word => word.startsWith(needle))
}

/** Score one whitespace-free term. */
function scoreTerm(entry: DiscoveryEntry, query: string): number {
  const label = normalize(entry.label)
  const acronyms = (entry.acronyms ?? []).map(normalize)
  const keywords = entry.keywords.map(normalize)
  const description = normalize(entry.description)

  const base = (() => {
    if (acronyms.includes(query)) return TIER.acronymExact
    if (label === query) return TIER.labelExact
    // A partial acronym still beats a full-label match elsewhere: someone typing
    // "pmes" is not reaching for anything else.
    if (acronyms.some(a => a.startsWith(query))) return TIER.acronymPrefix
    if (label.startsWith(query)) return TIER.labelPrefix
    if (keywords.includes(query)) return TIER.keywordExact
    if (wordStarts(label, query)) return TIER.labelWordStart
    if (keywords.some(k => k.startsWith(query) || wordStarts(k, query))) return TIER.keywordPrefix
    if (label.includes(query)) return TIER.labelContains
    if (keywords.some(k => k.includes(query))) return TIER.keywordContains
    if (description.includes(query)) return TIER.descriptionContains
    return NO_MATCH
  })()

  return base
}

export function scoreEntry(entry: DiscoveryEntry, rawQuery: string): number {
  const query = normalize(rawQuery)
  if (!query) return NO_MATCH

  // The whole phrase first: "center of gravity" should reach its framework as a
  // phrase, not as three words that happen to co-occur.
  let base = scoreTerm(entry, query)

  // Then every word independently. Someone typing "behavior wheel" means
  // "behaviour change wheel" — the words are right, the phrase is not, and
  // requiring a literal substring would refuse a search that is plainly correct.
  // ALL terms must match, or "timeline sausage" would return the timeline.
  const terms = query.split(/\s+/).filter(Boolean)
  if (base === NO_MATCH && terms.length > 1) {
    const scores = terms.map(term => scoreTerm(entry, term))
    // The weakest term sets the tier: an entry is only as relevant as its
    // loosest justification for being here.
    if (scores.every(score => score > NO_MATCH)) base = Math.min(...scores)
  }

  if (base === NO_MATCH) return NO_MATCH
  return base + GROUP_BONUS[entry.group]
}

/**
 * Matching entries, best first. Ties break on label so the order is stable
 * between keystrokes rather than reshuffling under the reader's cursor.
 */
export function rankEntries(entries: readonly DiscoveryEntry[], query: string): DiscoveryEntry[] {
  return entries
    .map(entry => ({ entry, score: scoreEntry(entry, query) }))
    .filter(({ score }) => score > NO_MATCH)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .map(({ entry }) => entry)
}
