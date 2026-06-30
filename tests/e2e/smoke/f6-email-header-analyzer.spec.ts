/**
 * F-6 — Email Header Analyzer smoke tests
 *
 * These are pure Node/unit tests (no browser page navigation needed) that run
 * the parser directly — following the same pattern as submission-search.spec.ts.
 *
 * Guards:
 *   1. Parser file exists and exports parseEmailHeaders
 *   2. Routing chain parsing (multi-hop Received: headers)
 *   3. Authentication-Results parsing (SPF / DKIM / DMARC)
 *   4. spf=fail extraction
 *   5. Empty input returns empty result without throwing
 *   6. Whitespace-only input is safe
 *   7. Folded Received: header (continuation with leading whitespace) → single hop
 *   8. Received-SPF: fallback when Authentication-Results is absent
 *   9. Key header extraction (From, To, Subject, Message-ID)
 *  10. Route is registered in routes/index.tsx
 */

import { test, expect } from '@playwright/test'
import { parseEmailHeaders } from '../../../src/lib/email-header-parser'
import type { ParsedEmailHeaders } from '../../../src/lib/email-header-parser'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MULTI_HOP_HEADERS = `
Received: from mail.example.com (mail.example.com [198.51.100.1])
        by mx.recipient.net (Postfix) with ESMTPS id AAA
        for <user@recipient.net>; Mon, 01 Jan 2024 12:05:00 +0000 (UTC)
Received: from smtp.sender.org (smtp.sender.org [203.0.113.10])
        by mail.example.com (Postfix) with ESMTP id BBB
        for <user@recipient.net>; Mon, 01 Jan 2024 12:04:45 +0000 (UTC)
Received: from [192.168.1.50] (unknown [192.168.1.50])
        by smtp.sender.org (Postfix) with ESMTPSA id CCC
        for <user@recipient.net>; Mon, 01 Jan 2024 12:04:30 +0000 (UTC)
From: Alice <alice@sender.org>
To: Bob <user@recipient.net>
Subject: Test
Date: Mon, 01 Jan 2024 12:04:28 +0000
Message-ID: <20240101120428.12345@sender.org>
`.trim()

const AUTH_PASS_HEADERS = `
Received: from mail.example.com ([198.51.100.1])
        by mx.recipient.net with ESMTPS; Mon, 01 Jan 2024 12:05:00 +0000
Authentication-Results: mx.recipient.net;
       spf=pass smtp.mailfrom=example.com;
       dkim=pass header.i=@example.com;
       dmarc=pass action=none header.from=example.com
From: Alice <alice@example.com>
To: Bob <bob@recipient.net>
Subject: Auth pass test
`.trim()

const AUTH_FAIL_HEADERS = `
Received: from forged.example.com ([10.0.0.1])
        by mx.victim.net with ESMTP; Mon, 01 Jan 2024 12:00:00 +0000
Authentication-Results: mx.victim.net;
       spf=fail (sender not authorized) smtp.mailfrom=victim.net;
       dkim=fail header.i=@victim.net;
       dmarc=fail
From: Forged <no@victim.net>
`.trim()

// Folded Received: header — the "by" clause continues on the next line with leading whitespace
const FOLDED_RECEIVED = `
Received: from smtp.folded.example (smtp.folded.example [192.0.2.1])
\tby mx.receiver.net (Postfix) with ESMTP id XYZ123
\tfor <dest@receiver.net>; Mon, 01 Jan 2024 10:00:00 +0000 (UTC)
From: folded@example.com
To: dest@receiver.net
Subject: Folding test
`.trim()

const RECEIVED_SPF_ONLY = `
Received: from spf-only.example.com ([203.0.113.1])
        by mx.receiver.net with ESMTP; Mon, 01 Jan 2024 11:00:00 +0000
Received-SPF: pass (mx.receiver.net: 203.0.113.1 is permitted sender)
        receiver=mx.receiver.net; client-ip=203.0.113.1
From: sender@spf-only.example.com
`.trim()

const KEY_FIELDS_HEADERS = `
Received: from host.example.com ([1.2.3.4])
        by mx.example.net with ESMTP; Tue, 02 Jan 2024 08:00:00 +0000
From: Alice Wonderland <alice@example.com>
To: Bob Builder <bob@example.net>
Subject: Key fields extraction test
Date: Tue, 02 Jan 2024 08:00:00 +0000
Message-ID: <unique-message-id-12345@example.com>
Reply-To: noreply@example.com
`.trim()

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('F-6 Email Header Analyzer @smoke', () => {

  // 1. Source guard — parser module exists
  test('@smoke parser file exists at src/lib/email-header-parser.ts', () => {
    const parserPath = path.resolve(__dirname, '../../../src/lib/email-header-parser.ts')
    expect(fs.existsSync(parserPath)).toBe(true)
  })

  // 2. Multi-hop Received chain
  test('@smoke multi-hop Received: chain → correct hop count', () => {
    const result: ParsedEmailHeaders = parseEmailHeaders(MULTI_HOP_HEADERS)
    // 3 Received: headers → 3 hops
    expect(result.receivedHops).toHaveLength(3)
    // Hops are indexed 1, 2, 3
    expect(result.receivedHops[0].index).toBe(1)
    expect(result.receivedHops[2].index).toBe(3)
  })

  // 3. Authentication pass results
  test('@smoke Authentication-Results: spf=pass dkim=pass dmarc=pass → all pass', () => {
    const result = parseEmailHeaders(AUTH_PASS_HEADERS)
    expect(result.auth.spf).toBe('pass')
    expect(result.auth.dkim).toBe('pass')
    expect(result.auth.dmarc).toBe('pass')
  })

  // 4. Authentication fail results
  test('@smoke spf=fail dkim=fail dmarc=fail → all fail', () => {
    const result = parseEmailHeaders(AUTH_FAIL_HEADERS)
    expect(result.auth.spf).toBe('fail')
    expect(result.auth.dkim).toBe('fail')
    expect(result.auth.dmarc).toBe('fail')
  })

  // 5. Empty input
  test('@smoke empty string → empty result without throwing', () => {
    expect(() => parseEmailHeaders('')).not.toThrow()
    const result = parseEmailHeaders('')
    expect(result.receivedHops).toHaveLength(0)
    expect(result.from).toBeNull()
  })

  // 6. Whitespace-only input
  test('@smoke whitespace-only input → empty result without throwing', () => {
    expect(() => parseEmailHeaders('   \n  \t  \n  ')).not.toThrow()
    const result = parseEmailHeaders('   \n  \t  \n  ')
    expect(result.receivedHops).toHaveLength(0)
  })

  // 7. Folded Received: header → single hop (not split at continuation line)
  test('@smoke folded Received: header (tab-indented continuation) → single hop', () => {
    const result = parseEmailHeaders(FOLDED_RECEIVED)
    expect(result.receivedHops).toHaveLength(1)
    // The folded "by" clause should have been joined
    expect(result.receivedHops[0].by).toMatch(/mx\.receiver\.net/i)
  })

  // 8. Received-SPF: fallback when Authentication-Results is absent
  test('@smoke Received-SPF: fallback → spf extracted when no Authentication-Results', () => {
    const result = parseEmailHeaders(RECEIVED_SPF_ONLY)
    expect(result.auth.spf).toBe('pass')
    // dkim/dmarc absent → 'none'
    expect(result.auth.dkim).toBe('none')
    expect(result.auth.dmarc).toBe('none')
  })

  // 9. Key field extraction
  test('@smoke key fields extracted correctly', () => {
    const result = parseEmailHeaders(KEY_FIELDS_HEADERS)
    expect(result.from).toMatch(/alice@example\.com/)
    expect(result.to).toMatch(/bob@example\.net/)
    expect(result.subject).toBe('Key fields extraction test')
    expect(result.messageId).toMatch(/unique-message-id-12345/)
    expect(result.replyTo).toMatch(/noreply@example\.com/)
  })

  // 10. Route is registered in routes/index.tsx
  test('@smoke route /dashboard/tools/email-header-analyzer registered in routes/index.tsx', () => {
    const routesPath = path.resolve(__dirname, '../../../src/routes/index.tsx')
    expect(fs.existsSync(routesPath)).toBe(true)
    const content = fs.readFileSync(routesPath, 'utf-8')
    expect(content).toContain('email-header-analyzer')
    expect(content).toContain('EmailHeaderAnalyzerPage')
  })

})
