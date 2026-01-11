
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Search, Flame, Loader2, ArrowRight } from 'lucide-react'

interface RageCheckResult {
  score: number
  label: 'Low' | 'Medium' | 'High'
  categoryScores: {
    loaded_language: number
    absolutist: number
    threat_panic: number
    us_vs_them: number
    engagement_bait: number
  }
  explanation: string
  highlights: Array<{
    text: string
    category: string
    explanation: string
  }>
  meta?: {
    title?: string
    contentPreview?: string
  }
}

export function RageCheckPage() {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RageCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tools/rage-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Analysis failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score < 34) return 'bg-green-500'
    if (score < 67) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'Low': return 'text-green-600 bg-green-50 border-green-200'
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'High': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <Flame className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">RageCheck</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Analyze content for manipulative framing, emotional provocation, and outrage-bait patterns.
        </p>
      </div>

      <Card className="mb-8 border-2 shadow-lg">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Input 
              placeholder="Paste article URL here..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-lg py-6"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <Button 
              size="lg" 
              onClick={handleAnalyze} 
              disabled={loading || !url.trim()}
              className="px-8 font-bold"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Check'}
            </Button>
          </div>
          {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Main Score Card */}
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg font-medium text-muted-foreground uppercase tracking-wide">Manipulative Framing Score</CardTitle>
              {result.meta?.title && (
                <div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                  {result.meta.title}
                </div>
              )}
            </CardHeader>
            <CardContent className="text-center">
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="relative">
                  <span className="text-6xl font-extrabold">{result.score}</span>
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                <Badge className={`text-xl px-4 py-1 rounded-full ${getLabelColor(result.label)}`}>
                  {result.label} Risk
                </Badge>
              </div>
              
              <Progress value={result.score} className="h-4 mb-6" indicatorClassName={getScoreColor(result.score)} />
              
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
                {result.explanation}
              </p>
            </CardContent>
          </Card>

          {/* Breakdown Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Signal Breakdown</CardTitle>
                <CardDescription>Intensity of specific manipulation patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: 'loaded_language', label: 'Loaded Language', desc: 'Emotional/inflammatory words' },
                  { key: 'threat_panic', label: 'Threat & Panic', desc: 'Fear-mongering framing' },
                  { key: 'engagement_bait', label: 'Engagement Bait', desc: 'Clickbait/viral patterns' },
                  { key: 'us_vs_them', label: 'Us vs Them', desc: 'Divisive group language' },
                  { key: 'absolutist', label: 'Absolutism', desc: 'Black-and-white certainty' },
                ].map((cat) => (
                  <div key={cat.key}>
                    <div className="flex justify-between mb-1">
                      <div>
                        <span className="font-semibold">{cat.label}</span>
                        <p className="text-xs text-muted-foreground">{cat.desc}</p>
                      </div>
                      <span className="font-mono font-bold">{(result.categoryScores as any)[cat.key]}</span>
                    </div>
                    <Progress value={(result.categoryScores as any)[cat.key]} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Flagged Highlights</CardTitle>
                <CardDescription>Specific examples extracted from the text</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {result.highlights.map((highlight, idx) => (
                    <div key={idx} className="p-3 bg-muted/50 rounded-lg text-sm border-l-4 border-red-400">
                      <p className="font-medium italic mb-1">"{highlight.text}"</p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span className="uppercase tracking-wider font-semibold">{highlight.category.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  ))}
                  {result.highlights.length === 0 && (
                    <p className="text-muted-foreground italic text-center py-8">No specific highlights flagged.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content Preview */}
          {result.meta?.contentPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Analyzed Content Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg">
                  {result.meta.contentPreview}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Credits & Methodology */}
      <Card className="mt-12 border-t bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Credits & Methodology</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This tool is an implementation of the open-source <a href="https://github.com/aagoldberg/ragecheck" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">RageCheck</a> project created by Andrew Goldberg (<a href="https://github.com/aagoldberg" target="_blank" rel="noopener noreferrer" className="hover:underline">@aagoldberg</a>).
          </p>
          <p>
            <strong>Methodology:</strong> The analysis detects linguistic patterns commonly associated with manipulative framing, specifically focusing on five key signals:
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><strong>Loaded Language:</strong> Emotional, inflammatory words designed to provoke a reaction.</li>
            <li><strong>Absolutism:</strong> Black-and-white certainty (e.g., "always", "never", "everyone knows").</li>
            <li><strong>Threat & Panic:</strong> Fear-mongering framing (e.g., "they're coming for", "collapse").</li>
            <li><strong>Us vs Them:</strong> Divisive in-group/out-group language.</li>
            <li><strong>Engagement Bait:</strong> Viral patterns designed to maximize clicks (e.g., "you won't believe").</li>
          </ul>
          <p className="mt-4 text-xs italic">
            Note: This tool analyzes framing, not factual accuracy. A high score indicates manipulative language, not necessarily false information.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
