/**
 * Enhanced SWOT Report Generator
 * Integrates visualizations, TOWS analysis, and executive summaries
 */

import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx'
import {
  createSWOTMatrixSVG,
  analyzeSWOTData,
  generateTOWSStrategies,
  type SWOTData
} from '../visualizations/swot-visuals'
import {
  generateExecutiveSummary,
  formatExecutiveSummaryForPDF,
  type ExecutiveSummaryData
} from '../core/executive-summary'

export interface EnhancedSWOTReportOptions {
  title: string
  description?: string
  sourceUrl?: string
  analyst?: string
  classification?: string
  swotData: SWOTData
  includeVisualizations?: boolean
  includeTOWS?: boolean
  includeExecutiveSummary?: boolean
}

/**
 * Generates an enhanced SWOT PDF report with visualizations
 */
export async function generateEnhancedSWOTPDF(options: EnhancedSWOTReportOptions): Promise<void> {
  const {
    title,
    description,
    sourceUrl,
    analyst,
    classification,
    swotData,
    includeVisualizations = true,
    includeTOWS = true,
    includeExecutiveSummary = true,
  } = options

  const pdf = new jsPDF()
  let yPos = 20

  // Helper function to check page break
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPos > 280 - requiredSpace) {
      pdf.addPage()
      yPos = 20
    }
  }

  // Colors
  const colors = {
    primary: [30, 58, 138] as [number, number, number],
    strengths: [34, 197, 94] as [number, number, number],
    weaknesses: [245, 158, 11] as [number, number, number],
    opportunities: [59, 130, 246] as [number, number, number],
    threats: [239, 68, 68] as [number, number, number],
  }

  // Cover Page
  pdf.setFillColor(...colors.primary)
  pdf.rect(0, 0, 210, 297, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(36)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SWOT ANALYSIS', 105, 100, { align: 'center' })

  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'normal')
  pdf.text(title, 105, 120, { align: 'center', maxWidth: 170 })

  pdf.setFontSize(12)
  pdf.text(new Date().toLocaleDateString(), 105, 250, { align: 'center' })
  if (analyst) {
    pdf.text(`Analyst: ${analyst}`, 105, 257, { align: 'center' })
  }
  if (classification) {
    pdf.setFontSize(10)
    pdf.text(classification.toUpperCase(), 105, 280, { align: 'center' })
  }

  // Page 2: Executive Summary
  if (includeExecutiveSummary) {
    pdf.addPage()
    yPos = 20

    const insights = analyzeSWOTData(swotData)

    const execSummaryData: ExecutiveSummaryData = {
      frameworkType: 'SWOT',
      frameworkTitle: 'SWOT Analysis',
      analysisDate: new Date(),
      analyst,
      classification,
      totalElements: insights.totalItems,
      completeness: Math.min(100, (insights.totalItems / 20) * 100), // Assume 20 items is 100%
      purpose: description || 'Strategic analysis of internal strengths and weaknesses, and external opportunities and threats.',
      keyFindings: [
        `${insights.totalItems} total factors identified across all four quadrants`,
        `Analysis is ${insights.balance === 'balanced' ? 'well-balanced' : insights.balance} with ${insights.internalVsExternal.internal} internal and ${insights.internalVsExternal.external} external factors`,
        `Overall sentiment is ${insights.sentiment} (${insights.positiveVsNegative.positive} positive vs ${insights.positiveVsNegative.negative} negative factors)`,
        swotData.strengths.length > 0 ? `${swotData.strengths.length} strengths identified that can be leveraged for strategic advantage` : 'Limited strengths identified - capability building recommended',
        swotData.threats.length > 0 ? `${swotData.threats.length} threats require mitigation strategies` : 'Minimal external threats identified',
      ],
      recommendations: [],
      frameworkData: swotData,
    }

    const execSummary = generateExecutiveSummary(execSummaryData)

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Executive Summary', 20, yPos)
    yPos += 15

    // Key Metrics
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Key Metrics', 20, yPos)
    yPos += 8

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    execSummary.keyMetrics.forEach((metric) => {
      checkPageBreak(15)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${metric.label}:`, 25, yPos)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`${metric.value}`, 75, yPos)
      if (metric.context) {
        pdf.setTextColor(100, 100, 100)
        pdf.text(`(${metric.context})`, 95, yPos)
        pdf.setTextColor(0, 0, 0)
      }
      yPos += 6
    })
    yPos += 5

    // Key Findings
    execSummary.sections.forEach((section) => {
      if (section.heading === 'Key Findings') {
        checkPageBreak(25)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text(section.heading, 20, yPos)
        yPos += 8

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const findings = Array.isArray(section.content) ? section.content : [section.content]
        findings.forEach((finding, idx) => {
          checkPageBreak(15)
          const lines = pdf.splitTextToSize(`${idx + 1}. ${finding}`, 165)
          pdf.text(lines, 25, yPos)
          yPos += lines.length * 5 + 3
        })
        yPos += 5
      }
    })
  }

  // Page 3: SWOT Matrix Visualization
  if (includeVisualizations) {
    pdf.addPage()
    yPos = 20

    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('SWOT Matrix', 105, yPos, { align: 'center' })
    yPos += 15

    // Generate SVG and embed it
    const svgData = createSWOTMatrixSVG(swotData, 170, 170)

    // Convert SVG to data URI and add to PDF
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' })
    const svgUrl = URL.createObjectURL(svgBlob)

    // For now, add a placeholder - in production you'd need to convert SVG to PNG/JPEG
    // This is a limitation of jsPDF - it doesn't support SVG directly
    // You would use a library like canvg or svg2img for conversion

    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text('(Matrix visualization)', 105, yPos + 85, { align: 'center' })
    yPos += 180
  }

  // Page 4+: Detailed SWOT Analysis
  pdf.addPage()
  yPos = 20

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Detailed Analysis', 105, yPos, { align: 'center' })
  yPos += 15

  const sections = [
    { key: 'strengths', label: 'Strengths', data: swotData.strengths, color: colors.strengths, desc: 'Internal Positive Factors' },
    { key: 'weaknesses', label: 'Weaknesses', data: swotData.weaknesses, color: colors.weaknesses, desc: 'Internal Negative Factors' },
    { key: 'opportunities', label: 'Opportunities', data: swotData.opportunities, color: colors.opportunities, desc: 'External Positive Factors' },
    { key: 'threats', label: 'Threats', data: swotData.threats, color: colors.threats, desc: 'External Negative Factors' },
  ]

  sections.forEach((section) => {
    if (section.data.length > 0) {
      checkPageBreak(30)

      // Section header with color bar
      pdf.setFillColor(...section.color)
      pdf.rect(15, yPos - 6, 180, 12, 'F')

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)
      pdf.text(section.label, 20, yPos)
      yPos += 12

      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(section.desc, 20, yPos)
      yPos += 8

      // Section items
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      section.data.slice(0, 10).forEach((item, idx) => {
        checkPageBreak(15)
        const itemText = `${idx + 1}. ${item}`
        const lines = pdf.splitTextToSize(itemText, 165)
        pdf.text(lines, 25, yPos)
        yPos += lines.length * 6 + 3
      })

      if (section.data.length > 10) {
        pdf.setFontSize(9)
        pdf.setTextColor(100, 100, 100)
        pdf.text(`... and ${section.data.length - 10} more`, 25, yPos)
        yPos += 6
        pdf.setTextColor(0, 0, 0)
      }

      yPos += 8
    }
  })

  // TOWS Strategic Analysis
  if (includeTOWS) {
    pdf.addPage()
    yPos = 20

    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('TOWS Strategic Recommendations', 105, yPos, { align: 'center' })
    yPos += 10

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('Threats-Opportunities-Weaknesses-Strengths Matrix', 105, yPos, { align: 'center' })
    yPos += 15

    const tows = generateTOWSStrategies(swotData)

    const towsSections = [
      { key: 'SO', label: 'SO Strategies (Growth)', desc: 'Use Strengths to exploit Opportunities', data: tows.SO, color: [34, 197, 94] },
      { key: 'ST', label: 'ST Strategies (Diversification)', desc: 'Use Strengths to mitigate Threats', data: tows.ST, color: [245, 158, 11] },
      { key: 'WO', label: 'WO Strategies (Development)', desc: 'Address Weaknesses to exploit Opportunities', data: tows.WO, color: [59, 130, 246] },
      { key: 'WT', label: 'WT Strategies (Defensive)', desc: 'Minimize Weaknesses and avoid Threats', data: tows.WT, color: [239, 68, 68] },
    ]

    towsSections.forEach((section) => {
      checkPageBreak(25)

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...(section.color as [number, number, number]))
      pdf.text(section.label, 20, yPos)
      yPos += 7

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'italic')
      pdf.setTextColor(100, 100, 100)
      pdf.text(section.desc, 20, yPos)
      yPos += 8

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(0, 0, 0)

      section.data.forEach((strategy, idx) => {
        checkPageBreak(12)
        const lines = pdf.splitTextToSize(`${idx + 1}. ${strategy}`, 165)
        pdf.text(lines, 25, yPos)
        yPos += lines.length * 5 + 3
      })

      yPos += 8
    })
  }

  // Methodology Appendix
  pdf.addPage()
  yPos = 20

  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Methodology', 20, yPos)
  yPos += 12

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  const methodology = [
    'SWOT Analysis is a strategic planning framework that evaluates:',
    '',
    '• Strengths: Internal attributes and resources that support successful outcomes',
    '• Weaknesses: Internal factors that could hinder success',
    '• Opportunities: External factors that could be exploited for advantage',
    '• Threats: External challenges that could cause trouble',
    '',
    'TOWS Matrix extends SWOT by generating actionable strategies:',
    '',
    '• SO (Strengths-Opportunities): Growth strategies leveraging internal capabilities',
    '• ST (Strengths-Threats): Diversification strategies using strengths defensively',
    '• WO (Weaknesses-Opportunities): Development strategies to build capabilities',
    '• WT (Weaknesses-Threats): Defensive strategies to minimize risk',
    '',
    'This analysis was generated using the Research Analysis Platform.',
  ]

  methodology.forEach((line) => {
    checkPageBreak(8)
    if (line === '') {
      yPos += 4
    } else {
      const lines = pdf.splitTextToSize(line, 170)
      pdf.text(lines, 20, yPos)
      yPos += lines.length * 5 + 2
    }
  })

  // Save
  pdf.save(`${title.replace(/[^a-z0-9]/gi, '_')}_SWOT_Analysis.pdf`)
}

/**
 * Generates enhanced SWOT insights for display
 */
export function generateSWOTInsightsSummary(swotData: SWOTData): string[] {
  const insights = analyzeSWOTData(swotData)
  const tows = generateTOWSStrategies(swotData)

  const summary: string[] = []

  // Overall assessment
  summary.push(`**Strategic Position:** ${insights.totalItems} factors identified with a ${insights.sentiment} outlook`)

  // Balance analysis
  if (insights.balance === 'internal-focused') {
    summary.push(`**Focus:** Analysis is heavily internal (${insights.internalVsExternal.internal} internal vs ${insights.internalVsExternal.external} external). Consider expanding environmental scanning.`)
  } else if (insights.balance === 'external-focused') {
    summary.push(`**Focus:** Analysis is heavily external (${insights.internalVsExternal.external} external vs ${insights.internalVsExternal.internal} internal). Consider deeper internal capability assessment.`)
  } else {
    summary.push(`**Focus:** Well-balanced analysis (${insights.internalVsExternal.internal} internal, ${insights.internalVsExternal.external} external factors)`)
  }

  // Sentiment analysis
  if (insights.sentiment === 'positive') {
    summary.push(`**Outlook:** Positive strategic position with ${insights.positiveVsNegative.positive} positive factors outweighing ${insights.positiveVsNegative.negative} challenges`)
  } else if (insights.sentiment === 'negative') {
    summary.push(`**Outlook:** Challenging environment with ${insights.positiveVsNegative.negative} negative factors. Defensive strategies recommended.`)
  } else {
    summary.push(`**Outlook:** Neutral balance between positive (${insights.positiveVsNegative.positive}) and negative (${insights.positiveVsNegative.negative}) factors`)
  }

  // Strategic recommendations
  if (swotData.strengths.length > 0 && swotData.opportunities.length > 0) {
    summary.push(`**Growth Potential:** ${swotData.strengths.length} strengths can be leveraged against ${swotData.opportunities.length} opportunities`)
  }

  if (swotData.weaknesses.length > 0 && swotData.threats.length > 0) {
    summary.push(`**Risk Mitigation:** ${swotData.weaknesses.length} weaknesses and ${swotData.threats.length} threats require defensive strategies`)
  }

  // Top TOWS strategy
  if (tows.SO.length > 0) {
    summary.push(`**Top SO Strategy:** ${tows.SO[0]}`)
  }

  return summary
}
