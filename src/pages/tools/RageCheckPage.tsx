
import { useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { getCopHeaders } from '@/lib/cop-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Search, Flame, Loader2, ArrowRight, Github } from 'lucide-react'

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
  const { t } = useTranslation('deception')
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
        headers: getCopHeaders(),
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        const data = await response.json().catch((e) => { console.error('[RageCheckPage] JSON parse error:', e); return {} })
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

  // Helper to get localized criteria info
  const getCriteriaInfo = (key: string) => {
    const map: Record<string, string> = {
      'loaded_language': 'rageLoadedLanguage',
      'absolutist': 'rageAbsolutist',
      'threat_panic': 'rageThreatPanic',
      'us_vs_them': 'rageUsVsThem',
      'engagement_bait': 'rageEngagementBait'
    }
    const criteriaKey = map[key] || key
    return {
      label: t(`criteria.${criteriaKey}.label`),
      description: t(`criteria.${criteriaKey}.description`)
    }
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <Flame className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">{t('tool.title')}</h1>
          <a 
            href="https://github.com/aagoldberg/ragecheck" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            title={t('tool.viewOnGithub')}
          >
            <Github className="h-6 w-6" />
          </a>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t('tool.description')}
        </p>
      </div>

      <Card className="mb-8 border-2 shadow-lg">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <Input 
              placeholder={t('tool.inputPlaceholder')} 
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
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('tool.analyzeButton')}
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
              <CardTitle className="text-lg font-medium text-muted-foreground uppercase tracking-wide">{t('tool.scoreTitle')}</CardTitle>
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
                  {result.label} {t('tool.riskLabel')}
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
                <CardTitle>{t('tool.signalBreakdown')}</CardTitle>
                <CardDescription>{t('tool.signalBreakdownDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  'loaded_language',
                  'threat_panic',
                  'engagement_bait',
                  'us_vs_them',
                  'absolutist'
                ].map((key) => {
                  const info = getCriteriaInfo(key)
                  const score = (result.categoryScores as any)[key] || 0
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-1">
                        <div>
                          <span className="font-semibold">{info.label}</span>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                        <span className="font-mono font-bold">{score}</span>
                      </div>
                      <Progress value={score} className="h-2" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('tool.highlights')}</CardTitle>
                <CardDescription>{t('tool.highlightsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {result.highlights.map((highlight, idx) => {
                    const info = getCriteriaInfo(highlight.category)
                    return (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg text-sm border-l-4 border-red-400">
                        <p className="font-medium italic mb-1">"{highlight.text}"</p>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span className="uppercase tracking-wider font-semibold">{info.label}</span>
                        </div>
                      </div>
                    )
                  })}
                  {result.highlights.length === 0 && (
                    <p className="text-muted-foreground italic text-center py-8">{t('tool.noHighlights')}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content Preview */}
          {result.meta?.contentPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('tool.contentPreview')}</CardTitle>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t('tool.creditsTitle')}</CardTitle>
          </div>
          <a 
            href="https://github.com/aagoldberg/ragecheck" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={t('tool.viewRepo')}
          >
            <Github className="h-5 w-5" />
          </a>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <Trans
              i18nKey="tool.creditsText"
              t={t}
              components={{
                1: <a href="https://github.com/aagoldberg/ragecheck" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium" />,
                2: <a href="https://ragecheck.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium" />,
                3: <a href="https://github.com/aagoldberg" target="_blank" rel="noopener noreferrer" className="hover:underline" />
              }}
            />
          </p>
          <p>
            <strong>{t('tool.methodologyTitle')}</strong> {t('tool.methodologyText')}
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><strong>{t('criteria.rageLoadedLanguage.label')}:</strong> {t('criteria.rageLoadedLanguage.description')}</li>
            <li><strong>{t('criteria.rageAbsolutist.label')}:</strong> {t('criteria.rageAbsolutist.description')}</li>
            <li><strong>{t('criteria.rageThreatPanic.label')}:</strong> {t('criteria.rageThreatPanic.description')}</li>
            <li><strong>{t('criteria.rageUsVsThem.label')}:</strong> {t('criteria.rageUsVsThem.description')}</li>
            <li><strong>{t('criteria.rageEngagementBait.label')}:</strong> {t('criteria.rageEngagementBait.description')}</li>
          </ul>
          <p className="mt-4 text-xs italic">
            {t('tool.methodologyNote')}
          </p>
          <div className="pt-4 border-t mt-4">
            <p className="font-semibold text-xs uppercase tracking-wider mb-2">{t('tool.researchFoundations')}</p>
            <ul className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <li>
                <span className="font-medium text-foreground">{t('researchFoundations.frameAnalysis')}</span> {t('researchFoundations.frameAnalysisDesc')}
              </li>
              <li>
                <span className="font-medium text-foreground">{t('researchFoundations.socialIdentity')}</span> {t('researchFoundations.socialIdentityDesc')}
              </li>
              <li>
                <span className="font-medium text-foreground">{t('researchFoundations.attentionEconomy')}</span> {t('researchFoundations.attentionEconomyDesc')}
              </li>
              <li>
                <span className="font-medium text-foreground">{t('researchFoundations.linguisticLoadedness')}</span> {t('researchFoundations.linguisticLoadednessDesc')}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
