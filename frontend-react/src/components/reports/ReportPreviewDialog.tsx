/**
 * Report Preview Dialog
 *
 * Displays generated report content inline with options to copy or download
 */

import { useState } from 'react'
import { X, Copy, Download, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

interface ReportPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  content: string
  onDownload?: () => void
}

export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  content,
  onDownload
}: ReportPreviewDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('Failed to copy to clipboard')
    }
  }

  // Convert markdown to HTML and sanitize
  const htmlContent = DOMPurify.sanitize(marked.parse(content) as string)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
              {onDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownload}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Preview your generated report. Copy to share with others or download in your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded-lg p-6 bg-white dark:bg-gray-900">
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
