/**
 * AI Generate Dialog
 *
 * Dialog for generating, previewing, and editing AI content
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, RefreshCw, Check, Edit, Loader2 } from 'lucide-react'
import { useFieldAI } from '@/hooks/useAI'

export interface AIGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fieldName: string
  currentValue?: string
  context?: {
    framework?: string
    relatedFields?: Record<string, any>
    linkedEvidence?: any[]
  }
  placeholder?: string
  onAccept: (value: string) => void
}

export function AIGenerateDialog({
  open,
  onOpenChange,
  fieldName,
  currentValue,
  context,
  placeholder,
  onAccept
}: AIGenerateDialogProps) {
  const { enabled, generating, error, preview, generateField, clearPreview } = useFieldAI(
    fieldName,
    currentValue,
    context || {}
  )

  const [editedContent, setEditedContent] = useState('')
  const [mode, setMode] = useState<'suggest' | 'expand' | 'rephrase' | 'summarize'>('suggest')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      clearPreview()
      setEditedContent('')
      setMode(currentValue ? 'expand' : 'suggest')
    }
  }, [open, currentValue, clearPreview])

  // Update edited content when preview changes
  useEffect(() => {
    if (preview) {
      setEditedContent(preview)
    }
  }, [preview])

  const handleGenerate = async () => {
    await generateField(mode)
  }

  const handleAccept = () => {
    onAccept(editedContent || preview || '')
  }

  const getModeDescription = (m: typeof mode): string => {
    const descriptions = {
      suggest: currentValue ? 'Expand on existing content' : 'Generate new content based on context',
      expand: 'Add more detail and depth to existing content',
      rephrase: 'Rephrase for better clarity and impact',
      summarize: 'Create a more concise version'
    }
    return descriptions[m]
  }

  if (!enabled) {
    return null
  }

  const hasContent = !!(preview || editedContent)
  const showTabs = !!currentValue

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Assistant - {fieldName}
          </DialogTitle>
          <DialogDescription>
            {getModeDescription(mode)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Mode Selection */}
          {showTabs ? (
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="expand">Expand</TabsTrigger>
                <TabsTrigger value="rephrase">Rephrase</TabsTrigger>
                <TabsTrigger value="summarize">Summarize</TabsTrigger>
                <TabsTrigger value="suggest">Suggest</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <div>
              <Badge variant="secondary" className="mb-2">
                <Sparkles className="h-3 w-3 mr-1" />
                Generate New Content
              </Badge>
            </div>
          )}

          {/* Current Value Display */}
          {currentValue && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Content:</label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border text-sm">
                {currentValue}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Preview/Edit Area */}
          {!generating && !hasContent && (
            <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click "Generate" to create AI-powered content
                </p>
              </div>
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-purple-600 animate-spin" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generating content...
                </p>
              </div>
            </div>
          )}

          {hasContent && !generating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  AI Generated Content (Editable):
                </label>
                {preview && !editedContent && (
                  <Badge variant="secondary">Preview</Badge>
                )}
                {editedContent && editedContent !== preview && (
                  <Badge variant="default">Edited</Badge>
                )}
              </div>
              <Textarea
                value={editedContent || preview || ''}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder={placeholder || `Enter ${fieldName}...`}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can edit the AI-generated content above before accepting
              </p>
            </div>
          )}

          {/* Context Info */}
          {context && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {context.framework && (
                <div>Framework: {context.framework}</div>
              )}
              {context.linkedEvidence && context.linkedEvidence.length > 0 && (
                <div>Linked Evidence: {context.linkedEvidence.length} items</div>
              )}
              {context.relatedFields && Object.keys(context.relatedFields).length > 0 && (
                <div>Related Fields: {Object.keys(context.relatedFields).length}</div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generating}
          >
            Cancel
          </Button>

          <div className="flex gap-2">
            {hasContent && (
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={generating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            )}

            <Button
              onClick={hasContent ? handleAccept : handleGenerate}
              disabled={generating || (hasContent && !editedContent && !preview)}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : hasContent ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Accept
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
