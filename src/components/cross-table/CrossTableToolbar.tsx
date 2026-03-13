/**
 * CrossTableToolbar — Top bar with editable title, template badge, status, and action buttons.
 */

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Save,
  Share2,
  Trash2,
  Loader2,
  Download,
  FileText,
  FileSpreadsheet,
  Presentation,
  Copy,
  Check,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CrossTable, Score, RowResult } from '@/lib/cross-table/types'
import { useCrossTable } from './cross-table-context'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  draft: 'secondary',
  scoring: 'default',
  complete: 'outline',
}

const TEMPLATE_LABELS: Record<string, string> = {
  carvar: 'CARVER',
  coa: 'COA',
  weighted: 'Weighted',
  pugh: 'Pugh',
  risk: 'Risk',
  'kepner-tregoe': 'K-T',
  prioritization: 'Prioritization',
  blank: 'Blank',
}

interface CrossTableToolbarProps {
  table: CrossTable
  scores: Score[]
  results: RowResult[]
  scoresDirty: boolean
  saving: boolean
  onSaveScores: () => void
  onShare: () => void
  onDelete: () => void
}

export function CrossTableToolbar({
  table,
  scores,
  results,
  scoresDirty,
  saving,
  onSaveScores,
  onShare,
  onDelete,
}: CrossTableToolbarProps) {
  const navigate = useNavigate()
  const { dispatch } = useCrossTable()
  const [exporting, setExporting] = useState(false)

  // ── Inline title editing ──────────────────────────────────────
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(table.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const commitTitle = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== table.title) {
      dispatch({ type: 'UPDATE_TITLE', title: trimmed })
    }
    setIsEditingTitle(false)
  }

  const cancelTitle = () => {
    setEditTitle(table.title)
    setIsEditingTitle(false)
  }

  // ── Share dialog ──────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const handleShare = async () => {
    setShareLoading(true)
    setShareOpen(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const userHash = localStorage.getItem('omnicore_user_hash')
      if (userHash) headers['X-User-Hash'] = userHash

      const res = await fetch(`/api/cross-table/${table.id}/share`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error('Failed to generate share link')
      const data = await res.json()
      setShareUrl(data.url)
    } catch {
      setShareUrl('')
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // Fallback: select the text so user can copy manually
      const input = document.querySelector<HTMLInputElement>('#share-url-input')
      if (input) {
        input.select()
      }
    }
  }

  // ── Export ────────────────────────────────────────────────────
  const handleExport = async (format: 'pdf' | 'excel' | 'docx' | 'pptx') => {
    setExporting(true)
    try {
      const { exportPDF, exportExcel, exportDOCX, exportPPTX } = await import('./export')
      switch (format) {
        case 'pdf':
          await exportPDF(table, scores, results)
          break
        case 'excel':
          await exportExcel(table, scores, results)
          break
        case 'docx':
          await exportDOCX(table, scores, results)
          break
        case 'pptx':
          await exportPPTX(table, scores, results)
          break
      }
    } catch {
      // TODO: toast error
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 md:px-6 md:py-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        {/* Left: back + title + badges */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard/tools/cross-table')}
            className="shrink-0 h-8 w-8 p-0 sm:h-auto sm:w-auto sm:p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={titleInputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle()
                    if (e.key === 'Escape') cancelTitle()
                  }}
                  className="h-8 text-base sm:text-lg font-bold px-2 py-0 w-full max-w-[300px]"
                />
              </div>
            ) : (
              <h1
                className="text-base sm:text-lg font-bold truncate cursor-pointer hover:text-[#4F5BFF] transition-colors"
                onClick={() => {
                  setEditTitle(table.title)
                  setIsEditingTitle(true)
                }}
                title="Click to edit title"
              >
                {table.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] font-normal">
                {TEMPLATE_LABELS[table.template_type] ?? table.template_type}
              </Badge>
              <Badge variant={STATUS_VARIANT[table.status] ?? 'secondary'} className="text-[10px]">
                {table.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Right: action buttons — horizontal scroll on mobile */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">
          {scoresDirty && (
            <Button
              size="sm"
              onClick={onSaveScores}
              disabled={saving}
              className="bg-[#D4673A] hover:bg-[#D4673A]/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Scores
            </Button>
          )}

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                PDF Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel Workbook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>
                <FileText className="h-4 w-4 mr-2" />
                Word Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pptx')}>
                <Presentation className="h-4 w-4 mr-2" />
                PowerPoint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Cross Table</DialogTitle>
          </DialogHeader>
          {shareLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Anyone with this link can view the results:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="share-url-input"
                  value={shareUrl}
                  readOnly
                  className="text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button size="sm" variant="outline" onClick={handleCopyUrl} className="shrink-0">
                  {shareCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {shareCopied && (
                <p className="text-xs text-green-600">Copied to clipboard!</p>
              )}
            </div>
          ) : (
            <div className="text-sm text-destructive py-4">
              Failed to generate share link. Please try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
