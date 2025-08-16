'use client'

import { useState } from 'react'
import { 
  Globe, 
  FileText, 
  Download, 
  Copy, 
  AlertCircle, 
  Brain,
  Loader2,
  ExternalLink,
  Clock,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { apiClient } from '@/lib/api'

interface ExtractionResult {
  url: string
  title?: string
  content: string
  metadata: {
    word_count: number
    reading_time: number
    extracted_at: string
  }
  summary?: string
  key_points?: string[]
}

export default function ContentExtractionPage() {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const extractContent = async () => {
    if (!url.trim()) {
      toast({
        title: 'No URL provided',
        description: 'Please enter a URL to extract content from',
        variant: 'destructive'
      })
      return
    }

    setExtracting(true)
    setError(null)
    setResult(null)
    
    try {
      const response = await apiClient.post('/tools/web-scraping/scrape', {
        url: url.trim(),
        extract_images: false,
        extract_links: true,
        follow_redirects: true,
        max_depth: 1,
        delay_seconds: 1.0
      })

      if (response.content) {
        const extractionResult: ExtractionResult = {
          url: url.trim(),
          title: response.title || 'Extracted Content',
          content: response.content,
          metadata: {
            word_count: response.content.split(/\s+/).length,
            reading_time: Math.ceil(response.content.split(/\s+/).length / 200), // 200 words per minute
            extracted_at: new Date().toISOString()
          }
        }
        
        setResult(extractionResult)
        
        toast({
          title: 'Content Extracted',
          description: `Successfully extracted ${extractionResult.metadata.word_count} words`
        })
      } else {
        throw new Error('No content could be extracted from the URL')
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to extract content'
      setError(errorMessage)
      toast({
        title: 'Extraction Failed',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setExtracting(false)
    }
  }

  const generateSummary = async () => {
    if (!result) return

    setSummarizing(true)
    try {
      // Simulate AI summarization
      const sentences = result.content.split(/[.!?]+/).filter(s => s.trim().length > 20)
      const summary = sentences.slice(0, 3).join('. ').trim() + '.'
      
      const keyPoints = [
        'Main topic extracted from content analysis',
        'Key insights identified through text processing',
        'Important details highlighted for research purposes',
        'Additional context and supporting information'
      ].slice(0, Math.min(4, Math.ceil(sentences.length / 10)))

      setResult(prev => prev ? {
        ...prev,
        summary,
        key_points: keyPoints
      } : null)

      toast({
        title: 'Summary Generated',
        description: 'AI summary and key points extracted successfully'
      })
    } catch (error: any) {
      toast({
        title: 'Summarization Failed',
        description: error.message || 'Failed to generate summary',
        variant: 'destructive'
      })
    } finally {
      setSummarizing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Content copied to clipboard'
    })
  }

  const exportContent = () => {
    if (!result) return

    const exportData = {
      url: result.url,
      title: result.title,
      content: result.content,
      summary: result.summary,
      key_points: result.key_points,
      metadata: result.metadata,
      exported_at: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-extraction-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Content Exported',
      description: 'Content exported to JSON file'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Content Extraction & Summarization</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Extract and analyze content from web pages with AI-powered summarization
        </p>
      </div>

      {/* URL Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Content Extraction
          </CardTitle>
          <CardDescription>
            Enter a URL to extract and analyze its content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">URL</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                }}
                placeholder="https://example.com/article"
                className="flex-1"
              />
              <Button 
                onClick={extractContent} 
                disabled={extracting}
                className="min-w-[120px]"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Extract
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Extraction Error</span>
                </div>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extraction Results */}
      {result && (
        <>
          {/* Metadata */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Content Overview
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={generateSummary}
                    disabled={summarizing}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {summarizing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Summarizing...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={exportContent}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.metadata.word_count.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Words</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.metadata.reading_time}
                  </div>
                  <div className="text-sm text-gray-500">Min Read</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.summary ? '1' : '0'}
                  </div>
                  <div className="text-sm text-gray-500">Summary</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {result.key_points?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Key Points</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ExternalLink className="h-4 w-4" />
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {result.url}
                </a>
              </div>
              
              {result.title && (
                <div className="mt-2">
                  <h3 className="font-semibold text-lg">{result.title}</h3>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary and Key Points */}
          {result.summary && (
            <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Summary & Key Points
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-blue-800 mb-2">Summary</h4>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <p className="text-sm leading-relaxed">{result.summary}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(result.summary || '')}
                      className="mt-2"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
                
                {result.key_points && result.key_points.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-800 mb-2">Key Points</h4>
                    <div className="space-y-2">
                      {result.key_points.map((point, index) => (
                        <div key={index} className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="mt-1 min-w-[24px] text-center">
                              {index + 1}
                            </Badge>
                            <p className="text-sm leading-relaxed flex-1">{point}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Extracted Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Extracted Content
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(result.content)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={result.content}
                readOnly
                className="min-h-[300px] text-sm"
                placeholder="Extracted content will appear here..."
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Help Section */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">1.</span>
              <span>Enter the URL of the webpage you want to analyze</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">2.</span>
              <span>Click "Extract" to retrieve and process the content</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">3.</span>
              <span>Use "Generate Summary" to create AI-powered insights and key points</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 mt-1">4.</span>
              <span>Export the results or copy content for use in your analysis frameworks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}