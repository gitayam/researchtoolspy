/**
 * The three places COP webcam discovery asks a model, each because the input is
 * language, not data:
 *   - placeQueryFromText: an ambiguous place ("the stadium") → a geocoder query,
 *     using the COP's name, description and map center as context;
 *   - placeQueryFromUrl: the address of a page that is not a camera feed → the
 *     place it is about (the page itself is never fetched);
 *   - viewTargetFromTitle: a camera title → the landmark the view faces.
 *
 * The model only ever returns words. Coordinates come from the geocoder, ids from
 * Windy, bearings from arithmetic. Every reply is untrusted: it must be the exact
 * JSON shape, and each field is length- and charset-checked; anything else is null.
 */
import { callOpenAIViaGateway, parseModelJson, UNTRUSTED_CONTENT_INSTRUCTION, wrapUntrustedContent } from './ai-gateway'

export interface WebcamAiEnv {
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  CACHE?: unknown
  DB?: unknown
}

export interface AiCaller {
  /** The gateway's per-caller limiter key: a user id, or `service:<clientId>`. */
  userId: string
}

export function webcamAiAvailable(env: WebcamAiEnv): boolean {
  return typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0
}

const QUERY_MAX = 120
const TARGET_MAX = 80

/** A geocoder query a model wrote: plain words, no links or markup, bounded length. */
export function cleanModelQuery(value: unknown, max = QUERY_MAX): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>{}\\`]/.test(value)) return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length < 2 || text.length > max) return null
  if (/:\/\/|\bwww\./i.test(text)) return null
  // Coordinates are the geocoder's job; a model that writes them is ignored.
  if (/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/.test(text)) return null
  return text
}

export function cleanCountryCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value.trim()) ? value.trim().toLowerCase() : null
}

async function askJson(
  env: WebcamAiEnv,
  caller: AiCaller,
  endpoint: string,
  system: string,
  user: string,
): Promise<Record<string, unknown> | null> {
  if (!webcamAiAvailable(env)) return null
  try {
    const response = await callOpenAIViaGateway(env as never, {
      tier: 'cheap',
      messages: [
        { role: 'system', content: UNTRUSTED_CONTENT_INSTRUCTION + system },
        { role: 'user', content: user },
      ],
      reasoning_effort: 'none',
      temperature: 0,
      max_completion_tokens: 200,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 86_400,
      timeout: 15_000,
      metadata: { endpoint, user_id: caller.userId },
      logRefusalPreview: false,
    })
    if (response?._refusal) return null
    const parsed = parseModelJson<unknown>(response?.choices?.[0]?.message?.content)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

export interface CopContext {
  name: string | null
  description: string | null
  center: { lat: number; lon: number } | null
}

function copContextBlock(cop: CopContext): string {
  return [
    `COP name: ${cop.name ?? '(none)'}`,
    `COP description: ${(cop.description ?? '(none)').slice(0, 600)}`,
    `COP map center: ${cop.center ? `${cop.center.lat.toFixed(4)}, ${cop.center.lon.toFixed(4)}` : '(none)'}`,
  ].join('\n')
}

/** An ambiguous place text → `{query, country_code}` for the geocoder, or null. */
export async function placeQueryFromText(
  env: WebcamAiEnv,
  caller: AiCaller,
  input: { text: string; cop: CopContext; candidates: string[] },
): Promise<{ query: string; countryCode: string | null } | null> {
  const system =
    'You turn a short place description into ONE search query for the OpenStreetMap geocoder. ' +
    'Use the operation context (COP name, description, map center) to decide which place is meant: ' +
    'a description written for a COP centred on Paris means the place near Paris. ' +
    'Reply with JSON only: {"query": string or null, "country_code": ISO 3166-1 alpha-2 code or null}. ' +
    'The query names a real, findable place (for example "Stade de France, Saint-Denis"). ' +
    'Never write coordinates, links or explanations. Use null when the text names no place.'
  const user = [
    'Operation context:',
    wrapUntrustedContent(copContextBlock(input.cop)),
    'Geocoder candidates for the raw text (may be wrong or empty):',
    wrapUntrustedContent(input.candidates.slice(0, 5).join('\n') || '(none)'),
    'Place description:',
    wrapUntrustedContent(input.text.slice(0, QUERY_MAX)),
  ].join('\n')
  const reply = await askJson(env, caller, 'cop-webcams-place', system, user)
  const query = cleanModelQuery(reply?.query)
  return query ? { query, countryCode: cleanCountryCode(reply?.country_code) } : null
}

/** The address (host and path only) of a page that is not a camera → the place it is about. */
export async function placeQueryFromUrl(
  env: WebcamAiEnv,
  caller: AiCaller,
  address: string,
): Promise<{ query: string; countryCode: string | null; confidence: 'high' | 'medium' | 'low' } | null> {
  const system =
    'You read the address of a web page (host name and path only; you cannot open it) and say ' +
    'which single place the page is about, for example a weather or webcam page for a town. ' +
    'Reply with JSON only: {"query": string or null, "country_code": ISO 3166-1 alpha-2 code or null, ' +
    '"confidence": "high" | "medium" | "low"}. The query is a geocoder search such as ' +
    '"Saint-Denis, Seine-Saint-Denis, France". Never write coordinates or links. Use null and "low" ' +
    'when the address does not name a place.'
  const reply = await askJson(env, caller, 'cop-webcams-from-url', system, `Page address:\n${wrapUntrustedContent(address)}`)
  const confidence = reply?.confidence
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') return null
  const query = cleanModelQuery(reply?.query)
  return query ? { query, countryCode: cleanCountryCode(reply?.country_code), confidence } : null
}

/** A camera's label/title → the landmark or feature its view faces, or null. */
export async function viewTargetFromTitle(
  env: WebcamAiEnv,
  caller: AiCaller,
  input: { label: string; title: string | null; city: string | null; country: string | null },
): Promise<string | null> {
  const system =
    'You read a webcam\'s label and title and name the ONE landmark or feature its view faces, as a ' +
    'geocoder search (for example "Eiffel Tower, Paris"). Only name something the text itself names ' +
    'or clearly implies; do not guess from the town alone. ' +
    'Reply with JSON only: {"target": string or null}. Never write coordinates, bearings or links.'
  const user = [
    'Camera:',
    wrapUntrustedContent([
      `Label: ${input.label}`,
      `Title: ${input.title ?? '(none)'}`,
      `Town: ${input.city ?? '(unknown)'}`,
      `Country: ${input.country ?? '(unknown)'}`,
    ].join('\n')),
  ].join('\n')
  const reply = await askJson(env, caller, 'cop-webcams-view-target', system, user)
  return cleanModelQuery(reply?.target, TARGET_MAX)
}
