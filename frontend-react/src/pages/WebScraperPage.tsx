import { useState } from 'react'
import { Globe, Download, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { ExtractionMode, ScrapingResult } from '@/types/scraper'
import { cn } from '@/lib/utils'

export function WebScraperPage() {
  const [url, setUrl] = useState('')
  const [extractMode, setExtractMode] = useState<ExtractionMode>('metadata')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScrape = async () => {
    if (!url) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/web-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          extract_mode: extractMode,
          create_dataset: false
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape URL')
      }

      setResult(data.data)
    } catch (err: any) {
      setError(err.message || 'Failed to scrape URL')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDataset = async () => {
    if (!result) return

    try {
      const response = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title || result.domain,
          description: result.description || `Content from ${result.domain}`,
          source: result.url,
          type: 'web_article',
          source_name: result.domain,
          source_url: result.url,
          author: result.author,
          reliability_rating: result.reliability_score && result.reliability_score >= 7 ? 'high' :
                              result.reliability_score && result.reliability_score >= 5 ? 'medium' : 'low',
          tags: result.metadata?.keywords || [],
          metadata: JSON.stringify(result.metadata),
          access_date: new Date().toISOString().split('T')[0],
        })
      })

      if (response.ok) {
        const { dataset } = await response.json()
        alert(`Dataset created successfully! ID: ${dataset.id}`)
      } else {
        throw new Error('Failed to create dataset')
      }
    } catch (err: any) {
      alert('Error creating dataset: ' + err.message)
    }
  }

  const handleExport = () => {
    if (!result) return

    const data = JSON.stringify(result, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scraped-data-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getReliabilityBadge = (score?: number) => {
    if (!score) return null

    let variant: 'default' | 'secondary' | 'destructive' = 'secondary'
    let label = 'Unknown'

    if (score >= 8) {
      variant = 'default'
      label = 'High Reliability'
    } else if (score >= 6) {
      variant = 'secondary'
      label = 'Medium Reliability'
    } else {
      variant = 'destructive'
      label = 'Low Reliability'
    }

    return <Badge variant={variant}>{label} ({score}/10)</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Web Scraper & Intelligence Extractor</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Extract structured data from web pages for intelligence analysis
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            URL Extraction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="url">URL to Scrape *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="extract-mode">Extraction Mode</Label>
            <Select
              value={extractMode}
              onValueChange={(value) => setExtractMode(value as ExtractionMode)}
              disabled={loading}
            >
              <SelectTrigger id="extract-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metadata">Metadata Only (Fast)</SelectItem>
                <SelectItem value="summary">Summary + Metadata</SelectItem>
                <SelectItem value="full">Full Content Analysis</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {extractMode === 'metadata' && 'Extracts title, description, author, keywords'}
              {extractMode === 'summary' && 'Includes metadata plus content summary'}
              {extractMode === 'full' && 'Full text extraction and analysis'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button onClick={handleScrape} disabled={loading} className="w-full">
            {loading ? 'Extracting...' : 'Extract & Analyze'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Title</Label>
                <p className="font-semibold text-gray-900 dark:text-white">{result.title || 'N/A'}</p>
              </div>

              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Domain</Label>
                <p className="text-gray-900 dark:text-white">{result.domain}</p>
              </div>

              {result.author && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Author</Label>
                  <p className="text-gray-900 dark:text-white">{result.author}</p>
                </div>
              )}

              {result.published_date && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Published</Label>
                  <p className="text-gray-900 dark:text-white">{result.published_date}</p>
                </div>
              )}

              {result.reliability_score && (
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Reliability Score</Label>
                  <div className="mt-1">{getReliabilityBadge(result.reliability_score)}</div>
                </div>
              )}

              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Extracted At</Label>
                <p className="text-gray-900 dark:text-white text-sm">
                  {new Date(result.extracted_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Description */}
            {result.description && (
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Description</Label>
                <p className="text-gray-700 dark:text-gray-300">{result.description}</p>
              </div>
            )}

            {/* Keywords */}
            {result.metadata?.keywords && result.metadata.keywords.length > 0 && (
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">Keywords</Label>
                <div className="flex flex-wrap gap-2">
                  {result.metadata.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">{keyword}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            {result.content && (
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">Content Preview</Label>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mt-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {result.content.summary || result.content.text.substring(0, 500) + '...'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Word count: {result.content.word_count}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleExport} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
              <Button onClick={handleCreateDataset} className="flex-1">
                <Database className="h-4 w-4 mr-2" />
                Create Dataset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
