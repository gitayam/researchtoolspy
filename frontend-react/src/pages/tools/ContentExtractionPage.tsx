import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Download, Copy, Save, Check, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUploader } from '@/components/tools/FileUploader'
import type { ExtractionResult, ExtractionProgress } from '@/types/extraction'

export function ContentExtractionPage() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<ExtractionProgress>({ status: 'idle', progress: 0 })
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [extractionMode, setExtractionMode] = useState<'file' | 'url'>('file')

  const handleFileSelected = async (file: File) => {
    setProgress({ status: 'uploading', progress: 10, message: 'Uploading file...' })

    try {
      const formData = new FormData()
      formData.append('file', file)

      setProgress({ status: 'processing', progress: 30, message: 'Extracting content...' })

      const response = await fetch('/api/tools/extract', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`)
      }

      setProgress({ status: 'analyzing', progress: 70, message: 'Analyzing text...' })

      const data = await response.json()

      setProgress({ status: 'complete', progress: 100, message: 'Complete!' })
      setResult(data)

    } catch (error) {
      console.error('Extraction error:', error)
      setProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Failed to extract content'
      })
    }
  }

  const handleUrlExtraction = async () => {
    if (!url.trim()) return

    setProgress({ status: 'processing', progress: 20, message: 'Fetching URL...' })

    try {
      const response = await fetch('/api/tools/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`)
      }

      setProgress({ status: 'analyzing', progress: 70, message: 'Analyzing content...' })

      const data = await response.json()

      setProgress({ status: 'complete', progress: 100, message: 'Complete!' })
      setResult(data)

    } catch (error) {
      console.error('URL extraction error:', error)
      setProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Failed to extract content from URL'
      })
    }
  }

  const copyToClipboard = async () => {
    if (!result) return

    try {
      await navigator.clipboard.writeText(result.content.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const downloadText = () => {
    if (!result) return

    const blob = new Blob([result.content.text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extraction-${result.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadJSON = () => {
    if (!result) return

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extraction-${result.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Extraction</h1>
              <p className="text-gray-600 dark:text-gray-400">Extract and analyze content from documents and web pages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload or Enter URL</CardTitle>
          <CardDescription>Choose a file to upload or enter a URL to extract content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={extractionMode === 'file' ? 'default' : 'outline'}
              onClick={() => setExtractionMode('file')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              File Upload
            </Button>
            <Button
              variant={extractionMode === 'url' ? 'default' : 'outline'}
              onClick={() => setExtractionMode('url')}
              className="flex-1"
            >
              <Globe className="h-4 w-4 mr-2" />
              URL
            </Button>
          </div>

          {extractionMode === 'file' ? (
            <FileUploader
              onFileSelected={handleFileSelected}
              progress={progress}
            />
          ) : (
            <div className="space-y-4">
              <Input
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={progress.status === 'processing'}
              />
              <Button
                onClick={handleUrlExtraction}
                disabled={!url.trim() || progress.status === 'processing'}
                className="w-full"
              >
                Extract from URL
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Extraction Results</CardTitle>
                <CardDescription>
                  {result.content.wordCount} words • {result.content.charCount} characters
                  {result.content.pages && ` • ${result.content.pages} pages`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadText}>
                  <Download className="h-4 w-4 mr-2" />
                  TXT
                </Button>
                <Button variant="outline" size="sm" onClick={downloadJSON}>
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="text">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <Textarea
                  value={result.content.text}
                  readOnly
                  className="min-h-[400px] font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {result.metadata.title && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{result.metadata.title}</p>
                    </div>
                  )}
                  {result.metadata.author && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Author</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{result.metadata.author}</p>
                    </div>
                  )}
                  {result.metadata.date && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{result.metadata.date}</p>
                    </div>
                  )}
                  {result.metadata.language && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{result.metadata.language}</p>
                    </div>
                  )}
                  {result.metadata.keywords && result.metadata.keywords.length > 0 && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Keywords</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {result.metadata.keywords.map((keyword, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                {result.analysis ? (
                  <div className="space-y-4">
                    {result.analysis.readability && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Readability</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Flesch-Kincaid</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {result.analysis.readability.fleschKincaid.toFixed(1)}
                            </p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Grade Level</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {result.analysis.readability.grade}
                            </p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400">Difficulty</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                              {result.analysis.readability.difficulty.replace('-', ' ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {result.analysis.keywords && result.analysis.keywords.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top Keywords</h3>
                        <div className="space-y-2">
                          {result.analysis.keywords.slice(0, 10).map((kw, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-32 truncate">
                                {kw.word}
                              </span>
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${kw.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                                {kw.frequency}×
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No analysis data available</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
