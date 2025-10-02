import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  Download,
  Copy,
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

  const parseURLs = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('http'))
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
      setError('Please enter at least one URL')
      return
    }

    if (urls.length > 20) {
      setError('Maximum 20 URLs allowed per batch')
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

    let citationsAdded = 0

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
          citationsAdded++
        } catch (error) {
          console.error('Failed to create citation:', error)
        }
      }
    })

    if (citationsAdded > 0) {
      alert(`${citationsAdded} citation(s) added to your library!\n\nGo to Citations Generator to view and manage them.`)
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

    const successful = result.items.filter(i => i.status === 'success')
    const failed = result.items.filter(i => i.status === 'error')

    const summary = `
Batch Processing Summary
========================

Operation: ${getOperationName(result.operation)}
Total Items: ${result.total}
Succeeded: ${result.succeeded} (${Math.round((result.succeeded / result.total) * 100)}%)
Failed: ${result.failed} (${Math.round((result.failed / result.total) * 100)}%)
Duration: ${((result.duration || 0) / 1000).toFixed(1)}s

Successful URLs:
${successful.map((item, i) => `${i + 1}. ${item.source}`).join('\n')}

${failed.length > 0 ? `
Failed URLs:
${failed.map((item, i) => `${i + 1}. ${item.source} - ${item.error || 'Unknown error'}`).join('\n')}
` : ''}
    `.trim()

    // Copy to clipboard
    navigator.clipboard.writeText(summary).then(() => {
      alert('Summary copied to clipboard!')
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
          Back to Tools
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Processing</h1>
          <p className="text-gray-600 dark:text-gray-400">Process multiple URLs or files simultaneously</p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Configuration</CardTitle>
          <CardDescription>
            Configure your batch processing job (max 20 items per batch)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Operation Selection */}
          <div className="space-y-2">
            <Label>Operation Type</Label>
            <Select value={operation} onValueChange={(v) => setOperation(v as BatchOperation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analyze-url">URL Analysis (with Wayback Machine)</SelectItem>
                <SelectItem value="scrape-metadata">Metadata Extraction</SelectItem>
                <SelectItem value="extract-content">Content Extraction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Input Method */}
          <div className="space-y-2">
            <Label>Input Method</Label>
            <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'paste' | 'csv')}>
              <TabsList>
                <TabsTrigger value="paste">Paste URLs</TabsTrigger>
                <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-2 mt-4">
                <Label htmlFor="urls">URLs (one per line)</Label>
                <Textarea
                  id="urls"
                  placeholder={'https://example.com\nhttps://example.org\nhttps://example.net'}
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  className="min-h-32 font-mono text-sm"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {parseURLs(urlsText).length} valid URLs found
                </p>
              </TabsContent>

              <TabsContent value="csv" className="space-y-2 mt-4">
                <Label htmlFor="csv-upload">Upload CSV File</Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  CSV should have URLs in the first column (header row will be skipped)
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <Label>Processing Options</Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workers">Concurrent Workers</Label>
                <Select value={String(maxWorkers)} onValueChange={(v) => setMaxWorkers(Number(v))}>
                  <SelectTrigger id="workers">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Sequential)</SelectItem>
                    <SelectItem value="2">2 (Slow)</SelectItem>
                    <SelectItem value="3">3 (Balanced)</SelectItem>
                    <SelectItem value="4">4 (Fast)</SelectItem>
                    <SelectItem value="5">5 (Very Fast)</SelectItem>
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
                    Stop on first error
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
                    Retry failed items
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
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Processing
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => {
              setUrlsText('')
              setResult(null)
              setError(null)
            }}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
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
                <span>Batch Results</span>
                <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                  Job ID: {result.jobId}
                </span>
              </CardTitle>
              <CardDescription>
                {getOperationName(result.operation)} • Completed in {((result.duration || 0) / 1000).toFixed(1)}s
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Progress: {result.processed}/{result.total} items
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
                  <div className="text-sm text-gray-600 dark:text-gray-400">Succeeded</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{result.failed}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {result.total - result.processed}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Label>Process Results</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createCitationsFromBatch}
                    disabled={result.succeeded === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Citations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveAsDataset}
                    disabled={result.succeeded === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Save as Dataset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addToEvidence}
                    disabled={result.succeeded === 0}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Add to Evidence
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateSummary}
                    disabled={result.succeeded === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Summary
                  </Button>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="space-y-2">
                <Label>Export Results</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportJSON}>
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
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
        </div>
      )}
    </div>
  )
}
