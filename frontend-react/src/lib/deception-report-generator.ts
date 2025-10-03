/**
 * Deception Detection Report Generator
 * Professional intelligence report exports in PDF and DOCX formats
 * Includes classification markings, visualizations, and executive summaries
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, AlignmentType, BorderStyle, WidthType } from 'docx'
import { saveAs } from 'file-saver'
import type { DeceptionScores, DeceptionAssessment } from './deception-scoring'
import type { AIDeceptionAnalysis } from './ai-deception-analysis'

export interface ReportData {
  id?: string
  title: string
  description?: string
  scenario: string
  mom?: string
  pop?: string
  moses?: string
  eve?: string
  assessment?: string
  scores?: Partial<DeceptionScores>
  calculatedAssessment?: DeceptionAssessment
  aiAnalysis?: AIDeceptionAnalysis
  created_at?: string
  updated_at?: string
}

export interface ReportOptions {
  classification?: 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET'
  organizationName?: string
  analystName?: string
  distributionStatement?: string
  includeVisualizations?: boolean
  includeAIAnalysis?: boolean
}

const DEFAULT_OPTIONS: ReportOptions = {
  classification: 'UNCLASSIFIED',
  organizationName: 'Intelligence Analysis Unit',
  analystName: 'AI-Assisted Analysis',
  distributionStatement: 'DISTRIBUTION AUTHORIZED TO U.S. GOVERNMENT AGENCIES ONLY',
  includeVisualizations: true,
  includeAIAnalysis: true
}

/**
 * Generate PDF Intelligence Report
 */
export async function generatePDFReport(data: ReportData, options: ReportOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const doc = new jsPDF()
  let yPos = 20

  // Helper to add text with word wrap
  const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return y + (lines.length * fontSize * 0.5)
  }

  // Classification Header
  doc.setFillColor(opts.classification === 'UNCLASSIFIED' ? 100 : 200, 50, 50)
  doc.rect(0, 0, 210, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.classification || 'UNCLASSIFIED', 105, 10, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  yPos = 25

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  yPos = addText(data.title, 20, yPos, 170, 16)
  yPos += 5

  // Metadata
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Organization: ${opts.organizationName}`, 20, yPos)
  yPos += 5
  doc.text(`Analyst: ${opts.analystName}`, 20, yPos)
  yPos += 5
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos)
  yPos += 5
  if (data.updated_at) {
    doc.text(`Last Updated: ${new Date(data.updated_at).toLocaleDateString()}`, 20, yPos)
    yPos += 5
  }
  yPos += 5

  // Deception Likelihood - BLUF
  if (data.calculatedAssessment) {
    const assessment = data.calculatedAssessment
    doc.setFillColor(
      assessment.riskLevel === 'CRITICAL' ? 220 :
      assessment.riskLevel === 'HIGH' ? 255 :
      assessment.riskLevel === 'MEDIUM' ? 255 : 200,
      assessment.riskLevel === 'CRITICAL' ? 50 :
      assessment.riskLevel === 'HIGH' ? 140 :
      assessment.riskLevel === 'MEDIUM' ? 200 : 220,
      assessment.riskLevel === 'CRITICAL' || assessment.riskLevel === 'HIGH' ? 50 : 200
    )
    doc.rect(20, yPos, 170, 20, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('BOTTOM LINE UP FRONT (BLUF)', 105, yPos + 7, { align: 'center' })
    doc.setFontSize(18)
    doc.text(`${assessment.overallLikelihood}% DECEPTION LIKELIHOOD`, 105, yPos + 15, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    yPos += 25
  }

  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage()
    yPos = 20
  }

  // Executive Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE SUMMARY', 20, yPos)
  yPos += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  if (data.aiAnalysis?.executiveSummary) {
    yPos = addText(data.aiAnalysis.executiveSummary, 20, yPos, 170)
  } else if (data.description) {
    yPos = addText(data.description, 20, yPos, 170)
  }
  yPos += 10

  // Scenario
  if (yPos > 240) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('1. SCENARIO', 20, yPos)
  yPos += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  yPos = addText(data.scenario, 20, yPos, 170)
  yPos += 10

  // MOM Analysis
  if (data.mom) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('2. MOM (MOTIVE, OPPORTUNITY, MEANS)', 20, yPos)
    yPos += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    yPos = addText(data.mom, 20, yPos, 170)
    yPos += 10
  }

  // POP Analysis
  if (data.pop) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('3. POP (PATTERNS OF PRACTICE)', 20, yPos)
    yPos += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    yPos = addText(data.pop, 20, yPos, 170)
    yPos += 10
  }

  // MOSES Analysis
  if (data.moses) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('4. MOSES (MY OWN SOURCES EVALUATION)', 20, yPos)
    yPos += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    yPos = addText(data.moses, 20, yPos, 170)
    yPos += 10
  }

  // EVE Analysis
  if (data.eve) {
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('5. EVE (EVALUATION OF EVIDENCE)', 20, yPos)
    yPos += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    yPos = addText(data.eve, 20, yPos, 170)
    yPos += 10
  }

  // Scoring Matrix
  if (data.scores && data.calculatedAssessment) {
    if (yPos > 200) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('6. DECEPTION SCORING MATRIX', 20, yPos)
    yPos += 7

    const tableData = [
      ['Category', 'Criterion', 'Score', 'Weight'],
      ['MOM', 'Motive', String(data.scores.motive || 0), '10%'],
      ['', 'Opportunity', String(data.scores.opportunity || 0), '10%'],
      ['', 'Means', String(data.scores.means || 0), '10%'],
      ['POP', 'Historical Pattern', String(data.scores.historicalPattern || 0), '8.3%'],
      ['', 'Sophistication', String(data.scores.sophisticationLevel || 0), '8.3%'],
      ['', 'Success Rate', String(data.scores.successRate || 0), '8.3%'],
      ['MOSES', 'Source Vulnerability', String(data.scores.sourceVulnerability || 0), '12.5%'],
      ['', 'Manipulation Evidence', String(data.scores.manipulationEvidence || 0), '12.5%'],
      ['EVE', 'Internal Consistency', String(data.scores.internalConsistency || 0), '6.7%'],
      ['', 'External Corroboration', String(data.scores.externalCorroboration || 0), '6.7%'],
      ['', 'Anomaly Detection', String(data.scores.anomalyDetection || 0), '6.7%'],
      ['', '', '', ''],
      ['OVERALL', 'Deception Likelihood', `${data.calculatedAssessment.overallLikelihood}%`, `${data.calculatedAssessment.riskLevel} RISK`]
    ]

    autoTable(doc, {
      startY: yPos,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 80 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' }
      }
    })

    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  // AI Analysis Results
  if (opts.includeAIAnalysis && data.aiAnalysis) {
    if (yPos > 220) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('7. AI-GENERATED ANALYSIS', 20, yPos)
    yPos += 7

    // Key Indicators
    if (data.aiAnalysis.keyIndicators.length > 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Key Indicators:', 25, yPos)
      yPos += 6
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      data.aiAnalysis.keyIndicators.forEach(indicator => {
        if (yPos > 280) {
          doc.addPage()
          yPos = 20
        }
        yPos = addText(`• ${indicator}`, 30, yPos, 160, 9)
        yPos += 2
      })
      yPos += 5
    }

    // Recommendations
    if (data.aiAnalysis.recommendations.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Recommendations:', 25, yPos)
      yPos += 6
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      data.aiAnalysis.recommendations.forEach(rec => {
        if (yPos > 280) {
          doc.addPage()
          yPos = 20
        }
        yPos = addText(`• ${rec}`, 30, yPos, 160, 9)
        yPos += 2
      })
      yPos += 5
    }

    // Collection Priorities
    if (data.aiAnalysis.collectionPriorities.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Collection Priorities:', 25, yPos)
      yPos += 6
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      data.aiAnalysis.collectionPriorities.forEach(priority => {
        if (yPos > 280) {
          doc.addPage()
          yPos = 20
        }
        yPos = addText(`• ${priority}`, 30, yPos, 160, 9)
        yPos += 2
      })
    }
  }

  // Classification Footer on all pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFillColor(opts.classification === 'UNCLASSIFIED' ? 100 : 200, 50, 50)
    doc.rect(0, 282, 210, 15, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(opts.classification || 'UNCLASSIFIED', 105, 290, { align: 'center' })
    doc.setFontSize(8)
    doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: 'right' })
  }

  // Save PDF
  const filename = `Deception_Analysis_${data.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Generate DOCX Intelligence Report
 */
export async function generateDOCXReport(data: ReportData, options: ReportOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const children: any[] = []

  // Classification Header
  children.push(
    new Paragraph({
      text: opts.classification || 'UNCLASSIFIED',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      shading: {
        fill: opts.classification === 'UNCLASSIFIED' ? 'CCCCCC' : 'FF0000'
      }
    })
  )

  children.push(new Paragraph({ text: '' })) // Spacing

  // Title
  children.push(
    new Paragraph({
      text: data.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER
    })
  )

  children.push(new Paragraph({ text: '' }))

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Organization: ', bold: true }),
        new TextRun(opts.organizationName || '')
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Analyst: ', bold: true }),
        new TextRun(opts.analystName || '')
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun(new Date().toLocaleDateString())
      ]
    })
  )

  if (data.updated_at) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Last Updated: ', bold: true }),
          new TextRun(new Date(data.updated_at).toLocaleDateString())
        ]
      })
    )
  }

  children.push(new Paragraph({ text: '' }))

  // BLUF
  if (data.calculatedAssessment) {
    children.push(
      new Paragraph({
        text: 'BOTTOM LINE UP FRONT (BLUF)',
        heading: HeadingLevel.HEADING_2,
        shading: { fill: 'EEEEEE' }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.calculatedAssessment.overallLikelihood}% DECEPTION LIKELIHOOD - ${data.calculatedAssessment.riskLevel} RISK`,
            bold: true,
            size: 28
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ text: '' })
    )
  }

  // Executive Summary
  children.push(
    new Paragraph({
      text: 'EXECUTIVE SUMMARY',
      heading: HeadingLevel.HEADING_2
    })
  )

  if (data.aiAnalysis?.executiveSummary) {
    children.push(new Paragraph({ text: data.aiAnalysis.executiveSummary }))
  } else if (data.description) {
    children.push(new Paragraph({ text: data.description }))
  }

  children.push(new Paragraph({ text: '' }))

  // Scenario
  children.push(
    new Paragraph({
      text: '1. SCENARIO',
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({ text: data.scenario }),
    new Paragraph({ text: '' })
  )

  // MOM
  if (data.mom) {
    children.push(
      new Paragraph({
        text: '2. MOM (MOTIVE, OPPORTUNITY, MEANS)',
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({ text: data.mom }),
      new Paragraph({ text: '' })
    )
  }

  // POP
  if (data.pop) {
    children.push(
      new Paragraph({
        text: '3. POP (PATTERNS OF PRACTICE)',
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({ text: data.pop }),
      new Paragraph({ text: '' })
    )
  }

  // MOSES
  if (data.moses) {
    children.push(
      new Paragraph({
        text: '4. MOSES (MY OWN SOURCES EVALUATION)',
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({ text: data.moses }),
      new Paragraph({ text: '' })
    )
  }

  // EVE
  if (data.eve) {
    children.push(
      new Paragraph({
        text: '5. EVE (EVALUATION OF EVIDENCE)',
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({ text: data.eve }),
      new Paragraph({ text: '' })
    )
  }

  // Scoring Table
  if (data.scores && data.calculatedAssessment) {
    children.push(
      new Paragraph({
        text: '6. DECEPTION SCORING MATRIX',
        heading: HeadingLevel.HEADING_2
      })
    )

    const scoreTable = new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Criterion', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Score', bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Weight', bold: true })] })] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('MOM')], rowSpan: 3 }),
            new TableCell({ children: [new Paragraph('Motive')] }),
            new TableCell({ children: [new Paragraph(String(data.scores.motive || 0))] }),
            new TableCell({ children: [new Paragraph('10%')] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Opportunity')] }),
            new TableCell({ children: [new Paragraph(String(data.scores.opportunity || 0))] }),
            new TableCell({ children: [new Paragraph('10%')] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Means')] }),
            new TableCell({ children: [new Paragraph(String(data.scores.means || 0))] }),
            new TableCell({ children: [new Paragraph('10%')] })
          ]
        })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE }
    })

    children.push(scoreTable, new Paragraph({ text: '' }))
  }

  // AI Analysis
  if (opts.includeAIAnalysis && data.aiAnalysis) {
    children.push(
      new Paragraph({
        text: '7. AI-GENERATED ANALYSIS',
        heading: HeadingLevel.HEADING_2
      })
    )

    if (data.aiAnalysis.keyIndicators.length > 0) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Key Indicators:', bold: true })] })
      )
      data.aiAnalysis.keyIndicators.forEach(indicator => {
        children.push(new Paragraph({ text: `• ${indicator}`, bullet: { level: 0 } }))
      })
      children.push(new Paragraph({ text: '' }))
    }

    if (data.aiAnalysis.recommendations.length > 0) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Recommendations:', bold: true })] })
      )
      data.aiAnalysis.recommendations.forEach(rec => {
        children.push(new Paragraph({ text: `• ${rec}`, bullet: { level: 0 } }))
      })
    }
  }

  // Classification Footer
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      text: opts.classification || 'UNCLASSIFIED',
      alignment: AlignmentType.CENTER,
      shading: {
        fill: opts.classification === 'UNCLASSIFIED' ? 'CCCCCC' : 'FF0000'
      }
    })
  )

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  })

  const blob = await Packer.toBlob(doc)
  const filename = `Deception_Analysis_${data.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.docx`
  saveAs(blob, filename)
}

/**
 * Generate Executive Briefing (1-page summary)
 */
export async function generateExecutiveBriefing(data: ReportData, options: ReportOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const doc = new jsPDF()

  // Classification Header
  doc.setFillColor(opts.classification === 'UNCLASSIFIED' ? 100 : 200, 50, 50)
  doc.rect(0, 0, 210, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.classification || 'UNCLASSIFIED', 105, 10, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  let yPos = 25

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE BRIEFING', 105, yPos, { align: 'center' })
  yPos += 8
  doc.setFontSize(12)
  doc.text(data.title, 105, yPos, { align: 'center' })
  yPos += 10

  // BLUF Box
  if (data.calculatedAssessment) {
    const assessment = data.calculatedAssessment
    doc.setFillColor(
      assessment.riskLevel === 'CRITICAL' ? 220 : 255,
      assessment.riskLevel === 'CRITICAL' || assessment.riskLevel === 'HIGH' ? 140 : 200,
      50
    )
    doc.rect(20, yPos, 170, 25, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('DECEPTION LIKELIHOOD', 105, yPos + 8, { align: 'center' })
    doc.setFontSize(20)
    doc.text(`${assessment.overallLikelihood}%`, 105, yPos + 18, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`${assessment.riskLevel} RISK | ${assessment.confidenceLevel} CONFIDENCE`, 105, yPos + 23, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    yPos += 35
  }

  // Executive Summary
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('EXECUTIVE SUMMARY', 20, yPos)
  yPos += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (data.aiAnalysis?.executiveSummary) {
    const lines = doc.splitTextToSize(data.aiAnalysis.executiveSummary, 170)
    doc.text(lines, 20, yPos)
    yPos += lines.length * 4
  }
  yPos += 5

  // Key Findings
  if (data.aiAnalysis?.keyIndicators && data.aiAnalysis.keyIndicators.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('KEY FINDINGS', 20, yPos)
    yPos += 7
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    data.aiAnalysis.keyIndicators.slice(0, 3).forEach(indicator => {
      const lines = doc.splitTextToSize(`• ${indicator}`, 165)
      doc.text(lines, 25, yPos)
      yPos += lines.length * 4
    })
    yPos += 5
  }

  // Recommendations
  if (data.aiAnalysis?.recommendations && data.aiAnalysis.recommendations.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('RECOMMENDATIONS', 20, yPos)
    yPos += 7
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    data.aiAnalysis.recommendations.slice(0, 3).forEach(rec => {
      const lines = doc.splitTextToSize(`• ${rec}`, 165)
      doc.text(lines, 25, yPos)
      yPos += lines.length * 4
    })
  }

  // Classification Footer
  doc.setFillColor(opts.classification === 'UNCLASSIFIED' ? 100 : 200, 50, 50)
  doc.rect(0, 282, 210, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(opts.classification || 'UNCLASSIFIED', 105, 290, { align: 'center' })

  const filename = `Executive_Briefing_${data.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
