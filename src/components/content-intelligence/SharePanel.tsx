// src/components/content-intelligence/SharePanel.tsx
import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Share2, Copy, Check, Mail, Send, ExternalLink, Loader2 } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import { useShareAnalysis } from '@/hooks/content-intelligence'
import type { ContentAnalysis } from '@/types/content-intelligence'

interface SharePanelProps {
  analysis: ContentAnalysis
  className?: string
}

/**
 * SharePanel component provides share options for content analysis
 * - Get Share Link: generates a shareable URL
 * - Copy Summary: copies formatted summary to clipboard
 * - Share via Email: opens mailto link
 * - Share via Telegram: opens Telegram share URL
 */
export const SharePanel: React.FC<SharePanelProps> = ({ analysis, className }) => {
  // Share link state - cached once generated
  const [shareUrl, setShareUrl] = useState<string | null>(() => {
    // Check if analysis already has a share token
    if (analysis.share_token) {
      return `${window.location.origin}/public/content/${analysis.share_token}`
    }
    return null
  })
  const [showShareDialog, setShowShareDialog] = useState(false)

  // Clipboard hooks with custom messages
  const { copied: linkCopied, copyToClipboard: copyLink } = useClipboard({
    successMessage: 'Share link copied to clipboard',
  })
  const { copied: summaryCopied, copyToClipboard: copySummary } = useClipboard({
    successMessage: 'Summary copied to clipboard',
  })

  // Share analysis mutation
  const shareAnalysisMutation = useShareAnalysis()

  /**
   * Generate share link - only generates once, then caches
   */
  const handleGetShareLink = useCallback(async () => {
    // If we already have a share URL, just show the dialog
    if (shareUrl) {
      setShowShareDialog(true)
      return
    }

    // Generate new share link
    try {
      const response = await shareAnalysisMutation.mutateAsync(analysis.id)
      const newShareUrl = response.share_url.startsWith('http')
        ? response.share_url
        : `${window.location.origin}${response.share_url}`
      setShareUrl(newShareUrl)
      setShowShareDialog(true)
    } catch {
      // Error handling is done in the mutation hook via toast
    }
  }, [shareUrl, analysis.id, shareAnalysisMutation])

  /**
   * Copy the share link to clipboard
   */
  const handleCopyShareLink = useCallback(() => {
    if (shareUrl) {
      copyLink(shareUrl)
    }
  }, [shareUrl, copyLink])

  /**
   * Build formatted summary text for sharing
   */
  const buildSummaryText = useCallback(() => {
    const title = analysis.title || 'Content Analysis'
    const summary = analysis.summary || 'No summary available'
    const url = analysis.url

    let text = `${title}\n\n${summary}\n\nSource: ${url}`

    // Add share link if available
    if (shareUrl) {
      text += `\n\nFull Analysis: ${shareUrl}`
    }

    return text
  }, [analysis.title, analysis.summary, analysis.url, shareUrl])

  /**
   * Copy formatted summary to clipboard
   */
  const handleCopySummary = useCallback(() => {
    const summaryText = buildSummaryText()
    copySummary(summaryText)
  }, [buildSummaryText, copySummary])

  /**
   * Open email client with pre-filled content
   */
  const handleShareViaEmail = useCallback(() => {
    const title = analysis.title || 'Content Analysis'
    const summary = analysis.summary || ''
    const url = analysis.url

    let body = `I wanted to share this analysis with you:\n\n${title}\n\n${summary}\n\nSource: ${url}`

    if (shareUrl) {
      body += `\n\nView Full Analysis: ${shareUrl}`
    }

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(`Analysis: ${title}`)}&body=${encodeURIComponent(body)}`
    window.open(mailtoUrl, '_blank')
  }, [analysis.title, analysis.summary, analysis.url, shareUrl])

  /**
   * Open Telegram share dialog
   */
  const handleShareViaTelegram = useCallback(() => {
    const title = analysis.title || 'Content Analysis'
    const shareText = shareUrl
      ? `${title}\n\n${shareUrl}`
      : `${title}\n\n${analysis.url}`

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl || analysis.url)}&text=${encodeURIComponent(title)}`
    window.open(telegramUrl, '_blank')
  }, [analysis.title, analysis.url, shareUrl])

  const isLoading = shareAnalysisMutation.isPending

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 mr-2" />
            )}
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Share Options</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleGetShareLink} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Get Share Link
            {shareUrl && <Check className="h-3 w-3 ml-auto text-green-600" />}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleCopySummary}>
            {summaryCopied ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy Summary
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleShareViaEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Share via Email
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleShareViaTelegram}>
            <Send className="h-4 w-4 mr-2" />
            Share via Telegram
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share Link Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Analysis</DialogTitle>
            <DialogDescription>
              Anyone with this link can view this analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                id="share-link"
                value={shareUrl || ''}
                readOnly
                className="h-9"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="px-3"
              onClick={handleCopyShareLink}
            >
              {linkCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="sr-only">Copy</span>
            </Button>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Link will remain active as long as the analysis exists.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (shareUrl) {
                  window.open(shareUrl, '_blank')
                }
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default SharePanel
