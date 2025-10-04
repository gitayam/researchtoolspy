/**
 * AI Summarize Component
 *
 * Generates AI-powered summaries of completed analyses
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileText, Loader2, Copy, Check } from 'lucide-react'
import { useAI } from '@/hooks/useAI'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export interface AISummarizeProps {
  analysisData: Record<string, any>
  framework: string
  onAccept?: (summary: string) => void
  disabled?: boolean
}

export function AISummarize({
  analysisData,
  framework,
  onAccept,
  disabled = false
}: AISummarizeProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [summaries, setSummaries] = useState<{
    executive: string | null
    detailed: string | null
    keyFindings: string | null
  }>({
    executive: null,
    detailed: null,
    keyFindings: null
  })
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { enabled, generate } = useAI()

  const handleGenerate = async (type: 'executive' | 'detailed' | 'keyFindings') => {
    setGenerating(true)
    setError(null)

    try {
      let prompt = ''
      const dataStr = JSON.stringify(analysisData, null, 2)

      switch (type) {
        case 'executive':
          prompt = `Generate a concise executive summary (2-3 sentences) for this ${framework} analysis:\n\n${dataStr}\n\nProvide a high-level overview suitable for senior decision-makers.`
          break
        case 'detailed':
          prompt = `Generate a detailed summary for this ${framework} analysis:\n\n${dataStr}\n\nInclude all key points, findings, and recommendations in a structured format.`
          break
        case 'keyFindings':
          prompt = `Extract and list the key findings from this ${framework} analysis:\n\n${dataStr}\n\nPresent as bullet points (5-7 items) highlighting the most important insights.`
          break
      }

      const content = await generate({
        prompt,
        useCase: 'summarization'
      })

      if (content) {
        setSummaries(prev => ({ ...prev, [type]: content }))
      }
    } catch (err) {
      console.error('Summarization error:', err)
      setError('Failed to generate summary. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleAccept = (summary: string) => {
    if (onAccept) {
      onAccept(summary)
      setDialogOpen(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setSummaries({ executive: null, detailed: null, keyFindings: null })
      setError(null)
      setCopied(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      <Button
        variant="outline"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
      >
        <FileText className="h-4 w-4 mr-2" />
        AI Summary
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              AI-Powered Summary
            </DialogTitle>
            <DialogDescription>
              Generate different types of summaries for your {framework} analysis
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="executive" className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="executive">Executive</TabsTrigger>
              <TabsTrigger value="detailed">Detailed</TabsTrigger>
              <TabsTrigger value="keyFindings">Key Findings</TabsTrigger>
            </TabsList>

            <TabsContent value="executive" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                A concise, high-level summary suitable for executive briefings
              </div>

              {!summaries.executive ? (
                <Button
                  onClick={() => handleGenerate('executive')}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Executive Summary'
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm whitespace-pre-wrap">{summaries.executive}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(summaries.executive!)}
                    >
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    {onAccept && (
                      <Button
                        size="sm"
                        onClick={() => handleAccept(summaries.executive!)}
                      >
                        Use This Summary
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="detailed" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                A comprehensive summary with all key points and findings
              </div>

              {!summaries.detailed ? (
                <Button
                  onClick={() => handleGenerate('detailed')}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Detailed Summary'
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-h-96 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{summaries.detailed}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(summaries.detailed!)}
                    >
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    {onAccept && (
                      <Button
                        size="sm"
                        onClick={() => handleAccept(summaries.detailed!)}
                      >
                        Use This Summary
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="keyFindings" className="space-y-4 mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Bullet-point list of the most important insights
              </div>

              {!summaries.keyFindings ? (
                <Button
                  onClick={() => handleGenerate('keyFindings')}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Key Findings'
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm whitespace-pre-wrap">{summaries.keyFindings}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(summaries.keyFindings!)}
                    >
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    {onAccept && (
                      <Button
                        size="sm"
                        onClick={() => handleAccept(summaries.keyFindings!)}
                      >
                        Use This Summary
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
