import { useState, useCallback } from 'react'
import { Link, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CopSession } from '@/types/cop'

// ── Types ────────────────────────────────────────────────────────

interface ContentAnalysis {
  id: string
  title: string
  url: string
  entity_count: number
  claim_count: number
  status?: 'pending' | 'completed' | 'failed'
  error?: string
}

// ── Props ────────────────────────────────────────────────────────

interface CopIntelTabProps {
  session: CopSession
  onSessionUpdate: (updates: Partial<CopSession>) => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopIntelTab({ session, onSessionUpdate }: CopIntelTabProps) {
  const [url, setUrl] = useState('')
  const [analyses, setAnalyses] = useState<ContentAnalysis[]>([])
  const [error, setError] = useState<string | null>(null)

  const analyzeUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    const tempId = crypto.randomUUID()
    const pendingAnalysis: ContentAnalysis = {
      id: tempId,
      title: trimmed,
      url: trimmed,
      entity_count: 0,
      claim_count: 0,
      status: 'pending'
    }

    setAnalyses(prev => [pendingAnalysis, ...prev])
    setUrl('')
    setError(null)

    try {
      const res = await fetch('/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, workspace_id: session.id }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error ?? `Analysis failed (${res.status})`)
      }

      const data = await res.json()
      const analysis: ContentAnalysis = {
        id: data.id ?? data.analysis_id ?? tempId,
        title: data.title ?? trimmed,
        url: trimmed,
        entity_count: data.entity_count ?? data.entities?.length ?? 0,
        claim_count: data.claim_count ?? data.claims?.length ?? 0,
        status: 'completed'
      }

      setAnalyses(prev => prev.map(a => a.id === tempId ? analysis : a))

      // Update session content_analyses array
      const updatedIds = [...(session.content_analyses ?? []), analysis.id]
      onSessionUpdate({ content_analyses: updatedIds })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      setAnalyses(prev => prev.map(a => 
        a.id === tempId 
          ? { ...a, status: 'failed', error: errorMessage, title: `Error: ${errorMessage}` } 
          : a
      ))
    }
  }, [url, session.id, session.content_analyses, onSessionUpdate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        analyzeUrl()
      }
    },
    [analyzeUrl]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Intel</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* URL input */}
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Link className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500" />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste URL to analyze..."
                className="w-full rounded border border-gray-700 bg-gray-800 pl-7 pr-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button
              size="sm"
              onClick={analyzeUrl}
              disabled={!url.trim()}
              className="h-7 text-xs shrink-0"
            >
              Analyze
            </Button>
          </div>
          {analyses.some(a => a.status === 'pending') && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Analyzing URL content...</span>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Analyses list */}
        {analyses.length > 0 ? (
          <div className="space-y-2">
            {analyses.map(a => (
              <div
                key={a.id}
                className={cn(
                  "rounded border border-gray-700 bg-gray-800/50 px-2.5 py-2 space-y-1 transition-opacity",
                  a.status === 'pending' && "opacity-70",
                  a.status === 'failed' && "border-red-900/50 bg-red-900/10"
                )}
              >
                <div className="flex items-start gap-1.5">
                  <span className={cn(
                    "text-xs font-medium flex-1 line-clamp-2",
                    a.status === 'failed' ? "text-red-400" : "text-gray-200"
                  )}>
                    {a.title}
                    {a.status === 'pending' && (
                      <Loader2 className="h-3 w-3 animate-spin inline ml-2 text-blue-400" />
                    )}
                  </span>
                  {a.url && a.status === 'completed' && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-blue-400 shrink-0 cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {a.status === 'completed' && (
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>{a.entity_count} entities</span>
                    <span>{a.claim_count} claims</span>
                  </div>
                )}
                {a.status === 'failed' && a.error && (
                  <p className="text-[10px] text-red-400/80">{a.error}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Link className="h-6 w-6 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              Drop a URL above to extract entities and claims.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
