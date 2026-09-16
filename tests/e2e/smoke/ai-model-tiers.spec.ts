import { test, expect } from '@playwright/test'
import {
  aiModel,
  DEFAULT_MODELS,
  estimateCost,
  MODEL_PRICING,
  isReasoningModel,
  minCompletionTokens,
  normalizeChatRequest,
  resolveModel,
} from '../../../functions/api/_shared/ai-models'

/**
 * The model decision used to live at 58 call sites. These cases pin the three
 * things that consolidating it is supposed to buy: one place to re-point the
 * fleet, no retired model reaching the API, and a request shape that is legal
 * for the model it is actually sent to.
 */
test.describe('AI model tiers @smoke', () => {
  test('a tier resolves to its model, and an operator can re-point it', () => {
    expect(aiModel('cheap')).toBe(DEFAULT_MODELS.cheap)
    expect(aiModel('standard')).toBe(DEFAULT_MODELS.standard)
    expect(aiModel('premium')).toBe(DEFAULT_MODELS.premium)
    expect(aiModel()).toBe(DEFAULT_MODELS.cheap)

    expect(aiModel('cheap', { AI_MODEL_CHEAP: 'gpt-6-astra' })).toBe('gpt-6-astra')
    expect(aiModel('cheap', { AI_MODEL_CHEAP: '   ' })).toBe(DEFAULT_MODELS.cheap)
    // An override pointing at something retired is still a mistake.
    expect(aiModel('cheap', { AI_MODEL_CHEAP: 'gpt-4o-mini' })).toBe(DEFAULT_MODELS.cheap)
  })

  test('the two models this codebase hardcoded are remapped, not passed through', () => {
    expect(resolveModel('gpt-5.4-mini')).toBe(DEFAULT_MODELS.cheap)
    expect(resolveModel('gpt-5.4-nano')).toBe(DEFAULT_MODELS.cheap)
    expect(resolveModel('gpt-4o')).toBe(DEFAULT_MODELS.standard)
    // A model we have no opinion about is left alone.
    expect(resolveModel('gpt-6-astra')).toBe('gpt-6-astra')
    expect(resolveModel(undefined)).toBe(DEFAULT_MODELS.cheap)
  })

  test('reasoning-model detection covers the families that change the request shape', () => {
    for (const model of ['gpt-5.6-luna', 'gpt-5.4-mini', 'gpt-6-astra', 'o3', 'o1-preview']) {
      expect(isReasoningModel(model), model).toBe(true)
    }
    for (const model of ['gpt-4o', 'gpt-4-turbo', 'text-embedding-3-small']) {
      expect(isReasoningModel(model), model).toBe(false)
    }
  })

  test('a budget too small for the hidden reasoning phase is raised', () => {
    // The live case: generate-title asked for 50 completion tokens at 'low'
    // effort. The call succeeds and the content comes back EMPTY, because the
    // reasoning phase draws on the same allowance — so the caller's fallback
    // title was the only title that endpoint ever produced.
    const raised = normalizeChatRequest({
      tier: 'cheap',
      messages: [],
      reasoning_effort: 'low',
      max_completion_tokens: 50,
    })
    expect(raised.max_completion_tokens).toBe(minCompletionTokens())
    expect(raised.model).toBe(DEFAULT_MODELS.cheap)
    expect(raised.tier).toBeUndefined()

    // 'none' does no hidden reasoning, so that caller's budget is already right.
    const untouched = normalizeChatRequest({
      tier: 'cheap', messages: [], reasoning_effort: 'none', max_completion_tokens: 50,
    })
    expect(untouched.max_completion_tokens).toBe(50)

    // A budget already above the floor is never lowered.
    const generous = normalizeChatRequest({
      tier: 'cheap', messages: [], reasoning_effort: 'low', max_completion_tokens: 8000,
    })
    expect(generous.max_completion_tokens).toBe(8000)
  })

  test('parameters a reasoning model refuses are corrected, not forwarded', () => {
    // max_tokens is the legacy name and is rejected; the intent carries over.
    const renamed = normalizeChatRequest({ tier: 'cheap', messages: [], max_tokens: 4096 })
    expect(renamed.max_tokens).toBeUndefined()
    expect(renamed.max_completion_tokens).toBe(4096)

    // A caller asking for a temperature gets the effort that permits one,
    // rather than having the sampling it asked for silently dropped.
    const sampled = normalizeChatRequest({ tier: 'cheap', messages: [], temperature: 0.7 })
    expect(sampled.reasoning_effort).toBe('none')
    expect(sampled.temperature).toBe(0.7)

    // But an explicit effort wins, and then the temperature cannot come along.
    const deliberate = normalizeChatRequest({
      tier: 'cheap', messages: [], temperature: 0.7, reasoning_effort: 'high',
    })
    expect(deliberate.reasoning_effort).toBe('high')
    expect(deliberate.temperature).toBeUndefined()
  })

  test('a legacy chat model keeps the legacy shape', () => {
    const legacy = normalizeChatRequest({
      model: 'text-davinci-003', messages: [], max_tokens: 50, temperature: 0.7,
    })
    expect(legacy.max_tokens).toBe(50)
    expect(legacy.temperature).toBe(0.7)
    expect(legacy.reasoning_effort).toBeUndefined()
  })

  test('the completion floor is operator-tunable', () => {
    expect(minCompletionTokens()).toBe(2000)
    expect(minCompletionTokens({ AI_MIN_COMPLETION_TOKENS: '512' })).toBe(512)
    for (const bad of ['0', '-1', 'abc', '']) {
      expect(minCompletionTokens({ AI_MIN_COMPLETION_TOKENS: bad }), bad).toBe(2000)
    }
  })

  test('cost is priced per model, and retired prices are kept for old rows', () => {
    // 1M in + 1M out, so the assertion reads as the table.
    expect(estimateCost('gpt-5.6-luna', 1_000_000, 1_000_000)).toBeCloseTo(0.20 + 1.20, 6)
    expect(estimateCost('gpt-5.6-terra', 1_000_000, 1_000_000)).toBeCloseTo(2.00 + 12.00, 6)

    // Retired models keep their prices: a stored usage row must still cost out
    // against the model that actually served it.
    expect(MODEL_PRICING['gpt-5.4-mini']).toEqual({ input: 0.75, output: 4.50 })
    expect(estimateCost('gpt-5.4-mini', 1_000_000, 0)).toBeCloseTo(0.75, 6)

    // The bug this replaced: two copies of the table, both falling back to
    // gpt-5.4-mini for anything unlisted — which after the tier migration was
    // every call, overstating the reader's cost by 3.75x.
    expect(estimateCost('gpt-5.6-luna', 1_000_000, 0))
      .toBeLessThan(estimateCost('gpt-5.4-mini', 1_000_000, 0))

    // An unpriced model estimates at the cheap tier rather than at whatever
    // happened to be first in the table.
    expect(estimateCost('some-unreleased-model', 1_000_000, 0))
      .toBeCloseTo(MODEL_PRICING[DEFAULT_MODELS.cheap].input, 6)

    expect(estimateCost('gpt-5.6-luna', 0, 0)).toBe(0)
  })

  test('a reasoning effort the API no longer accepts is remapped', () => {
    // 'minimal' was the gpt-5.x name for the lowest setting and is now rejected
    // outright, so forwarding it is a hard error rather than a quieter answer.
    expect(normalizeChatRequest({ tier: 'cheap', messages: [], reasoning_effort: 'minimal' }).reasoning_effort)
      .toBe('low')
    // Something we have no mapping for falls through to the default, rather
    // than being passed along to be rejected.
    expect(normalizeChatRequest({ tier: 'cheap', messages: [], reasoning_effort: 'turbo' }).reasoning_effort)
      .toBe('low')
    for (const effort of ['none', 'low', 'medium', 'high', 'xhigh', 'max']) {
      expect(normalizeChatRequest({ tier: 'cheap', messages: [], reasoning_effort: effort }).reasoning_effort, effort)
        .toBe(effort)
    }
  })
})
