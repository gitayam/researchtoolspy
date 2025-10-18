/**
 * Export Button Component
 *
 * Provides a dropdown menu for exporting framework analyses
 * to Word, PDF, PowerPoint, or CSV formats with optional AI enhancements
 */

import { useState } from 'react'
import { FileDown, FileText, FileSpreadsheet, Presentation, Loader2, Eye, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createLogger } from '@/lib/logger'
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

const logger = createLogger('ExportButton')

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
      logger.debug('Loading report generator...')
      const { ReportGenerator } = await import('@/lib/report-generator')

      // Get AI enhancements if requested
      let aiEnhancements
      if (includeAI) {
        logger.info('Generating AI enhancements...')
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
      logger.info('✓ Report preview generated')
    } catch (error) {
      logger.error('Failed to generate preview:', error)
      alert(`Failed to generate report preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleEnhancedSWOTExport = async () => {
    setExporting(true)
    setCurrentFormat('pdf')

    try {
      logger.debug('Loading enhanced SWOT export...')
      const { generateEnhancedSWOTPDF } = await import('@/lib/reports')

      // Transform data to match SWOTData interface
      // Keep full SwotItem objects for rich metadata (confidence, evidence, tags, appliesTo)
      const swotData = {
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
        opportunities: data.opportunities || [],
        threats: data.threats || [],
        goal: data.goal,
        options: data.options
      }

      await generateEnhancedSWOTPDF({
        title: data.title,
        description: data.description,
        swotData,
        includeVisualizations: true,
        includeTOWS: true,
        includeExecutiveSummary: true
      })

      logger.info('✓ Enhanced SWOT report exported successfully')
    } catch (error) {
      logger.error('Enhanced export failed:', error)
      alert(`Failed to export enhanced report: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExporting(false)
      setCurrentFormat(null)
    }
  }

  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    setCurrentFormat(format)

    try {
      // Dynamically import ReportGenerator (includes heavy export libraries)
      logger.debug(`Loading export libraries for ${format}...`)
      const { ReportGenerator } = await import('@/lib/report-generator')

      // Get AI enhancements if requested
      let aiEnhancements
      if (includeAI) {
        logger.info('Generating AI enhancements...')
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

      logger.info(`✓ Successfully exported to ${format.toUpperCase()}`)
    } catch (error) {
      logger.error('Export failed:', error)
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

          {/* Enhanced SWOT Export (Phase 1) */}
          {frameworkType === 'swot' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleEnhancedSWOTExport}
                disabled={exporting || generating}
                className="font-medium text-blue-600 dark:text-blue-400"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Enhanced SWOT Report
                <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">NEW</span>
              </DropdownMenuItem>
              <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                Includes visualizations, TOWS strategies & executive summary
              </div>
            </>
          )}

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
