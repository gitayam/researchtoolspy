/**
 * AI Batch Generate Button
 *
 * Generates content for multiple fields at once
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAI } from '@/hooks/useAI'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export interface BatchField {
  key: string
  label: string
  currentValue?: string
  prompt: string
}

export interface AIBatchGenerateProps {
  fields: BatchField[]
  framework: string
  onAccept: (results: Record<string, string>) => void
  context?: Record<string, any>
  disabled?: boolean
}

export function AIBatchGenerate({
  fields,
  framework,
  onAccept,
  context,
  disabled = false
}: AIBatchGenerateProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const { enabled, generate } = useAI()

  const handleGenerate = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to generate')
      return
    }

    setGenerating(true)
    setError(null)
    const newResults: Record<string, string> = {}

    try {
      for (const fieldKey of selectedFields) {
        const field = fields.find(f => f.key === fieldKey)
        if (!field) continue

        const content = await generate({
          prompt: field.prompt,
          useCase: 'fieldSuggestions'
        })

        if (content) {
          newResults[fieldKey] = content
        }
      }

      setResults(newResults)
    } catch (err) {
      console.error('Batch generation error:', err)
      setError('Failed to generate some fields. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleAccept = () => {
    onAccept(results)
    setDialogOpen(false)
    setSelectedFields([])
    setResults({})
    setError(null)
  }

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (open) {
      // Auto-select empty fields
      const emptyFields = fields.filter(f => !f.currentValue?.trim()).map(f => f.key)
      setSelectedFields(emptyFields)
      setResults({})
      setError(null)
    }
  }

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    )
  }

  if (!enabled) return null

  return (
    <>
      <Button
        variant="outline"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Batch Generate
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Batch Generate Fields
            </DialogTitle>
            <DialogDescription>
              Select fields to generate content for using AI
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Field Selection */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {fields.map(field => (
                <div key={field.key} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Checkbox
                    id={`field-${field.key}`}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                    disabled={generating}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={`field-${field.key}`}
                      className="font-medium cursor-pointer"
                    >
                      {field.label}
                    </Label>
                    {field.currentValue && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Current: {field.currentValue.substring(0, 100)}
                        {field.currentValue.length > 100 ? '...' : ''}
                      </p>
                    )}
                    {results[field.key] && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        ✓ Generated
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Results Preview */}
            {Object.keys(results).length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Generated Content Preview:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(results).map(([key, value]) => {
                    const field = fields.find(f => f.key === key)
                    return (
                      <div key={key} className="text-sm">
                        <strong>{field?.label}:</strong>
                        <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">
                          {value.substring(0, 150)}
                          {value.length > 150 ? '...' : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={generating}
              >
                Cancel
              </Button>

              {Object.keys(results).length > 0 ? (
                <Button onClick={handleAccept}>
                  Accept All
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={generating || selectedFields.length === 0}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
