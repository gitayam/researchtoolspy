/**
 * Email Header Analyzer — F-6
 *
 * Pure client-side tool. Paste a raw email header block; the tool parses
 * and visualises:
 *   - Routing chain (Received: hops, oldest → newest, with delay analysis)
 *   - Authentication summary (SPF / DKIM / DMARC)
 *   - Key header fields
 */

import { useState } from 'react'
import { Mail, Shield, ChevronRight, AlertCircle, Clock, Server } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { parseEmailHeaders, type ParsedEmailHeaders, type AuthResult, type ReceivedHop } from '@/lib/email-header-parser'

// ─── Example placeholder ───────────────────────────────────────────────────

const EXAMPLE_HEADERS = `Received: from mail.example.com (mail.example.com [198.51.100.1])
        by mx.recipient.net (Postfix) with ESMTPS id A1B2C3D4E5
        for <user@recipient.net>; Mon, 01 Jan 2024 12:05:00 +0000 (UTC)
Received: from smtp.sender.org (smtp.sender.org [203.0.113.10])
        by mail.example.com (Postfix) with ESMTP id F6G7H8I9J0
        for <user@recipient.net>; Mon, 01 Jan 2024 12:04:45 +0000 (UTC)
Received: from [192.168.1.50] (unknown [192.168.1.50])
        by smtp.sender.org (Postfix) with ESMTPSA id K1L2M3N4O5
        for <user@recipient.net>; Mon, 01 Jan 2024 12:04:30 +0000 (UTC)
Authentication-Results: mx.recipient.net;
       spf=pass (sender IP is 203.0.113.10) smtp.mailfrom=sender.org;
       dkim=pass header.i=@sender.org header.s=2024;
       dmarc=pass action=none header.from=sender.org
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=sender.org; s=2024;
        h=from:to:subject:date:message-id;
        bh=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=;
        b=abc123...
From: Alice Sender <alice@sender.org>
To: Bob Recipient <user@recipient.net>
Subject: Test email with full headers
Date: Mon, 01 Jan 2024 12:04:28 +0000
Message-ID: <20240101120428.12345@sender.org>
Reply-To: replies@sender.org`.trim()

// ─── Auth badge helper ────────────────────────────────────────────────────

function authColor(result: AuthResult): string {
  switch (result) {
    case 'pass':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    case 'fail':
    case 'reject':
    case 'permerror':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    case 'softfail':
    case 'neutral':
    case 'temperror':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
    case 'none':
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

function AuthBadge({ label, result }: { label: string; result: AuthResult }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${authColor(result)}`}>
      {result === 'pass' ? '✓' : result === 'fail' || result === 'reject' ? '✗' : '~'} {label}: {result}
    </span>
  )
}

// ─── Delay formatter ─────────────────────────────────────────────────────

function formatDelay(seconds: number): string {
  if (seconds < 0) return `${Math.abs(seconds)}s (clock skew)`
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${seconds % 60}s`
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

// ─── Hop row ──────────────────────────────────────────────────────────────

function HopRow({ hop, isLast }: { hop: ReceivedHop; isLast: boolean }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="py-2 pr-3 text-center">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {hop.index}
        </span>
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={hop.from || '—'}>
        {hop.from || <span className="text-gray-400">—</span>}
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[180px] truncate" title={hop.by || '—'}>
        {hop.by || <span className="text-gray-400">—</span>}
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-blue-700 dark:text-blue-300">
        {hop.ip ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {hop.timestamp ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="py-2 text-xs">
        {!isLast && hop.delaySeconds !== null ? (
          <span className={`font-medium ${hop.delaySeconds > 300 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {formatDelay(hop.delaySeconds)}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── Results panel ────────────────────────────────────────────────────────

function Results({ parsed }: { parsed: ParsedEmailHeaders }) {
  const keyFields: Array<[string, string | null]> = [
    ['From', parsed.from],
    ['To', parsed.to],
    ['Subject', parsed.subject],
    ['Date', parsed.date],
    ['Message-ID', parsed.messageId],
    ['Reply-To', parsed.replyTo],
  ]

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {parsed.warnings.length > 0 && (
        <div className="flex gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <ul className="space-y-0.5 text-xs text-yellow-800 dark:text-yellow-300">
            {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Auth badges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Authentication Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <AuthBadge label="SPF" result={parsed.auth.spf} />
            <AuthBadge label="DKIM" result={parsed.auth.dkim} />
            <AuthBadge label="DMARC" result={parsed.auth.dmarc} />
          </div>
          {parsed.auth.raw && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                Raw authentication header(s)
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-900 dark:text-gray-300">
                {parsed.auth.raw}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Routing chain */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Routing Chain
            <Badge variant="secondary" className="ml-1 text-xs">
              {parsed.receivedHops.length} {parsed.receivedHops.length === 1 ? 'hop' : 'hops'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Hop 1 = oldest (entry point) → Hop {parsed.receivedHops.length} = most recent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parsed.receivedHops.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No Received: headers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 uppercase">
                    <th className="pb-1 pr-3">#</th>
                    <th className="pb-1 pr-3">From</th>
                    <th className="pb-1 pr-3">By</th>
                    <th className="pb-1 pr-3">IP</th>
                    <th className="pb-1 pr-3">Timestamp</th>
                    <th className="pb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Delay
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.receivedHops.map((hop, i) => (
                    <HopRow
                      key={hop.index}
                      hop={hop}
                      isLast={i === parsed.receivedHops.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key fields */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Key Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-gray-100 dark:divide-gray-800">
            {keyFields.map(([label, value]) => (
              value ? (
                <div key={label} className="flex gap-3 py-2 text-sm">
                  <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="break-all text-gray-900 dark:text-gray-100 font-mono text-xs leading-relaxed">
                    {value}
                  </dd>
                </div>
              ) : null
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function EmailHeaderAnalyzerPage() {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState<ParsedEmailHeaders | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = () => {
    setError(null)
    try {
      const result = parseEmailHeaders(raw)
      setParsed(result)
    } catch (e) {
      setError('Failed to parse headers: ' + String(e))
    }
  }

  const handleLoadExample = () => {
    setRaw(EXAMPLE_HEADERS)
    setParsed(null)
    setError(null)
  }

  const handleClear = () => {
    setRaw('')
    setParsed(null)
    setError(null)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Mail className="h-6 w-6 text-blue-600" />
          Email Header Analyzer
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Paste a raw email header block to visualize the routing chain, authentication results (SPF / DKIM / DMARC), and key fields.
          All analysis runs locally in your browser — no data is sent to any server.
        </p>
      </div>

      {/* Input card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Raw Email Headers</CardTitle>
          <CardDescription className="text-xs">
            In most email clients: View &rarr; Show Original (or &ldquo;Raw message&rdquo;). Paste the block of headers that appears before the blank line separating headers from the email body.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Paste raw email headers here…\n\nExample:\nReceived: from mail.example.com ([198.51.100.1]) by …\nFrom: alice@example.com\nTo: bob@example.net\n…`}
            className="min-h-48 font-mono text-xs"
            spellCheck={false}
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAnalyze} disabled={!raw.trim()}>
              <ChevronRight className="mr-1 h-4 w-4" />
              Analyze
            </Button>
            <Button variant="outline" onClick={handleLoadExample}>
              Load example
            </Button>
            {(raw || parsed) && (
              <Button variant="ghost" onClick={handleClear} className="ml-auto text-gray-500">
                Clear
              </Button>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {parsed && <Results parsed={parsed} />}
    </div>
  )
}
