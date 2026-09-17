import { useState, useCallback, useRef, useEffect } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import { Link, Brain, Loader2, Sparkles, MapPin, ClipboardList, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { noteTitle, parseCapture, type CaptureKind } from '@/lib/cop-capture'

interface CopGlobalCaptureBarProps {
  sessionId: string
  /** The session's real workspace. A COP session's id and workspace_id are only
   *  the same value for sessions created through /api/cop/sessions; ones created
   *  through /api/workspaces get a UUID workspace and a `cop-` prefixed id. Half
   *  the sessions in production are the second kind, and sending the session id
   *  as the workspace made checkWorkspaceAccess look up a workspace that does not
   *  exist -- so every write from this panel was refused. */
  workspaceId?: string
  onSuccess?: (type: CaptureKind) => void
  onLocationDetected?: (location: string, evidenceId: string) => void
}

export default function CopGlobalCaptureBar({ sessionId, workspaceId, onSuccess, onLocationDetected }: CopGlobalCaptureBarProps) {
  const copWorkspaceId = workspaceId ?? sessionId
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detection, setDetection] = useState<{ location: string, evidenceId: string } | null>(null)
  /** What this analyst has just put in, newest first. A live picture is built
   *  from a stream of small entries, and without a record of the last few there
   *  is no way to tell a capture that worked from one that silently did not. */
  const [captured, setCaptured] = useState<{ kind: CaptureKind; text: string; at: number }[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const parsed = parseCapture(input)
  const kind = parsed?.kind

  const handleCapture = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setDetection(null)

    const route = parseCapture(trimmed)
    if (!route) {
      setLoading(false)
      setError('Nothing to capture — a prefix on its own needs something after it.')
      return
    }

    try {
      let endpoint: string
      let body: Record<string, unknown>
      const type = route.kind

      switch (route.kind) {
        case 'rfi':
          endpoint = `/api/cop/${sessionId}/rfis`
          body = {
            question: route.body,
            priority: route.priority,
            is_blocker: route.isBlocker,
          }
          break
        case 'survey':
          endpoint = '/api/surveys'
          body = { title: route.body, status: 'active', cop_session_id: sessionId }
          break
        case 'hypothesis':
          endpoint = `/api/cop/${sessionId}/hypotheses`
          body = { statement: route.body }
          break
        case 'url':
          endpoint = '/api/content-intelligence/analyze-url'
          body = { url: route.url, workspace_id: copWorkspaceId }
          break
        case 'note':
          // COP-scoped evidence, not the global /api/evidence.
          endpoint = `/api/cop/${sessionId}/evidence`
          body = {
            // The first line, not the first fifty characters: an analyst writes
            // the gist and then the detail, and the gist is the title.
            title: noteTitle(route.body),
            content: route.body,
            source_type: 'observation',
            confidence: 'medium',
          }
          break
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch((e) => { console.error('[CopGlobalCaptureBar] JSON parse error:', e); return {} })
        throw new Error(data.error ?? 'Failed to capture intel')
      }

      const data = await res.json()

      // For surveys, show the share link
      if (type === 'survey' && data.share_token) {
        const shareUrl = `${window.location.origin}/drop/${data.share_token}`
        navigator.clipboard.writeText(shareUrl).catch(() => {})
        setDetection({ location: `Survey link copied: ${shareUrl}`, evidenceId: '' })
      } else {
        const evidenceId = data.id ?? data.analysis_id ?? data.evidence_id
        // Simplified geocoding detection from analysis result
        const locationMatch = (data.summary ?? data.title ?? '').match(/in ([\w\s,]{3,30})/i)
        if (locationMatch && evidenceId) {
          setDetection({ location: locationMatch[1], evidenceId: String(evidenceId) })
        }
      }

      setInput('')
      setCaptured(prev => [{ kind: type, text: route.body, at: Date.now() }, ...prev].slice(0, 4))
      onSuccess?.(type)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setLoading(false)
    }
  }, [input, sessionId, copWorkspaceId, onSuccess])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends. Someone logging a live picture types a fragment and moves on,
    // and reaching for a modifier on every entry is a tax on exactly the flow
    // this bar exists for. Shift+Enter is the newline, which is the convention
    // every chat client has already taught. Cmd+Enter still works for anyone
    // with it in their fingers.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCapture()
    }
    if (e.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  // "/" focuses the bar, as long as the analyst is not already typing somewhere.
  //
  // This used to be Ctrl+K, which is also the command palette's global shortcut —
  // and the palette is mounted on this very page. Pressing it opened the palette
  // AND focused this input behind the dialog, so the bar's own advertised
  // shortcut did not work anywhere it was visible.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable
      if (typing) return
      e.preventDefault()
      inputRef.current?.focus()
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
            ) : kind === 'rfi' ? (
              <HelpCircle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            ) : kind === 'survey' ? (
              <ClipboardList className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            ) : kind === 'url' ? (
              <Link className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            ) : kind === 'hypothesis' ? (
              <Brain className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            )}
          </div>

          {/* A textarea, not an input. An observation is often two sentences and
              the single-line field made the analyst either truncate the thought
              or lose the shape of it. It grows to a few lines and then scrolls. */}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Capture intelligence"
            placeholder="Note, URL, or a prefix: rfi: · hyp: · survey:"
            className={cn(
              "w-full resize-none max-h-32 bg-gray-50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg pl-10 pr-24 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50",
              kind === 'rfi' && "focus:ring-amber-500/50",
              kind === 'survey' && "focus:ring-cyan-500/50",
              kind === 'hypothesis' && "focus:ring-emerald-500/50",
              kind === 'note' && "focus:ring-purple-500/50"
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />

          <div className="absolute right-2 flex items-center gap-2">
            {!input.trim() && (
              <div data-testid="capture-kbd-hint" className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 text-[10px] text-gray-500 font-medium">
                <span>/</span>
              </div>
            )}
            <Button
              size="sm"
              onClick={handleCapture}
              disabled={loading || !input.trim()}
              className={cn(
                "h-7 text-[10px] px-3 font-bold uppercase tracking-tighter transition-all cursor-pointer",
                kind === 'rfi' ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : kind === 'survey' ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                  : kind === 'hypothesis' ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
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

        {parsed && !loading && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-10 animate-in fade-in slide-in-from-top-1">
             <span className="text-[10px] text-gray-500 dark:text-gray-400">
               Routing to: <span className="font-bold text-gray-700 dark:text-gray-300">{parsed.label}</span>
             </span>
             <span className="text-[10px] text-gray-500 dark:text-gray-400">
               Enter sends · Shift+Enter for a new line
             </span>
          </div>
        )}

        {/* The prefixes, shown rather than described. They were only discoverable
            by reading a placeholder that vanished the moment anyone typed. */}
        {!input.trim() && !loading && (
          <div className="hidden sm:flex flex-wrap items-center gap-2 ml-10">
            {[
              { prefix: 'rfi:', meaning: 'request for information', extra: '! or !! to raise priority' },
              { prefix: 'hyp:', meaning: 'hypothesis' },
              { prefix: 'survey:', meaning: 'collection form' },
            ].map(hint => (
              <button
                key={hint.prefix}
                type="button"
                onClick={() => {
                  setInput(`${hint.prefix} `)
                  inputRef.current?.focus()
                }}
                title={hint.extra ? `${hint.meaning} — ${hint.extra}` : hint.meaning}
                className="rounded border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-400"
              >
                <span className="font-mono font-semibold">{hint.prefix}</span>{' '}
                <span>{hint.meaning}</span>
              </button>
            ))}
          </div>
        )}

        {/* What just went in. A live picture is built from a stream of small
            entries; without the last few visible there is no way to tell a
            capture that landed from one that quietly did not. */}
        {captured.length > 0 && (
          <ul className="ml-10 space-y-0.5" aria-label="Recently captured">
            {captured.map(entry => (
              <li key={entry.at} className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                <span className={cn(
                  'font-semibold uppercase tracking-tight',
                  entry.kind === 'rfi' && 'text-amber-600 dark:text-amber-400',
                  entry.kind === 'hypothesis' && 'text-emerald-600 dark:text-emerald-400',
                  entry.kind === 'survey' && 'text-cyan-600 dark:text-cyan-400',
                  entry.kind === 'url' && 'text-blue-600 dark:text-blue-400',
                  entry.kind === 'note' && 'text-purple-600 dark:text-purple-400',
                )}>{entry.kind}</span>
                <span className="truncate">{entry.text}</span>
                <time className="ml-auto shrink-0 tabular-nums" dateTime={new Date(entry.at).toISOString()}>
                  {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            ))}
          </ul>
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
