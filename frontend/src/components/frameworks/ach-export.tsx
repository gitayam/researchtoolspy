'use client'

import { useState } from 'react'
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Presentation, 
  File,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  exportToExcel, 
  exportToPDF, 
  exportToWord, 
  exportToPowerPoint, 
  downloadFile,
  type ACHExportData 
} from '@/lib/ach-export'

interface ACHExportProps {
  data: ACHExportData
  className?: string
}

type ExportFormat = 'excel' | 'pdf' | 'word' | 'powerpoint'

interface ExportOption {
  id: ExportFormat
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  mimeType: string
  extension: string
  recommended?: boolean
  governmentStandard?: boolean
}

const exportOptions: ExportOption[] = [
  {
    id: 'excel',
    name: 'Excel Spreadsheet',
    description: 'Government-standard ACH matrix with hypothesis columns, evidence rows, and color-coded scoring',
    icon: FileSpreadsheet,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    recommended: true,
    governmentStandard: true
  },
  {
    id: 'pdf',
    name: 'PDF Report',
    description: 'Professional report with executive summary, hypothesis ranking, and detailed analysis',
    icon: FileText,
    mimeType: 'application/pdf',
    extension: 'pdf',
    recommended: true
  },
  {
    id: 'word',
    name: 'Word Document',
    description: 'Editable document with structured analysis, tables, and findings for further editing',
    icon: File,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx'
  },
  {
    id: 'powerpoint',
    name: 'PowerPoint Presentation',
    description: 'Briefing slides with key findings, hypothesis rankings, and executive summary',
    icon: Presentation,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx'
  }
]

export function ACHExport({ data, className }: ACHExportProps) {
  const [exportingFormats, setExportingFormats] = useState<Set<ExportFormat>>(new Set())
  const [completedFormats, setCompletedFormats] = useState<Set<ExportFormat>>(new Set())
  const { toast } = useToast()

  const generateFilename = (format: ExportFormat) => {
    const title = data.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    const date = data.createdAt.toISOString().split('T')[0]
    return `ach_${title}_${date}.${exportOptions.find(opt => opt.id === format)?.extension}`
  }

  const handleExport = async (format: ExportFormat) => {
    setExportingFormats(prev => new Set(prev).add(format))
    
    try {
      let buffer: ArrayBuffer
      const option = exportOptions.find(opt => opt.id === format)!
      
      switch (format) {
        case 'excel':
          buffer = await exportToExcel(data)
          break
        case 'pdf':
          buffer = await exportToPDF(data)
          break
        case 'word':
          buffer = await exportToWord(data)
          break
        case 'powerpoint':
          buffer = await exportToPowerPoint(data)
          break
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }
      
      downloadFile(buffer, generateFilename(format), option.mimeType)
      
      setCompletedFormats(prev => new Set(prev).add(format))
      
      toast({
        title: 'Export Successful',
        description: `${option.name} has been downloaded successfully.`,
      })
      
      // Clear completed status after 3 seconds
      setTimeout(() => {
        setCompletedFormats(prev => {
          const newSet = new Set(prev)
          newSet.delete(format)
          return newSet
        })
      }, 3000)
      
    } catch (error) {
      console.error(`Error exporting ${format}:`, error)
      toast({
        title: 'Export Failed',
        description: `Failed to export ${format.toUpperCase()}. Please try again.`,
        variant: 'destructive',
      })
    } finally {
      setExportingFormats(prev => {
        const newSet = new Set(prev)
        newSet.delete(format)
        return newSet
      })
    }
  }

  const handleExportAll = async () => {
    for (const option of exportOptions) {
      if (!exportingFormats.has(option.id)) {
        await handleExport(option.id)
        // Small delay between exports to prevent browser overload
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export ACH Analysis
        </CardTitle>
        <CardDescription>
          Download your analysis in professional formats suitable for government and organizational use
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Analysis Summary */}
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <h4 className="font-medium mb-2">Analysis Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Hypotheses:</span>
              <div className="font-medium">{data.hypotheses.length}</div>
            </div>
            <div>
              <span className="text-gray-500">Evidence:</span>
              <div className="font-medium">{data.evidence.length}</div>
            </div>
            <div>
              <span className="text-gray-500">Scale:</span>
              <div className="font-medium capitalize">{data.scaleType}</div>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>
              <div className="font-medium">{data.createdAt.toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Export Formats</h4>
            <Button 
              onClick={handleExportAll}
              disabled={exportingFormats.size > 0}
              variant="outline"
              size="sm"
            >
              {exportingFormats.size > 0 ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </>
              )}
            </Button>
          </div>
          
          <div className="grid gap-4">
            {exportOptions.map((option) => {
              const isExporting = exportingFormats.has(option.id)
              const isCompleted = completedFormats.has(option.id)
              const Icon = option.icon
              
              return (
                <div
                  key={option.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <Icon className="h-8 w-8 text-blue-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium">{option.name}</h5>
                      {option.recommended && (
                        <Badge variant="secondary" className="text-xs">
                          Recommended
                        </Badge>
                      )}
                      {option.governmentStandard && (
                        <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-400">
                          Gov Standard
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Button
                      onClick={() => handleExport(option.id)}
                      disabled={isExporting}
                      variant={isCompleted ? "default" : "outline"}
                      size="sm"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : isCompleted ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Downloaded
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Export Tips */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-2">Export Tips:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Excel:</strong> Best for government workflows - opens in desktop Excel with full formatting</li>
                <li>• <strong>PDF:</strong> Professional reports for distribution and archival</li>
                <li>• <strong>Word:</strong> Editable format for collaborative analysis and report writing</li>
                <li>• <strong>PowerPoint:</strong> Ready-to-use briefing slides for presentations</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}