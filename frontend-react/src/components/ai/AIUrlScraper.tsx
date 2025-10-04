/**
 * AI URL Scraper Component
 *
 * Scrapes URLs and extracts structured data using AI
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Globe, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ScrapedData {
  url: string
  title: string
  content: string
  summary: string
  extractedData: Record<string, any>
  metadata: {
    publishDate?: string
    author?: string
    source: string
  }
}

export interface AIUrlScraperProps {
  framework: string
  onExtract: (data: Record<string, any>, metadata: { url: string; title: string; summary: string }) => void
  disabled?: boolean
  buttonVariant?: 'default' | 'outline' | 'secondary'
}

export function AIUrlScraper({
  framework,
  onExtract,
  disabled = false,
  buttonVariant = 'outline'
}: AIUrlScraperProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setScraping(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), framework })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to scrape URL')
      }

      const data: ScrapedData = await response.json()
      setScrapedData(data)
    } catch (err) {
      console.error('Scraping error:', err)
      setError(err instanceof Error ? err.message : 'Failed to scrape URL')
    } finally {
      setScraping(false)
    }
  }

  const handleAccept = () => {
    if (scrapedData && scrapedData.extractedData) {
      onExtract(scrapedData.extractedData, {
        url: scrapedData.url,
        title: scrapedData.title,
        summary: scrapedData.summary
      })
      setDialogOpen(false)
      setUrl('')
      setScrapedData(null)
      setError(null)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setUrl('')
      setScrapedData(null)
      setError(null)
    }
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
      >
        <Globe className="h-4 w-4 mr-2" />
        Import from URL
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              Import from URL
            </DialogTitle>
            <DialogDescription>
              Enter a URL to scrape and extract information for your {framework} analysis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* URL Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !scraping && handleScrape()}
                  disabled={scraping}
                />
                <Button
                  onClick={handleScrape}
                  disabled={scraping || !url.trim()}
                >
                  {scraping ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    'Analyze'
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste a URL to a news article, report, or web page
              </p>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Results */}
            {scrapedData && (
              <div className="space-y-4 border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                {/* Metadata */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg line-clamp-2">{scrapedData.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{scrapedData.metadata.source}</Badge>
                        <a
                          href={scrapedData.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View source
                        </a>
                      </div>
                    </div>
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  </div>
                </div>

                {/* Tabs for Summary and Extracted Data */}
                <Tabs defaultValue="extracted" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                  </TabsList>

                  <TabsContent value="extracted" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                    {Object.keys(scrapedData.extractedData).length === 0 ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        No structured data extracted for this framework
                      </p>
                    ) : (
                      <>
                        {/* Answered Questions/Data */}
                        {Object.entries(scrapedData.extractedData)
                          .filter(([key]) => !key.startsWith('_'))
                          .map(([key, value]) => (
                            <div key={key} className="space-y-2">
                              <h4 className="font-medium text-sm capitalize">
                                {key.replace(/_/g, ' ')}:
                              </h4>
                              {Array.isArray(value) ? (
                                <ul className="space-y-2">
                                  {value.map((item, idx) => (
                                    <li key={idx} className="text-sm ml-4">
                                      {typeof item === 'object' && item !== null && 'question' in item ? (
                                        <div className="space-y-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                          <div className="font-medium text-gray-900 dark:text-gray-100">
                                            Q: {item.question}
                                          </div>
                                          <div className="text-gray-700 dark:text-gray-300 ml-4">
                                            A: {item.answer || <span className="italic text-gray-500">No answer extracted</span>}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-gray-700 dark:text-gray-300 list-disc">
                                          {typeof item === 'string' ? item : JSON.stringify(item)}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-700 dark:text-gray-300">{typeof value === 'string' ? value : JSON.stringify(value)}</p>
                              )}
                            </div>
                          ))}

                        {/* Unanswered Questions Section */}
                        {scrapedData.extractedData._unansweredQuestions && (
                          <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                            <h4 className="font-semibold text-base mb-3 text-orange-700 dark:text-orange-400">
                              🔍 Questions to Investigate Further
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 italic">
                              These questions could not be answered from the article and represent information gaps
                            </p>
                            <div className="space-y-3">
                              {Object.entries(scrapedData.extractedData._unansweredQuestions).map(([category, questions]) => (
                                <div key={category} className="space-y-2">
                                  <h5 className="font-medium text-sm capitalize text-gray-700 dark:text-gray-300">
                                    {category.replace(/_/g, ' ')}:
                                  </h5>
                                  <ul className="space-y-1.5">
                                    {Array.isArray(questions) && questions.map((question: string, idx: number) => (
                                      <li key={idx} className="text-sm ml-4">
                                        <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                                          <div className="text-gray-900 dark:text-gray-100">
                                            ❓ {question}
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="summary" className="mt-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {scrapedData.summary}
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Empty State */}
            {!scraping && !scrapedData && !error && (
              <div className="flex items-center justify-center py-12 border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <Globe className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter a URL above to start extracting information
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {scrapedData && scrapedData.extractedData && Object.keys(scrapedData.extractedData).length > 0
                ? `Ready to populate ${Object.keys(scrapedData.extractedData).length} fields`
                : 'AI will extract relevant information for your framework'
              }
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={scraping}
              >
                Cancel
              </Button>

              {scrapedData && (
                <Button
                  onClick={handleAccept}
                  disabled={!scrapedData.extractedData || Object.keys(scrapedData.extractedData).length === 0}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Accept & Populate
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
