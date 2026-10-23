/**
 * What kind of COP item a line of text is, which of the session's tags fit, and
 * which places it names.
 *
 * Deterministic first: the capture-bar prefixes (src/lib/cop-capture.ts), a link,
 * coordinates or an MGRS grid, and `#tags` decide without a model. Only unprefixed
 * free text goes to the model, which returns words: a kind from a fixed list, tag
 * names (kept only when they are in the session's vocabulary, checked in code), and
 * place names (kept only when they occur in the text itself; coordinates always
 * come from the geocoder later).
 */
import { callOpenAIViaGateway, parseModelJson, UNTRUSTED_CONTENT_INSTRUCTION, wrapUntrustedContent } from './ai-gateway'
import { cleanModelQuery, webcamAiAvailable, type AiCaller, type WebcamAiEnv } from './webcam-ai'
import { hashtagsIn, tagKey } from './cop-tags'

export const SUGGEST_KINDS = ['note', 'evidence', 'rfi', 'task', 'timeline', 'hypothesis', 'marker'] as const
export type SuggestKind = (typeof SUGGEST_KINDS)[number]
export const MAX_SUGGEST_TEXT = 2000
const MAX_TAGS = 5
const MAX_PLACES = 5

export interface Suggestion {
  kind: { value: SuggestKind; confidence: number } | null
  tags: string[]
  places: { text: string; query: string }[]
}

const PREFIXES: [RegExp, SuggestKind][] = [
  [/^rfi!*\s*:/i, 'rfi'],
  [/^(?:nai|aoi)\s*:/i, 'marker'],
  [/^task!*\s*:/i, 'task'],
  [/^(?:t|time|timeline)\s*:/i, 'timeline'],
  [/^(?:hypothesis|hyp|maybe)\s*:/i, 'hypothesis'],
  [/^note\s*:/i, 'note'],
]

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[a-z0-9-]+\.[a-z]{2,}\S*/i
const DECIMAL_PAIR = /(?:^|[^\d.])-?\d{1,2}\.\d{3,}\s*[, ]\s*-?\d{1,3}\.\d{3,}(?![\d.])/
const DMS = /\d{1,3}\s*°\s*\d{1,2}\s*['′]\s*(?:\d{1,2}(?:\.\d+)?\s*["″]\s*)?[NSns]\b.*?\d{1,3}\s*°/
const MGRS = /\b\d{1,2}[C-HJ-NP-X]\s?[A-HJ-NP-Z]{2}\s?\d{2,5}\s?\d{2,5}\b/

export type DeterministicKind = { kind: SuggestKind; reason: 'prefix' | 'url' | 'coordinates' }

/** The kind the text's own form decides, or null when only meaning can. */
export function deterministicKind(text: string): DeterministicKind | null {
  const trimmed = text.trim()
  for (const [pattern, kind] of PREFIXES) if (pattern.test(trimmed)) return { kind, reason: 'prefix' }
  if (DECIMAL_PAIR.test(trimmed) || DMS.test(trimmed) || MGRS.test(trimmed)) return { kind: 'marker', reason: 'coordinates' }
  if (URL_IN_TEXT.test(trimmed)) return { kind: 'evidence', reason: 'url' }
  return null
}

/** `#tags` in the text that are already in the vocabulary, in its spelling. */
export function vocabularyHashtags(text: string, vocabulary: string[]): string[] {
  const byKey = new Map(vocabulary.map((name) => [tagKey(name), name]))
  return hashtagsIn(text).map((t) => byKey.get(tagKey(t))).filter((t): t is string => Boolean(t)).slice(0, MAX_TAGS)
}

function normaliseForMatch(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')
}

/** Validate a model reply against the text and the vocabulary. Anything else is dropped. */
export function cleanSuggestion(reply: unknown, text: string, vocabulary: string[]): Suggestion {
  const out: Suggestion = { kind: null, tags: [], places: [] }
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return out
  const r = reply as Record<string, unknown>
  if (typeof r.kind === 'string' && (SUGGEST_KINDS as readonly string[]).includes(r.kind)) {
    const c = Number(r.confidence)
    out.kind = { value: r.kind as SuggestKind, confidence: Number.isFinite(c) ? Math.round(Math.min(1, Math.max(0, c)) * 100) / 100 : 0.5 }
  }
  if (Array.isArray(r.tags)) {
    const byKey = new Map(vocabulary.map((name) => [tagKey(name), name]))
    const seen = new Set<string>()
    for (const t of r.tags) {
      if (typeof t !== 'string') continue
      const name = byKey.get(tagKey(t.replace(/^#/, '').trim()))
      if (name && !seen.has(name)) {
        seen.add(name)
        out.tags.push(name)
      }
      if (out.tags.length >= MAX_TAGS) break
    }
  }
  if (Array.isArray(r.places)) {
    const haystack = normaliseForMatch(text)
    for (const p of r.places) {
      if (!p || typeof p !== 'object') continue
      const place = p as Record<string, unknown>
      const mention = typeof place.text === 'string' ? place.text.replace(/\s+/g, ' ').trim() : ''
      // A place counts only when the text itself names it.
      if (mention.length < 2 || mention.length > 80 || !haystack.includes(normaliseForMatch(mention))) continue
      const query = cleanModelQuery(place.query ?? mention)
      if (!query) continue
      out.places.push({ text: mention, query })
      if (out.places.length >= MAX_PLACES) break
    }
  }
  return out
}

export interface SuggestContext {
  name: string | null
  description: string | null
}

/** One model call for an unprefixed line. Null when no model is configured or it fails. */
export async function modelSuggestion(
  env: WebcamAiEnv,
  caller: AiCaller,
  input: { text: string; vocabulary: string[]; cop: SuggestContext; want: Set<string> },
): Promise<Suggestion | null> {
  if (!webcamAiAvailable(env)) return null
  const system =
    'You sort one line an analyst typed into a common operating picture (COP). Reply with JSON only: ' +
    '{"kind": one of "note","evidence","rfi","task","timeline","hypothesis","marker", "confidence": 0..1, ' +
    '"tags": [tag names], "places": [{"text": the exact words naming a place, "query": a geocoder search for it}]}. ' +
    'kind: rfi = a question someone needs answered; task = something to do; timeline = something that happened at a ' +
    'time; hypothesis = a guess to test; marker = mainly a location; evidence or note = an observation or report. ' +
    'tags: only names from the TAG LIST, never new ones; [] when none fit. ' +
    'places: only places the line itself names; never coordinates or links; [] when none.'
  const user = [
    'COP:',
    wrapUntrustedContent(`Name: ${input.cop.name ?? '(none)'}\nDescription: ${(input.cop.description ?? '(none)').slice(0, 400)}`),
    'TAG LIST:',
    wrapUntrustedContent(input.vocabulary.slice(0, 200).join('\n') || '(empty)'),
    'Line:',
    wrapUntrustedContent(input.text.slice(0, MAX_SUGGEST_TEXT)),
  ].join('\n')
  try {
    const response = await callOpenAIViaGateway(env as never, {
      tier: 'cheap',
      messages: [
        { role: 'system', content: UNTRUSTED_CONTENT_INSTRUCTION + system },
        { role: 'user', content: user },
      ],
      reasoning_effort: 'none',
      temperature: 0,
      max_completion_tokens: 300,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 86_400,
      timeout: 15_000,
      metadata: { endpoint: 'cop-suggest', user_id: caller.userId },
      logRefusalPreview: false,
    })
    if (response?._refusal) return null
    const parsed = parseModelJson<unknown>(response?.choices?.[0]?.message?.content)
    const clean = cleanSuggestion(parsed, input.text, input.vocabulary)
    if (!input.want.has('kind')) clean.kind = null
    if (!input.want.has('tags')) clean.tags = []
    if (!input.want.has('places')) clean.places = []
    return clean
  } catch {
    return null
  }
}
