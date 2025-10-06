/**
 * Export Button Component
 *
 * Provides a dropdown menu for exporting framework analyses
 * to Word, PDF, PowerPoint, or CSV formats with optional AI enhancements
 */

import { useState } from 'react'
import { FileDown, FileText, FileSpreadsheet, Presentation, Loader2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import type { ExportFormat } from '@/lib/report-generator'
import { ReportPreviewDialog } from './ReportPreviewDialog'

export interface ExportButtonProps {
  frameworkType: string
  frameworkTitle: string
  data: any
  analysisId?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function ExportButton({
  frameworkType,
  frameworkTitle,
  data,
  analysisId,
  variant = 'outline',
  size = 'default'
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [includeAI, setIncludeAI] = useState(true)
  const [currentFormat, setCurrentFormat] = useState<ExportFormat | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleViewReport = async () => {
    setGenerating(true)

    try {
      // Dynamically import ReportGenerator
      console.log('Loading report generator...')
      const { ReportGenerator } = await import('@/lib/report-generator')

      // Get AI enhancements if requested
      let aiEnhancements
      if (includeAI) {
        console.log('Generating AI enhancements...')
        aiEnhancements = await ReportGenerator.enhanceReport(frameworkType, data, 'standard')
      }

      // Generate markdown content
      const markdown = ReportGenerator.generateMarkdown({
        frameworkType,
        frameworkTitle,
        data,
        format: 'word', // Format doesn't matter for markdown
        template: 'standard',
        includeAI,
        aiEnhancements
      })

      setPreviewContent(markdown)
      setShowPreview(true)
      console.log('✓ Report preview generated')
    } catch (error) {
      console.error('Failed to generate preview:', error)
      alert(`Failed to generate report preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    setCurrentFormat(format)

    try {
      // Dynamically import ReportGenerator (includes heavy export libraries)
      console.log(`Loading export libraries for ${format}...`)
      const { ReportGenerator } = await import('@/lib/report-generator')

      // Get AI enhancements if requested
      let aiEnhancements
      if (includeAI) {
        console.log('Generating AI enhancements...')
        aiEnhancements = await ReportGenerator.enhanceReport(frameworkType, data, 'standard')
      }

      // Generate report
      await ReportGenerator.generate({
        frameworkType,
        frameworkTitle,
        data,
        format,
        template: 'standard',
        includeAI,
        aiEnhancements
      })

      console.log(`✓ Successfully exported to ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      alert(`Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExporting(false)
      setCurrentFormat(null)
    }
  }

  const formatOptions = [
    { format: 'word' as ExportFormat, label: 'Word Document', icon: FileText, ext: '.docx' },
    { format: 'pdf' as ExportFormat, label: 'PDF Document', icon: FileText, ext: '.pdf' },
    { format: 'pptx' as ExportFormat, label: 'PowerPoint', icon: Presentation, ext: '.pptx' },
    { format: 'csv' as ExportFormat, label: 'CSV Spreadsheet', icon: FileSpreadsheet, ext: '.csv' }
  ]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={exporting || generating}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* View Report Option */}
          <DropdownMenuItem
            onClick={handleViewReport}
            disabled={exporting || generating}
            className="font-medium"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Report
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Download As</DropdownMenuLabel>
          <DropdownMenuSeparator />

        {formatOptions.map(({ format, label, icon: Icon, ext }) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={exporting}
          >
            <Icon className="h-4 w-4 mr-2" />
            <span className="flex-1">{label}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{ext}</span>
            {exporting && currentFormat === format && (
              <Loader2 className="h-3 w-3 ml-2 animate-spin" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={includeAI}
          onCheckedChange={setIncludeAI}
          disabled={exporting}
        >
          <span className="ml-6">Include AI Insights</span>
        </DropdownMenuCheckboxItem>

        <div className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400">
          {includeAI ? (
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              AI enhancements enabled
            </span>
          ) : (
            'Enable AI for summaries & insights'
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>

    <ReportPreviewDialog
      open={showPreview}
      onOpenChange={setShowPreview}
      title={`${frameworkTitle} Analysis Report`}
      content={previewContent}
    />
  </>
  )
}
