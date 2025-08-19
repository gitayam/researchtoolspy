'use client'

import { useState } from 'react'
import { 
  Globe, 
  Plus, 
  Trash2, 
  Play, 
  Download, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Loader2,
  Eye,
  BarChart3,
  FileText,
  Link
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface BatchURL {
  id: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: {
    title?: string
    content: string
    word_count: number
    links_count: number
    domain: string
    response_time: number
  }
  error?: string
}

interface BatchResults {
  total_urls: number
  completed: number
  failed: number
  total_words: number
  total_links: number
  processing_time: number
}

export default function BatchProcessingPage() {
  const { toast } = useToast()
  const [urls, setUrls] = useState<BatchURL[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<BatchResults | null>(null)
  const [showBulkInput, setShowBulkInput] = useState(false)

  const addUrl = () => {
    if (!newUrl.trim()) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive'
      })
      return
    }

    try {
      new URL(newUrl.trim()) // Validate URL
      const newBatchUrl: BatchURL = {
        id: Date.now().toString(),
        url: newUrl.trim(),
        status: 'pending'
      }
      setUrls(prev => [...prev, newBatchUrl])
      setNewUrl('')
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL format',
        variant: 'destructive'
      })
    }
  }

  const addBulkUrls = () => {
    if (!bulkUrls.trim()) return

    const urlList = bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)

    const validUrls: BatchURL[] = []
    const invalidUrls: string[] = []

    urlList.forEach(url => {
      try {
        new URL(url) // Validate URL
        validUrls.push({
          id: `${Date.now()}-${Math.random()}`,
          url,
          status: 'pending'
        })
      } catch {
        invalidUrls.push(url)
      }
    })

    if (validUrls.length > 0) {
      setUrls(prev => [...prev, ...validUrls])
      setBulkUrls('')
      setShowBulkInput(false)
      
      toast({
        title: 'URLs Added',
        description: `${validUrls.length} valid URLs added${invalidUrls.length > 0 ? `, ${invalidUrls.length} invalid URLs skipped` : ''}`
      })
    } else {
      toast({
        title: 'No Valid URLs',
        description: 'Please check your URL format and try again',
        variant: 'destructive'
      })
    }
  }

  const removeUrl = (id: string) => {
    setUrls(prev => prev.filter(url => url.id !== id))
  }

  const clearAll = () => {
    setUrls([])
    setResults(null)
  }

  const processBatch = async () => {
    if (urls.length === 0) {
      toast({
        title: 'No URLs',
        description: 'Please add URLs to process',
        variant: 'destructive'
      })
      return
    }

    setProcessing(true)
    const startTime = Date.now()
    let completed = 0
    let failed = 0
    let totalWords = 0
    let totalLinks = 0

    try {
      // Process URLs sequentially to avoid overwhelming the server
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        
        // Update status to processing
        setUrls(prev => prev.map(u => 
          u.id === url.id ? { ...u, status: 'processing' } : u
        ))

        try {
          const response = await apiClient.post('/tools/scraping/scrape', {
            url: url.url,
            extract_images: false,
            extract_links: true,
            follow_redirects: true,
            max_depth: 1,
            delay_seconds: 0.5
          })

          if (response.content) {
            const urlObj = new URL(url.url)
            const wordCount = response.content.split(/\s+/).filter(word => word.length > 0).length
            const linksCount = response.links?.length || 0
            
            const result = {
              title: response.title || 'Extracted Content',
              content: response.content,
              word_count: wordCount,
              links_count: linksCount,
              domain: urlObj.hostname,
              response_time: Date.now() - startTime
            }

            setUrls(prev => prev.map(u => 
              u.id === url.id ? { ...u, status: 'completed', result } : u
            ))

            completed++
            totalWords += wordCount
            totalLinks += linksCount
          } else {
            throw new Error('No content extracted')
          }
        } catch (error: any) {
          setUrls(prev => prev.map(u => 
            u.id === url.id ? { 
              ...u, 
              status: 'failed', 
              error: error.message || 'Failed to process URL' 
            } : u
          ))
          failed++
        }

        // Small delay between requests
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      const endTime = Date.now()
      const processingTime = endTime - startTime

      setResults({
        total_urls: urls.length,
        completed,
        failed,
        total_words: totalWords,
        total_links: totalLinks,
        processing_time: processingTime
      })

      toast({
        title: 'Batch Processing Complete',
        description: `Processed ${completed} URLs successfully, ${failed} failed`
      })

    } catch (error: any) {
      toast({
        title: 'Batch Processing Failed',
        description: error.message || 'Failed to process batch',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const exportResults = () => {
    if (!results) return

    const exportData = {
      batch_results: results,
      urls: urls.map(url => ({
        url: url.url,
        status: url.status,
        title: url.result?.title,
        word_count: url.result?.word_count,
        links_count: url.result?.links_count,
        domain: url.result?.domain,
        error: url.error
      })),
      exported_at: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-processing-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Results Exported',
      description: 'Batch processing results exported to JSON file'
    })
  }

  const getStatusIcon = (status: BatchURL['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = (status: BatchURL['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
    }
  }

  const completedCount = urls.filter(url => url.status === 'completed').length
  const progressPercentage = urls.length > 0 ? (completedCount / urls.length) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Batch URL Processing</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Process multiple URLs simultaneously for bulk content extraction and analysis
        </p>
      </div>

      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Add URLs for Processing
          </CardTitle>
          <CardDescription>
            Add individual URLs or import multiple URLs at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Single URL Input */}
          <div>
            <label className="text-sm font-medium">Single URL</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addUrl()}
              />
              <Button onClick={addUrl}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Bulk URL Input */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Bulk URLs</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkInput(!showBulkInput)}
              >
                {showBulkInput ? 'Hide' : 'Show'} Bulk Input
              </Button>
            </div>
            
            {showBulkInput && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder="Enter URLs separated by new lines&#10;https://example1.com&#10;https://example2.com&#10;https://example3.com"
                  rows={6}
                />
                <div className="flex gap-2">
                  <Button onClick={addBulkUrls} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add All URLs
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setBulkUrls('')}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* URL List and Processing */}
      {urls.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                URLs to Process ({urls.length})
              </CardTitle>
              <div className="flex gap-2">
                {results && (
                  <Button variant="outline" onClick={exportResults}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Results
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={clearAll}
                  disabled={processing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                <Button 
                  onClick={processBatch}
                  disabled={processing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
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
              </div>
            </div>
            {processing && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Progress: {completedCount} of {urls.length} completed</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {urls.map((url) => (
                <div key={url.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(url.status)}
                    <Badge className={getStatusColor(url.status)} variant="secondary">
                      {url.status}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{url.url}</p>
                    
                    {url.result && (
                      <div className="mt-1 text-xs text-gray-600">
                        <span className="font-medium">{url.result.title}</span>
                        <span className="mx-2">•</span>
                        <span>{url.result.word_count.toLocaleString()} words</span>
                        <span className="mx-2">•</span>
                        <span>{url.result.links_count} links</span>
                        <span className="mx-2">•</span>
                        <span>{url.result.domain}</span>
                      </div>
                    )}
                    
                    {url.error && (
                      <div className="mt-1 text-xs text-red-600">
                        Error: {url.error}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUrl(url.id)}
                    disabled={processing}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {results && (
        <Card className="border-2 border-dashed border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Batch Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {results.total_urls}
                </div>
                <div className="text-sm text-gray-500">Total URLs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {results.completed}
                </div>
                <div className="text-sm text-gray-500">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {results.failed}
                </div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {results.total_words.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Total Words</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(results.processing_time / 1000)}s
                </div>
                <div className="text-sm text-gray-500">Processing Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">How to Use Batch Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">1.</span>
              <span>Add URLs individually or use bulk input to paste multiple URLs</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">2.</span>
              <span>Review your URL list and remove any unwanted entries</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">3.</span>
              <span>Click "Start Processing" to begin batch extraction</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">4.</span>
              <span>Monitor progress and export results when complete</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Batch processing includes automatic delays between requests to avoid overwhelming servers. 
              Large batches may take several minutes to complete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}