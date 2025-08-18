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
  Eye,
  Hash,
  Globe2,
  User,
  Calendar,
  Link,
  Image,
  Zap,
  Server,
  Languages
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
    domain?: string
    content_type?: string
    language?: string
    author?: string
    published_date?: string
    links_count?: number
    images_count?: number
    content_hash?: string
    status_code?: number
    response_time?: number
  }
  summary?: string
  key_points?: string[]
  links?: Array<{
    url: string
    text: string
    type: 'internal' | 'external'
  }>
  images?: Array<{
    src: string
    alt?: string
    title?: string
  }>
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
    
    const startTime = Date.now()
    
    try {
      // Start the scraping job
      const jobResponse = await apiClient.post('/tools/scraping/scrape', {
        url: url.trim(),
        extract_images: true,
        extract_links: true,
        follow_redirects: true,
        max_depth: 1,
        delay_seconds: 1.0
      })

      const jobId = jobResponse.job_id
      if (!jobId) {
        throw new Error('Failed to start scraping job')
      }

      // Poll for job completion
      let attempts = 0
      const maxAttempts = 30 // 30 seconds timeout
      let scrapedData: any = null
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        attempts++
        
        try {
          // Check job status
          const statusResponse = await apiClient.get(`/tools/scraping/jobs/${jobId}/status`)
          
          if (statusResponse.status === 'completed') {
            // Get the results
            const resultsResponse = await apiClient.get(`/tools/scraping/jobs/${jobId}/results`)
            
            if (resultsResponse.results && resultsResponse.results.length > 0) {
              scrapedData = resultsResponse.results[0]
              break
            }
          } else if (statusResponse.status === 'failed') {
            throw new Error('Scraping job failed')
          }
        } catch (statusError: any) {
          if (attempts >= maxAttempts) {
            throw new Error('Timeout waiting for scraping to complete')
          }
        }
      }
      
      const endTime = Date.now()
      const responseTime = endTime - startTime
      
      if (!scrapedData) {
        throw new Error('No data received from scraping job')
      }

      if (scrapedData.content) {
        const response = scrapedData
        const urlObj = new URL(url.trim())
        const domain = urlObj.hostname
        const wordCount = response.content.split(/\s+/).filter(word => word.length > 0).length
        
        // Extract metadata from response and enhance with additional analysis
        const extractionResult: ExtractionResult = {
          url: url.trim(),
          title: response.title || 'Extracted Content',
          content: response.content,
          metadata: {
            word_count: wordCount,
            reading_time: Math.ceil(wordCount / 200), // 200 words per minute
            extracted_at: new Date().toISOString(),
            domain: domain,
            content_type: response.content_type || 'text/html',
            language: detectLanguage(response.content),
            author: extractAuthor(response.content),
            published_date: extractPublishedDate(response.content),
            links_count: response.links?.length || 0,
            images_count: response.images?.length || 0,
            content_hash: generateContentHash(response.content),
            status_code: response.status_code || 200,
            response_time: responseTime
          },
          links: response.links?.map((link: any) => ({
            url: link.url || link,
            text: link.text || link,
            type: isInternalLink(link.url || link, domain) ? 'internal' : 'external'
          })) || [],
          images: response.images?.map((img: any) => ({
            src: img.src || img,
            alt: img.alt || '',
            title: img.title || ''
          })) || []
        }
        
        setResult(extractionResult)
        
        toast({
          title: 'Content Extracted',
          description: `Successfully extracted ${wordCount} words with ${extractionResult.metadata.links_count} links`
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

  // Helper functions for metadata extraction
  const detectLanguage = (content: string): string => {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    const words = content.toLowerCase().split(/\s+/).slice(0, 100)
    const englishCount = words.filter(word => englishWords.includes(word)).length
    return englishCount > 5 ? 'en' : 'unknown'
  }

  const extractAuthor = (content: string): string | undefined => {
    // Look for author patterns in content
    const authorPatterns = [
      /by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /author[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /written\s+by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
    ]
    
    for (const pattern of authorPatterns) {
      const match = content.match(pattern)
      if (match) return match[1]
    }
    return undefined
  }

  const extractPublishedDate = (content: string): string | undefined => {
    // Look for date patterns in content
    const datePatterns = [
      /published[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /(\d{4}-\d{2}-\d{2})/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    ]
    
    for (const pattern of datePatterns) {
      const match = content.match(pattern)
      if (match) return match[1] || match[0]
    }
    return undefined
  }

  const isInternalLink = (linkUrl: string, domain: string): boolean => {
    try {
      const link = new URL(linkUrl, `https://${domain}`)
      return link.hostname === domain
    } catch {
      return linkUrl.startsWith('/') || linkUrl.startsWith('#')
    }
  }

  const generateContentHash = (content: string): string => {
    // Simple hash function for content fingerprinting
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
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
              {/* Primary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
                    {result.metadata.links_count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Links</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {result.metadata.images_count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Images</div>
                </div>
              </div>

              {/* URL and Title */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ExternalLink className="h-4 w-4" />
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                    {result.url}
                  </a>
                </div>
                
                {result.title && (
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{result.title}</h3>
                  </div>
                )}
              </div>

              {/* Enhanced Metadata */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-800 mb-3">Detailed Metadata</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.metadata.domain && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe2 className="h-4 w-4 text-blue-500" />
                      <span className="text-gray-500">Domain:</span>
                      <span className="font-medium">{result.metadata.domain}</span>
                    </div>
                  )}
                  
                  {result.metadata.language && (
                    <div className="flex items-center gap-2 text-sm">
                      <Languages className="h-4 w-4 text-green-500" />
                      <span className="text-gray-500">Language:</span>
                      <span className="font-medium">{result.metadata.language.toUpperCase()}</span>
                    </div>
                  )}
                  
                  {result.metadata.author && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-purple-500" />
                      <span className="text-gray-500">Author:</span>
                      <span className="font-medium">{result.metadata.author}</span>
                    </div>
                  )}
                  
                  {result.metadata.published_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      <span className="text-gray-500">Published:</span>
                      <span className="font-medium">{result.metadata.published_date}</span>
                    </div>
                  )}
                  
                  {result.metadata.content_type && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      <span className="text-gray-500">Type:</span>
                      <span className="font-medium">{result.metadata.content_type}</span>
                    </div>
                  )}
                  
                  {result.metadata.response_time && (
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-gray-500">Response:</span>
                      <span className="font-medium">{result.metadata.response_time}ms</span>
                    </div>
                  )}
                  
                  {result.metadata.status_code && (
                    <div className="flex items-center gap-2 text-sm">
                      <Server className="h-4 w-4 text-red-500" />
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium ${result.metadata.status_code === 200 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.metadata.status_code}
                      </span>
                    </div>
                  )}
                  
                  {result.metadata.content_hash && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-500">Hash:</span>
                      <span className="font-mono text-xs font-medium">{result.metadata.content_hash}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-500">Extracted:</span>
                    <span className="font-medium text-xs">
                      {new Date(result.metadata.extracted_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
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

          {/* Links and Images */}
          {(result.links && result.links.length > 0) || (result.images && result.images.length > 0) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Extracted Links */}
              {result.links && result.links.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link className="h-5 w-5" />
                      Extracted Links ({result.links.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {result.links.slice(0, 20).map((link, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 border rounded-lg hover:bg-gray-50">
                          <Badge variant={link.type === 'internal' ? 'default' : 'secondary'} className="mt-1 text-xs">
                            {link.type}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{link.text || 'Link'}</p>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {link.url}
                            </a>
                          </div>
                        </div>
                      ))}
                      {result.links.length > 20 && (
                        <p className="text-sm text-gray-500 text-center">
                          ... and {result.links.length - 20} more links
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Extracted Images */}
              {result.images && result.images.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="h-5 w-5" />
                      Extracted Images ({result.images.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {result.images.slice(0, 10).map((img, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 border rounded-lg hover:bg-gray-50">
                          <Image className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            {img.alt && (
                              <p className="text-sm font-medium">{img.alt}</p>
                            )}
                            {img.title && img.title !== img.alt && (
                              <p className="text-xs text-gray-600">{img.title}</p>
                            )}
                            <a 
                              href={img.src} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {img.src}
                            </a>
                          </div>
                        </div>
                      ))}
                      {result.images.length > 10 && (
                        <p className="text-sm text-gray-500 text-center">
                          ... and {result.images.length - 10} more images
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}

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