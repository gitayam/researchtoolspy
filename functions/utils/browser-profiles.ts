// Browser profile utilities for enhanced web scraping
// Helps bypass anti-bot protection by mimicking real browser requests

export interface BrowserProfile {
  name: string
  headers: Record<string, string>
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

/**
 * Enhanced fetch with browser-like headers and retry logic
 *
 * @param url - URL to fetch
 * @param options - Optional fetch options
 * @returns Response from the fetch
 */
export async function enhancedFetch(
  url: string,
  options: {
    referer?: string
    maxRetries?: number
    retryDelay?: number
  } = {}
): Promise<Response> {
  const { referer, maxRetries = 3, retryDelay = 500 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add respectful rate limiting (500ms delay)
      if (attempt > 0) {
        const delay = retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Get random browser profile
      const profile = getRandomProfile()
      const headers = addReferer(profile.headers, referer)

      const response = await fetch(url, {
        headers,
        redirect: 'follow'
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

      // If last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError
      }
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Failed to fetch after retries')
}
