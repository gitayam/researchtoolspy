/**
 * FeedbackDialog Component
 *
 * User feedback form with optional screenshot upload
 */

import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

export function FeedbackDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  // Form state
  const [toolName, setToolName] = useState('')
  const [toolUrl, setToolUrl] = useState('')
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle image paste from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            setScreenshot(event.target?.result as string)
          }
          reader.readAsDataURL(blob)
          e.preventDefault()
        }
      }
    }
  }, [])

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setScreenshot(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Submit feedback
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // At least one field must be filled
    if (!toolName && !toolUrl && !description && !screenshot) {
      toast({
        title: t('components.feedback.nothingToSubmit'),
        description: t('components.feedback.nothingToSubmitDesc'),
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toolName: toolName || undefined,
          toolUrl: toolUrl || undefined,
          description: description || undefined,
          screenshot: screenshot || undefined,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit feedback')
      }

      toast({
        title: t('components.feedback.submitted'),
        description: data.message || t('components.feedback.submittedDesc')
      })

      // Reset form
      setToolName('')
      setToolUrl('')
      setDescription('')
      setScreenshot(null)
      setOpen(false)
    } catch (error) {
      console.error('Feedback submission error:', error)
      toast({
        title: t('components.feedback.submissionFailed'),
        description: error instanceof Error ? error.message : t('components.feedback.tryAgainLater'),
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setToolName('')
      setToolUrl('')
      setDescription('')
      setScreenshot(null)
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          {t('components.feedback.feedback')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{t('components.feedback.sendFeedback')}</DialogTitle>
          <DialogDescription>
            {t('components.feedback.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tool Name */}
          <div className="space-y-2">
            <Label htmlFor="toolName">{t('components.feedback.toolName')}</Label>
            <Input
              id="toolName"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder={t('components.feedback.toolNamePlaceholder')}
              disabled={submitting}
            />
          </div>

          {/* Tool URL */}
          <div className="space-y-2">
            <Label htmlFor="toolUrl">{t('components.feedback.directLink')}</Label>
            <Input
              id="toolUrl"
              value={toolUrl}
              onChange={(e) => setToolUrl(e.target.value)}
              placeholder={t('components.feedback.directLinkPlaceholder')}
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {t('components.feedback.describeIssue')}
            </Label>
            <Textarea
              ref={textareaRef}
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onPaste={handlePaste}
              placeholder={t('components.feedback.descriptionPlaceholder')}
              rows={4}
              disabled={submitting}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {t('components.feedback.screenshotTip')}
            </p>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-2">
            <Label>{t('components.feedback.screenshotOptional')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                {t('components.feedback.uploadImage')}
              </Button>

              {screenshot && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setScreenshot(null)}
                  disabled={submitting}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('components.feedback.remove')}
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {screenshot && (
              <div className="mt-2 border rounded-lg p-2">
                <img
                  src={screenshot}
                  alt={t('components.feedback.screenshotPreview')}
                  className="max-h-[200px] w-auto mx-auto"
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('components.feedback.submitting')}
                </>
              ) : (
                t('components.feedback.submitFeedback')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
