/**
 * ACH Export Utilities
 * Government-standard Analysis of Competing Hypotheses export formats
 */

import * as ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, HeadingLevel, TextRun, AlignmentType } from 'docx'
// PowerPoint export is in a separate file to avoid Node.js dependencies
import { ACHScore, HypothesisAnalysis, ScaleType, getScoreOption, analyzeHypotheses } from './ach-scoring'
import { generateExecutiveSummary, checkAIAvailability, type AIAnalysisResult } from './ai-analysis'

export interface ACHExportData {
  title: string
  description?: string
  hypotheses: Array<{ id: string; text: string }>
  evidence: Array<{ 
    id: string; 
    text: string; 
    confidenceScore?: number;
    evaluationResponses?: Record<string, number>
  }>
  scores: Map<string, Map<string, ACHScore>>
  scaleType: ScaleType
  analysis?: HypothesisAnalysis[]
  createdAt: Date
  analyst?: string
  organization?: string
}

/**
 * Export ACH analysis to government-standard Excel format
 */
export async function exportToExcel(data: ACHExportData): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = data.analyst || 'Research Tools Platform'
  workbook.created = data.createdAt
  workbook.modified = new Date()
  
  // Main ACH Matrix Sheet
  const matrixSheet = workbook.addWorksheet('ACH Matrix')
  await createACHMatrixSheet(matrixSheet, data)
  
  // Analysis Summary Sheet
  const summarySheet = workbook.addWorksheet('Analysis Summary')
  await createAnalysisSummarySheet(summarySheet, data)
  
  // Evidence Details Sheet
  const evidenceSheet = workbook.addWorksheet('Evidence Details')
  await createEvidenceDetailsSheet(evidenceSheet, data)
  
  // Scale Reference Sheet
  const scaleSheet = workbook.addWorksheet('Scale Reference')
  await createScaleReferenceSheet(scaleSheet, data)
  
  return await workbook.xlsx.writeBuffer() as ArrayBuffer
}

async function createACHMatrixSheet(worksheet: ExcelJS.Worksheet, data: ACHExportData) {
  const { hypotheses, evidence, scores, scaleType } = data
  
  // Title and headers
  worksheet.mergeCells('A1', `${String.fromCharCode(65 + hypotheses.length)}1`)
  const titleCell = worksheet.getCell('A1')
  titleCell.value = data.title
  titleCell.font = { size: 16, bold: true }
  titleCell.alignment = { horizontal: 'center' }
  
  // Subtitle
  worksheet.mergeCells('A2', `${String.fromCharCode(65 + hypotheses.length)}2`)
  const subtitleCell = worksheet.getCell('A2')
  subtitleCell.value = `Analysis of Competing Hypotheses Matrix (${scaleType === 'logarithmic' ? 'Logarithmic' : 'Linear'} Scale)`
  subtitleCell.font = { size: 12, italic: true }
  subtitleCell.alignment = { horizontal: 'center' }
  
  // Column headers
  worksheet.getCell('A4').value = 'Evidence'
  worksheet.getCell('A4').font = { bold: true }
  worksheet.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } }
  
  // Add hypothesis headers
  hypotheses.forEach((hypothesis, index) => {
    const col = String.fromCharCode(66 + index) // B, C, D, etc.
    const cell = worksheet.getCell(`${col}4`)
    cell.value = `H${index + 1}: ${hypothesis.text}`
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0FF' } }
    cell.alignment = { horizontal: 'center', wrapText: true }
    worksheet.getColumn(col).width = 20
  })
  
  // Add evidence rows
  evidence.forEach((evidenceItem, evidenceIndex) => {
    const row = evidenceIndex + 5
    
    // Evidence text
    const evidenceCell = worksheet.getCell(`A${row}`)
    evidenceCell.value = evidenceItem.text
    evidenceCell.alignment = { wrapText: true, vertical: 'top' }
    
    // Add confidence score if available
    if (evidenceItem.confidenceScore) {
      evidenceCell.value += ` [Credibility: ${evidenceItem.confidenceScore}/13]`
    }
    
    // Add scores for each hypothesis
    hypotheses.forEach((hypothesis, hypothesisIndex) => {
      const col = String.fromCharCode(66 + hypothesisIndex)
      const cell = worksheet.getCell(`${col}${row}`)
      
      const evidenceScores = scores.get(evidenceItem.id)
      const score = evidenceScores?.get(hypothesis.id)
      
      if (score) {
        cell.value = score.score
        cell.alignment = { horizontal: 'center' }
        
        // Color coding based on score
        if (score.score > 0) {
          const intensity = Math.min(Math.abs(score.score) / (scaleType === 'logarithmic' ? 13 : 5), 1)
          const greenValue = Math.floor(255 - (intensity * 100))
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${greenValue.toString(16).padStart(2, '0')}FF${greenValue.toString(16).padStart(2, '0')}` } }
        } else if (score.score < 0) {
          const intensity = Math.min(Math.abs(score.score) / (scaleType === 'logarithmic' ? 13 : 5), 1)
          const redValue = Math.floor(255 - (intensity * 100))
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FFFF${redValue.toString(16).padStart(2, '0')}${redValue.toString(16).padStart(2, '0')}` } }
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
        }
        
        // Add border
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      }
    })
  })
  
  // Set evidence column width
  worksheet.getColumn('A').width = 40
  
  // Add totals row
  const totalsRow = evidence.length + 6
  worksheet.getCell(`A${totalsRow}`).value = 'TOTALS'
  worksheet.getCell(`A${totalsRow}`).font = { bold: true }
  worksheet.getCell(`A${totalsRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
  
  hypotheses.forEach((hypothesis, index) => {
    const col = String.fromCharCode(66 + index)
    const cell = worksheet.getCell(`${col}${totalsRow}`)
    
    // Calculate total for this hypothesis
    let total = 0
    evidence.forEach((evidenceItem) => {
      const evidenceScores = scores.get(evidenceItem.id)
      const score = evidenceScores?.get(hypothesis.id)
      if (score) total += score.score
    })
    
    cell.value = total
    cell.font = { bold: true }
    cell.alignment = { horizontal: 'center' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }
  })
}

async function createAnalysisSummarySheet(worksheet: ExcelJS.Worksheet, data: ACHExportData) {
  const analysis = data.analysis || analyzeHypotheses(data.hypotheses, data.scores, data.scaleType)
  
  // Title
  worksheet.getCell('A1').value = 'ACH Analysis Summary'
  worksheet.getCell('A1').font = { size: 16, bold: true }
  
  // Date and analyst info
  worksheet.getCell('A3').value = 'Analysis Date:'
  worksheet.getCell('B3').value = data.createdAt.toLocaleDateString()
  if (data.analyst) {
    worksheet.getCell('A4').value = 'Analyst:'
    worksheet.getCell('B4').value = data.analyst
  }
  if (data.organization) {
    worksheet.getCell('A5').value = 'Organization:'
    worksheet.getCell('B5').value = data.organization
  }
  
  // Hypothesis ranking
  worksheet.getCell('A7').value = 'Hypothesis Ranking (by Weighted Score)'
  worksheet.getCell('A7').font = { size: 14, bold: true }
  
  // Headers
  const headers = ['Rank', 'Hypothesis', 'Weighted Score', 'Total Score', 'Supporting', 'Contradicting', 'Confidence', 'Status']
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(`${String.fromCharCode(65 + index)}9`)
    cell.value = header
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } }
  })
  
  // Hypothesis data
  analysis.forEach((hypothesisAnalysis, index) => {
    const row = 10 + index
    const hypothesis = data.hypotheses.find(h => h.id === hypothesisAnalysis.hypothesisId)
    
    worksheet.getCell(`A${row}`).value = index + 1
    worksheet.getCell(`B${row}`).value = hypothesis?.text || `Hypothesis ${index + 1}`
    worksheet.getCell(`C${row}`).value = Math.round(hypothesisAnalysis.weightedScore * 100) / 100
    worksheet.getCell(`D${row}`).value = hypothesisAnalysis.totalScore
    worksheet.getCell(`E${row}`).value = hypothesisAnalysis.supportingEvidence
    worksheet.getCell(`F${row}`).value = hypothesisAnalysis.contradictingEvidence
    worksheet.getCell(`G${row}`).value = hypothesisAnalysis.confidenceLevel
    worksheet.getCell(`H${row}`).value = hypothesisAnalysis.rejectionThreshold ? 'REJECTED' : 'VIABLE'
    
    // Color code status
    if (hypothesisAnalysis.rejectionThreshold) {
      worksheet.getCell(`H${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
      worksheet.getCell(`H${row}`).font = { color: { argb: 'FFFFFFFF' } }
    } else if (index === 0) {
      worksheet.getCell(`H${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FF00' } }
    }
  })
  
  // Set column widths
  worksheet.getColumn('A').width = 8
  worksheet.getColumn('B').width = 40
  worksheet.getColumn('C').width = 15
  worksheet.getColumn('D').width = 12
  worksheet.getColumn('E').width = 12
  worksheet.getColumn('F').width = 15
  worksheet.getColumn('G').width = 12
  worksheet.getColumn('H').width = 12
}

async function createEvidenceDetailsSheet(worksheet: ExcelJS.Worksheet, data: ACHExportData) {
  worksheet.getCell('A1').value = 'Evidence Details and SATS Evaluation'
  worksheet.getCell('A1').font = { size: 16, bold: true }
  
  // Headers
  const headers = ['Evidence ID', 'Evidence Text', 'Credibility Score', 'Credibility Level', 'SATS Evaluation']
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(`${String.fromCharCode(65 + index)}3`)
    cell.value = header
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } }
  })
  
  // Evidence data
  data.evidence.forEach((evidence, index) => {
    const row = 4 + index
    
    worksheet.getCell(`A${row}`).value = `E${index + 1}`
    worksheet.getCell(`B${row}`).value = evidence.text
    worksheet.getCell(`C${row}`).value = evidence.confidenceScore || 'Not Evaluated'
    
    // Credibility level
    let level = 'Unknown'
    if (evidence.confidenceScore) {
      if (evidence.confidenceScore >= 11) level = 'VERY HIGH'
      else if (evidence.confidenceScore >= 7) level = 'HIGH'
      else if (evidence.confidenceScore >= 4) level = 'MODERATE'
      else if (evidence.confidenceScore >= 2) level = 'LOW'
      else level = 'VERY LOW'
    }
    worksheet.getCell(`D${row}`).value = level
    
    // SATS details
    if (evidence.evaluationResponses) {
      const responses = Object.entries(evidence.evaluationResponses)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ')
      worksheet.getCell(`E${row}`).value = responses
    }
  })
  
  // Set column widths
  worksheet.getColumn('A').width = 12
  worksheet.getColumn('B').width = 50
  worksheet.getColumn('C').width = 15
  worksheet.getColumn('D').width = 15
  worksheet.getColumn('E').width = 40
}

async function createScaleReferenceSheet(worksheet: ExcelJS.Worksheet, data: ACHExportData) {
  worksheet.getCell('A1').value = `${data.scaleType === 'logarithmic' ? 'Logarithmic (Fibonacci)' : 'Linear'} Scale Reference`
  worksheet.getCell('A1').font = { size: 16, bold: true }
  
  worksheet.getCell('A3').value = 'Score'
  worksheet.getCell('B3').value = 'Label'
  worksheet.getCell('C3').value = 'Description'
  
  const headers = worksheet.getRow(3)
  headers.font = { bold: true }
  headers.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } }
  
  // Get score options based on scale type
  const scoreOptions = data.scaleType === 'logarithmic' 
    ? [
        { value: 13, label: 'Strongly Supports', description: 'Evidence strongly confirms hypothesis' },
        { value: 8, label: 'Moderately Supports', description: 'Evidence moderately confirms hypothesis' },
        { value: 5, label: 'Slightly Supports', description: 'Evidence slightly confirms hypothesis' },
        { value: 3, label: 'Weakly Supports', description: 'Evidence weakly confirms hypothesis' },
        { value: 1, label: 'Very Weakly Supports', description: 'Evidence very weakly confirms hypothesis' },
        { value: 0, label: 'Neutral', description: 'Evidence neither supports nor contradicts' },
        { value: -1, label: 'Very Weakly Contradicts', description: 'Evidence very weakly contradicts hypothesis' },
        { value: -3, label: 'Weakly Contradicts', description: 'Evidence weakly contradicts hypothesis' },
        { value: -5, label: 'Slightly Contradicts', description: 'Evidence slightly contradicts hypothesis' },
        { value: -8, label: 'Moderately Contradicts', description: 'Evidence moderately contradicts hypothesis' },
        { value: -13, label: 'Strongly Contradicts', description: 'Evidence strongly contradicts hypothesis' }
      ]
    : [
        { value: 5, label: 'Strongly Supports', description: 'Evidence strongly confirms hypothesis' },
        { value: 4, label: 'Moderately Supports', description: 'Evidence moderately confirms hypothesis' },
        { value: 3, label: 'Slightly Supports', description: 'Evidence slightly confirms hypothesis' },
        { value: 2, label: 'Weakly Supports', description: 'Evidence weakly confirms hypothesis' },
        { value: 1, label: 'Very Weakly Supports', description: 'Evidence very weakly confirms hypothesis' },
        { value: 0, label: 'Neutral', description: 'Evidence neither supports nor contradicts' },
        { value: -1, label: 'Very Weakly Contradicts', description: 'Evidence very weakly contradicts hypothesis' },
        { value: -2, label: 'Weakly Contradicts', description: 'Evidence weakly contradicts hypothesis' },
        { value: -3, label: 'Slightly Contradicts', description: 'Evidence slightly contradicts hypothesis' },
        { value: -4, label: 'Moderately Contradicts', description: 'Evidence moderately contradicts hypothesis' },
        { value: -5, label: 'Strongly Contradicts', description: 'Evidence strongly contradicts hypothesis' }
      ]
  
  scoreOptions.forEach((option, index) => {
    const row = 4 + index
    worksheet.getCell(`A${row}`).value = option.value
    worksheet.getCell(`B${row}`).value = option.label
    worksheet.getCell(`C${row}`).value = option.description
    
    // Color code based on score
    if (option.value > 0) {
      worksheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0FFE0' } }
    } else if (option.value < 0) {
      worksheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } }
    } else {
      worksheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
    }
  })
  
  // Set column widths
  worksheet.getColumn('A').width = 8
  worksheet.getColumn('B').width = 25
  worksheet.getColumn('C').width = 50
}

/**
 * Export ACH analysis to comprehensive PDF report with AI-generated analysis
 */
export async function exportToPDF(data: ACHExportData): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const analysis = data.analysis || analyzeHypotheses(data.hypotheses, data.scores, data.scaleType)
  let currentY = 20
  
  // Generate AI analysis if available
  let aiAnalysis: AIAnalysisResult | null = null
  try {
    const aiAvailable = await checkAIAvailability()
    if (aiAvailable) {
      aiAnalysis = await generateExecutiveSummary(data)
    }
  } catch (error) {
    console.warn('AI analysis not available, using fallback')
  }
  
  // Title page
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(data.title, 105, 40, { align: 'center' })
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text('Analysis of Competing Hypotheses', 105, 60, { align: 'center' })
  doc.text('Intelligence Assessment Report', 105, 75, { align: 'center' })
  
  doc.setFontSize(12)
  doc.text(`Generated: ${data.createdAt.toLocaleDateString()}`, 105, 100, { align: 'center' })
  
  if (data.analyst) {
    doc.text(`Analyst: ${data.analyst}`, 105, 115, { align: 'center' })
  }
  if (data.organization) {
    doc.text(`Organization: ${data.organization}`, 105, 130, { align: 'center' })
  }
  
  // Executive Summary
  doc.addPage()
  currentY = 30
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary', 20, currentY)
  currentY += 15
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  
  if (aiAnalysis) {
    // AI-generated executive summary
    const summaryLines = doc.splitTextToSize(aiAnalysis.executiveSummary, 170)
    summaryLines.forEach((line: string) => {
      if (currentY > 270) {
        doc.addPage()
        currentY = 30
      }
      doc.text(line, 20, currentY)
      currentY += 6
    })
  } else {
    // Fallback summary
    const topHypothesis = analysis[0]
    const hypothesis = data.hypotheses.find(h => h.id === topHypothesis.hypothesisId)
    
    doc.text(`Analysis Question: ${data.title}`, 20, currentY)
    currentY += 10
    
    if (data.description) {
      doc.text(`Context: ${data.description}`, 20, currentY)
      currentY += 10
    }
    
    doc.text(`Primary Conclusion: ${hypothesis?.text || 'Primary hypothesis'}`, 20, currentY)
    currentY += 10
    doc.text(`Confidence Level: ${topHypothesis.confidenceLevel}`, 20, currentY)
    currentY += 10
    doc.text(`Weighted Score: ${Math.round(topHypothesis.weightedScore * 100) / 100}`, 20, currentY)
  }
  
  // Methodology page (page 3)
  doc.addPage()
  currentY = 30
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Methodology', 20, currentY)
  currentY += 15
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  
  const methodologyText = `This Analysis of Competing Hypotheses (ACH) employed structured analytic techniques to evaluate ${data.hypotheses.length} competing hypotheses against ${data.evidence.length} pieces of evidence. The analysis used a ${data.scaleType} scoring scale to assess the consistency of each piece of evidence with each hypothesis.

Evidence Evaluation: Each piece of evidence was evaluated using the Structured Analytic Techniques Standards (SATS) methodology, assessing factors including source classification, corroboration, bias potential, and access to information. Evidence credibility scores range from 1 (very low) to 13 (very high).

Scoring Method: The ${data.scaleType} scale ${data.scaleType === 'logarithmic' ? 'uses Fibonacci sequence values (1, 3, 5, 8, 13) to better match human perception of differences in evidence strength' : 'uses linear values (1-5) for organizational consistency'}. Positive scores indicate evidence supports a hypothesis, negative scores indicate contradiction, and zero indicates neutrality.

Weighting: Final hypothesis scores incorporate both consistency ratings and evidence credibility, ensuring that strong claims from weak sources receive appropriate weight adjustment.`
  
  const methodLines = doc.splitTextToSize(methodologyText, 170)
  methodLines.forEach((line: string) => {
    if (currentY > 270) {
      doc.addPage()
      currentY = 30
    }
    doc.text(line, 20, currentY)
    currentY += 6
  })
  
  // Key Findings
  if (aiAnalysis && aiAnalysis.keyFindings.length > 0) {
    currentY += 15
    if (currentY > 250) {
      doc.addPage()
      currentY = 30
    }
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Findings', 20, currentY)
    currentY += 10
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    
    aiAnalysis.keyFindings.forEach((finding, index) => {
      if (currentY > 270) {
        doc.addPage()
        currentY = 30
      }
      const findingLines = doc.splitTextToSize(`• ${finding}`, 165)
      findingLines.forEach((line: string) => {
        doc.text(line, 25, currentY)
        currentY += 6
      })
      currentY += 3
    })
  }
  
  // Hypothesis Analysis
  doc.addPage()
  currentY = 30
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Hypothesis Analysis', 20, currentY)
  currentY += 15
  
  // Hypothesis ranking table
  const tableData = analysis.map((h, index) => {
    const hypothesis = data.hypotheses.find(hyp => hyp.id === h.hypothesisId)
    return [
      (index + 1).toString(),
      hypothesis?.text || `Hypothesis ${index + 1}`,
      h.weightedScore.toFixed(2),
      h.totalScore.toString(),
      h.supportingEvidence.toString(),
      h.contradictingEvidence.toString(),
      h.confidenceLevel,
      h.rejectionThreshold ? 'REJECTED' : 'VIABLE'
    ]
  })
  
  autoTable(doc, {
    head: [['Rank', 'Hypothesis', 'Weighted Score', 'Total', 'Supporting', 'Contradicting', 'Confidence', 'Status']],
    body: tableData,
    startY: currentY,
    styles: { 
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 60 },
      2: { cellWidth: 20 },
      3: { cellWidth: 15 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 }
    },
    didParseCell: (data) => {
      if (data.column.index === 7 && data.cell.text[0] === 'REJECTED') {
        data.cell.styles.fillColor = [255, 220, 220]
        data.cell.styles.textColor = [150, 0, 0]
      } else if (data.column.index === 7 && data.cell.text[0] === 'VIABLE') {
        data.cell.styles.fillColor = [220, 255, 220]
        data.cell.styles.textColor = [0, 100, 0]
      }
    }
  })
  
  // Evidence Analysis
  doc.addPage()
  currentY = 30
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Evidence Analysis', 20, currentY)
  currentY += 15
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`This analysis evaluated ${data.evidence.length} pieces of evidence using SATS methodology for credibility assessment.`, 20, currentY)
  currentY += 15
  
  // Evidence details table
  const evidenceTableData = data.evidence.map((evidence, index) => {
    const credibilityLevel = evidence.confidenceScore 
      ? evidence.confidenceScore >= 11 ? 'VERY HIGH' :
        evidence.confidenceScore >= 7 ? 'HIGH' :
        evidence.confidenceScore >= 4 ? 'MODERATE' :
        evidence.confidenceScore >= 2 ? 'LOW' : 'VERY LOW'
      : 'Not Evaluated'
    
    return [
      `E${index + 1}`,
      evidence.text,
      evidence.confidenceScore?.toString() || 'N/A',
      credibilityLevel
    ]
  })
  
  autoTable(doc, {
    head: [['ID', 'Evidence Description', 'SATS Score', 'Credibility Level']],
    body: evidenceTableData,
    startY: currentY,
    styles: { 
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 100 },
      2: { cellWidth: 20 },
      3: { cellWidth: 30 }
    }
  })
  
  // Evidence-Hypothesis Matrix
  doc.addPage()
  currentY = 30
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Evidence-Hypothesis Consistency Matrix', 20, currentY)
  currentY += 15
  
  // Create matrix data
  const matrixHeaders = ['Evidence', ...data.hypotheses.map((_, i) => `H${i + 1}`)]
  const matrixData = data.evidence.map((evidence, eIndex) => {
    const row = [`E${eIndex + 1}`]
    data.hypotheses.forEach((hypothesis) => {
      const score = data.scores.get(evidence.id)?.get(hypothesis.id)
      row.push(score ? `${score.score > 0 ? '+' : ''}${score.score}` : '-')
    })
    return row
  })
  
  autoTable(doc, {
    head: [matrixHeaders],
    body: matrixData,
    startY: currentY,
    styles: { 
      fontSize: 8,
      cellPadding: 2,
      halign: 'center'
    },
    didParseCell: (data) => {
      if (data.row.index > 0 && data.column.index > 0) {
        const value = parseFloat(data.cell.text[0])
        if (!isNaN(value)) {
          if (value > 0) {
            data.cell.styles.fillColor = [220, 255, 220]
          } else if (value < 0) {
            data.cell.styles.fillColor = [255, 220, 220]
          } else {
            data.cell.styles.fillColor = [240, 240, 240]
          }
        }
      }
    }
  })
  
  // AI-Generated Analysis Sections
  if (aiAnalysis) {
    // Recommendations
    if (aiAnalysis.recommendations.length > 0) {
      doc.addPage()
      currentY = 30
      
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Recommendations', 20, currentY)
      currentY += 15
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      
      aiAnalysis.recommendations.forEach((rec, index) => {
        if (currentY > 270) {
          doc.addPage()
          currentY = 30
        }
        const recLines = doc.splitTextToSize(`${index + 1}. ${rec}`, 165)
        recLines.forEach((line: string) => {
          doc.text(line, 20, currentY)
          currentY += 6
        })
        currentY += 5
      })
    }
    
    // Confidence Assessment
    currentY += 15
    if (currentY > 250) {
      doc.addPage()
      currentY = 30
    }
    
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Confidence Assessment', 20, currentY)
    currentY += 10
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    const confLines = doc.splitTextToSize(aiAnalysis.confidenceAssessment, 170)
    confLines.forEach((line: string) => {
      if (currentY > 270) {
        doc.addPage()
        currentY = 30
      }
      doc.text(line, 20, currentY)
      currentY += 6
    })
    
    // Intelligence Gaps
    if (aiAnalysis.gaps.length > 0) {
      currentY += 15
      if (currentY > 250) {
        doc.addPage()
        currentY = 30
      }
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('Intelligence Gaps', 20, currentY)
      currentY += 10
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      
      aiAnalysis.gaps.forEach((gap, index) => {
        if (currentY > 270) {
          doc.addPage()
          currentY = 30
        }
        const gapLines = doc.splitTextToSize(`• ${gap}`, 165)
        gapLines.forEach((line: string) => {
          doc.text(line, 25, currentY)
          currentY += 6
        })
        currentY += 3
      })
    }
  }
  
  // Additional Analysis Section (moved methodology to page 3)
  
  // Add page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' })
    
    // Add classification markings
    doc.text('FOR OFFICIAL USE ONLY', 105, 10, { align: 'center' })
    doc.text('FOR OFFICIAL USE ONLY', 105, 290, { align: 'center' })
  }
  
  return doc.output('arraybuffer')
}

/**
 * Export ACH analysis to Word document
 */
export async function exportToWord(data: ACHExportData): Promise<ArrayBuffer> {
  const analysis = data.analysis || analyzeHypotheses(data.hypotheses, data.scores, data.scaleType)
  
  // Create document sections
  const sections = [
    {
      children: [
        // Title
        new Paragraph({
          text: data.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        
        new Paragraph({
          text: 'Analysis of Competing Hypotheses Report',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${data.createdAt.toLocaleDateString()}`,
              break: 1,
            }),
            ...(data.analyst ? [new TextRun({
              text: `Analyst: ${data.analyst}`,
              break: 1,
            })] : []),
            ...(data.organization ? [new TextRun({
              text: `Organization: ${data.organization}`,
              break: 1,
            })] : []),
          ],
          alignment: AlignmentType.CENTER,
        }),
        
        // Executive Summary
        new Paragraph({
          text: 'Executive Summary',
          heading: HeadingLevel.HEADING_1,
        }),
        
        new Paragraph({
          children: [
            new TextRun({
              text: `This analysis evaluates ${data.hypotheses.length} competing hypotheses against ${data.evidence.length} pieces of evidence using a ${data.scaleType} scoring scale.`,
            }),
          ],
        }),
        
        // Top hypothesis
        new Paragraph({
          children: [
            new TextRun({
              text: 'Primary Hypothesis: ',
              bold: true,
            }),
            new TextRun({
              text: data.hypotheses.find(h => h.id === analysis[0].hypothesisId)?.text || 'Unknown',
            }),
          ],
        }),
        
        new Paragraph({
          children: [
            new TextRun({
              text: 'Weighted Score: ',
              bold: true,
            }),
            new TextRun({
              text: `${Math.round(analysis[0].weightedScore * 100) / 100}`,
            }),
          ],
        }),
        
        // Hypothesis Ranking Table
        new Paragraph({
          text: 'Hypothesis Ranking',
          heading: HeadingLevel.HEADING_1,
        }),
        
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: [
            // Header row
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Rank')] }),
                new TableCell({ children: [new Paragraph('Hypothesis')] }),
                new TableCell({ children: [new Paragraph('Weighted Score')] }),
                new TableCell({ children: [new Paragraph('Status')] }),
              ],
            }),
            // Data rows
            ...analysis.map((h, index) => {
              const hypothesis = data.hypotheses.find(hyp => hyp.id === h.hypothesisId)
              return new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph((index + 1).toString())] }),
                  new TableCell({ children: [new Paragraph(hypothesis?.text || `Hypothesis ${index + 1}`)] }),
                  new TableCell({ children: [new Paragraph((Math.round(h.weightedScore * 100) / 100).toString())] }),
                  new TableCell({ children: [new Paragraph(h.rejectionThreshold ? 'REJECTED' : 'VIABLE')] }),
                ],
              })
            }),
          ],
        }),
      ],
    },
  ]
  
  const doc = new Document({
    sections,
  })
  
  return await Packer.toBuffer(doc)
}

// PowerPoint export is handled separately to avoid Node.js dependencies
// See ach-export-pptx.ts for the implementation

/**
 * Download file with proper MIME type and filename
 */
export function downloadFile(buffer: ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}