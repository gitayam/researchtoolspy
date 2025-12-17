/**
 * Export utilities for analysis frameworks
 * Handles export to various formats (PDF, Word, Excel, PowerPoint)
 */

// Use dynamic imports for browser-only libraries to avoid Node.js module issues
// These will be imported dynamically when needed

export type ExportFormat = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'json' | 'csv'

export interface ExportOptions {
  title: string
  author?: string
  includeTimestamp?: boolean
  customHeader?: string
  customFooter?: string
}

/**
 * Download a file from binary data
 */
export function downloadFile(buffer: ArrayBuffer, filename: string, mimeType: string): void {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url) // Clean up memory
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
  const mimeTypes = {
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    powerpoint: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    json: 'application/json',
    csv: 'text/csv'
  }
  return mimeTypes[format]
}

/**
 * Export data as PDF
 */
export async function exportToPDF(data: any, options: ExportOptions): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  
  // Add title
  doc.setFontSize(18)
  doc.text(options.title, 20, 30)
  
  // Add timestamp if requested
  if (options.includeTimestamp) {
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40)
  }
  
  // Add content (basic text representation)
  doc.setFontSize(12)
  let yPosition = options.includeTimestamp ? 60 : 50
  
  const content = JSON.stringify(data, null, 2)
  const lines = doc.splitTextToSize(content, 170)
  
  for (const line of lines) {
    if (yPosition > 270) {
      doc.addPage()
      yPosition = 20
    }
    doc.text(line, 20, yPosition)
    yPosition += 7
  }
  
  return doc.output('arraybuffer')
}

/**
 * Export data as Excel
 */
export async function exportToExcel(data: any, options: ExportOptions): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(options.title)
  
  // Add header
  worksheet.addRow([options.title])
  worksheet.getRow(1).font = { bold: true, size: 16 }
  
  if (options.includeTimestamp) {
    worksheet.addRow([`Generated: ${new Date().toLocaleString()}`])
  }
  
  worksheet.addRow([]) // Empty row
  
  // Add data
  if (Array.isArray(data)) {
    data.forEach(item => {
      worksheet.addRow([JSON.stringify(item)])
    })
  } else {
    worksheet.addRow([JSON.stringify(data, null, 2)])
  }
  
  return await workbook.xlsx.writeBuffer() as ArrayBuffer
}

/**
 * Export data as Word document
 */
export async function exportToWord(data: any, options: ExportOptions): Promise<ArrayBuffer> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({
            text: options.title,
            bold: true,
            size: 32
          })],
          heading: HeadingLevel.TITLE
        }),
        
        ...(options.includeTimestamp ? [
          new Paragraph({
            children: [new TextRun({
              text: `Generated: ${new Date().toLocaleString()}`,
              italics: true
            })]
          })
        ] : []),
        
        new Paragraph({
          children: [new TextRun({
            text: JSON.stringify(data, null, 2),
            font: 'Courier New'
          })]
        })
      ]
    }]
  })
  
  return await Packer.toBuffer(doc)
}

/**
 * Export data as PowerPoint presentation
 * Note: Only works in client-side environment
 */
export async function exportToPowerPoint(data: any, options: ExportOptions): Promise<ArrayBuffer> {
  if (typeof window === 'undefined') {
    throw new Error('PowerPoint export only available in browser environment')
  }
  
  // Simple fallback implementation for PowerPoint export
  // Use a basic structure similar to other formats
  const content = {
    title: options.title,
    timestamp: options.includeTimestamp ? new Date().toLocaleString() : null,
    data: JSON.stringify(data, null, 2)
  }
  
  // For now, return as JSON until we can properly handle pptxgenjs in browser
  const jsonString = JSON.stringify(content, null, 2)
  return new TextEncoder().encode(jsonString).buffer
}

/**
 * Export data as JSON
 */
export function exportToJSON(data: any, options: ExportOptions): ArrayBuffer {
  const exportData = {
    title: options.title,
    generated: new Date().toISOString(),
    data: data
  }
  
  const jsonString = JSON.stringify(exportData, null, 2)
  return new TextEncoder().encode(jsonString).buffer
}

/**
 * Export data as CSV
 */
export function exportToCSV(data: any, options: ExportOptions): ArrayBuffer {
  let csvContent = `${options.title}\n`
  
  if (options.includeTimestamp) {
    csvContent += `Generated: ${new Date().toLocaleString()}\n`
  }
  
  csvContent += '\n'
  
  // Convert data to CSV format
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object') {
      // Array of objects - use keys as headers
      const headers = Object.keys(data[0])
      csvContent += headers.join(',') + '\n'
      
      data.forEach(item => {
        const row = headers.map(header => 
          `"${String(item[header] || '').replace(/"/g, '""')}"`)
        csvContent += row.join(',') + '\n'
      })
    } else {
      // Simple array
      data.forEach(item => {
        csvContent += `"${String(item).replace(/"/g, '""')}"\n`
      })
    }
  } else if (typeof data === 'object') {
    // Single object
    Object.entries(data).forEach(([key, value]) => {
      csvContent += `"${key}","${String(value).replace(/"/g, '""')}"\n`
    })
  } else {
    csvContent += `"${String(data).replace(/"/g, '""')}"\n`
  }
  
  return new TextEncoder().encode(csvContent).buffer
}

/**
 * Main export function that handles all formats
 */
export async function exportData(
  data: any, 
  format: ExportFormat, 
  filename: string,
  options: ExportOptions
): Promise<void> {
  let buffer: ArrayBuffer
  
  try {
    switch (format) {
      case 'pdf':
        buffer = await exportToPDF(data, options)
        break
      case 'excel':
        buffer = await exportToExcel(data, options)
        break
      case 'word':
        buffer = await exportToWord(data, options)
        break
      case 'powerpoint':
        buffer = await exportToPowerPoint(data, options)
        break
      case 'json':
        buffer = exportToJSON(data, options)
        break
      case 'csv':
        buffer = exportToCSV(data, options)
        break
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
    
    const mimeType = getMimeType(format)
    const fileExtension = format === 'powerpoint' ? 'pptx' : 
                         format === 'excel' ? 'xlsx' : 
                         format === 'word' ? 'docx' : format
    
    const fullFilename = filename.includes('.') ? filename : `${filename}.${fileExtension}`
    
    downloadFile(buffer, fullFilename, mimeType)
  } catch (error) {
    console.error('Export failed:', error)
    throw new Error(`Failed to export as ${format}: ${error.message}`)
  }
}

/**
 * Export framework analysis results
 */
export async function exportFrameworkAnalysis(
  framework: string,
  data: any,
  format: ExportFormat,
  filename?: string
): Promise<void> {
  const options: ExportOptions = {
    title: `${framework} Analysis Results`,
    includeTimestamp: true
  }
  
  const exportFilename = filename || `${framework.toLowerCase().replace(/\s+/g, '-')}-analysis`
  
  return exportData(data, format, exportFilename, options)
}