import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { evidenceToCitation } from '@/utils/evidence-to-citation'
import { addCitation } from '@/utils/citation-library'
import type { EvidenceItem } from '@/types/evidence'
import {
  ArrowLeft,
  Globe,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Archive,
  Download,
  Copy,
  ExternalLink,
  AlertCircle,
  Link,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import type { URLAnalysisResult } from '@/types/url-processing'

export function URLProcessingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<URLAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Options
  const [checkWayback, setCheckWayback] = useState(true)
  const [checkSEO, setCheckSEO] = useState(true)

  const analyzeUrl = async () => {
    if (!url.trim()) {
      setError(t('urlProcessingTool.pleaseEnterUrl'))
      return
    }

    setAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tools/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          checkWayback,
          checkSEO
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError(err.message || t('urlProcessingTool.failedToAnalyze'))
    } finally {
      setAnalyzing(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const exportJSON = () => {
    if (!result) return

    const dataStr = JSON.stringify(result, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `url-analysis-${new Date().getTime()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'text-green-600 dark:text-green-400'
      case 'Good': return 'text-blue-600 dark:text-blue-400'
      case 'Fair': return 'text-yellow-600 dark:text-yellow-400'
      case 'Poor': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const createCitationFromUrl = async () => {
    if (!result) return

    try {
      // Create a pseudo-evidence item from URL analysis
      const evidenceItem: Partial<EvidenceItem> = {
        id: Date.now(),
        title: result.metadata.title || 'Untitled',
        description: result.metadata.description,
        who: result.metadata.author,
        where_location: result.normalizedUrl,
        when_occurred: new Date().toISOString().split('T')[0],
        evidence_type: result.metadata.type === 'article' ? 'news_article' : 'blog_post',
        credibility: result.reliability.rating === 'Excellent' ? 'A' :
                     result.reliability.rating === 'Good' ? 'B' :
                     result.reliability.rating === 'Fair' ? 'C' : 'D',
        tags: []
      }

      const citation = evidenceToCitation(evidenceItem as EvidenceItem, 'apa')
      addCitation(citation)

      alert(`Citation created and added to your library!\n\nTitle: ${citation.fields.title}\n\nGo to Citations Generator to view and manage it.`)
    } catch (error) {
      console.error('Failed to create citation:', error)
      alert('Failed to create citation. Please try again.')
    }
  }

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return 'N/A'
    try {
      // Wayback timestamp format: YYYYMMDDHHmmss
      if (timestamp.length === 14) {
        const year = timestamp.substring(0, 4)
        const month = timestamp.substring(4, 6)
        const day = timestamp.substring(6, 8)
        return `${month}/${day}/${year}`
      }
      return new Date(timestamp).toLocaleDateString()
    } catch {
      return timestamp
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/tools')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('urlProcessingTool.backToTools')}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('urlProcessingTool.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('urlProcessingTool.subtitle')}</p>
        </div>
      </div>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('urlProcessingTool.enterUrlTitle')}</CardTitle>
          <CardDescription>
            {t('urlProcessingTool.enterUrlDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">{t('urlProcessingTool.urlLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                placeholder={t('urlProcessingTool.urlPlaceholder')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyzeUrl()}
                className="flex-1"
              />
              <Button onClick={analyzeUrl} disabled={analyzing || !url.trim()}>
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('urlProcessingTool.analyzing')}
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    {t('urlProcessingTool.analyze')}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('urlProcessingTool.analysisOptions')}</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wayback"
                  checked={checkWayback}
                  onCheckedChange={(checked) => setCheckWayback(checked as boolean)}
                />
                <label
                  htmlFor="wayback"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('urlProcessingTool.checkWayback')}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="seo"
                  checked={checkSEO}
                  onCheckedChange={(checked) => setCheckSEO(checked as boolean)}
                />
                <label
                  htmlFor="seo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('urlProcessingTool.seoAnalysis')}
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Bypass & Archive Links - TOP PRIORITY */}
          <Card className="border-blue-500 dark:border-blue-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                {t('urlProcessingTool.quickAccessTitle')}
              </CardTitle>
              <CardDescription>
                {t('urlProcessingTool.quickAccessDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => window.open(`https://12ft.io/proxy?q=${encodeURIComponent(result.normalizedUrl)}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('urlProcessingTool.paywallBypass')}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => window.open(`https://archive.is/?run=1&url=${encodeURIComponent(result.normalizedUrl)}`, '_blank')}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {t('urlProcessingTool.archiveIs')}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => window.open(`https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(result.normalizedUrl)}`, '_blank')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {t('urlProcessingTool.googleCache')}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => window.open(`https://outline.com/${result.normalizedUrl}`, '_blank')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('urlProcessingTool.outlineReader')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reliability Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('urlProcessingTool.reliabilityScore')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getRatingColor(result.reliability.rating)}`}>
                    {result.reliability.score}
                  </div>
                  <div className="text-xl text-gray-600 dark:text-gray-400">{t('urlProcessingTool.outOf100')}</div>
                  <div className={`text-lg font-semibold mt-2 ${getRatingColor(result.reliability.rating)}`}>
                    {t(`urlProcessingTool.${result.reliability.rating.toLowerCase()}`)}
                  </div>
                </div>

                <Progress value={result.reliability.score} className="h-3" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('urlProcessingTool.sslHttps')}</div>
                    <div className="text-lg font-semibold">{result.reliability.breakdown.ssl}/20</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('urlProcessingTool.domainAge')}</div>
                    <div className="text-lg font-semibold">{result.reliability.breakdown.domainAge}/20</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('urlProcessingTool.content')}</div>
                    <div className="text-lg font-semibold">{result.reliability.breakdown.contentQuality}/20</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{t('urlProcessingTool.archive')}</div>
                    <div className="text-lg font-semibold">{result.reliability.breakdown.archiveHistory}/15</div>
                  </div>
                </div>

                {result.reliability.notes && result.reliability.notes.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {result.reliability.notes.map((note, idx) => (
                      <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('urlProcessingTool.pageMetadata')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {result.metadata.title && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.title')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.metadata.title}</dd>
                  </div>
                )}
                {result.metadata.description && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.description')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.metadata.description}</dd>
                  </div>
                )}
                {result.metadata.author && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.author')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.metadata.author}</dd>
                  </div>
                )}
                {result.metadata.siteName && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.siteName')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.metadata.siteName}</dd>
                  </div>
                )}
                {result.metadata.type && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.type')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.metadata.type}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Domain Info */}
            <Card>
              <CardHeader>
                <CardTitle>{t('urlProcessingTool.domainInformation')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.domain')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.domain.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.protocol')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {result.domain.protocol.toUpperCase()}
                      {result.domain.ssl && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4 inline" /> {t('urlProcessingTool.secure')}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.path')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-mono">{result.domain.path}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t('urlProcessingTool.statusPerformance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.statusCode')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {result.status.code}
                      {result.status.ok ? (
                        <CheckCircle className="h-4 w-4 inline ml-2 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 inline ml-2 text-red-600 dark:text-red-400" />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.responseTime')}</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{result.status.responseTime}ms</dd>
                  </div>
                  {result.status.redirects.length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.redirects')}</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{result.status.redirects.length}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Wayback Machine */}
          {result.wayback && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  {t('urlProcessingTool.archiveHistory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.wayback.isArchived ? (
                  <div className="space-y-3">
                    {result.wayback.message && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">{result.wayback.message}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {result.wayback.firstSnapshot && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.firstSnapshot')}</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{formatDate(result.wayback.firstSnapshot)}</dd>
                        </div>
                      )}
                      {result.wayback.lastSnapshot && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.latestSnapshot')}</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{formatDate(result.wayback.lastSnapshot)}</dd>
                        </div>
                      )}
                      {result.wayback.totalSnapshots && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('urlProcessingTool.totalSnapshots')}</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{result.wayback.totalSnapshots}</dd>
                        </div>
                      )}
                    </div>
                    {result.wayback.archiveUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.wayback!.archiveUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t('urlProcessingTool.viewInWayback')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {result.wayback.message || t('urlProcessingTool.notArchived')}
                    </p>
                    {result.wayback.message && result.wayback.message.includes('Failed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://web.archive.org/save/${result.normalizedUrl}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t('urlProcessingTool.saveToWayback')}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Export & Citation Options */}
          <Card>
            <CardHeader>
              <CardTitle>{t('urlProcessingTool.exportCitationTools')}</CardTitle>
              <CardDescription>
                {t('urlProcessingTool.exportCitationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={createCitationFromUrl} className="bg-blue-600 hover:bg-blue-700">
                <FileText className="h-4 w-4 mr-2" />
                {t('urlProcessingTool.createCitation')}
              </Button>
              <Button variant="outline" onClick={exportJSON}>
                <Download className="h-4 w-4 mr-2" />
                {t('urlProcessingTool.exportJson')}
              </Button>
              <Button variant="outline" onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}>
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('urlProcessingTool.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('urlProcessingTool.copyToClipboard')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
