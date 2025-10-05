import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Play,
  Download,
  Copy,
  Check,
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Trash2,
  Archive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { BatchOperation, BatchJob } from '@/types/batch-processing'
import type { SavedCitation } from '@/types/citations'
import { generateCitation } from '@/utils/citation-formatters'
import { addCitation, generateCitationId } from '@/utils/citation-library'
import { useNavigate as useNav } from 'react-router-dom'

export function BatchProcessingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [operation, setOperation] = useState<BatchOperation>('analyze-url')
  const [inputMethod, setInputMethod] = useState<'paste' | 'csv'>('paste')
  const [urlsText, setUrlsText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<BatchJob | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Options
  const [maxWorkers, setMaxWorkers] = useState(3)
  const [stopOnError, setStopOnError] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)

  // Citations
  const [generatedCitations, setGeneratedCitations] = useState<SavedCitation[]>([])
  const [showCitations, setShowCitations] = useState(false)
  const [copied, setCopied] = useState(false)

  const parseURLs = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'))
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('Failed to copy to clipboard')
    }
  }

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text.split('\n')

    // Parse CSV (simple parser, assumes first column is URL)
    const urls = lines
      .slice(1) // Skip header
      .map(line => line.split(',')[0].trim())
      .filter(url => url && url.startsWith('http'))

    setUrlsText(urls.join('\n'))
    setInputMethod('paste') // Switch to paste view to show loaded URLs
  }

  const startProcessing = async () => {
    const urls = parseURLs(urlsText)

    if (urls.length === 0) {
      setError(t('batchProcessingTool.pleaseEnterUrl'))
      return
    }

    if (urls.length > 20) {
      setError(t('batchProcessingTool.maxUrlsExceeded'))
      return
    }

    setProcessing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/tools/batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          items: urls.map((url, index) => ({
            id: `url-${index + 1}`,
            type: 'url',
            source: url
          })),
          options: {
            maxWorkers,
            stopOnError,
            retryFailed,
            createDatasets: false
          }
        })
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process batch')
    } finally {
      setProcessing(false)
    }
  }

  const exportJSON = () => {
    if (!result) return

    const dataStr = JSON.stringify(result, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `batch-results-${result.jobId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    if (!result) return

    const headers = ['ID', 'URL', 'Status', 'Duration (ms)', 'Error']
    const rows = result.items.map(item => [
      item.id,
      item.source,
      item.status,
      item.duration || '',
      item.error || ''
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const dataBlob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `batch-results-${result.jobId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const createCitationsFromBatch = () => {
    if (!result) return

    const successfulItems = result.items.filter(item => item.status === 'success' && item.result)
    if (successfulItems.length === 0) {
      alert('No successful results to create citations from')
      return
    }

    const createdCitations: SavedCitation[] = []

    successfulItems.forEach(item => {
      const data = item.result

      // Extract citation info from the result
      if (data.metadata && data.metadata.title) {
        try {
          const authors = data.metadata.author
            ? [{
                firstName: data.metadata.author.split(' ')[0] || '',
                lastName: data.metadata.author.split(' ').slice(-1)[0] || '',
                middleName: ''
              }]
            : [{ firstName: '', lastName: 'Unknown', middleName: '' }]

          const fields = {
            authors,
            title: data.metadata.title || item.source,
            year: data.metadata.publishDate || data.domain?.registrationDate || '',
            url: item.source,
            siteName: data.metadata.siteName || data.domain?.name || '',
            accessDate: new Date().toISOString().split('T')[0]
          }

          const { citation, inTextCitation } = generateCitation(fields, 'website', 'apa')

          const savedCitation: SavedCitation = {
            id: generateCitationId(),
            citationStyle: 'apa',
            sourceType: 'website',
            fields,
            citation,
            inTextCitation,
            addedAt: new Date().toISOString()
          }

          addCitation(savedCitation)
          createdCitations.push(savedCitation)
        } catch (error) {
          console.error('Failed to create citation:', error)
        }
      }
    })

    if (createdCitations.length > 0) {
      setGeneratedCitations(createdCitations)
      setShowCitations(true)
      alert(`${createdCitations.length} citation(s) created and displayed below!`)
    } else {
      alert('Could not create citations from these results. Try using URLs with better metadata.')
    }
  }

  const saveAsDataset = async () => {
    if (!result) return

    const successfulItems = result.items.filter(item => item.status === 'success')
    if (successfulItems.length === 0) {
      alert('No successful results to save')
      return
    }

    try {
      const dataset = {
        title: `Batch Analysis - ${new Date().toLocaleDateString()}`,
        description: `Batch ${result.operation} of ${result.total} URLs`,
        source: 'batch-processing',
        type: 'batch_analysis',
        source_name: 'Batch Processing Tool',
        tags: ['batch', result.operation],
        metadata: JSON.stringify({
          jobId: result.jobId,
          operation: result.operation,
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
          items: successfulItems.map(item => ({
            source: item.source,
            result: item.result
          }))
        }),
        access_date: new Date().toISOString().split('T')[0],
        public: false
      }

      const response = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataset)
      })

      if (response.ok) {
        const { dataset: created } = await response.json()
        if (confirm(`Dataset created successfully! ID: ${created.id}\n\nGo to Dataset Library?`)) {
          navigate('/dashboard/datasets')
        }
      } else {
        throw new Error('Failed to create dataset')
      }
    } catch (error) {
      console.error('Dataset creation error:', error)
      alert('Failed to save as dataset. Please try again.')
    }
  }

  const addToEvidence = () => {
    alert('Add to Evidence feature coming in Phase 3!\n\nThis will allow you to convert batch results into evidence items with claims.')
  }

  const generateSummary = () => {
    if (!result) return

    const successful = result.items.filter(i => i.status === 'success' && i.result)

    if (successful.length === 0) {
      alert('No successful results to summarize')
      return
    }

    let summary = `Content Summary\n${'='.repeat(50)}\n\n`
    summary += `Operation: ${getOperationName(result.operation)}\n`
    summary += `Sources Analyzed: ${successful.length}\n`
    summary += `Date: ${new Date().toLocaleDateString()}\n\n`
    summary += `${'='.repeat(50)}\n\n`

    // Generate content summary based on operation type
    successful.forEach((item, index) => {
      const data = item.result

      summary += `${index + 1}. ${item.source}\n`
      summary += `${'-'.repeat(50)}\n`

      if (result.operation === 'analyze-url') {
        // Extract metadata from URL analysis
        if (data.metadata) {
          if (data.metadata.title) {
            summary += `Title: ${data.metadata.title}\n`
          }
          if (data.metadata.author) {
            summary += `Author: ${data.metadata.author}\n`
          }
          if (data.metadata.publishDate) {
            summary += `Published: ${data.metadata.publishDate}\n`
          }
          if (data.metadata.description) {
            summary += `\nDescription:\n${data.metadata.description}\n`
          }
        }

        if (data.domain?.name) {
          summary += `Source: ${data.domain.name}\n`
        }

        if (data.reliability) {
          summary += `\nReliability: ${data.reliability.score}/100 (${data.reliability.category})\n`
          if (data.reliability.notes && data.reliability.notes.length > 0) {
            summary += `Notes:\n${data.reliability.notes.map(n => `  • ${n}`).join('\n')}\n`
          }
        }

      } else if (result.operation === 'extract-content') {
        // Extract content summary
        if (data.metadata?.title) {
          summary += `Title: ${data.metadata.title}\n`
        }
        if (data.content?.text) {
          const text = data.content.text.trim()
          const preview = text.length > 500 ? text.substring(0, 500) + '...' : text
          summary += `\nContent Preview:\n${preview}\n`
          summary += `\nTotal Characters: ${text.length}\n`
        }
        if (data.analysis) {
          summary += `\nAnalysis:\n`
          if (data.analysis.summary) {
            summary += `Summary: ${data.analysis.summary}\n`
          }
          if (data.analysis.keyPoints && data.analysis.keyPoints.length > 0) {
            summary += `Key Points:\n${data.analysis.keyPoints.map(p => `  • ${p}`).join('\n')}\n`
          }
        }

      } else if (result.operation === 'scrape-metadata') {
        // Display scraped metadata
        if (data.title) summary += `Title: ${data.title}\n`
        if (data.author) summary += `Author: ${data.author}\n`
        if (data.description) summary += `Description: ${data.description}\n`
        if (data.siteName) summary += `Site: ${data.siteName}\n`
        if (data.publishDate) summary += `Published: ${data.publishDate}\n`

        if (data.openGraph) {
          summary += `\nOpen Graph Data:\n`
          Object.entries(data.openGraph).forEach(([key, value]) => {
            if (typeof value === 'string') {
              summary += `  ${key}: ${value}\n`
            }
          })
        }
      }

      summary += `\n`
    })

    // Add stats at the end
    summary += `${'='.repeat(50)}\n`
    summary += `Processing Stats:\n`
    summary += `  Total Processed: ${result.total}\n`
    summary += `  Successful: ${result.succeeded}\n`
    summary += `  Failed: ${result.failed}\n`
    summary += `  Duration: ${((result.duration || 0) / 1000).toFixed(1)}s\n`

    // Copy to clipboard
    navigator.clipboard.writeText(summary).then(() => {
      alert('Content summary copied to clipboard!')
    }).catch(() => {
      // Fallback: show in alert
      alert(summary)
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getOperationName = (op: BatchOperation) => {
    switch (op) {
      case 'analyze-url': return 'URL Analysis'
      case 'scrape-metadata': return 'Metadata Extraction'
      case 'extract-content': return 'Content Extraction'
      case 'generate-citation': return 'Citation Generation'
      default: return op
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/tools')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('batchProcessingTool.backToTools')}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('batchProcessingTool.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('batchProcessingTool.subtitle')}</p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('batchProcessingTool.configTitle')}</CardTitle>
          <CardDescription>
            {t('batchProcessingTool.configDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Operation Selection */}
          <div className="space-y-2">
            <Label>{t('batchProcessingTool.operationType')}</Label>
            <Select value={operation} onValueChange={(v) => setOperation(v as BatchOperation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analyze-url">{t('batchProcessingTool.urlAnalysis')}</SelectItem>
                <SelectItem value="scrape-metadata">{t('batchProcessingTool.metadataExtraction')}</SelectItem>
                <SelectItem value="extract-content">{t('batchProcessingTool.contentExtraction')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Input Method */}
          <div className="space-y-2">
            <Label>{t('batchProcessingTool.inputMethod')}</Label>
            <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'paste' | 'csv')}>
              <TabsList>
                <TabsTrigger value="paste">{t('batchProcessingTool.pasteUrls')}</TabsTrigger>
                <TabsTrigger value="csv">{t('batchProcessingTool.uploadCsv')}</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-2 mt-4">
                <Label htmlFor="urls">{t('batchProcessingTool.urlsLabel')}</Label>
                <Textarea
                  id="urls"
                  placeholder={t('batchProcessingTool.urlsPlaceholder')}
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  className="min-h-32 font-mono text-sm"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {parseURLs(urlsText).length} {t('batchProcessingTool.validUrlsFound')}
                </p>
              </TabsContent>

              <TabsContent value="csv" className="space-y-2 mt-4">
                <Label htmlFor="csv-upload">{t('batchProcessingTool.uploadCsvFile')}</Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('batchProcessingTool.csvHelperText')}
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <Label>{t('batchProcessingTool.processingOptions')}</Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workers">{t('batchProcessingTool.concurrentWorkers')}</Label>
                <Select value={String(maxWorkers)} onValueChange={(v) => setMaxWorkers(Number(v))}>
                  <SelectTrigger id="workers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('batchProcessingTool.sequential')}</SelectItem>
                    <SelectItem value="2">{t('batchProcessingTool.slow')}</SelectItem>
                    <SelectItem value="3">{t('batchProcessingTool.balanced')}</SelectItem>
                    <SelectItem value="4">{t('batchProcessingTool.fast')}</SelectItem>
                    <SelectItem value="5">{t('batchProcessingTool.veryFast')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="stop-on-error"
                    checked={stopOnError}
                    onCheckedChange={(checked) => setStopOnError(checked as boolean)}
                  />
                  <label
                    htmlFor="stop-on-error"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('batchProcessingTool.stopOnError')}
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="retry-failed"
                    checked={retryFailed}
                    onCheckedChange={(checked) => setRetryFailed(checked as boolean)}
                  />
                  <label
                    htmlFor="retry-failed"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('batchProcessingTool.retryFailed')}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={startProcessing} disabled={processing || parseURLs(urlsText).length === 0}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('batchProcessingTool.processing')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {t('batchProcessingTool.startProcessing')}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => {
              setUrlsText('')
              setResult(null)
              setError(null)
            }}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('batchProcessingTool.clear')}
            </Button>
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
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('batchProcessingTool.batchResults')}</span>
                <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                  {t('batchProcessingTool.jobId')}: {result.jobId}
                </span>
              </CardTitle>
              <CardDescription>
                {getOperationName(result.operation)} • {t('batchProcessingTool.completedIn')} {((result.duration || 0) / 1000).toFixed(1)}s
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t('batchProcessingTool.progress')}: {result.processed}/{result.total} {t('batchProcessingTool.items')}
                  </span>
                  <span className="font-medium">
                    {Math.round((result.processed / result.total) * 100)}%
                  </span>
                </div>
                <Progress value={(result.processed / result.total) * 100} className="h-2" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{result.succeeded}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('batchProcessingTool.succeeded')}</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{result.failed}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('batchProcessingTool.failed')}</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {result.total - result.processed}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{t('batchProcessingTool.pending')}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Label>{t('batchProcessingTool.processResults')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createCitationsFromBatch}
                    disabled={result.succeeded === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('batchProcessingTool.createCitations')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveAsDataset}
                    disabled={result.succeeded === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('batchProcessingTool.saveAsDataset')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addToEvidence}
                    disabled={result.succeeded === 0}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {t('batchProcessingTool.addToEvidence')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateSummary}
                    disabled={result.succeeded === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('batchProcessingTool.generateSummary')}
                  </Button>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="space-y-2">
                <Label>{t('batchProcessingTool.exportResults')}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportJSON}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('batchProcessingTool.exportJson')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV}>
                    <FileText className="h-4 w-4 mr-2" />
                    {t('batchProcessingTool.exportCsv')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('batchProcessingTool.processingResults')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getStatusIcon(item.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.source}
                        </div>
                        {item.error && (
                          <div className="text-xs text-red-600 dark:text-red-400 truncate">
                            {item.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.duration && (
                        <span>{(item.duration / 1000).toFixed(2)}s</span>
                      )}
                      <span className="capitalize">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generated Citations Section */}
          {generatedCitations.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('batchProcessingTool.generatedCitations')}</CardTitle>
                    <CardDescription>
                      {generatedCitations.length} {t('batchProcessingTool.citationsCreated')}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCitations(!showCitations)}
                  >
                    {showCitations ? t('batchProcessingTool.hideCitations') : t('batchProcessingTool.showCitations')}
                  </Button>
                </div>
              </CardHeader>

              {showCitations && (
                <CardContent className="space-y-3">
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {generatedCitations.map((citation, idx) => (
                      <div
                        key={citation.id}
                        className="p-3 border rounded-lg dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                              {citation.citation}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(citation.citation)}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const text = generatedCitations
                          .map((c, i) => `${i + 1}. ${c.citation}`)
                          .join('\n\n')
                        copyToClipboard(text)
                      }}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          {t('contentExtractionTool.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          {t('batchProcessingTool.copyAll')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/dashboard/tools/citations-generator')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {t('batchProcessingTool.viewInLibrary')}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
