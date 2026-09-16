/**
 * Which model each workload uses — decided once, here.
 *
 * Before this module the answer was written out at 58 call sites across 37
 * files, as a literal string next to the prompt. Re-pointing the product at a
 * new generation meant finding every one of them, and the two literals actually
 * in use had both been superseded on price.
 *
 * Call sites ask for a *tier*. A tier resolves to a model, an operator can
 * override it per environment, and nothing downstream has to know the ID.
 *
 * | Tier       | Default model   | $/M in | $/M out | Use for                         |
 * |------------|-----------------|--------|---------|---------------------------------|
 * | `cheap`    | `gpt-5.6-luna`  | $0.20  | $1.20   | classification, JSON extraction, |
 * |            |                 |        |         | entity tagging, summaries        |
 * | `standard` | `gpt-5.6-terra` | $2.00  | $12.00  | synthesis the reader will judge  |
 * | `premium`  | `gpt-5.6-sol`   | $4.00  | $20.00  | rarely justified                 |
 *
 * `gpt-5.6-luna` supersedes both models this codebase had hardcoded:
 * `gpt-5.4-mini` ($0.75/$4.50) and `gpt-5.4-nano` ($0.20/$1.25). It is cheaper
 * than either on both axes while sitting in the newer flagship family, so there
 * is no separate nano tier to keep.
 *
 * This deliberately mirrors `packages/shared-utils/src/ai-models.ts` in the
 * IrregularChat monorepo — same tier names, same env var names, same retired-model
 * remapping — so the two products can be re-pointed by the same operator action.
 * It is a copy rather than a dependency because that package is not published and
 * this is a Pages Functions bundle in a different repository.
 *
 * Env overrides (all optional): `AI_MODEL_CHEAP`, `AI_MODEL_STANDARD`,
 * `AI_MODEL_PREMIUM`, `AI_MODEL_EMBEDDING`, `AI_MIN_COMPLETION_TOKENS`.
 */

export type ModelTier = 'cheap' | 'standard' | 'premium'

/**
 * Any environment bag: a Pages Functions `env`, a plain object, a test fixture.
 *
 * Typed as `object` rather than an index signature on purpose. A Worker's `Env`
 * interface declares named bindings and has no index signature, so it is not
 * assignable to `Record<string, unknown>` — every call site would need a cast,
 * and a cast at 40 call sites is how the bindings stop being checked at all.
 */
export type EnvBag = object

/** Verified against OpenAI's catalog, September 2026. */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
  cheap: 'gpt-5.6-luna',
  standard: 'gpt-5.6-terra',
  premium: 'gpt-5.6-sol',
}

const TIER_ENV_KEYS: Record<ModelTier, string> = {
  cheap: 'AI_MODEL_CHEAP',
  standard: 'AI_MODEL_STANDARD',
  premium: 'AI_MODEL_PREMIUM',
}

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * Models that must not be used, mapped to the tier that replaces them.
 *
 * Two reasons to land here: a generation we have moved off (`gpt-4o*`,
 * `gpt-4-turbo`, the `gpt-5.4` family), or a floating alias whose target changes
 * under us (`gpt-5-mini`, `gpt-5-nano`). A missed call site is remapped and
 * warned about rather than failed — "correct but logged" beats a 400 in front of
 * a reader, and the warning is what gets the call site fixed.
 */
const RETIRED_MODELS: Record<string, ModelTier> = {
  'gpt-3.5-turbo': 'cheap',
  'gpt-4': 'standard',
  'gpt-4-turbo': 'standard',
  'gpt-4o': 'standard',
  'gpt-4o-mini': 'cheap',
  'gpt-5-mini': 'cheap',
  'gpt-5-nano': 'cheap',
  'gpt-5.4-nano': 'cheap',
  'gpt-5.4-mini': 'cheap',
  'gpt-5.4': 'standard',
}

/** Warn once per distinct retired model, so a hot path does not flood the log. */
const warnedRetired = new Set<string>()

function readEnv(key: string, env?: EnvBag): string | undefined {
  const value = (env as Record<string, unknown> | undefined)?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function warnRetired(model: string, replacement: string, source: string): void {
  if (warnedRetired.has(model)) return
  warnedRetired.add(model)
  console.warn(
    `[AIModels] "${model}" is retired (${source}) — using "${replacement}" instead. `
    + `Ask for a tier (\`tier: '<tier>'\`) or set the AI_MODEL_* env var.`,
  )
}

/** Resolve a tier to a concrete model ID. */
export function aiModel(tier: ModelTier = 'cheap', env?: EnvBag): string {
  const override = readEnv(TIER_ENV_KEYS[tier], env)
  if (override) {
    // An operator override pointing at a retired model is still a mistake.
    const remapped = RETIRED_MODELS[override]
    if (remapped) {
      warnRetired(override, DEFAULT_MODELS[remapped], `${TIER_ENV_KEYS[tier]} env var`)
      return DEFAULT_MODELS[remapped]
    }
    return override
  }
  return DEFAULT_MODELS[tier]
}

/** Embedding model (OpenAI-only). */
export function aiEmbeddingModel(env?: EnvBag): string {
  return readEnv('AI_MODEL_EMBEDDING', env) || DEFAULT_EMBEDDING_MODEL
}

/**
 * Normalize a caller-supplied model string: unchanged unless retired, in which
 * case it becomes the replacement tier's model. `undefined` yields the tier default.
 */
export function resolveModel(model: unknown, tier: ModelTier = 'cheap', env?: EnvBag): string {
  if (typeof model !== 'string' || !model) return aiModel(tier, env)

  const remapTier = RETIRED_MODELS[model]
  if (remapTier) {
    const replacement = aiModel(remapTier, env)
    warnRetired(model, replacement, 'call site')
    return replacement
  }
  return model
}

/**
 * Whether a model is a reasoning model, which changes the legal request shape:
 * `max_completion_tokens` rather than `max_tokens`, `reasoning_effort` support,
 * and no `temperature` unless `reasoning_effort` is `'none'`.
 *
 * Covers the gpt-5.x and gpt-6.x families plus the o-series.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-[56]([.-]|$)|o[1-9]([.-]|$))/.test(model)
}

/**
 * Floor for `max_completion_tokens` on a reasoning model.
 *
 * A reasoning model spends hidden tokens before it emits any content, and both
 * draw on the same allowance. Ask for 50 and the reasoning phase consumes the
 * whole budget: the call succeeds, `content` is empty, and the caller's `||`
 * fallback covers it — so the failure is invisible and permanent.
 *
 * Raising the ceiling costs nothing. Output tokens are billed on what is
 * actually generated, never on the cap.
 *
 * Override with `AI_MIN_COMPLETION_TOKENS`.
 */
export function minCompletionTokens(env?: EnvBag): number {
  const raw = readEnv('AI_MIN_COMPLETION_TOKENS', env)
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000
}

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * Make a chat-completions body valid for the model it will actually be sent to.
 *
 * The three disagreements between reasoning and legacy chat models are each a
 * hard failure rather than a soft downgrade, and one of them is silent:
 *
 *   - `max_tokens` is rejected outright
 *   - `temperature` is rejected unless `reasoning_effort` is `'none'`
 *   - too small an output budget returns an EMPTY completion
 *
 * A caller that wants a specific temperature gets `reasoning_effort: 'none'`
 * rather than having its temperature dropped, because dropping it changes the
 * sampling the caller asked for without telling anyone.
 */
export function normalizeChatRequest(
  request: Record<string, unknown>,
  env?: EnvBag,
): Record<string, unknown> {
  const body = { ...request }

  const tier = body.tier
  delete body.tier
  body.model = typeof tier === 'string'
    ? aiModel(tier as ModelTier, env)
    : resolveModel(body.model, 'cheap', env)

  if (!isReasoningModel(body.model as string)) return body

  // `max_tokens` is the legacy name and is refused; carry the caller's intent over.
  if (body.max_tokens !== undefined) {
    if (body.max_completion_tokens === undefined) body.max_completion_tokens = body.max_tokens
    delete body.max_tokens
  }

  const wantsTemperature = body.temperature !== undefined
  const effort = (body.reasoning_effort as ReasoningEffort | undefined)
    ?? (wantsTemperature ? 'none' : 'low')
  body.reasoning_effort = effort

  if (typeof body.max_completion_tokens === 'number' && effort !== 'none') {
    // 'none' does no hidden reasoning, so that caller's budget is already right.
    body.max_completion_tokens = Math.max(body.max_completion_tokens, minCompletionTokens(env))
  }

  if (wantsTemperature && effort !== 'none') delete body.temperature

  return body
}
