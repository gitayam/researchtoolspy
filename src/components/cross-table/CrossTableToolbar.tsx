/**
 * CrossTableToolbar — Top bar with title, template badge, status, and action buttons.
 */

import { useState } from 'react'
import { ArrowLeft, Save, Share2, Trash2, Loader2, Download, FileText, FileSpreadsheet, Presentation } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CrossTable, Score, RowResult } from '@/lib/cross-table/types'

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
  const [exporting, setExporting] = useState(false)

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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 md:px-6 md:py-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      {/* Left: back + title + badges */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/tools/cross-table')}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{table.title}</h1>
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

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0">
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

        <Button variant="outline" size="sm" onClick={onShare}>
          <Share2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
