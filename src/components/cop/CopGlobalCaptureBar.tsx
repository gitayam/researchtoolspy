import { useState, useCallback, useRef, useEffect } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { Link, Brain, Loader2, Sparkles, Command, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CopGlobalCaptureBarProps {
  sessionId: string
  onSuccess?: (type: 'evidence' | 'hypothesis' | 'note') => void
  onLocationDetected?: (location: string, evidenceId: string) => void
}

export default function CopGlobalCaptureBar({ sessionId, onSuccess, onLocationDetected }: CopGlobalCaptureBarProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detection, setDetection] = useState<{ location: string, evidenceId: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect type based on input
  const isUrl = input.trim().match(/^https?:\/\//)
  const isHypothesis = input.trim().toLowerCase().startsWith('hypothesis:') || input.trim().toLowerCase().startsWith('maybe:')

  const handleCapture = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setDetection(null)

    try {
      let endpoint = '/api/content-intelligence/analyze-url'
      let body: any = { url: trimmed, workspace_id: sessionId }
      let type: 'evidence' | 'hypothesis' | 'note' = 'evidence'

      if (isHypothesis) {
        endpoint = `/api/cop/${sessionId}/hypotheses`
        body = { statement: trimmed.replace(/^(hypothesis|maybe):/i, '').trim() }
        type = 'hypothesis'
      } else if (!isUrl) {
        // Route notes through COP-scoped evidence endpoint (not global /api/evidence)
        endpoint = `/api/cop/${sessionId}/evidence`
        body = {
          title: trimmed.substring(0, 50) + (trimmed.length > 50 ? '...' : ''),
          content: trimmed,
          source_type: 'observation',
          confidence: 'medium',
        }
        type = 'note'
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to capture intel')
      }

      const data = await res.json()
      const evidenceId = data.id ?? data.analysis_id ?? data.evidence_id

      // Simplified geocoding detection from analysis result
      const locationMatch = (data.summary ?? data.title ?? '').match(/in ([\w\s,]{3,30})/i)
      if (locationMatch && evidenceId) {
        setDetection({ location: locationMatch[1], evidenceId: String(evidenceId) })
      }

      setInput('')
      onSuccess?.(type)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setLoading(false)
    }
  }, [input, sessionId, isUrl, isHypothesis, onSuccess])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleCapture()
    }
    if (e.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  // Keyboard shortcut Ctrl+K to focus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  return (
    <div className="sticky top-0 z-30 px-2 sm:px-4 py-2 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md border-b border-slate-200 dark:border-gray-700/50 shadow-sm dark:shadow-xl">
      <div className="max-w-5xl mx-auto flex flex-col gap-1">
        <div className="relative flex items-center gap-2">
          <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none">
            {loading ? (
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            ) : isUrl ? (
              <Link className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            ) : isHypothesis ? (
              <Brain className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Drop a URL, type a quick note, or start with 'Hypothesis:'..."
            className={cn(
              "w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg pl-10 pr-24 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50",
              isHypothesis && "focus:ring-emerald-500/50",
              !isUrl && !isHypothesis && input.trim() && "focus:ring-purple-500/50"
            )}
          />

          <div className="absolute right-2 flex items-center gap-2">
            {!input.trim() && (
              <div data-testid="capture-kbd-hint" className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 text-[10px] text-gray-500 font-medium">
                <Command className="h-2.5 w-2.5" />
                <span>K</span>
              </div>
            )}
            <Button
              size="sm"
              onClick={handleCapture}
              disabled={loading || !input.trim()}
              className={cn(
                "h-7 text-[10px] px-3 font-bold uppercase tracking-tighter transition-all cursor-pointer",
                isHypothesis ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {loading ? "Capturing..." : "Capture"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-[10px] text-red-600 dark:text-red-400 ml-10 font-medium animate-in fade-in slide-in-from-top-1" role="alert">
            {error}
          </p>
        )}

        {input.trim() && !loading && (
          <div className="flex items-center gap-3 ml-10 animate-in fade-in slide-in-from-top-1">
             <span className="text-[10px] text-gray-500 dark:text-gray-400">
               Routing to: <span className="font-bold text-gray-700 dark:text-gray-300">
                 {isUrl ? "Evidence Feed (URL Analysis)" : isHypothesis ? "Hypothesis Ledger" : "Evidence Feed (Quick Note)"}
               </span>
             </span>
             <span className="text-[10px] text-gray-500 dark:text-gray-400">Press Cmd+Enter to send</span>
          </div>
        )}

        {detection && !loading && (
          <div className="flex items-center gap-3 ml-10 animate-in fade-in slide-in-from-top-1 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded px-2 py-1">
             <span className="text-[10px] text-green-700 dark:text-green-400 flex items-center gap-1">
               <MapPin className="h-3 w-3" />
               Detected location: <span className="font-bold uppercase">{detection.location}</span>
             </span>
             <Button
               size="sm"
               variant="ghost"
               onClick={() => {
                 onLocationDetected?.(detection.location, detection.evidenceId)
                 setDetection(null)
               }}
               className="h-5 text-[9px] px-2 bg-green-600 hover:bg-green-700 text-white font-bold uppercase cursor-pointer"
             >
               Pin to Map
             </Button>
             <button
               onClick={() => setDetection(null)}
               className="text-[9px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 uppercase underline decoration-dotted cursor-pointer"
             >
               Dismiss
             </button>
          </div>
        )}
      </div>
    </div>
  )
}
