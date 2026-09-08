import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Check, Clock3, Copy, ExternalLink, FileSearch, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TimelineAnalysisResult, TimelineEvent } from '@/types/timeline-analysis'

interface TimelineResultsProps {
  result: TimelineAnalysisResult
  onRegenerate?: () => void
  regenerating?: boolean
}

const importanceClasses: Record<TimelineEvent['importance'], string> = {
  low: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  normal: 'border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300',
  high: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  critical: 'border-red-400 text-red-700 dark:border-red-800 dark:text-red-300',
}

function timelineMarkdown(result: TimelineAnalysisResult): string {
  const lines = [
    `# ${result.article.title}`,
    '',
    `Source: ${result.article.url}`,
    '',
  ]
  for (const event of result.events) {
    lines.push(`- **${event.eventDate}** — ${event.title}`)
    if (event.description) lines.push(`  ${event.description}`)
  }
  if (result.events.length === 0) lines.push('No supported dated events were identified.')
  return lines.join('\n')
}

export function TimelineResults({ result, onRegenerate, regenerating = false }: TimelineResultsProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyResetRef = useRef<number | null>(null)
  const events = useMemo(
    () => [...result.events].sort((left, right) => left.eventDate.localeCompare(right.eventDate)),
    [result.events],
  )

  useEffect(() => () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
  }, [])

  const copyTimeline = async () => {
    if (copyResetRef.current !== null) window.clearTimeout(copyResetRef.current)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(timelineMarkdown(result))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
    copyResetRef.current = window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  return (
    <div className="space-y-4" data-testid="timeline-results">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{events.length} {events.length === 1 ? 'event' : 'events'}</Badge>
              <Badge variant="outline">{result.article.domain}</Badge>
              <Badge variant="outline">{result.extraction.sourceMode}</Badge>
            </div>
            <CardTitle className="text-xl leading-tight">{result.article.title}</CardTitle>
            <a
              href={result.article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              <span className="truncate">{result.article.url}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyTimeline}>
              {copyStatus === 'copied' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy'}
            </Button>
            {onRegenerate && (
              <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerating}>
                <Clock3 className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 font-medium"><FileSearch className="h-4 w-4" />Content source</div>
            <p className="mt-1 text-muted-foreground">{result.extraction.contentSource}</p>
            {result.extraction.method && <p className="mt-1 text-xs text-muted-foreground">Method: {result.extraction.method}</p>}
            {result.extraction.fallbackAttempts.length > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">Tried: {result.extraction.fallbackAttempts.join(' → ')}</p>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" />Extraction quality</div>
            <p className="mt-1 text-muted-foreground">{Math.round(result.extraction.quality.score)}% · {result.extraction.wordCount.toLocaleString()} words</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 font-medium"><Calendar className="h-4 w-4" />Published</div>
            <p className="mt-1 text-muted-foreground">{result.article.publishedAt || 'Not reliably available'}</p>
          </div>
        </CardContent>
      </Card>

      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No supported dated events found</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              The source may discuss a topic without providing reliable dates. The analyzer does not invent missing dates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Chronological events</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="ml-3 border-l-2 border-blue-200 pl-6 dark:border-blue-900">
              {events.map((event, index) => (
                <li key={`${event.eventDate}-${event.title}-${index}`} className="relative pb-7 last:pb-0">
                  <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-blue-600 bg-background" />
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={event.eventDate} className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300">{event.eventDate}</time>
                    <Badge variant="outline" className="capitalize">{event.category}</Badge>
                    {event.importance !== 'normal' && (
                      <Badge variant="outline" className={`capitalize ${importanceClasses[event.importance]}`}>{event.importance}</Badge>
                    )}
                  </div>
                  <h3 className="mt-2 font-semibold leading-snug">{event.title}</h3>
                  {event.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{event.description}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Request {result.requestId} · {result.model.name}
        {result.model.rejectedEventCount > 0 ? ` · ${result.model.rejectedEventCount} events omitted during validation` : ''}
      </p>
    </div>
  )
}
