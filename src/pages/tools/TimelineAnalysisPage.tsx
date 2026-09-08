import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Calendar, FileSearch, Info, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TimelineResults } from '@/components/timeline/TimelineResults'
import { analyzeTimeline, TimelineAnalysisError } from '@/lib/timeline-analysis'
import type { TimelineAnalysisResult } from '@/types/timeline-analysis'

export function TimelineAnalysisPage() {
  const [searchParams] = useSearchParams()
  const queryUrl = searchParams.get('url') || ''
  const [url, setUrl] = useState(() => queryUrl)
  const [result, setResult] = useState<TimelineAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    requestRef.current?.abort()
    requestRef.current = null
    const updateId = window.setTimeout(() => {
      setLoading(false)
      setResult(null)
      setError(null)
      setUrl(queryUrl)
    }, 0)
    return () => window.clearTimeout(updateId)
  }, [queryUrl])

  useEffect(() => () => requestRef.current?.abort(), [])

  const runAnalysis = async (event?: FormEvent) => {
    event?.preventDefault()
    const target = url.trim()
    if (!target) {
      setError('Enter an article URL to build a timeline.')
      return
    }

    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const nextResult = await analyzeTimeline({ url: target }, { signal: controller.signal })
      if (!controller.signal.aborted) setResult(nextResult)
    } catch (caught) {
      if (controller.signal.aborted) return
      if (caught instanceof TimelineAnalysisError && caught.status === 422) {
        setError('The page did not expose enough article text. Try an archive or analyze a working copy in Content Research.')
      } else {
        setError(caught instanceof Error ? caught.message : 'Timeline analysis failed. Please try again.')
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-8">
      <div className="flex items-start gap-4">
        <Button variant="outline" size="icon" asChild aria-label="Back to research tools">
          <Link to="/dashboard/tools"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold"><Calendar className="h-8 w-8" />Timeline Analysis</h1>
          <p className="mt-1 text-muted-foreground">Extract source-backed dated events and organize them into a research-ready chronology.</p>
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription>No login is required. Results are temporary unless you continue the source in a signed-in research workspace.</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Build a timeline from an article</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={runAnalysis} className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
                aria-label="Article URL"
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                {loading ? 'Building timeline…' : 'Build Timeline'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Dates are preserved at day, month, or year precision. Events without reliable dates are omitted rather than guessed.</p>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && <TimelineResults result={result} onRegenerate={() => void runAnalysis()} regenerating={loading} />}

      {result && (
        <div className="flex justify-end">
          <Button variant="outline" asChild>
            <Link to={`/dashboard/tools/content-intelligence?url=${encodeURIComponent(result.article.url)}`}>
              Continue in Content Research
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
