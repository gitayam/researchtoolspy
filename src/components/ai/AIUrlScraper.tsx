/**
 * AI URL Scraper Component
 *
 * Scrapes URLs and extracts structured data using AI
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScrape = async () => {
    if (!url.trim()) {
      setError(t('urlScraper.pleaseEnterUrl'))
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data: ScrapedData = await response.json()
      setScrapedData(data)
    } catch (err) {
      console.error('Scraping error:', err)

      // Better error messages for common issues
      let errorMessage = t('urlScraper.failedToScrape')
      if (err instanceof TypeError && err.message === 'Load failed') {
        errorMessage = t('urlScraper.networkErrorTimeout')
      } else if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        errorMessage = t('urlScraper.networkErrorConnection')
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setScraping(false)
    }
  }

  const handleAccept = () => {
    if (scrapedData && scrapedData.extractedData) {
      // Merge answered and unanswered questions
      const mergedData = { ...scrapedData.extractedData }

      // If there are unanswered questions, add them to each category
      if (scrapedData.extractedData._unansweredQuestions) {
        const unanswered = scrapedData.extractedData._unansweredQuestions

        Object.keys(unanswered).forEach(category => {
          const unansweredQuestions = unanswered[category]

          if (Array.isArray(unansweredQuestions) && unansweredQuestions.length > 0) {
            // Convert unanswered string questions to Q&A format with empty answers
            const unansweredQA = unansweredQuestions.map((q: string) => ({
              id: crypto.randomUUID(),
              question: q,
              answer: '', // Empty answer indicates it needs to be filled in
              needsAnswer: true // Flag for red highlighting
            }))

            // Merge with existing answered questions, unanswered first
            const existingQuestions = mergedData[category] || []
            mergedData[category] = [...unansweredQA, ...existingQuestions]
          }
        })
      }

      onExtract(mergedData, {
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
        {t('urlScraper.importFromUrl')}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              {t('urlScraper.dialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('urlScraper.dialogDescription', { framework })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* URL Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder={t('urlScraper.placeholder')}
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
                      {t('urlScraper.scraping')}
                    </>
                  ) : (
                    t('urlScraper.analyze')
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('urlScraper.urlHint')}
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
                          {t('urlScraper.viewSource')}
                        </a>
                      </div>
                    </div>
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  </div>
                </div>

                {/* Tabs for Summary and Extracted Data */}
                <Tabs defaultValue="extracted" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="extracted">{t('urlScraper.extractedData')}</TabsTrigger>
                    <TabsTrigger value="summary">{t('urlScraper.summary')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="extracted" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                    {Object.keys(scrapedData.extractedData).length === 0 ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {t('urlScraper.noStructuredData')}
                      </p>
                    ) : (
                      <>
                        {/* Error Display */}
                        {scrapedData.extractedData._error && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                            <h4 className="font-semibold text-red-800 dark:text-red-400 mb-2">⚠️ {t('urlScraper.extractionError')}</h4>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-2">{scrapedData.extractedData._error}</p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {t('urlScraper.model')}: {scrapedData.extractedData._model || t('urlScraper.unknown')} • {t('urlScraper.framework')}: {scrapedData.extractedData._framework || t('urlScraper.unknown')}
                            </p>
                          </div>
                        )}

                        {/* Parse Error Display */}
                        {scrapedData.extractedData._parseError && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                            <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">⚠️ {t('urlScraper.jsonParsingError')}</h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">{t('urlScraper.jsonParsingErrorDesc')}</p>
                            <p className="text-xs font-mono text-yellow-600 dark:text-yellow-400 mb-2">{scrapedData.extractedData._parseError}</p>
                            {scrapedData.extractedData._raw && (
                              <details className="mt-2">
                                <summary className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 cursor-pointer">{t('urlScraper.showRawResponse')}</summary>
                                <pre className="mt-2 text-xs bg-yellow-100 dark:bg-yellow-900/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                  {scrapedData.extractedData._raw}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}

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
                                            A: {item.answer || <span className="italic text-gray-500">{t('urlScraper.noAnswerExtracted')}</span>}
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
                              🔍 {t('urlScraper.questionsToInvestigate')}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 italic">
                              {t('urlScraper.questionsToInvestigateDesc')}
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
                    {t('urlScraper.emptyStateTitle')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {scrapedData && scrapedData.extractedData && Object.keys(scrapedData.extractedData).length > 0
                ? (() => {
                    const validFields = Object.keys(scrapedData.extractedData).filter(key => !key.startsWith('_')).length
                    const hasErrors = scrapedData.extractedData._error || scrapedData.extractedData._parseError
                    if (hasErrors && validFields === 0) {
                      return `⚠️ ${t('urlScraper.extractionFailed')}`
                    }
                    return validFields > 0
                      ? t('urlScraper.readyToPopulate', { count: validFields })
                      : t('urlScraper.noDataExtracted')
                  })()
                : t('urlScraper.aiWillExtract')
              }
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={scraping}
              >
                {t('urlScraper.cancel')}
              </Button>

              {scrapedData && (
                <Button
                  onClick={handleAccept}
                  disabled={!scrapedData.extractedData || Object.keys(scrapedData.extractedData).length === 0}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {t('urlScraper.acceptAndPopulate')}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
