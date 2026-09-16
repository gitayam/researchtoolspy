import { test, expect } from '@playwright/test'
import {
  aiModel,
  DEFAULT_MODELS,
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
})
