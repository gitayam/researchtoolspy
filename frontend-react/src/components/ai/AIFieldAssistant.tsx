/**
 * AI Field Assistant
 *
 * Sparkles button that appears next to form fields to trigger AI assistance
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { AIGenerateDialog } from './AIGenerateDialog'
import { useAI } from '@/hooks/useAI'

export interface AIFieldAssistantProps {
  fieldName: string
  currentValue?: string
  onAccept: (value: string) => void
  context?: {
    framework?: string
    relatedFields?: Record<string, any>
    linkedEvidence?: any[]
  }
  placeholder?: string
  disabled?: boolean
}

export function AIFieldAssistant({
  fieldName,
  currentValue,
  onAccept,
  context,
  placeholder,
  disabled = false
}: AIFieldAssistantProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { enabled, loading } = useAI()

  // Don't show if AI features are disabled or still loading
  if (!enabled || loading) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
        title="AI Assistant"
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      <AIGenerateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fieldName={fieldName}
        currentValue={currentValue}
        context={context}
        placeholder={placeholder}
        onAccept={(value) => {
          onAccept(value)
          setDialogOpen(false)
        }}
      />
    </>
  )
}
