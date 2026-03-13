/**
 * CopClaimsPanel — Extract and analyze claims from URLs within a COP session
 *
 * Allows users to submit URLs, extracts factual claims via AI analysis,
 * and displays risk scores with deception detection results.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Loader2,
  LinkIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileWarning,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  MessageSquareText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCopHeaders } from '@/lib/cop-auth'

// ── Types ────────────────────────────────────────────────────────

interface ExtractedClaim {
  id?: string
  claim: string
  category?: string
  confidence?: number
  suggested_market?: string
  status?: 'unverified' | 'verified' | 'disputed' | 'false'
  evidence_item_id?: number | null
}

interface ClaimAnalysisResult {
  url: string
  title?: string
  domain?: string
  claims: ExtractedClaim[]
  summary?: string
  entity_count?: number
  analyzed_at: string
}

interface CopClaimsPanelProps {
  sessionId: string
  expanded: boolean
  highlightEntityId?: string
}

// ── Helpers ──────────────────────────────────────────────────────

function getRiskBadge(confidence: number | undefined) {
  const score = confidence ?? 50
  if (score >= 80) return { label: 'High confidence', color: 'bg-emerald-600 text-white', icon: CheckCircle2 }
  if (score >= 50) return { label: 'Medium', color: 'bg-amber-600 text-white', icon: AlertTriangle }
  return { label: 'Low confidence', color: 'bg-red-600 text-white', icon: XCircle }
}

function getCategoryColor(category: string | undefined) {
  switch (category?.toLowerCase()) {
    case 'statement': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'quote': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'statistic': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'event': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    case 'relationship': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

/** Detect if input looks like a URL (has a dot-separated domain pattern) */
function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim()
  // Starts with http(s):// or has domain-like pattern (e.g., "example.com/path")
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}/i.test(trimmed)) return true
  return false
}

// ── Component ────────────────────────────────────────────────────

export default function CopClaimsPanel({ sessionId, expanded, highlightEntityId }: CopClaimsPanelProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ClaimAnalysisResult[]>([])
  const [expandedClaims, setExpandedClaims] = useState<Record<number, boolean>>({})

  // Scroll to and highlight a specific claim when requested
  useEffect(() => {
    if (!highlightEntityId) return
    const timer = setTimeout(() => {
      const el = Array.from(document.querySelectorAll(`[data-claim-id="${highlightEntityId}"]`))
        .find(el => (el as HTMLElement).offsetParent !== null) as HTMLElement | undefined
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-yellow-400', 'transition-all')
        setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400'), 2000)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [highlightEntityId])

  // Load persisted claims from DB on mount
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/cop/${sessionId}/claims`, { headers: getCopHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.claims?.length) return
        // Group by URL
        const grouped = new Map<string, ClaimAnalysisResult>()
        for (const c of data.claims) {
          // Manual claims (no URL) each get their own group by ID
          const key = c.url || `manual-${c.id}`
          if (!grouped.has(key)) {
            grouped.set(key, {
              url: c.url || '',
              title: c.url_title || (c.url ? undefined : 'Manual claim'),
              domain: c.url_domain,
              claims: [],
              summary: c.summary,
              analyzed_at: c.created_at,
            })
          }
          grouped.get(key)!.claims.push({
            id: c.id,
            claim: c.claim_text,
            category: c.category,
            confidence: c.confidence,
            status: c.status,
            evidence_item_id: c.evidence_item_id,
          })
        }
        setResults(Array.from(grouped.values()))
      })
      .catch(() => {})
  }, [sessionId])

  // Helper to update a single claim's status via API
  const handleUpdateClaimStatus = useCallback(async (claimId: string, status: string, promoteToEvidence = false) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/claims`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ claim_id: claimId, status, promote_to_evidence: promoteToEvidence }),
      })
      if (!res.ok) return

      // Update local state
      setResults(prev => prev.map(r => ({
        ...r,
        claims: r.claims.map(c => c.id === claimId ? { ...c, status: status as any } : c),
      })))
    } catch {
      // Non-fatal
    }
  }, [sessionId])

  const isUrl = looksLikeUrl(input)

  /** Submit a manual text claim directly to DB */
  const handleManualClaim = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)

    try {
      const claim = { claim: text, category: 'statement', confidence: 50 }
      const persistRes = await fetch(`/api/cop/${sessionId}/claims`, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ claims: [claim] }),
      })

      if (!persistRes.ok) throw new Error('Failed to save claim')

      const persistData = await persistRes.json()
      const result: ClaimAnalysisResult = {
        url: '',
        title: 'Manual claim',
        claims: [{
          ...claim,
          id: persistData.ids?.[0],
          status: 'unverified' as const,
        }],
        analyzed_at: new Date().toISOString(),
      }

      setResults(prev => [result, ...prev])
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save claim')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  /** Extract claims from a URL via AI */
  const handleExtractFromUrl = useCallback(async (rawUrl: string) => {
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

    // Validate URL
    try {
      new URL(fullUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tools/extract-claims', {
        method: 'POST',
        headers: { ...getCopHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: fullUrl,
          include_entities: true,
          include_summary: true,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.details || errData.error || `Failed to extract claims (${res.status})`)
      }

      const data = await res.json()

      const result: ClaimAnalysisResult = {
        url: rawUrl,
        title: data.metadata?.title || data.title,
        domain: data.metadata?.domain || data.domain,
        claims: data.claims ?? [],
        summary: data.summary,
        entity_count: data.entities?.length ?? 0,
        analyzed_at: new Date().toISOString(),
      }

      // Persist claims to DB so they survive page refresh
      if (result.claims.length > 0) {
        try {
          const persistRes = await fetch(`/api/cop/${sessionId}/claims`, {
            method: 'POST',
            headers: getCopHeaders(),
            body: JSON.stringify({
              url: result.url,
              title: result.title,
              domain: result.domain,
              summary: result.summary,
              claims: result.claims,
            }),
          })
          if (persistRes.ok) {
            const persistData = await persistRes.json()
            if (persistData.ids) {
              result.claims = result.claims.map((c, i) => ({
                ...c,
                id: persistData.ids[i],
                status: 'unverified' as const,
              }))
            }
          }
        } catch {
          // Non-fatal — claims still visible in UI
        }
      }

      setResults(prev => [result, ...prev])
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract claims')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return

    if (isUrl) {
      handleExtractFromUrl(trimmed)
    } else {
      handleManualClaim(trimmed)
    }
  }, [input, isUrl, handleExtractFromUrl, handleManualClaim])

  const removeResult = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index))
  }

  const toggleResultExpand = (index: number) => {
    setExpandedClaims(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const totalClaims = results.reduce((sum, r) => sum + r.claims.length, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Claim / URL Input */}
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            {isUrl ? (
              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            ) : (
              <MessageSquareText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
              placeholder="Enter a claim or paste a URL..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="h-8 text-xs px-3 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isUrl ? (
              'Analyze'
            ) : (
              'Add'
            )}
          </Button>
        </div>
        {error && (
          <p className="text-[10px] text-red-500 dark:text-red-400 mt-1.5">{error}</p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {results.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <FileWarning className="h-6 w-6 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500">No claims analyzed yet</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[220px] mx-auto">
              Enter a claim directly or paste a URL to extract claims from articles and reports.
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>{results.length} source{results.length !== 1 ? 's' : ''} analyzed</span>
              <span>{totalClaims} claim{totalClaims !== 1 ? 's' : ''} extracted</span>
            </div>

            {/* Results list */}
            {results.map((result, ri) => {
              const isOpen = expandedClaims[ri] ?? (ri === 0)
              const visibleClaims = expanded || isOpen
                ? result.claims
                : result.claims.slice(0, 3)

              return (
                <div
                  key={`${result.url}-${ri}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  {/* Source header */}
                  <button
                    type="button"
                    onClick={() => toggleResultExpand(ri)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {result.title || result.url || 'Manual claim'}
                      </p>
                      {result.domain && (
                        <p className="text-[10px] text-slate-400 truncate">{result.domain}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {result.claims.length} claim{result.claims.length !== 1 ? 's' : ''}
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeResult(ri) }}
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </button>

                  {/* Summary */}
                  {isOpen && result.summary && (
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                        {result.summary}
                      </p>
                    </div>
                  )}

                  {/* Claims list */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleClaims.map((claim, ci) => {
                        const risk = getRiskBadge(claim.confidence)
                        const RiskIcon = risk.icon
                        const isVerified = claim.status === 'verified'
                        const isDisputed = claim.status === 'disputed' || claim.status === 'false'
                        return (
                          <div key={ci} data-claim-id={claim.id} className={cn('px-3 py-2 space-y-1', isVerified && 'bg-emerald-50/50 dark:bg-emerald-950/20', isDisputed && 'bg-red-50/50 dark:bg-red-950/20')}>
                            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                              {claim.claim}
                            </p>
                            <div className="flex flex-wrap items-center gap-1">
                              {claim.category && (
                                <Badge className={cn('text-[9px] px-1.5 py-0 leading-4 border-transparent', getCategoryColor(claim.category))}>
                                  {claim.category}
                                </Badge>
                              )}
                              {claim.confidence != null && (
                                <Badge className={cn('text-[9px] px-1.5 py-0 leading-4 border-transparent flex items-center gap-0.5', risk.color)}>
                                  <RiskIcon className="h-2.5 w-2.5" />
                                  {claim.confidence}%
                                </Badge>
                              )}
                              {claim.status && claim.status !== 'unverified' && (
                                <Badge className={cn('text-[9px] px-1.5 py-0 leading-4 border-transparent flex items-center gap-0.5',
                                  isVerified ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                )}>
                                  {isVerified ? <ShieldCheck className="h-2.5 w-2.5" /> : <ShieldX className="h-2.5 w-2.5" />}
                                  {claim.status}
                                </Badge>
                              )}
                              {/* Action buttons for claims with DB IDs */}
                              {claim.id && claim.status !== 'verified' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateClaimStatus(claim.id!, 'verified', true)}
                                  className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="Verify and promote to evidence"
                                >
                                  <ShieldCheck className="h-2.5 w-2.5" />
                                  Verify
                                </button>
                              )}
                              {claim.id && claim.status !== 'disputed' && claim.status !== 'false' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateClaimStatus(claim.id!, 'disputed')}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="Mark as disputed"
                                >
                                  <ShieldX className="h-2.5 w-2.5" />
                                  Dispute
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {!expanded && !isOpen && result.claims.length > 3 && (
                        <div className="px-3 py-1.5">
                          <p className="text-[10px] text-slate-400 italic">
                            +{result.claims.length - 3} more claims (expand to view)
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Source link */}
                  {isOpen && result.url && (
                    <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">
                      <a
                        href={result.url.startsWith('http') ? result.url : `https://${result.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        View source
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
