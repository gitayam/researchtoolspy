/**
 * Email header parser — pure TypeScript, no external dependencies, no browser APIs.
 *
 * Parses raw email headers (the full text block above the body) and extracts:
 *   - Received hop chain (routing)
 *   - Authentication results (SPF, DKIM, DMARC)
 *   - Key headers (From, To, Subject, Date, Message-ID, Reply-To)
 *   - Delay between consecutive hops
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthResult = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'reject' | 'temperror' | 'permerror' | 'unknown'

export interface ReceivedHop {
  /** 1-based index, 1 = earliest (oldest header, bottom of stack) */
  index: number
  /** "from" clause — the sending host/IP string */
  from: string
  /** "by" clause — the receiving MTA */
  by: string
  /** IPv4 or IPv6 extracted from the hop, if found */
  ip: string | null
  /** Timestamp string from the ";" at end of Received header */
  timestamp: string | null
  /** Parsed Date object, null if unparseable */
  date: Date | null
  /** Seconds between this hop and the NEXT hop; null for the last hop */
  delaySeconds: number | null
  /** Full raw text of the unfolded Received header value */
  raw: string
}

export interface AuthResults {
  spf: AuthResult
  dkim: AuthResult
  dmarc: AuthResult
  /** Raw Authentication-Results header value(s) for display */
  raw: string
}

export interface ParsedEmailHeaders {
  /** Routing chain, index 1 = oldest (furthest from recipient) */
  receivedHops: ReceivedHop[]
  auth: AuthResults
  from: string | null
  to: string | null
  subject: string | null
  date: string | null
  messageId: string | null
  replyTo: string | null
  /** Any parse warnings */
  warnings: string[]
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Unfold RFC 5322 header folding: continuation lines (starting with SP or HT)
 * are joined to the preceding line.  Returns an array of [name, value] pairs
 * preserving order.
 */
function unfoldHeaders(raw: string): Array<{ name: string; value: string }> {
  // Normalize CRLF → LF
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const headers: Array<{ name: string; value: string }> = []
  let current: { name: string; value: string } | null = null

  for (const line of text.split('\n')) {
    if (line === '') {
      // Blank line = end of header section
      if (current) headers.push(current)
      current = null
      break
    }

    if (/^[ \t]/.test(line)) {
      // Continuation line
      if (current) {
        current.value += ' ' + line.trim()
      }
    } else {
      // New header
      if (current) headers.push(current)
      const colon = line.indexOf(':')
      if (colon !== -1) {
        current = {
          name: line.slice(0, colon).trim().toLowerCase(),
          value: line.slice(colon + 1).trim(),
        }
      } else {
        // Malformed line — skip
        current = null
      }
    }
  }

  if (current) headers.push(current)
  return headers
}

/**
 * Extract all values for a given header name (lowercase).
 * Returns an empty array when the header is absent.
 */
function getHeaderValues(headers: Array<{ name: string; value: string }>, name: string): string[] {
  return headers.filter(h => h.name === name).map(h => h.value)
}

/**
 * Extract the first value for a given header name, or null.
 */
function getFirstHeader(headers: Array<{ name: string; value: string }>, name: string): string | null {
  const found = headers.find(h => h.name === name)
  return found ? found.value : null
}

/**
 * Extract IP from a Received hop string.
 * Looks for [x.x.x.x], IPv6 in brackets, or "from host (host [ip])" patterns.
 */
function extractIp(hopText: string): string | null {
  // IPv4 in brackets
  const ipv4 = hopText.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/)
  if (ipv4) return ipv4[1]

  // IPv6 in brackets — e.g. [IPv6:2001:db8::1]
  const ipv6 = hopText.match(/\[IPv6:([^\]]+)\]/i)
  if (ipv6) return ipv6[1]

  // Bare IPv6 in brackets
  const bareIpv6 = hopText.match(/\[([0-9a-fA-F:]{3,39})\]/)
  if (bareIpv6) return bareIpv6[1]

  return null
}

/**
 * Parse the semicolon-delimited timestamp at the end of a Received header.
 * Returns { raw, date } or null.
 */
function extractTimestamp(hopText: string): { raw: string; date: Date | null } | null {
  // Received: ... ; Mon, 01 Jan 2024 12:00:00 +0000
  const semicolonIdx = hopText.lastIndexOf(';')
  if (semicolonIdx === -1) return null

  const rawTs = hopText.slice(semicolonIdx + 1).trim()
  if (!rawTs) return null

  const date = parseDate(rawTs)
  return { raw: rawTs, date }
}

/**
 * Attempt to parse an RFC 2822 date string.  Returns null on failure.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

/**
 * Extract "from ..." clause from a Received hop.
 */
function extractFrom(hopText: string): string {
  const m = hopText.match(/^from\s+(.+?)(?:\s+by\s+|\s+with\s+|\s+for\s+|;|$)/i)
  return m ? m[1].trim() : ''
}

/**
 * Extract "by ..." clause from a Received hop.
 */
function extractBy(hopText: string): string {
  const m = hopText.match(/\bby\s+(.+?)(?:\s+with\s+|\s+for\s+|\s+via\s+|;|$)/i)
  return m ? m[1].trim() : ''
}

/**
 * Parse an AuthResult keyword from a string fragment.
 */
function parseAuthResult(fragment: string): AuthResult {
  const v = fragment.toLowerCase().trim()
  const known: AuthResult[] = ['pass', 'fail', 'softfail', 'neutral', 'none', 'reject', 'temperror', 'permerror']
  for (const k of known) {
    if (v === k || v.startsWith(k)) return k
  }
  return 'unknown'
}

/**
 * Extract SPF/DKIM/DMARC results from Authentication-Results header values
 * or Received-SPF header.
 */
function parseAuthHeaders(
  authResultsValues: string[],
  receivedSpfValues: string[],
): AuthResults {
  let spf: AuthResult = 'none'
  let dkim: AuthResult = 'none'
  let dmarc: AuthResult = 'none'
  const rawParts: string[] = []

  for (const arv of authResultsValues) {
    rawParts.push(arv)

    // spf=<result>
    const spfMatch = arv.match(/\bspf=(\S+)/i)
    if (spfMatch && spf === 'none') spf = parseAuthResult(spfMatch[1])

    // dkim=<result>
    const dkimMatch = arv.match(/\bdkim=(\S+)/i)
    if (dkimMatch && dkim === 'none') dkim = parseAuthResult(dkimMatch[1])

    // dmarc=<result>
    const dmarcMatch = arv.match(/\bdmarc=(\S+)/i)
    if (dmarcMatch && dmarc === 'none') dmarc = parseAuthResult(dmarcMatch[1])
  }

  // Fall back to Received-SPF: if Authentication-Results didn't have it
  if (spf === 'none' && receivedSpfValues.length > 0) {
    const spfRaw = receivedSpfValues[0].trim()
    rawParts.push(`Received-SPF: ${spfRaw}`)
    const m = spfRaw.match(/^(\w+)/i)
    if (m) spf = parseAuthResult(m[1])
  }

  return {
    spf,
    dkim,
    dmarc,
    raw: rawParts.join('\n'),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a raw email header block (text above the blank line separating headers
 * from body) and return a structured representation.
 *
 * Handles:
 *   - RFC 5322 folded headers (continuation lines starting with whitespace)
 *   - Multiple Received: headers forming a routing chain
 *   - Authentication-Results: and Received-SPF: for auth status
 *   - Empty / whitespace-only input (returns empty result without throwing)
 */
export function parseEmailHeaders(rawText: string): ParsedEmailHeaders {
  const empty: ParsedEmailHeaders = {
    receivedHops: [],
    auth: { spf: 'none', dkim: 'none', dmarc: 'none', raw: '' },
    from: null,
    to: null,
    subject: null,
    date: null,
    messageId: null,
    replyTo: null,
    warnings: [],
  }

  if (!rawText || rawText.trim() === '') {
    return empty
  }

  const warnings: string[] = []
  let headers: Array<{ name: string; value: string }>

  try {
    headers = unfoldHeaders(rawText)
  } catch (e) {
    return { ...empty, warnings: ['Header unfolding failed: ' + String(e)] }
  }

  // ── Received hops ──────────────────────────────────────────────────────────
  // Email standards stack Received headers: topmost = most recent.
  // We reverse so index 1 = oldest (entry point into the network).
  const receivedRaw = getHeaderValues(headers, 'received')
  const hopsReversed = [...receivedRaw].reverse()

  const receivedHops: ReceivedHop[] = hopsReversed.map((raw, i) => {
    const ts = extractTimestamp(raw)
    return {
      index: i + 1,
      from: extractFrom(raw),
      by: extractBy(raw),
      ip: extractIp(raw),
      timestamp: ts ? ts.raw : null,
      date: ts ? ts.date : null,
      delaySeconds: null, // filled below
      raw,
    }
  })

  // Calculate delays between consecutive hops
  for (let i = 0; i < receivedHops.length - 1; i++) {
    const cur = receivedHops[i]
    const next = receivedHops[i + 1]
    if (cur.date && next.date) {
      cur.delaySeconds = Math.round((next.date.getTime() - cur.date.getTime()) / 1000)
    }
  }

  // ── Authentication ─────────────────────────────────────────────────────────
  const authResultsValues = getHeaderValues(headers, 'authentication-results')
  const receivedSpfValues = getHeaderValues(headers, 'received-spf')
  const auth = parseAuthHeaders(authResultsValues, receivedSpfValues)

  // ── Key fields ─────────────────────────────────────────────────────────────
  const from = getFirstHeader(headers, 'from')
  const to = getFirstHeader(headers, 'to')
  const subject = getFirstHeader(headers, 'subject')
  const date = getFirstHeader(headers, 'date')
  const messageId = getFirstHeader(headers, 'message-id')
  const replyTo = getFirstHeader(headers, 'reply-to')

  if (receivedHops.length === 0) {
    warnings.push('No Received: headers found — routing chain will be empty.')
  }

  return {
    receivedHops,
    auth,
    from,
    to,
    subject,
    date,
    messageId,
    replyTo,
    warnings,
  }
}
