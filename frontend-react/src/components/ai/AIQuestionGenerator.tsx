/**
 * AI Question Generator
 *
 * Generates follow-up questions to improve analysis depth
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HelpCircle, Loader2, RefreshCw } from 'lucide-react'
import { useAI } from '@/hooks/useAI'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export interface AIQuestionGeneratorProps {
  currentData: Record<string, any>
  framework: string
  onSelectQuestion?: (question: string) => void
  disabled?: boolean
}

export function AIQuestionGenerator({
  currentData,
  framework,
  onSelectQuestion,
  disabled = false
}: AIQuestionGeneratorProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const { enabled, generate } = useAI()

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      const dataStr = JSON.stringify(currentData, null, 2)
      const prompt = `Based on this ${framework} analysis, generate 5-7 probing questions that would help deepen the analysis and uncover blind spots:\n\n${dataStr}\n\nGenerate questions that:\n1. Challenge assumptions\n2. Explore alternative explanations\n3. Identify missing information\n4. Consider second-order effects\n5. Probe for counterarguments\n\nReturn ONLY the questions, one per line, without numbering.`

      const content = await generate({
        prompt,
        useCase: 'questionGeneration'
      })

      if (content) {
        // Parse questions (split by newlines, filter empty lines)
        const questionList = content
          .split('\n')
          .map(q => q.trim())
          .filter(q => q.length > 0 && q.includes('?'))
          .map(q => q.replace(/^[-•*\d.)\s]+/, '').trim()) // Remove bullets/numbers

        setQuestions(questionList)
      }
    } catch (err) {
      console.error('Question generation error:', err)
      setError('Failed to generate questions. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (open && questions.length === 0) {
      handleGenerate()
    }
    if (!open) {
      setError(null)
    }
  }

  const handleSelectQuestion = (question: string) => {
    if (onSelectQuestion) {
      onSelectQuestion(question)
      setDialogOpen(false)
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
        <HelpCircle className="h-4 w-4 mr-2" />
        Suggest Questions
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-600" />
              AI-Generated Follow-Up Questions
            </DialogTitle>
            <DialogDescription>
              Questions to deepen your {framework} analysis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {generating ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 text-amber-600 animate-spin" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Generating probing questions...
                  </p>
                </div>
              </div>
            ) : questions.length > 0 ? (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {questions.map((question, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg border hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors cursor-pointer"
                      onClick={() => handleSelectQuestion(question)}
                    >
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="mt-0.5">
                          Q{index + 1}
                        </Badge>
                        <p className="flex-1 text-sm">{question}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click a question to use it, or regenerate for new suggestions
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No questions generated yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
