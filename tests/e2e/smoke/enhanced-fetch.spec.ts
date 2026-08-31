/**
 * Pure-Node contract tests for the Cloudflare scraping request wrapper.
 * These tests mock outbound fetch and do not require a browser or live server.
 */
import { expect, test } from '@playwright/test'
import { enhancedFetch } from '../../../functions/utils/browser-profiles'

const originalFetch = globalThis.fetch

test.describe('enhancedFetch request contract @smoke', () => {
  test.afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('@smoke merges request headers and forwards an abort signal', async () => {
    let capturedInit: RequestInit | undefined

    globalThis.fetch = (async (_input, init) => {
      capturedInit = init
      return new Response('ok', { status: 200 })
    }) as typeof fetch

    const caller = new AbortController()
    const response = await enhancedFetch('https://example.com/article', {
      headers: {
        Accept: 'application/json',
        'X-Scrape-Contract': 'present',
      },
      referer: 'https://example.com/',
      signal: caller.signal,
      maxRetries: 1,
      retryDelay: 0,
    })

    expect(response.ok).toBe(true)
    expect(capturedInit?.redirect).toBe('follow')
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal)

    const headers = new Headers(capturedInit?.headers)
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('x-scrape-contract')).toBe('present')
    expect(headers.get('referer')).toBe('https://example.com/')
    expect(headers.get('user-agent')).toBeTruthy()
  })

  test('@smoke applies timeout to the complete retry operation', async () => {
    let requestCount = 0

    globalThis.fetch = ((_input, init) => {
      requestCount += 1
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    }) as typeof fetch

    await expect(enhancedFetch('https://example.com/slow', {
      timeoutMs: 20,
      maxRetries: 3,
      retryDelay: 0,
    })).rejects.toMatchObject({ name: 'TimeoutError' })

    expect(requestCount).toBe(1)
  })

  test('@smoke fails before fetch when the caller signal is already aborted', async () => {
    let requestCount = 0
    globalThis.fetch = (async () => {
      requestCount += 1
      return new Response('unexpected')
    }) as typeof fetch

    const caller = new AbortController()
    caller.abort()

    await expect(enhancedFetch('https://example.com/article', {
      signal: caller.signal,
      maxRetries: 1,
      retryDelay: 0,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(requestCount).toBe(0)
  })

  test('@smoke rejects invalid retry and timeout options', async () => {
    await expect(enhancedFetch('https://example.com', { maxRetries: 0 }))
      .rejects.toThrow('maxRetries must be a positive integer')
    await expect(enhancedFetch('https://example.com', { timeoutMs: 0 }))
      .rejects.toThrow('timeoutMs must be a positive number')
  })
})
