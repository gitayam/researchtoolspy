/**
 * Remarks Planner API
 * POST /api/research/plan-remarks
 *
 * Plans spoken remarks against a declared time slot from a BRIEF Map. The
 * budget, clock marks, pace warnings, ask placement, fact guard, and written
 * submission are arithmetic (remarks-contract.ts); only `script` and `trim`
 * call a model. Contract: docs/api/REMARKS-PLANNING-API.md.
 *
 * Two callers, the generate-question.ts shape:
 * - Users (session/JWT/hash) via requireAuth; may persist with saveToFramework.
 * - Scoped services (`Bearer rt_svc_…`) with `community.research.execute`,
 *   gated by COMMUNITY_INTEGRATIONS_ENABLED and REMARKS_SERVICE_ENABLED.
 *   Service requests never reach user auth, never persist, and fail with
 *   integration-error.v1 documents.
 */

import { requireAuth } from '../_shared/auth-helpers'
import { callOpenAIViaGateway, parseModelJson, wrapUntrustedContent } from '../_shared/ai-gateway'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import {
  buildIntegrationErrorDocument,
  readIntegrationCorrelationId,
  type IntegrationErrorCode,
} from '../_shared/integration-contract'
import {
  getIntegrationPrincipalFromRequest,
  IntegrationAuthError,
  isReservedIntegrationAuthorization,
  type IntegrationAuthEnv,
} from '../_shared/service-auth'
import {
  REMARKS_LIMITS,
  REMARKS_PLAN_VERSION,
  BRANCH_PURPOSE,
  COACH_LIMITS,
  COACH_MAY_REWORD,
  answerCardsFor,
  answerWarnings,
  mapStatus,
  sanitizeCoach,
  budgetFor,
  countWords,
  evaluateScript,
  isParseFailure,
  parseRemarksRequest,
  resolveVenue,
  timeFor,
  utf8Bytes,
  writtenSubmission,
  type AnswerCard,
  type BranchKey,
  type Budget,
  type RemarksMap,
  type RemarksRequest,
  type RemarksWarning,
  type ResolvedVenue,
} from '../_shared/remarks-contract'

interface Env extends IntegrationAuthEnv {
  DB: D1Database
  SESSIONS?: KVNamespace
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  ENABLE_AI_FEATURES?: string
  COMMUNITY_INTEGRATIONS_ENABLED?: string
  REMARKS_SERVICE_ENABLED?: string
}

type Caller =
  | { kind: 'user'; userId: number }
  | { kind: 'service'; clientId: string }

const RESPONSE_HEADERS = {
  ...JSON_HEADERS,
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

function serviceErrorResponse(options: {
  requestId: string
  correlationId?: string
  code: IntegrationErrorCode
  message: string
  retryable: boolean
  status: number
}): Response {
  return new Response(JSON.stringify(buildIntegrationErrorDocument(options)), {
    status: options.status,
    headers: { ...RESPONSE_HEADERS, ...(options.status === 503 ? { 'Retry-After': '2' } : {}) },
  })
}

/** Users on the interactive site get the flat shape the rest of /api/research returns. */
function userErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: RESPONSE_HEADERS })
}

function errorFor(caller: Caller, requestId: string, correlationId: string | undefined, message: string, status: number, code: IntegrationErrorCode = 'invalid_request', retryable = false): Response {
  return caller.kind === 'service'
    ? serviceErrorResponse({ requestId, correlationId, code, message, retryable, status })
    : userErrorResponse(message, status)
}

async function authorizeServiceCaller(request: Request, env: Env, requestId: string, correlationId?: string): Promise<Caller | Response> {
  try {
    const principal = await getIntegrationPrincipalFromRequest(request, env)
    if (!principal) {
      return serviceErrorResponse({ requestId, correlationId, code: 'authentication_required', message: 'A ResearchTools service credential is required.', retryable: false, status: 401 })
    }
    if (
      env.COMMUNITY_INTEGRATIONS_ENABLED !== 'true'
      || env.REMARKS_SERVICE_ENABLED !== 'true'
      || !principal.scopes.includes('community.research.execute')
    ) {
      return serviceErrorResponse({ requestId, correlationId, code: 'scope_denied', message: 'Remarks planning is not enabled for this service credential.', retryable: false, status: 403 })
    }
    return { kind: 'service', clientId: principal.clientId }
  } catch (error) {
    if (error instanceof IntegrationAuthError) {
      return serviceErrorResponse({ requestId, correlationId, code: error.code, message: error.message, retryable: error.retryable, status: error.status })
    }
    return serviceErrorResponse({ requestId, correlationId, code: 'internal_error', message: 'Remarks planning authentication failed.', retryable: true, status: 500 })
  }
}

interface BodyFailure { ok: false; message: string; status: number }
async function readBody(request: Request): Promise<{ ok: true; value: unknown } | BodyFailure> {
  const declared = request.headers.get('Content-Length')
  if (declared && /^\d+$/.test(declared) && Number(declared) > REMARKS_LIMITS.requestBytes) {
    return { ok: false, message: 'The request body exceeds 32 KiB.', status: 413 }
  }
  const text = await request.text()
  if (utf8Bytes(text) > REMARKS_LIMITS.requestBytes) {
    return { ok: false, message: 'The request body exceeds 32 KiB.', status: 413 }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, message: 'The request body must be valid JSON.', status: 400 }
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SCRIPT_RULES = [
  'You write spoken remarks for a person standing at a podium. Return ONLY valid JSON.',
  'Rules that are never broken:',
  '- Use only the facts, names, numbers, dates, and places that appear in the map. If something specific is missing, write a bracketed placeholder such as [date] or [amount]. Never invent one.',
  '- The headline (the ask) must be stated in the first two sentences and restated in the last sentence.',
  '- Describe what happened, when, and where. Do not characterise people. No adjectives about anyone.',
  '- Short sentences, plain words, one idea per sentence. No sentence over 25 words.',
  '- No rhetorical questions. The audience will not answer.',
  '- No greeting longer than one sentence. End with one sentence of thanks.',
  '- Stay inside the word budget given. Under the target is better than over.',
].join('\n')

function mapForPrompt(map: RemarksMap): string {
  const lines: string[] = [`HEADLINE (the ask): ${map.headline}`]
  if (map.background?.length) lines.push('BACKGROUND:', ...map.background.map(item => `- ${item}`))
  if (map.relevance?.length) lines.push('RELEVANCE (why now):', ...map.relevance.map(item => `- ${item}`))
  if (map.information?.length) {
    lines.push('INFORMATION (facts):')
    for (const item of map.information) {
      if (typeof item === 'string') lines.push(`- ${item}`)
      else lines.push(`- ${item.fact}${item.date ? ` (date: ${item.date})` : ''}${item.place ? ` (place: ${item.place})` : ''}`)
    }
  }
  if (map.ending) lines.push(`ENDING (the ask again, with deadline and success): ${map.ending}`)
  if (map.follow_up?.length) {
    lines.push('FOLLOW-UP (not for the script; prepared answers only):')
    for (const item of map.follow_up) lines.push(typeof item === 'string' ? `- ${item}` : `- Q: ${item.question}${item.answer ? ` A: ${item.answer}` : ''}`)
  }
  return lines.join('\n')
}

function scriptPrompt(req: RemarksRequest, resolved: ResolvedVenue, budget: Budget): { system: string; user: string } {
  const venueLine = `VENUE: ${resolved.format.replace(/_/g, ' ')}; ${resolved.scriptSeconds} seconds of speaking at ${resolved.wpm} words a minute; audience: ${req.venue.audience ?? 'a public body'}${req.venue.bodyName ? ` (${req.venue.bodyName})` : ''}.`
  const allocation = budget.allocation.map(a => `${a.section.replace(/_/g, ' ')}: ~${a.words} words`).join('; ')
  const wantsCards = resolved.format !== 'statement'
  const wantsScript = resolved.format !== 'qa_only'
  const shape = wantsScript && wantsCards
    ? '{"script": "the spoken remarks as plain text", "answerCards": [{"question": "...", "answer": "..."}]}'
    : wantsScript
      ? '{"script": "the spoken remarks as plain text"}'
      : '{"answerCards": [{"question": "...", "answer": "..."}]}'
  const system = [req.voice ? `VOICE (supplied by the caller, apply it):\n${req.voice}\n` : '', SCRIPT_RULES].filter(Boolean).join('\n')
  const user = [
    venueLine,
    wantsScript ? `WORD BUDGET: write to ${budget.targetWords} words, never more than ${budget.maxWords}. Suggested allocation: ${allocation}.` : '',
    wantsCards ? `PREPARED ANSWERS: one per FOLLOW-UP item, each at most ${budget.answerCards?.wordsEach ?? 60} words, answering only from the map.` : '',
    'MAP:',
    wrapUntrustedContent(mapForPrompt(req.map!)),
    `Return JSON exactly of the form ${shape}`,
  ].filter(Boolean).join('\n\n')
  return { system, user }
}

function trimPrompt(req: RemarksRequest, resolved: ResolvedVenue, budget: Budget): { system: string; user: string } {
  const system = [req.voice ? `VOICE (supplied by the caller, apply it):\n${req.voice}\n` : '', SCRIPT_RULES, 'You are TRIMMING an existing script, not rewriting it. Remove and tighten. Keep every fact that stays in the same words. Do not add a fact, a number, a name, or a date that is not already in the script or the map.'].filter(Boolean).join('\n')
  const user = [
    `TARGET: at most ${budget.targetWords} words (${resolved.scriptSeconds} seconds at ${resolved.wpm} words a minute). The script is currently ${countWords(req.script!)} words.`,
    'MAP (the source of every fact):',
    wrapUntrustedContent(mapForPrompt(req.map!)),
    'SCRIPT TO TRIM:',
    wrapUntrustedContent(req.script!),
    'Return JSON exactly of the form {"script": "the trimmed remarks as plain text"}',
  ].join('\n\n')
  return { system, user }
}

function coachPrompt(req: RemarksRequest, resolved: ResolvedVenue, status: ReturnType<typeof mapStatus>): { system: string; user: string } {
  const section = req.section as BranchKey
  const mayReword = COACH_MAY_REWORD.has(section)
  const system = [
    req.voice ? `VOICE (supplied by the caller, apply it to any rewording):\n${req.voice}\n` : '',
    'You coach a person preparing to speak. You review ONE part of their plan and help them improve it. Return ONLY valid JSON.',
    'Rules that are never broken:',
    '- Never supply a fact, number, date, name, place, or source. Facts come only from the speaker. If something specific is missing, ASK for it in questions.',
    mayReword
      ? '- You may offer "suggestion": a tighter rewording of THEIR OWN words for this part, using only what is already in the map. If you cannot improve it without adding a fact, set suggestion to null.'
      : '- Do not offer a rewording for this part. Set suggestion to null. Help only with questions and a note.',
    '- "note" is one or two plain sentences: what is working, then the single most useful change. No praise words, no jargon.',
    `- "questions" are at most ${COACH_LIMITS.questions} short questions whose answers would make this part stronger.`,
    '- "status" is "strong" if this part already does its job, "needs_work" if not, "empty" if there is nothing to review.',
  ].filter(Boolean).join('\n')
  const user = [
    `VENUE: ${resolved.format.replace(/_/g, ' ')}; ${resolved.secondsTotal} seconds; ${resolved.wpm} words a minute; audience: ${req.venue.audience ?? 'a public body'}.`,
    `PART TO REVIEW: ${section}. Its job: ${BRANCH_PURPOSE[section]}`,
    `RULE CHECK ALREADY APPLIED: ${status[section].state}${status[section].reason ? ` (${status[section].reason})` : ''}`,
    'WHOLE MAP (for context; review only the part named above):',
    wrapUntrustedContent(mapForPrompt(req.map!)),
    'Return JSON exactly of the form {"status": "strong|needs_work|empty", "note": "...", "suggestion": "..." or null, "questions": ["..."]}',
  ].join('\n\n')
  return { system, user }
}

interface ModelResult { script?: string; answerCards?: Array<{ question?: string; answer?: string }> }

async function callModel(env: Env, prompt: { system: string; user: string }, metadata: Record<string, unknown>): Promise<ModelResult | null> {
  const response = await callOpenAIViaGateway(env, {
    tier: 'cheap',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    reasoning_effort: 'low',
    max_completion_tokens: 2500,
  }, { cacheTTL: 0, metadata: { endpoint: 'plan-remarks', ...metadata } })
  if (response?._refusal) return null
  const content = response?.choices?.[0]?.message?.content
  const parsed = parseModelJson<ModelResult>(content)
  if (!parsed || typeof parsed !== 'object') return null
  return parsed
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const onRequestOptions: PagesFunction = async () => optionsResponse()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestId = `req-${crypto.randomUUID()}`
  const correlationId = readIntegrationCorrelationId(context.request)
  const serviceRequest = isReservedIntegrationAuthorization(context.request)

  let caller: Caller
  if (serviceRequest) {
    const authorized = await authorizeServiceCaller(context.request, context.env, requestId, correlationId)
    if (authorized instanceof Response) return authorized
    caller = authorized
  } else {
    try {
      caller = { kind: 'user', userId: await requireAuth(context.request, context.env) }
    } catch (error) {
      if (error instanceof Response) return error
      return userErrorResponse('Authentication required', 401)
    }
  }

  const body = await readBody(context.request)
  if (body.ok === false) {
    const failure = body as BodyFailure
    return errorFor(caller, requestId, correlationId, failure.message, failure.status)
  }
  const parsed = parseRemarksRequest((body as { value: unknown }).value)
  if (isParseFailure(parsed)) return errorFor(caller, requestId, correlationId, parsed.message, 400)
  const req = (parsed as { value: RemarksRequest }).value
  if (caller.kind === 'service' && req.saveToFramework === true) {
    return errorFor(caller, requestId, correlationId, 'Service callers cannot persist remarks plans.', 400)
  }

  const { resolved, warnings: venueWarnings } = resolveVenue(req.venue)
  const budget = budgetFor(resolved, req.map?.follow_up?.length ?? 0)
  const warnings: RemarksWarning[] = [...venueWarnings]

  const base = {
    schemaVersion: REMARKS_PLAN_VERSION,
    requestId,
    ...(correlationId ? { correlationId } : {}),
    id: null as number | null,
    mode: req.mode,
    venueResolved: resolved,
    budget,
    ...(req.map ? { mapStatus: mapStatus(req.map, resolved.format) } : {}),
  }

  if (req.mode === 'budget') {
    return Response.json({ ...base, warnings, model: { used: false } }, { headers: RESPONSE_HEADERS })
  }

  if (req.mode === 'check') {
    const evaluation = evaluateScript(req.script!, req.map ?? null, resolved, budget)
    return Response.json({
      ...base,
      warnings: [...warnings, ...evaluation.warnings],
      script: req.script,
      answerCards: null,
      wordCount: evaluation.wordCount,
      estimatedSeconds: evaluation.estimatedSeconds,
      askPlacement: evaluation.askPlacement,
      factGuard: evaluation.factGuard,
      plainLanguage: evaluation.plainLanguage,
      ...(req.map ? { writtenSubmission: writtenSubmission(req.map, req.venue) } : {}),
      model: { used: false },
    }, { headers: RESPONSE_HEADERS })
  }

  if (req.mode === 'coach') {
    if (!context.env.OPENAI_API_KEY) {
      return errorFor(caller, requestId, correlationId, 'AI coaching is not available right now.', 503, 'auth_datastore_unavailable', true)
    }
    const status = mapStatus(req.map!, resolved.format)
    const coachMetadata = caller.kind === 'user' ? { user_id: String(caller.userId) } : { user_id: `service:${caller.clientId}` }
    let raw: unknown
    try {
      const response = await callOpenAIViaGateway(context.env, {
        tier: 'cheap',
        messages: [
          { role: 'system', content: coachPrompt(req, resolved, status).system },
          { role: 'user', content: coachPrompt(req, resolved, status).user },
        ],
        reasoning_effort: 'low',
        max_completion_tokens: 800,
        response_format: { type: 'json_object' },
      }, { cacheTTL: 0, metadata: { endpoint: 'plan-remarks-coach', ...coachMetadata } })
      if (response?._refusal) throw new Error('refusal')
      raw = parseModelJson(response?.choices?.[0]?.message?.content)
      if (!raw || typeof raw !== 'object') throw new Error('unparseable')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/rate limit/i.test(message)) {
        return errorFor(caller, requestId, correlationId, 'The coaching service is busy. Try again shortly.', 503, 'auth_datastore_unavailable', true)
      }
      return errorFor(caller, requestId, correlationId, 'Coaching could not be produced.', 502, 'upstream_invalid_response', true)
    }
    return Response.json({
      ...base,
      warnings,
      coach: sanitizeCoach(raw, req.section!, req.map!, status),
      model: { used: true, tier: 'cheap' },
    }, { headers: RESPONSE_HEADERS })
  }

  // script and trim call a model.
  if (!context.env.OPENAI_API_KEY || (caller.kind === 'user' && context.env.ENABLE_AI_FEATURES !== 'true' && context.env.ENABLE_AI_FEATURES !== undefined)) {
    return errorFor(caller, requestId, correlationId, 'AI drafting is not available right now.', 503, 'auth_datastore_unavailable', true)
  }
  const metadata = caller.kind === 'user' ? { user_id: caller.userId } : { user_id: `service:${caller.clientId}` }
  const prompt = req.mode === 'trim' ? trimPrompt(req, resolved, budget) : scriptPrompt(req, resolved, budget)

  let result: ModelResult | null
  try {
    result = await callModel(context.env, prompt, metadata)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/rate limit/i.test(message)) {
      return errorFor(caller, requestId, correlationId, 'The drafting service is busy. Try again shortly.', 503, 'auth_datastore_unavailable', true)
    }
    return errorFor(caller, requestId, correlationId, 'The draft could not be produced.', 502, 'upstream_invalid_response', true)
  }

  const wantsScript = resolved.format !== 'qa_only'
  const wantsCards = resolved.format !== 'statement'
  const script = typeof result?.script === 'string' ? result.script.trim() : ''
  if (!result || (wantsScript && !script)) {
    return errorFor(caller, requestId, correlationId, 'The draft could not be produced.', 502, 'upstream_invalid_response', true)
  }

  // Prepared answers: the model's where given, else the map's own, each budgeted.
  let answerCards: AnswerCard[] | null = null
  if (wantsCards) {
    const own = answerCardsFor(req.map!, resolved.wpm)
    const fromModel = Array.isArray(result.answerCards) ? result.answerCards : []
    const merged: RemarksMap = {
      ...req.map!,
      follow_up: (req.map!.follow_up ?? []).map((item, index) => {
        const question = typeof item === 'string' ? item : item.question
        const existing = typeof item === 'string' ? undefined : item.answer
        const modelAnswer = fromModel.find(card => typeof card?.question === 'string' && card.question.trim().toLowerCase() === question.trim().toLowerCase())?.answer
          ?? fromModel[index]?.answer
        return { question, answer: (existing ?? (typeof modelAnswer === 'string' ? modelAnswer : '')).slice(0, REMARKS_LIMITS.itemChars) }
      }),
    }
    const cards = answerCardsFor(merged, resolved.wpm)
    answerCards = cards.cards
    warnings.push(...answerWarnings(cards.unbudgeted.length ? cards.unbudgeted : own.unbudgeted.filter(i => cards.unbudgeted.includes(i)), resolved.wpm))
  }

  let evaluation = wantsScript ? evaluateScript(script, req.map!, resolved, budget) : null

  if (req.mode === 'trim' && evaluation) {
    // A trim must not introduce specifics the original lacked, and must keep the ask in place.
    const before = new Set(evaluateScript(req.script!, req.map!, resolved, budget).factGuard.map(hit => hit.text.toLowerCase()))
    const introduced = evaluation.factGuard.filter(hit => !before.has(hit.text.toLowerCase()))
    if (introduced.length || !evaluation.askPlacement.inFirstTwoSentences || !evaluation.askPlacement.inLastSentence) {
      return errorFor(caller, requestId, correlationId, 'The trimmed draft changed the facts or lost the ask. Your original script is untouched.', 502, 'upstream_invalid_response', true)
    }
  }

  let id: number | null = null
  if (caller.kind === 'user' && req.saveToFramework === true) {
    try {
      const title = req.map!.headline.slice(0, 120)
      const data = {
        venue: req.venue, map: req.map, script: wantsScript ? script : null, answerCards,
        generatedAt: new Date().toISOString(), contract: REMARKS_PLAN_VERSION,
      }
      const row = await context.env.DB.prepare(
        `INSERT INTO framework_sessions (user_id, workspace_id, title, description, framework_type, status, data, config, created_at, updated_at)
         VALUES (?, NULL, ?, ?, 'brief-map', 'draft', ?, ?, datetime('now'), datetime('now')) RETURNING id`,
      ).bind(caller.userId, title, req.venue.bodyName ?? null, JSON.stringify(data), JSON.stringify(req.venue)).first<{ id: number }>()
      id = row?.id ?? null
    } catch (error) {
      console.error('[plan-remarks] save failed', error)
    }
  }

  if (!evaluation) {
    evaluation = { wordCount: 0, estimatedSeconds: 0, askPlacement: { inFirstTwoSentences: false, inLastSentence: false, beforeFirstMark: false }, factGuard: [], warnings: [], plainLanguage: [] }
  }

  return Response.json({
    ...base,
    id,
    warnings: [...warnings, ...evaluation.warnings],
    script: wantsScript ? script : null,
    answerCards,
    wordCount: evaluation.wordCount,
    estimatedSeconds: wantsScript ? evaluation.estimatedSeconds : timeFor(0, resolved.wpm),
    askPlacement: evaluation.askPlacement,
    factGuard: evaluation.factGuard,
    plainLanguage: evaluation.plainLanguage,
    writtenSubmission: writtenSubmission(req.map!, req.venue),
    model: { used: true, tier: 'cheap' },
  }, { headers: RESPONSE_HEADERS })
}
