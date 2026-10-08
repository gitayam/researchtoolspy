/**
 * remarks-plan.v1 — the deterministic half of the Remarks Planner.
 *
 * Everything here is arithmetic over a declared venue and a BRIEF Map: word
 * budgets, clock marks, allocation, ask placement, sentence lengths, the fact
 * guard, and the warnings. None of it calls a model, so all of it is unit
 * tested, and `budget`/`check` mode responses are built from this file alone.
 *
 * The published contract is docs/api/REMARKS-PLANNING-API.md and
 * docs/api/schemas/remarks-plan.v1.schema.json. The limits and formulas below
 * are the ones that document states; the schema test asserts the two agree.
 */

export const REMARKS_PLAN_VERSION = 'remarks-plan.v1' as const

export const REMARKS_LIMITS = Object.freeze({
  requestBytes: 32 * 1024,
  scriptChars: 6000,
  voiceChars: 2000,
  branchItems: 12,
  itemChars: 500,
  headlineChars: 300,
  endingChars: 500,
  textChars: 200,
  sourceChars: 300,
  dateChars: 40,
  minSeconds: 30,
  maxSeconds: 3600,
  measuredWordsMin: 50,
  measuredWordsMax: 2000,
  measuredSecondsMin: 10,
  measuredSecondsMax: 1200,
})

export const REMARKS_FORMATS = ['statement', 'statement_with_questions', 'qa_only', 'open_discussion'] as const
export type RemarksFormat = typeof REMARKS_FORMATS[number]

export const REMARKS_MODES = ['budget', 'script', 'trim', 'check', 'coach'] as const
export type RemarksMode = typeof REMARKS_MODES[number]

export const PACE_PRESETS = Object.freeze({ deliberate: 120, podium: 135, conversational: 150 })
export type PacePreset = keyof typeof PACE_PRESETS

/** The six parts of a BRIEF Map, in the order the method fills them. */
export const BRANCH_KEYS = ['headline', 'background', 'relevance', 'information', 'ending', 'follow_up'] as const
export type BranchKey = typeof BRANCH_KEYS[number]

export const COACH_LIMITS = Object.freeze({ noteChars: 240, suggestionChars: 500, questionChars: 200, questions: 3 })

export const QUESTION_SOURCES = ['chair', 'members', 'staff', 'press', 'public', 'partners'] as const

export const HARD_CLOCK_FACTOR = 0.92
export const SOFT_CLOCK_FACTOR = 1
export const ANSWER_CARD_SECONDS = 30
export const OPEN_DISCUSSION_OPENING_SECONDS = 60
export const FAST_PACE_WPM = 150
export const SLOW_PACE_WPM = 110
export const LONG_SENTENCE_WORDS = 30
export const CLOCK_MARK_SECONDS = 60
export const MIN_SUBSTANTIVE_WORDS = 4

export type AllocationSection = 'who' | 'ask' | 'evidence' | 'doing' | 'invite_questions' | 'ask_again' | 'thanks'

/** The venue preset owns these numbers; nothing else restates them. */
export const ALLOCATION: Readonly<Record<RemarksFormat, ReadonlyArray<readonly [AllocationSection, number]>>> = Object.freeze({
  statement: [['who', 0.12], ['ask', 0.08], ['evidence', 0.48], ['doing', 0.17], ['ask_again', 0.12], ['thanks', 0.03]],
  statement_with_questions: [['who', 0.12], ['ask', 0.08], ['evidence', 0.40], ['doing', 0.17], ['invite_questions', 0.08], ['ask_again', 0.12], ['thanks', 0.03]],
  open_discussion: [['who', 0.12], ['ask', 0.08], ['evidence', 0.48], ['doing', 0.17], ['ask_again', 0.12], ['thanks', 0.03]],
  qa_only: [],
})

export const WARNING_CODES = [
  'over_budget', 'near_budget', 'pace_assumes_fast', 'pace_assumes_slow', 'no_measured_rate',
  'ask_lost_if_cut', 'ask_not_last', 'no_question_reserve', 'answers_unbudgeted',
  'sentence_too_long', 'audience_will_not_respond', 'fact_unsupported',
] as const
export type WarningCode = typeof WARNING_CODES[number]

export interface RemarksWarning {
  code: WarningCode
  severity: 'info' | 'warning'
  message: string
  detail?: Record<string, unknown>
}

export type PaceInput =
  | { preset: PacePreset }
  | { measured: { words: number; seconds: number } }

export interface VenueInput {
  format: RemarksFormat
  secondsTotal: number
  secondsHard: boolean
  questionReserveSeconds?: number
  questionsLikelyFrom?: Array<typeof QUESTION_SOURCES[number]>
  pace: PaceInput
  audience?: string
  bodyName?: string
}

export interface InformationItem { fact: string; date?: string; place?: string; source?: string }
export interface FollowUpItem { question: string; answer?: string }

export interface RemarksMap {
  headline: string
  background?: string[]
  relevance?: string[]
  information?: Array<string | InformationItem>
  ending?: string
  follow_up?: Array<string | FollowUpItem>
}

export interface RemarksRequest {
  schemaVersion: typeof REMARKS_PLAN_VERSION
  mode: RemarksMode
  venue: VenueInput
  map?: RemarksMap
  script?: string
  voice?: string
  saveToFramework?: boolean
  /** Required for mode `coach`: the branch to review. */
  section?: BranchKey
}

export interface ResolvedVenue {
  format: RemarksFormat
  secondsTotal: number
  secondsHard: boolean
  scriptSeconds: number
  questionReserveSeconds: number
  wpm: number
  paceSource: string
  targetFactor: number
}

export interface ClockMark { atSeconds: number; words: number }

export interface Budget {
  targetWords: number
  maxWords: number
  marks: ClockMark[]
  allocation: Array<{ section: AllocationSection; words: number }>
  answerCards: { count: number; wordsEach: number; secondsEach: number } | null
}

export interface AskPlacement { inFirstTwoSentences: boolean; inLastSentence: boolean; beforeFirstMark: boolean }

export interface FactGuardHit { text: string; kind: 'number' | 'date' | 'year' | 'money' | 'name'; position: number }

export interface AnswerCard { question: string; answer: string; words: number; seconds: number }

export interface WrittenSubmission { title: string; lines: string[] }

// ── Validation ───────────────────────────────────────────────────────────────

export interface ParseFailure { ok: false; message: string }
export type Parsed<T> = { ok: true; value: T } | ParseFailure

/** Explicit guard: the functions build is not strict, so `!x.ok` does not narrow. */
export function isParseFailure(value: { ok: boolean }): value is ParseFailure {
  return value.ok === false
}

const fail = (failure: ParseFailure): ParseFailure => ({ ok: false, message: failure.message })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function onlyKeys(record: Record<string, unknown>, allowed: string[], where: string): string | null {
  const extra = Object.keys(record).filter(key => !allowed.includes(key))
  return extra.length ? `${where} has unknown field${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}.` : null
}

function boundedText(value: unknown, max: number, where: string, required: boolean): string | null | undefined {
  if (value === undefined) return required ? null : undefined
  if (typeof value !== 'string') return null
  if (required && !value.trim()) return null
  if (value.length > max) return null
  return value
}

function parseTextArray(value: unknown, where: string): Parsed<string[] | undefined> {
  if (value === undefined) return { ok: true, value: undefined }
  if (!Array.isArray(value)) return { ok: false, message: `${where} must be an array.` }
  if (value.length > REMARKS_LIMITS.branchItems) return { ok: false, message: `${where} may hold at most ${REMARKS_LIMITS.branchItems} items.` }
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > REMARKS_LIMITS.itemChars) {
      return { ok: false, message: `${where} items must be text of 1 to ${REMARKS_LIMITS.itemChars} characters.` }
    }
    out.push(item)
  }
  return { ok: true, value: out }
}

function parseInformation(value: unknown): Parsed<Array<string | InformationItem> | undefined> {
  if (value === undefined) return { ok: true, value: undefined }
  if (!Array.isArray(value)) return { ok: false, message: 'map.information must be an array.' }
  if (value.length > REMARKS_LIMITS.branchItems) return { ok: false, message: `map.information may hold at most ${REMARKS_LIMITS.branchItems} items.` }
  const out: Array<string | InformationItem> = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (!item.trim() || item.length > REMARKS_LIMITS.itemChars) return { ok: false, message: `map.information items must be 1 to ${REMARKS_LIMITS.itemChars} characters.` }
      out.push(item)
      continue
    }
    if (!isRecord(item)) return { ok: false, message: 'map.information items must be text or an object with a fact.' }
    const extra = onlyKeys(item, ['fact', 'date', 'place', 'source'], 'map.information item')
    if (extra) return { ok: false, message: extra }
    const fact = boundedText(item.fact, REMARKS_LIMITS.itemChars, 'fact', true)
    if (!fact) return { ok: false, message: `map.information item fact must be 1 to ${REMARKS_LIMITS.itemChars} characters.` }
    const date = boundedText(item.date, REMARKS_LIMITS.dateChars, 'date', false)
    const place = boundedText(item.place, REMARKS_LIMITS.textChars, 'place', false)
    const source = boundedText(item.source, REMARKS_LIMITS.sourceChars, 'source', false)
    if (date === null || place === null || source === null) return { ok: false, message: 'map.information item date, place, and source must be short text.' }
    out.push({ fact, ...(date ? { date } : {}), ...(place ? { place } : {}), ...(source ? { source } : {}) })
  }
  return { ok: true, value: out }
}

function parseFollowUp(value: unknown): Parsed<Array<string | FollowUpItem> | undefined> {
  if (value === undefined) return { ok: true, value: undefined }
  if (!Array.isArray(value)) return { ok: false, message: 'map.follow_up must be an array.' }
  if (value.length > REMARKS_LIMITS.branchItems) return { ok: false, message: `map.follow_up may hold at most ${REMARKS_LIMITS.branchItems} items.` }
  const out: Array<string | FollowUpItem> = []
  for (const item of value) {
    if (typeof item === 'string') {
      if (!item.trim() || item.length > REMARKS_LIMITS.itemChars) return { ok: false, message: `map.follow_up items must be 1 to ${REMARKS_LIMITS.itemChars} characters.` }
      out.push(item)
      continue
    }
    if (!isRecord(item)) return { ok: false, message: 'map.follow_up items must be text or an object with a question.' }
    const extra = onlyKeys(item, ['question', 'answer'], 'map.follow_up item')
    if (extra) return { ok: false, message: extra }
    const question = boundedText(item.question, REMARKS_LIMITS.itemChars, 'question', true)
    if (!question) return { ok: false, message: `map.follow_up item question must be 1 to ${REMARKS_LIMITS.itemChars} characters.` }
    const answer = boundedText(item.answer, REMARKS_LIMITS.itemChars, 'answer', false)
    if (answer === null) return { ok: false, message: `map.follow_up item answer must be at most ${REMARKS_LIMITS.itemChars} characters.` }
    out.push({ question, ...(answer ? { answer } : {}) })
  }
  return { ok: true, value: out }
}

export function parseRemarksMap(value: unknown): Parsed<RemarksMap> {
  if (!isRecord(value)) return { ok: false, message: 'map must be an object.' }
  const extra = onlyKeys(value, ['headline', 'background', 'relevance', 'information', 'ending', 'follow_up'], 'map')
  if (extra) return { ok: false, message: extra }
  const headline = boundedText(value.headline, REMARKS_LIMITS.headlineChars, 'headline', true)
  if (!headline) return { ok: false, message: `map.headline is required and must be at most ${REMARKS_LIMITS.headlineChars} characters.` }
  const background = parseTextArray(value.background, 'map.background')
  if (isParseFailure(background)) return fail(background)
  const relevance = parseTextArray(value.relevance, 'map.relevance')
  if (isParseFailure(relevance)) return fail(relevance)
  const information = parseInformation(value.information)
  if (isParseFailure(information)) return fail(information)
  const ending = boundedText(value.ending, REMARKS_LIMITS.endingChars, 'ending', false)
  if (ending === null) return { ok: false, message: `map.ending must be at most ${REMARKS_LIMITS.endingChars} characters.` }
  const followUp = parseFollowUp(value.follow_up)
  if (isParseFailure(followUp)) return fail(followUp)
  return {
    ok: true,
    value: {
      headline,
      ...(background.value ? { background: background.value } : {}),
      ...(relevance.value ? { relevance: relevance.value } : {}),
      ...(information.value ? { information: information.value } : {}),
      ...(ending ? { ending } : {}),
      ...(followUp.value ? { follow_up: followUp.value } : {}),
    },
  }
}

function parsePace(value: unknown): Parsed<PaceInput> {
  if (!isRecord(value)) return { ok: false, message: 'venue.pace must be { preset } or { measured: { words, seconds } }.' }
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === 'preset') {
    const preset = value.preset
    if (typeof preset === 'string' && preset in PACE_PRESETS) return { ok: true, value: { preset: preset as PacePreset } }
    return { ok: false, message: `venue.pace.preset must be one of ${Object.keys(PACE_PRESETS).join(', ')}.` }
  }
  if (keys.length === 1 && keys[0] === 'measured') {
    const measured = value.measured
    if (!isRecord(measured)) return { ok: false, message: 'venue.pace.measured must be { words, seconds }.' }
    const extra = onlyKeys(measured, ['words', 'seconds'], 'venue.pace.measured')
    if (extra) return { ok: false, message: extra }
    const { words, seconds } = measured
    if (!Number.isInteger(words) || (words as number) < REMARKS_LIMITS.measuredWordsMin || (words as number) > REMARKS_LIMITS.measuredWordsMax) {
      return { ok: false, message: `venue.pace.measured.words must be an integer from ${REMARKS_LIMITS.measuredWordsMin} to ${REMARKS_LIMITS.measuredWordsMax}.` }
    }
    if (!Number.isInteger(seconds) || (seconds as number) < REMARKS_LIMITS.measuredSecondsMin || (seconds as number) > REMARKS_LIMITS.measuredSecondsMax) {
      return { ok: false, message: `venue.pace.measured.seconds must be an integer from ${REMARKS_LIMITS.measuredSecondsMin} to ${REMARKS_LIMITS.measuredSecondsMax}.` }
    }
    return { ok: true, value: { measured: { words: words as number, seconds: seconds as number } } }
  }
  // A bare rate is rejected on purpose: the rate must come from a choice or a measurement.
  return { ok: false, message: 'venue.pace must be exactly { preset } or { measured: { words, seconds } }; a bare rate is not accepted.' }
}

export function parseVenue(value: unknown): Parsed<VenueInput> {
  if (!isRecord(value)) return { ok: false, message: 'venue is required and must be an object.' }
  const extra = onlyKeys(value, ['format', 'secondsTotal', 'secondsHard', 'questionReserveSeconds', 'questionsLikelyFrom', 'pace', 'audience', 'bodyName'], 'venue')
  if (extra) return { ok: false, message: extra }
  const format = value.format
  if (typeof format !== 'string' || !(REMARKS_FORMATS as readonly string[]).includes(format)) {
    return { ok: false, message: `venue.format must be one of ${REMARKS_FORMATS.join(', ')}.` }
  }
  const secondsTotal = value.secondsTotal
  if (!Number.isInteger(secondsTotal) || (secondsTotal as number) < REMARKS_LIMITS.minSeconds || (secondsTotal as number) > REMARKS_LIMITS.maxSeconds) {
    return { ok: false, message: `venue.secondsTotal must be an integer from ${REMARKS_LIMITS.minSeconds} to ${REMARKS_LIMITS.maxSeconds}.` }
  }
  if (typeof value.secondsHard !== 'boolean') return { ok: false, message: 'venue.secondsHard must be true or false.' }
  let questionReserveSeconds: number | undefined
  if (value.questionReserveSeconds !== undefined) {
    const reserve = value.questionReserveSeconds
    if (!Number.isInteger(reserve) || (reserve as number) < 0 || (reserve as number) > REMARKS_LIMITS.maxSeconds) {
      return { ok: false, message: 'venue.questionReserveSeconds must be a non-negative integer.' }
    }
    if (format !== 'statement_with_questions' && (reserve as number) > 0) {
      return { ok: false, message: 'venue.questionReserveSeconds applies only to statement_with_questions.' }
    }
    if ((reserve as number) >= (secondsTotal as number)) {
      return { ok: false, message: 'venue.questionReserveSeconds must be smaller than venue.secondsTotal.' }
    }
    questionReserveSeconds = reserve as number
  }
  let questionsLikelyFrom: VenueInput['questionsLikelyFrom']
  if (value.questionsLikelyFrom !== undefined) {
    const list = value.questionsLikelyFrom
    if (!Array.isArray(list) || list.length > QUESTION_SOURCES.length) return { ok: false, message: 'venue.questionsLikelyFrom must be a short array.' }
    const seen = new Set<string>()
    for (const item of list) {
      if (typeof item !== 'string' || !(QUESTION_SOURCES as readonly string[]).includes(item) || seen.has(item)) {
        return { ok: false, message: `venue.questionsLikelyFrom entries must be distinct values from ${QUESTION_SOURCES.join(', ')}.` }
      }
      seen.add(item)
    }
    questionsLikelyFrom = [...seen] as VenueInput['questionsLikelyFrom']
  }
  const pace = parsePace(value.pace)
  if (isParseFailure(pace)) return fail(pace)
  const audience = boundedText(value.audience, REMARKS_LIMITS.textChars, 'audience', false)
  const bodyName = boundedText(value.bodyName, REMARKS_LIMITS.textChars, 'bodyName', false)
  if (audience === null || bodyName === null) return { ok: false, message: `venue.audience and venue.bodyName must be at most ${REMARKS_LIMITS.textChars} characters.` }
  return {
    ok: true,
    value: {
      format: format as RemarksFormat,
      secondsTotal: secondsTotal as number,
      secondsHard: value.secondsHard,
      ...(questionReserveSeconds !== undefined ? { questionReserveSeconds } : {}),
      ...(questionsLikelyFrom ? { questionsLikelyFrom } : {}),
      pace: pace.value,
      ...(audience ? { audience } : {}),
      ...(bodyName ? { bodyName } : {}),
    },
  }
}

/** Strict parse of a remarks-plan.v1 request. Unknown fields are refused. */
export function parseRemarksRequest(value: unknown): Parsed<RemarksRequest> {
  if (!isRecord(value)) return { ok: false, message: 'The request body must be a JSON object.' }
  const extra = onlyKeys(value, ['schemaVersion', 'mode', 'venue', 'map', 'script', 'voice', 'saveToFramework', 'section'], 'request')
  if (extra) return { ok: false, message: extra }
  if (value.schemaVersion !== REMARKS_PLAN_VERSION) return { ok: false, message: `schemaVersion must be ${REMARKS_PLAN_VERSION}.` }
  const mode = value.mode
  if (typeof mode !== 'string' || !(REMARKS_MODES as readonly string[]).includes(mode)) {
    return { ok: false, message: `mode must be one of ${REMARKS_MODES.join(', ')}.` }
  }
  const venue = parseVenue(value.venue)
  if (isParseFailure(venue)) return fail(venue)
  let map: RemarksMap | undefined
  if (value.map !== undefined) {
    const parsed = parseRemarksMap(value.map)
    if (isParseFailure(parsed)) return fail(parsed)
    map = parsed.value
  }
  if ((mode === 'script' || mode === 'trim' || mode === 'coach') && !map) return { ok: false, message: `mode ${mode} requires map.` }
  let section: BranchKey | undefined
  if (value.section !== undefined) {
    if (typeof value.section !== 'string' || !(BRANCH_KEYS as readonly string[]).includes(value.section)) {
      return { ok: false, message: `section must be one of ${BRANCH_KEYS.join(', ')}.` }
    }
    if (mode !== 'coach') return { ok: false, message: 'section applies only to mode coach.' }
    section = value.section as BranchKey
  }
  if (mode === 'coach' && !section) return { ok: false, message: 'mode coach requires section.' }
  let script: string | undefined
  if (value.script !== undefined) {
    if (typeof value.script !== 'string') return { ok: false, message: 'script must be text.' }
    if (value.script.length > REMARKS_LIMITS.scriptChars) return { ok: false, message: `script must be at most ${REMARKS_LIMITS.scriptChars} characters.` }
    script = value.script
  }
  if ((mode === 'trim' || mode === 'check') && (!script || !script.trim())) return { ok: false, message: `mode ${mode} requires script.` }
  let voice: string | undefined
  if (value.voice !== undefined) {
    if (typeof value.voice !== 'string') return { ok: false, message: 'voice must be text.' }
    if (value.voice.length > REMARKS_LIMITS.voiceChars) return { ok: false, message: `voice must be at most ${REMARKS_LIMITS.voiceChars} characters.` }
    voice = value.voice
  }
  if (value.saveToFramework !== undefined && typeof value.saveToFramework !== 'boolean') return { ok: false, message: 'saveToFramework must be true or false.' }
  return {
    ok: true,
    value: {
      schemaVersion: REMARKS_PLAN_VERSION,
      mode: mode as RemarksMode,
      venue: venue.value,
      ...(map ? { map } : {}),
      ...(script !== undefined ? { script } : {}),
      ...(voice !== undefined ? { voice } : {}),
      ...(value.saveToFramework !== undefined ? { saveToFramework: value.saveToFramework as boolean } : {}),
      ...(section ? { section } : {}),
    },
  }
}

// ── Venue, budget, and pace ──────────────────────────────────────────────────

export function resolvePace(pace: PaceInput): { wpm: number; paceSource: string } {
  if ('measured' in pace) {
    return { wpm: Math.round((pace.measured.words / pace.measured.seconds) * 60), paceSource: 'measured' }
  }
  return { wpm: PACE_PRESETS[pace.preset], paceSource: `preset:${pace.preset}` }
}

export function resolveVenue(venue: VenueInput): { resolved: ResolvedVenue; warnings: RemarksWarning[] } {
  const warnings: RemarksWarning[] = []
  const { wpm, paceSource } = resolvePace(venue.pace)
  const targetFactor = venue.secondsHard ? HARD_CLOCK_FACTOR : SOFT_CLOCK_FACTOR
  let questionReserveSeconds = 0
  if (venue.format === 'statement_with_questions') {
    questionReserveSeconds = venue.questionReserveSeconds ?? Math.round(venue.secondsTotal / 3)
    if (questionReserveSeconds === 0) {
      warnings.push({
        code: 'no_question_reserve', severity: 'warning',
        message: 'This venue takes questions, but no time is held back for them. Reserve part of the slot or the questions eat the script.',
      })
    }
  }
  let scriptSeconds: number
  switch (venue.format) {
    case 'statement': scriptSeconds = Math.floor(venue.secondsTotal * targetFactor); break
    case 'statement_with_questions': scriptSeconds = Math.floor((venue.secondsTotal - questionReserveSeconds) * targetFactor); break
    case 'open_discussion': scriptSeconds = Math.floor(Math.min(OPEN_DISCUSSION_OPENING_SECONDS, venue.secondsTotal) * targetFactor); break
    case 'qa_only': scriptSeconds = 0; break
  }
  if (wpm > FAST_PACE_WPM) {
    warnings.push({
      code: 'pace_assumes_fast', severity: 'warning',
      message: `This plan assumes ${wpm} words a minute. Nervous speakers run 10 to 20 percent faster at the podium, so a script that only fits at this rate will not fit on the day.`,
      detail: { wpm },
    })
  } else if (wpm < SLOW_PACE_WPM) {
    warnings.push({
      code: 'pace_assumes_slow', severity: 'info',
      message: `This plan assumes ${wpm} words a minute. That is fine for a recording or an older audience; on a hard clock it holds fewer words than you may expect.`,
      detail: { wpm },
    })
  }
  if (paceSource !== 'measured') {
    warnings.push({
      code: 'no_measured_rate', severity: 'info',
      message: `This plan uses the ${paceSource.slice('preset:'.length)} preset (${wpm} words a minute). Time one read of any 200 words and resubmit with a measured pace.`,
      detail: { wpm },
    })
  }
  return {
    resolved: {
      format: venue.format,
      secondsTotal: venue.secondsTotal,
      secondsHard: venue.secondsHard,
      scriptSeconds,
      questionReserveSeconds,
      wpm,
      paceSource,
      targetFactor,
    },
    warnings,
  }
}

export function wordsFor(seconds: number, wpm: number): number {
  return Math.floor((seconds * wpm) / 60)
}

export function timeFor(words: number, wpm: number): number {
  return Math.round((words / wpm) * 60)
}

/** Speaking seconds before flooring, so targetWords floors once, as the contract states. */
function rawScriptSeconds(resolved: ResolvedVenue): number {
  switch (resolved.format) {
    case 'statement': return resolved.secondsTotal * resolved.targetFactor
    case 'statement_with_questions': return (resolved.secondsTotal - resolved.questionReserveSeconds) * resolved.targetFactor
    case 'open_discussion': return Math.min(OPEN_DISCUSSION_OPENING_SECONDS, resolved.secondsTotal) * resolved.targetFactor
    case 'qa_only': return 0
  }
}

export function budgetFor(resolved: ResolvedVenue, followUpCount = 0): Budget {
  const targetWords = wordsFor(rawScriptSeconds(resolved), resolved.wpm)
  const maxWords = resolved.format === 'qa_only' ? 0 : wordsFor(
    resolved.format === 'open_discussion' ? Math.min(OPEN_DISCUSSION_OPENING_SECONDS, resolved.secondsTotal)
      : resolved.secondsTotal - resolved.questionReserveSeconds,
    resolved.wpm,
  )
  const marks: ClockMark[] = []
  for (let at = CLOCK_MARK_SECONDS; at < resolved.scriptSeconds; at += CLOCK_MARK_SECONDS) {
    marks.push({ atSeconds: at, words: wordsFor(at, resolved.wpm) })
  }
  if (resolved.scriptSeconds > 0) marks.push({ atSeconds: resolved.scriptSeconds, words: targetWords })
  const allocation = ALLOCATION[resolved.format].map(([section, ratio]) => ({ section, words: Math.round(targetWords * ratio) }))
  const takesQuestions = resolved.format !== 'statement'
  const answerCards = takesQuestions
    ? {
        count: resolved.format === 'qa_only' || resolved.format === 'open_discussion'
          ? Math.max(followUpCount, 1)
          : Math.max(1, Math.floor(resolved.questionReserveSeconds / ANSWER_CARD_SECONDS)),
        wordsEach: wordsFor(ANSWER_CARD_SECONDS, resolved.wpm),
        secondsEach: ANSWER_CARD_SECONDS,
      }
    : null
  return { targetWords, maxWords, marks, allocation, answerCards }
}

// ── Text analysis ────────────────────────────────────────────────────────────

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“([])/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

export function sentenceLengths(text: string): number[] {
  return splitSentences(text).map(countWords)
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'by', 'with', 'at', 'from', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'that', 'this', 'these', 'those', 'it', 'its', 'we', 'our', 'us', 'you', 'your', 'they', 'their', 'them',
  'i', 'my', 'me', 'he', 'she', 'his', 'her', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'do', 'does', 'did',
  'not', 'no', 'so', 'if', 'than', 'then', 'there', 'here', 'before', 'after', 'about', 'into', 'over', 'under', 'again',
  'please', 'thank', 'thanks', 'tonight', 'today', 'ask', 'asks', 'asking', 'asked',
])

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map(word => word.replace(/^'+|'+$/g, ''))
    .filter(word => word.length > 2 && !STOPWORDS.has(word))
}

function sentenceCarriesAsk(sentence: string, headlineWords: string[]): boolean {
  if (headlineWords.length === 0) return false
  const present = new Set(contentWords(sentence))
  const hits = headlineWords.filter(word => present.has(word)).length
  const needed = Math.max(2, Math.ceil(headlineWords.length * 0.5))
  return hits >= Math.min(needed, headlineWords.length)
}

export function checkAskPlacement(script: string, headline: string, firstMarkWords: number | null): AskPlacement {
  const sentences = splitSentences(script)
  const headlineWords = [...new Set(contentWords(headline))]
  const carries = sentences.map(sentence => sentenceCarriesAsk(sentence, headlineWords))
  // "Good evening." is not a sentence a listener spends attention on. Only
  // substantive sentences (MIN_SUBSTANTIVE_WORDS or more) count toward "first two".
  const substantive = sentences
    .map((sentence, index) => ({ index, words: countWords(sentence) }))
    .filter(entry => entry.words >= MIN_SUBSTANTIVE_WORDS)
    .slice(0, 2)
    .map(entry => entry.index)
  const inFirstTwoSentences = substantive.some(index => carries[index])
  const inLastSentence = carries.length > 0 && carries[carries.length - 1]
  let beforeFirstMark = false
  if (firstMarkWords !== null) {
    let cumulative = 0
    for (let index = 0; index < sentences.length; index += 1) {
      cumulative += countWords(sentences[index])
      if (carries[index] && cumulative <= firstMarkWords) { beforeFirstMark = true; break }
      if (cumulative > firstMarkWords) break
    }
  } else {
    beforeFirstMark = inFirstTwoSentences
  }
  return { inFirstTwoSentences, inLastSentence, beforeFirstMark }
}

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'
const DATE_PATTERN = new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b|\\b\\d{1,2}\\s+(?:${MONTHS})\\.?(?:\\s+\\d{4})?\\b|\\b\\d{4}-\\d{2}(?:-\\d{2})?\\b`, 'gi')
const MONEY_PATTERN = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|million|thousand|billion))?/gi
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/g
const NUMBER_PATTERN = /\b\d[\d,]*(?:\.\d+)?(?:%|-plus|\+)?\b/g
const NAME_PATTERN = /\b(?:[A-Z][a-z]+(?:'s)?)(?:\s+(?:[A-Z][a-z]+(?:'s)?|of|the|and|de|la|le))*\b/g
const NAME_STOPLIST = new Set(['I', 'The', 'A', 'An', 'We', 'Our', 'You', 'Your', 'It', 'This', 'That', 'These', 'Those', 'If', 'In', 'On', 'At', 'For', 'To', 'And', 'But', 'So', 'Thank', 'Thanks', 'Good', 'Tonight', 'Today', 'Please', 'When', 'Where', 'What', 'Why', 'How', 'Here', 'There', 'My', 'Mr', 'Ms', 'Mrs', 'Dr'])

function normalizeForLookup(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9$%.]+/g, ' ').replace(/\.(?=\s|$)/g, '').replace(/\s+/g, ' ').trim()} `
}

export function mapText(map: RemarksMap): string {
  const parts: string[] = [map.headline]
  for (const item of map.background ?? []) parts.push(item)
  for (const item of map.relevance ?? []) parts.push(item)
  for (const item of map.information ?? []) {
    if (typeof item === 'string') parts.push(item)
    else parts.push(item.fact, item.date ?? '', item.place ?? '', item.source ?? '')
  }
  if (map.ending) parts.push(map.ending)
  for (const item of map.follow_up ?? []) {
    if (typeof item === 'string') parts.push(item)
    else parts.push(item.question, item.answer ?? '')
  }
  return parts.join('\n')
}

/**
 * Every number, date, year, dollar amount, or capitalised run in the script
 * that appears nowhere in the map. One-directional: output must come from
 * input. Flagged, never removed.
 */
export function factGuard(map: RemarksMap, script: string): FactGuardHit[] {
  const haystack = normalizeForLookup(mapText(map))
  const hits: FactGuardHit[] = []
  const seen = new Set<string>()
  const consider = (text: string, kind: FactGuardHit['kind'], position: number) => {
    const key = `${kind}:${text.toLowerCase()}`
    if (seen.has(key)) return
    const needle = normalizeForLookup(text).trim()
    if (!needle || haystack.includes(` ${needle} `)) return
    seen.add(key)
    hits.push({ text, kind, position })
  }
  for (const match of script.matchAll(MONEY_PATTERN)) consider(match[0], 'money', match.index ?? 0)
  for (const match of script.matchAll(DATE_PATTERN)) consider(match[0], 'date', match.index ?? 0)
  const scriptWithoutDates = script.replace(DATE_PATTERN, m => ' '.repeat(m.length)).replace(MONEY_PATTERN, m => ' '.repeat(m.length))
  for (const match of scriptWithoutDates.matchAll(YEAR_PATTERN)) consider(match[0], 'year', match.index ?? 0)
  const scriptWithoutYears = scriptWithoutDates.replace(YEAR_PATTERN, m => ' '.repeat(m.length))
  for (const match of scriptWithoutYears.matchAll(NUMBER_PATTERN)) {
    const text = match[0]
    if (/^\d{1,2}$/.test(text) && Number(text) <= 12) continue // ordinal noise: "two", "3 things"
    consider(text, 'number', match.index ?? 0)
  }
  for (const match of script.matchAll(NAME_PATTERN)) {
    const text = match[0].trim()
    const words = text.split(/\s+/)
    const index = match.index ?? 0
    const atSentenceStart = index === 0 || /[.!?]\s*["'“]?\s*$/.test(script.slice(Math.max(0, index - 3), index))
    if (words.length === 1) {
      if (NAME_STOPLIST.has(words[0]) || atSentenceStart) continue
    } else if (NAME_STOPLIST.has(words[0]) && words.length < 3) {
      continue
    }
    consider(text, 'name', index)
  }
  hits.sort((a, b) => a.position - b.position)
  return hits
}

export function answerCardsFor(map: RemarksMap, wpm: number): { cards: AnswerCard[]; unbudgeted: number[] } {
  const cards: AnswerCard[] = []
  const unbudgeted: number[] = []
  const maxWords = wordsFor(ANSWER_CARD_SECONDS, wpm)
  ;(map.follow_up ?? []).forEach((item, index) => {
    const question = typeof item === 'string' ? item : item.question
    const answer = typeof item === 'string' ? '' : (item.answer ?? '')
    const words = countWords(answer)
    if (!answer.trim() || words > maxWords) unbudgeted.push(index)
    cards.push({ question, answer, words, seconds: timeFor(words, wpm) })
  })
  return { cards, unbudgeted }
}

export function writtenSubmission(map: RemarksMap, venue: VenueInput): WrittenSubmission {
  const title = `Written comment for the record${venue.bodyName ? ` — ${venue.bodyName}` : ''}`
  const lines: string[] = []
  lines.push('[Name, organisation, contact]')
  lines.push('')
  lines.push(`Request: ${map.headline}`)
  if (map.ending) lines.push(`Outcome sought: ${map.ending}`)
  if (map.relevance?.length) {
    lines.push('')
    lines.push('Why now:')
    for (const item of map.relevance) lines.push(`- ${item}`)
  }
  if (map.information?.length) {
    lines.push('')
    lines.push('Facts:')
    for (const item of map.information) {
      if (typeof item === 'string') { lines.push(`- ${item}`); continue }
      const where = [item.date, item.place].filter(Boolean).join(', ')
      lines.push(`- ${item.fact}${where ? ` (${where})` : ''}${item.source ? ` [Source: ${item.source}]` : ''}`)
    }
  }
  if (map.background?.length) {
    lines.push('')
    lines.push('Background:')
    for (const item of map.background) lines.push(`- ${item}`)
  }
  if (map.follow_up?.length) {
    lines.push('')
    lines.push('Further detail and anticipated questions:')
    for (const item of map.follow_up) {
      if (typeof item === 'string') { lines.push(`- ${item}`); continue }
      lines.push(`- ${item.question}${item.answer ? ` ${item.answer}` : ''}`)
    }
  }
  return { title, lines }
}

export interface ScriptEvaluation {
  wordCount: number
  estimatedSeconds: number
  askPlacement: AskPlacement
  factGuard: FactGuardHit[]
  warnings: RemarksWarning[]
}

export function evaluateScript(
  script: string,
  map: RemarksMap | null,
  resolved: ResolvedVenue,
  budget: Budget,
): ScriptEvaluation {
  const warnings: RemarksWarning[] = []
  const wordCount = countWords(script)
  const estimatedSeconds = timeFor(wordCount, resolved.wpm)
  if (wordCount > budget.maxWords) {
    const overrunSeconds = Math.max(1, timeFor(wordCount - budget.maxWords, resolved.wpm))
    warnings.push({
      code: 'over_budget', severity: 'warning',
      message: `The script is ${wordCount} words; the slot holds ${budget.maxWords} at ${resolved.wpm} words a minute. That is about ${overrunSeconds} seconds over.`,
      detail: { wordCount, maxWords: budget.maxWords, overrunSeconds },
    })
  } else if (wordCount > budget.targetWords) {
    warnings.push({
      code: 'near_budget', severity: 'info',
      message: `The script is ${wordCount} words against a target of ${budget.targetWords}. It fits only if nothing goes wrong; cut to the target to leave room to breathe.`,
      detail: { wordCount, targetWords: budget.targetWords },
    })
  }
  const askPlacement = checkAskPlacement(script, map?.headline ?? '', budget.marks[0]?.words ?? null)
  if (map) {
    if (!askPlacement.beforeFirstMark) {
      warnings.push({
        code: 'ask_lost_if_cut', severity: 'warning',
        message: 'The ask does not appear before the first clock mark. If the chair stops you early, the record will not contain it. Put it in the first two sentences.',
      })
    }
    if (!askPlacement.inLastSentence) {
      warnings.push({
        code: 'ask_not_last', severity: 'info',
        message: 'The last sentence does not restate the ask. End on it so it is the last thing the room hears.',
      })
    }
  }
  const longSentences = sentenceLengths(script)
    .map((length, index) => (length > LONG_SENTENCE_WORDS ? index : -1))
    .filter(index => index >= 0)
  if (longSentences.length) {
    warnings.push({
      code: 'sentence_too_long', severity: 'info',
      message: `${longSentences.length} sentence${longSentences.length > 1 ? 's run' : ' runs'} past ${LONG_SENTENCE_WORDS} words. Those are the ones a speaker rushes or restarts.`,
      detail: { sentences: longSentences },
    })
  }
  if (resolved.format === 'statement') {
    const outsideQuotes = script.replace(/"[^"]*"|“[^”]*”/g, '')
    if (outsideQuotes.includes('?')) {
      warnings.push({
        code: 'audience_will_not_respond', severity: 'info',
        message: 'The script asks a question, and in this format nobody on the dais will answer it. Say what you want instead.',
      })
    }
  }
  const guard = map ? factGuard(map, script) : []
  if (guard.length) {
    warnings.push({
      code: 'fact_unsupported', severity: 'warning',
      message: `${guard.length} specific${guard.length > 1 ? 's' : ''} in the script ${guard.length > 1 ? 'do' : 'does'} not appear in the map. Check each one before it is said on the record.`,
      detail: { count: guard.length },
    })
  }
  return { wordCount, estimatedSeconds, askPlacement, factGuard: guard, warnings }
}

export function answerWarnings(unbudgeted: number[], wpm: number): RemarksWarning[] {
  if (!unbudgeted.length) return []
  return [{
    code: 'answers_unbudgeted', severity: 'warning',
    message: `${unbudgeted.length} prepared answer${unbudgeted.length > 1 ? 's are' : ' is'} missing or longer than a ${ANSWER_CARD_SECONDS}-second card (${wordsFor(ANSWER_CARD_SECONDS, wpm)} words at this pace).`,
    detail: { index: unbudgeted },
  }]
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength
}


// ── Map status: the deterministic fill state the mind map draws ─────────────

export type BranchState = 'empty' | 'started' | 'ready'
export interface BranchStatus { state: BranchState; items: number; reason: string | null }
export type MapStatus = Record<BranchKey, BranchStatus>

const DEADLINE_CUE = new RegExp(`\\b(?:by|before|until|no later than|this week|next week|tonight|tomorrow|today|${MONTHS})\\b|\\d`, 'i')

/**
 * Where each branch stands, by rule rather than by model, so the map's colours
 * mean the same thing with or without AI. "ready" is a floor, not praise: it
 * says the branch holds what the method asks of it.
 */
export function mapStatus(map: RemarksMap, format: RemarksFormat): MapStatus {
  const headlineWords = countWords(map.headline ?? '')
  const headline: BranchStatus = headlineWords === 0
    ? { state: 'empty', items: 0, reason: null }
    : headlineWords < 6
      ? { state: 'started', items: 1, reason: 'Say what you want done, by whom, in a full sentence.' }
      : headlineWords > 40
        ? { state: 'started', items: 1, reason: 'Cut it to one breath: under 40 words.' }
        : !DEADLINE_CUE.test(map.headline)
          ? { state: 'started', items: 1, reason: 'Add when you need it: a date or "before" something.' }
          : { state: 'ready', items: 1, reason: null }

  const list = (items: string[] | undefined, max: number, tooMany: string): BranchStatus => {
    const n = items?.length ?? 0
    if (n === 0) return { state: 'empty', items: 0, reason: null }
    if (n > max) return { state: 'started', items: n, reason: tooMany }
    return { state: 'ready', items: n, reason: null }
  }
  const background = list(map.background, 2, 'Keep only what this audience does not already know: one or two lines.')
  const relevance = list(map.relevance, 3, 'One reason this is timely is stronger than four.')

  const facts = map.information ?? []
  let information: BranchStatus
  if (facts.length === 0) information = { state: 'empty', items: 0, reason: null }
  else if (facts.length > 3) information = { state: 'started', items: facts.length, reason: 'Pick the two or three facts that carry the argument. The rest go in the written submission.' }
  else {
    const unsourced = facts.map((item, index) => (typeof item === 'string' || !item.source?.trim() ? index + 1 : 0)).filter(Boolean)
    information = unsourced.length
      ? { state: 'started', items: facts.length, reason: `Add a source you can produce for fact ${unsourced.join(' and ')}.` }
      : { state: 'ready', items: facts.length, reason: null }
  }

  const ending: BranchStatus = !map.ending?.trim()
    ? { state: 'empty', items: 0, reason: null }
    : !DEADLINE_CUE.test(map.ending)
      ? { state: 'started', items: 1, reason: 'Say when, and what success looks like.' }
      : { state: 'ready', items: 1, reason: null }

  const follow = map.follow_up ?? []
  let follow_up: BranchStatus
  if (follow.length === 0) follow_up = { state: 'empty', items: 0, reason: null }
  else if (format === 'statement') follow_up = { state: 'ready', items: follow.length, reason: null }
  else {
    const unanswered = follow.map((item, index) => (typeof item === 'string' || !item.answer?.trim() ? index + 1 : 0)).filter(Boolean)
    follow_up = unanswered.length
      ? { state: 'started', items: follow.length, reason: `Write a two-sentence answer for question ${unanswered.join(' and ')}.` }
      : { state: 'ready', items: follow.length, reason: null }
  }

  return { headline, background, relevance, information, ending, follow_up }
}

// ── Coach: one branch at a time ──────────────────────────────────────────────

export interface CoachResult {
  section: BranchKey
  status: 'strong' | 'needs_work' | 'empty'
  note: string
  suggestion: string | null
  questions: string[]
  /** Specifics the model's suggestion introduced; when non-empty the suggestion was withheld. */
  withheld: FactGuardHit[]
  nextSection: BranchKey | null
}

/** Branches whose wording the coach may offer back. Never Information: facts come from the speaker. */
export const COACH_MAY_REWORD: ReadonlySet<BranchKey> = new Set(['headline', 'background', 'relevance', 'ending'])

function clip(text: unknown, max: number): string {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/**
 * Turns whatever the model returned into a CoachResult the client can trust:
 * statuses from the enum, lengths capped, questions kept as questions, and a
 * suggested rewording dropped whenever it carries a specific the map lacks.
 */
export function sanitizeCoach(raw: unknown, section: BranchKey, map: RemarksMap, status: MapStatus): CoachResult {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ruleState = status[section].state
  let coachStatus: CoachResult['status'] = record.status === 'strong' || record.status === 'needs_work' || record.status === 'empty'
    ? record.status : ruleState === 'ready' ? 'strong' : ruleState === 'empty' ? 'empty' : 'needs_work'
  // The rules outrank the model in one direction: a branch the rules say is not
  // ready is never "strong", or the map would turn green on a missing source.
  if (ruleState !== 'ready' && coachStatus === 'strong') coachStatus = ruleState === 'empty' ? 'empty' : 'needs_work'
  const note = clip(record.note, COACH_LIMITS.noteChars) || status[section].reason || ''
  const questions = (Array.isArray(record.questions) ? record.questions : [])
    .map(question => clip(question, COACH_LIMITS.questionChars))
    .filter(question => question.length > 3)
    .map(question => (question.endsWith('?') ? question : `${question.replace(/[.!]+$/, '')}?`))
    .slice(0, COACH_LIMITS.questions)
  let suggestion: string | null = null
  let withheld: FactGuardHit[] = []
  const proposed = clip(record.suggestion, COACH_LIMITS.suggestionChars)
  if (proposed && COACH_MAY_REWORD.has(section)) {
    withheld = factGuard(map, proposed)
    if (withheld.length === 0) suggestion = proposed
  }
  const order = BRANCH_KEYS.indexOf(section)
  const nextSection = BRANCH_KEYS.slice(order + 1).find(key => status[key].state !== 'ready')
    ?? BRANCH_KEYS.slice(0, order).find(key => status[key].state !== 'ready')
    ?? null
  return { section, status: coachStatus, note, suggestion, questions, withheld, nextSection }
}

export const BRANCH_PURPOSE: Readonly<Record<BranchKey, string>> = Object.freeze({
  headline: 'The ask in one sentence: what the audience should do, and by when. It must survive being cut off after ten seconds.',
  background: 'Only what this audience does not already know about the speaker and their organisation. Usually one sentence.',
  relevance: 'Why now, and why this audience: what changed, what is pending, or what was promised.',
  information: 'Two or three facts, each with a date, a place, and a source the speaker can produce.',
  ending: 'The ask restated with the deadline and what success looks like.',
  follow_up: 'Questions the audience will ask afterward, each with a two-sentence answer; or, for a statement-only venue, what was cut and belongs in the written record.',
})
