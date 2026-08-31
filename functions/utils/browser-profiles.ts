// Browser profile utilities for enhanced web scraping
// Helps bypass anti-bot protection by mimicking real browser requests

export interface BrowserProfile {
  name: string
  headers: Record<string, string>
}

/**
 * Request controls supported by {@link enhancedFetch}.
 *
 * Keep this narrower than RequestInit: the helper owns redirect handling and
 * only accepts the request-shaping fields it actually forwards to fetch.
 */
export interface EnhancedFetchOptions {
  referer?: string
  headers?: HeadersInit
  signal?: AbortSignal | null
  timeoutMs?: number
  maxRetries?: number
  retryDelay?: number
}

// Complete browser header sets that match real browsers in 2025
export const BROWSER_PROFILES: BrowserProfile[] = [
  {
    name: 'Chrome 135 Windows',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-CH-UA': '"Chromium";v="135", "Not A(Brand";v="8", "Google Chrome";v="135"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
    }
  },
  {
    name: 'Chrome 135 macOS',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-CH-UA': '"Chromium";v="135", "Not A(Brand";v="8", "Google Chrome";v="135"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"macOS"',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
    }
  },
  {
    name: 'Firefox 94 Windows',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:94.0) Gecko/20100101 Firefox/94.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  },
  {
    name: 'Safari 18.4 macOS',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4.1 Safari/605.1.15',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  }
]

/**
 * Get a random browser profile for request rotation
 * Helps avoid pattern detection by anti-bot systems
 */
export function getRandomProfile(): BrowserProfile {
  return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)]
}

/**
 * Add referer header if provided (makes request look more natural)
 */
export function addReferer(headers: Record<string, string>, referer?: string): Record<string, string> {
  if (referer) {
    return { ...headers, 'Referer': referer }
  }
  return headers
}

function createAbortError(reason?: unknown): Error {
  if (reason instanceof Error) return reason
  return new DOMException('The operation was aborted', 'AbortError')
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError(signal.reason))

  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const timeoutId = setTimeout(finish, ms)
    const abort = () => {
      clearTimeout(timeoutId)
      reject(createAbortError(signal?.reason))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

/**
 * Enhanced fetch with browser-like headers and retry logic
 *
 * @param url - URL to fetch
 * @param options - Optional fetch options
 * @returns Response from the fetch
 */
export async function enhancedFetch(
  url: string,
  options: EnhancedFetchOptions = {}
): Promise<Response> {
  const {
    referer,
    headers: requestHeaders,
    signal: callerSignal,
    timeoutMs,
    maxRetries = 3,
    retryDelay = 500,
  } = options

  if (!Number.isInteger(maxRetries) || maxRetries < 1) {
    throw new RangeError('maxRetries must be a positive integer')
  }
  if (!Number.isFinite(retryDelay) || retryDelay < 0) {
    throw new RangeError('retryDelay must be a non-negative number')
  }
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new RangeError('timeoutMs must be a positive number')
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })

  const timeoutId = timeoutMs === undefined
    ? undefined
    : setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)

  let lastError: Error | null = null

  try {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add respectful rate limiting and exponential retry backoff.
        const delayMs = attempt === 0 ? retryDelay : retryDelay * Math.pow(2, attempt - 1)
        await delay(delayMs, controller.signal)

        // Merge caller headers over the selected profile without discarding the
        // browser defaults. A supplied referer has the final say.
        const profile = getRandomProfile()
        const headers = new Headers(profile.headers)
        new Headers(requestHeaders).forEach((value, key) => headers.set(key, value))
        if (referer) headers.set('Referer', referer)

        const response = await fetch(url, {
          headers,
          redirect: 'follow',
          signal: controller.signal,
        })

        // Success - return response
        if (response.ok) {
          return response
        }

        // Handle rate limiting - retry with backoff
        if (response.status === 429 || response.status === 503) {
          lastError = new Error(`Rate limited: ${response.status} ${response.statusText}`)
          continue
        }

        // Other errors - return response (caller can handle)
        return response

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown fetch error')

        // Abort and timeout signals apply to the complete retry operation.
        if (controller.signal.aborted || attempt === maxRetries - 1) {
          throw lastError
        }
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('Failed to fetch after retries')
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}
