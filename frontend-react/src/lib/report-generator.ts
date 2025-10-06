/**
 * Report Generator
 *
 * Generates professional reports from framework analyses with AI enhancements
 * Supports export to Word, PDF, PowerPoint, and CSV formats
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import pptxgen from 'pptxgenjs'
import Papa from 'papaparse'
import type { FrameworkItem } from '@/types/frameworks'
import { isQuestionAnswerItem } from '@/types/frameworks'
import { frameworkConfigs } from '@/config/framework-configs'
import type { ComBDeficits, InterventionFunction } from '@/types/behavior-change-wheel'
import {
  generateInterventionRecommendations,
  generatePolicyRecommendations,
  assessBehaviorChangeFeasibility,
  INTERVENTION_DESCRIPTIONS,
  POLICY_DESCRIPTIONS,
} from '@/utils/behaviour-change-wheel'

export type ExportFormat = 'word' | 'pdf' | 'pptx' | 'csv'
export type ReportTemplate = 'standard' | 'executive' | 'detailed'

export interface ReportOptions {
  frameworkType: string
  frameworkTitle: string
  data: any
  format: ExportFormat
  template?: ReportTemplate
  includeAI?: boolean
  aiEnhancements?: AIEnhancements
}

export interface AIEnhancements {
  executiveSummary?: string
  keyInsights?: string[]
  recommendations?: string[]
  comprehensiveAnalysis?: string
}

export class ReportGenerator {
  /**
   * Generate and download a report in the specified format
   */
  static async generate(options: ReportOptions): Promise<void> {
    const {
      frameworkType,
      frameworkTitle,
      data,
      format,
      template = 'standard',
      includeAI = false,
      aiEnhancements
    } = options

    console.log(`Generating ${format.toUpperCase()} report for ${frameworkType}...`)

    switch (format) {
      case 'word':
        return this.generateWord(options)
      case 'pdf':
        return this.generatePDF(options)
      case 'pptx':
        return this.generatePowerPoint(options)
      case 'csv':
        return this.generateCSV(options)
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Generate AI enhancements for a report
   */
  static async enhanceReport(frameworkType: string, data: any, verbosity: 'executive' | 'standard' | 'comprehensive' = 'standard'): Promise<AIEnhancements> {
    try {
      const response = await fetch('/api/ai/report-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkType,
          data,
          enhancementType: 'full',
          verbosity
        })
      })

      if (!response.ok) {
        throw new Error('Failed to enhance report')
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to enhance report:', error)
      return {}
    }
  }

  /**
   * Generate Markdown content for preview
   */
  static generateMarkdown(options: ReportOptions): string {
    const { frameworkType, frameworkTitle, data, aiEnhancements } = options
    let markdown = ''

    // Title
    markdown += `# ${frameworkTitle} Analysis Report\n\n`

    // Metadata
    markdown += `**Title:** ${data.title || 'Untitled Analysis'}  \n`
    markdown += `**Date:** ${new Date().toLocaleDateString()}  \n`
    markdown += `**Framework:** ${frameworkTitle}  \n`
    if (data.source_url) {
      markdown += `**Source:** ${data.source_url}  \n`
    }
    markdown += '\n---\n\n'

    // Executive Summary (if AI enhanced)
    if (aiEnhancements?.executiveSummary) {
      markdown += `## 📝 Executive Summary\n\n`
      markdown += `${aiEnhancements.executiveSummary}\n\n`
    }

    // Key Insights (if AI enhanced)
    if (aiEnhancements?.keyInsights && aiEnhancements.keyInsights.length > 0) {
      markdown += `## 💡 Key Insights\n\n`
      aiEnhancements.keyInsights.forEach((insight, index) => {
        markdown += `${index + 1}. ${insight}\n`
      })
      markdown += '\n'
    }

    // Framework-specific content
    if (frameworkType === 'behavior') {
      markdown += this.generateBehaviorMarkdown(data, aiEnhancements)
    } else {
      markdown += this.generateGenericMarkdown(frameworkType, frameworkTitle, data)
    }

    // Recommendations (if AI enhanced)
    if (aiEnhancements?.recommendations && aiEnhancements.recommendations.length > 0) {
      markdown += `## 🎯 Recommendations\n\n`
      aiEnhancements.recommendations.forEach((rec, index) => {
        markdown += `${index + 1}. ${rec}\n`
      })
      markdown += '\n'
    }

    // Comprehensive Analysis (if AI enhanced)
    if (aiEnhancements?.comprehensiveAnalysis) {
      markdown += `## 📊 Comprehensive Analysis\n\n`
      markdown += `${aiEnhancements.comprehensiveAnalysis}\n\n`
    }

    return markdown
  }

  /**
   * Generate markdown for behavior analysis framework
   */
  private static generateBehaviorMarkdown(data: any, aiEnhancements?: AIEnhancements): string {
    let markdown = ''

    // COM-B Assessment
    if (data.com_b_deficits) {
      const deficits = data.com_b_deficits as ComBDeficits
      markdown += `## 🎯 COM-B Assessment Summary\n\n`
      markdown += `*Capability, Opportunity, Motivation → Behavior (Michie et al., 2011)*\n\n`

      // Count deficits by severity
      const deficitCounts = {
        major_barrier: Object.values(deficits).filter((d) => d === 'major_barrier').length,
        deficit: Object.values(deficits).filter((d) => d === 'deficit').length,
        adequate: Object.values(deficits).filter((d) => d === 'adequate').length,
      }

      markdown += `- ✓ Adequate: ${deficitCounts.adequate} components\n`
      markdown += `- ⚠ Deficit: ${deficitCounts.deficit} components\n`
      markdown += `- ✖ Major Barrier: ${deficitCounts.major_barrier} components\n\n`

      // Component breakdown
      markdown += `### Component Status Breakdown\n\n`
      const componentNames: Record<string, { label: string; icon: string }> = {
        physical_capability: { label: 'Physical Capability', icon: '💪' },
        psychological_capability: { label: 'Psychological Capability', icon: '🧠' },
        physical_opportunity: { label: 'Physical Opportunity', icon: '🌍' },
        social_opportunity: { label: 'Social Opportunity', icon: '👥' },
        reflective_motivation: { label: 'Reflective Motivation', icon: '🎯' },
        automatic_motivation: { label: 'Automatic Motivation', icon: '⚡' },
      }

      Object.entries(deficits).forEach(([component, level]) => {
        const info = componentNames[component as keyof typeof componentNames]
        const statusText = level === 'major_barrier' ? '✖ Major Barrier' : level === 'deficit' ? '⚠ Deficit' : '✓ Adequate'
        markdown += `- **${info.icon} ${info.label}:** ${statusText}\n`
      })
      markdown += '\n'

      // Feasibility
      const feasibility = assessBehaviorChangeFeasibility(deficits)
      markdown += `### Behavior Change Feasibility\n\n`
      const feasibilityText = feasibility.feasibility.charAt(0).toUpperCase() + feasibility.feasibility.slice(1)
      markdown += `**Overall Feasibility:** ${feasibilityText}\n\n`

      if (feasibility.barriers.length > 0) {
        markdown += `**Barriers Identified:**\n\n`
        feasibility.barriers.forEach((barrier) => {
          markdown += `- ${barrier}\n`
        })
        markdown += '\n'
      }

      if (feasibility.strengths.length > 0) {
        markdown += `**Strengths:**\n\n`
        feasibility.strengths.forEach((strength) => {
          markdown += `- ${strength}\n`
        })
        markdown += '\n'
      }

      // Intervention recommendations (if data has them)
      const interventionRecs = generateInterventionRecommendations(deficits)
      if (interventionRecs.length > 0) {
        markdown += `## 🔧 Recommended Intervention Functions\n\n`
        markdown += `*Based on Behaviour Change Wheel (Michie et al., 2011)*\n\n`

        interventionRecs.forEach((rec) => {
          markdown += `### ${rec.component} (${rec.severity.replace('_', ' ').toUpperCase()})\n\n`

          rec.interventions.forEach((intervention) => {
            const info = INTERVENTION_DESCRIPTIONS[intervention.name]
            const priorityText = intervention.priority.toUpperCase()
            const namePretty = intervention.name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

            markdown += `#### ${namePretty} [${priorityText} PRIORITY]\n\n`
            markdown += `**Definition:** ${info.definition}\n\n`
            markdown += `**Evidence Base:** *${intervention.evidence_base}*\n\n`
          })
        })
      }

      // Policy recommendations
      if (data.selected_interventions && data.selected_interventions.length > 0) {
        const policyRecs = generatePolicyRecommendations(data.selected_interventions as InterventionFunction[])
        if (policyRecs.length > 0) {
          markdown += `## 📜 Policy Category Recommendations\n\n`
          policyRecs.forEach((policy) => {
            const policyPretty = policy.name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            markdown += `### ${policyPretty}\n\n`
            markdown += `${POLICY_DESCRIPTIONS[policy.policy]}\n\n`
            markdown += `**Suitable For Interventions:** ${policy.suitable_for_interventions.map(i =>
              i.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            ).join(', ')}\n\n`
          })
        }
      }
    }

    // Timeline
    if (data.timeline && data.timeline.length > 0) {
      markdown += `## 📅 Behavior Timeline\n\n`
      data.timeline.forEach((event: any, index: number) => {
        markdown += `### ${index + 1}. ${event.label}\n\n`
        if (event.description) {
          markdown += `${event.description}\n\n`
        }
        if (event.time || event.location) {
          markdown += `- `
          if (event.time) markdown += `⏰ **Time:** ${event.time}  `
          if (event.location) markdown += `📍 **Location:** ${event.location}`
          markdown += '\n\n'
        }
        if (event.sub_steps && event.sub_steps.length > 0) {
          markdown += `**Sub-steps:**\n\n`
          event.sub_steps.forEach((step: any, idx: number) => {
            markdown += `${idx + 1}. ${step.label}`
            if (step.duration) markdown += ` (${step.duration})`
            markdown += '\n'
          })
          markdown += '\n'
        }
      })
    }

    // Other sections
    const config = frameworkConfigs['behavior']
    if (config?.sections) {
      config.sections.forEach(section => {
        if (section.key.includes('capability') || section.key.includes('opportunity') || section.key.includes('motivation') || section.key === 'timeline') {
          return
        }
        if (data[section.key] && data[section.key].length > 0) {
          markdown += `## ${section.label}\n\n`
          data[section.key].forEach((item: any, index: number) => {
            if (isQuestionAnswerItem(item)) {
              markdown += `**Q:** ${item.question}  \n`
              markdown += `**A:** ${item.answer || 'No answer provided'}\n\n`
            } else if (typeof item === 'string') {
              markdown += `- ${item}\n`
            }
          })
          markdown += '\n'
        }
      })
    }

    return markdown
  }

  /**
   * Generate markdown for generic frameworks
   */
  private static generateGenericMarkdown(frameworkType: string, frameworkTitle: string, data: any): string {
    let markdown = ''

    const config = frameworkConfigs[frameworkType]
    if (config?.sections) {
      config.sections.forEach(section => {
        if (data[section.key] && data[section.key].length > 0) {
          markdown += `## ${section.label}\n\n`
          data[section.key].forEach((item: FrameworkItem, index: number) => {
            if (isQuestionAnswerItem(item)) {
              markdown += `**Q${index + 1}:** ${item.question}  \n`
              markdown += `**A:** ${item.answer || 'No answer provided'}\n\n`
            } else if (typeof item === 'string') {
              markdown += `${index + 1}. ${item}\n`
            } else if (typeof item === 'object') {
              markdown += `${index + 1}. ${JSON.stringify(item)}\n`
            }
          })
          markdown += '\n'
        }
      })
    }

    return markdown
  }

  /**
   * Generate Word document (.docx)
   */
  private static async generateWord(options: ReportOptions): Promise<void> {
    const { frameworkType, frameworkTitle, data, aiEnhancements } = options

    const sections: any[] = []

    // Title
    sections.push(
      new Paragraph({
        text: `${frameworkTitle} Analysis Report`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    )

    // Metadata
    sections.push(
      new Paragraph({
        text: `Title: ${data.title || 'Untitled Analysis'}`,
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: `Date: ${new Date().toLocaleDateString()}`,
        spacing: { after: 200 }
      }),
      new Paragraph({
        text: `Framework: ${frameworkTitle}`,
        spacing: { after: data.source_url ? 200 : 400 }
      })
    )

    // Source URL (if available)
    if (data.source_url) {
      sections.push(
        new Paragraph({
          text: `Source: ${data.source_url}`,
          spacing: { after: 400 }
        })
      )
    }

    // Executive Summary (if AI enhanced)
    if (aiEnhancements?.executiveSummary) {
      sections.push(
        new Paragraph({
          text: 'Executive Summary',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          text: aiEnhancements.executiveSummary,
          spacing: { after: 400 }
        })
      )
    }

    // Analysis Overview
    if (data.description) {
      sections.push(
        new Paragraph({
          text: 'Analysis Overview',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
          text: data.description,
          spacing: { after: 400 }
        })
      )
    }

    // Unanswered Questions Summary (for Q&A frameworks)
    const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'
    const isQA = itemType === 'qa'
    if (isQA) {
      const config = frameworkConfigs[frameworkType]
      const unansweredBySection: Record<string, number> = {}
      let totalUnanswered = 0

      if (config?.sections) {
        config.sections.forEach(section => {
          if (data[section.key] && data[section.key].length > 0) {
            const unanswered = data[section.key].filter((item: FrameworkItem) =>
              isQuestionAnswerItem(item) && (!item.answer || item.answer.trim() === '')
            ).length
            if (unanswered > 0) {
              unansweredBySection[section.label] = unanswered
              totalUnanswered += unanswered
            }
          }
        })
      }

      if (totalUnanswered > 0) {
        sections.push(
          new Paragraph({
            text: '⚠️ Unanswered Questions Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),
          new Paragraph({
            text: `Total unanswered questions: ${totalUnanswered}`,
            spacing: { after: 200 }
          })
        )
        Object.entries(unansweredBySection).forEach(([label, count]) => {
          sections.push(
            new Paragraph({
              text: `• ${label}: ${count} unanswered`,
              spacing: { after: 100 },
              indent: { left: 360 }
            })
          )
        })
        sections.push(new Paragraph({ text: '', spacing: { after: 400 } }))
      }
    }

    // Framework-specific content
    sections.push(...this.getFrameworkContent(options))

    // Key Insights (if AI enhanced)
    if (aiEnhancements?.keyInsights && aiEnhancements.keyInsights.length > 0) {
      sections.push(
        new Paragraph({
          text: 'Key Insights',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        })
      )
      aiEnhancements.keyInsights.forEach((insight, idx) => {
        sections.push(
          new Paragraph({
            text: `${idx + 1}. ${insight}`,
            spacing: { after: 100 }
          })
        )
      })
      sections.push(new Paragraph({ text: '', spacing: { after: 400 } }))
    }

    // Recommendations (if AI enhanced)
    if (aiEnhancements?.recommendations && aiEnhancements.recommendations.length > 0) {
      sections.push(
        new Paragraph({
          text: 'Recommendations',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        })
      )
      aiEnhancements.recommendations.forEach((rec, idx) => {
        sections.push(
          new Paragraph({
            text: `${idx + 1}. ${rec}`,
            spacing: { after: 100 }
          })
        )
      })
    }

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: sections
      }]
    })

    // Generate and download
    const blob = await Packer.toBlob(doc)
    this.downloadFile(blob, `${data.title || 'report'}.docx`)
  }

  /**
   * Generate PDF document
   */
  private static async generatePDF(options: ReportOptions): Promise<void> {
    const { frameworkType, frameworkTitle, data, aiEnhancements } = options
    const pdf = new jsPDF()

    let yPos = 20

    // Get item type from config
    const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'
    const isQA = itemType === 'qa'

    // Helper function to check page break
    const checkPageBreak = (requiredSpace: number = 20) => {
      if (yPos > 280 - requiredSpace) {
        pdf.addPage()
        yPos = 20
      }
    }

    // Title
    pdf.setFontSize(20)
    pdf.text(`${frameworkTitle} Analysis Report`, 105, yPos, { align: 'center' })
    yPos += 15

    // Metadata
    pdf.setFontSize(11)
    pdf.text(`Title: ${data.title || 'Untitled Analysis'}`, 20, yPos)
    yPos += 7
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos)
    yPos += 7
    pdf.text(`Framework: ${frameworkTitle}`, 20, yPos)
    yPos += 7

    // Source URL (if available)
    if (data.source_url) {
      const urlText = `Source: ${data.source_url}`
      const urlLines = pdf.splitTextToSize(urlText, 170)
      pdf.text(urlLines, 20, yPos)
      yPos += urlLines.length * 7
    }

    yPos += 8

    // Unanswered Questions Summary (for Q&A frameworks)
    if (isQA) {
      const config = frameworkConfigs[frameworkType]
      const unansweredBySection: Record<string, number> = {}
      let totalUnanswered = 0

      if (config?.sections) {
        config.sections.forEach(section => {
          if (data[section.key] && data[section.key].length > 0) {
            const unanswered = data[section.key].filter((item: FrameworkItem) =>
              isQuestionAnswerItem(item) && (!item.answer || item.answer.trim() === '')
            ).length
            if (unanswered > 0) {
              unansweredBySection[section.label] = unanswered
              totalUnanswered += unanswered
            }
          }
        })
      }

      if (totalUnanswered > 0) {
        checkPageBreak(30)
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(200, 50, 50) // Red color
        pdf.text('⚠️ Unanswered Questions Summary', 20, yPos)
        yPos += 10

        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(0, 0, 0) // Reset to black
        pdf.text(`Total unanswered questions: ${totalUnanswered}`, 20, yPos)
        yPos += 8

        Object.entries(unansweredBySection).forEach(([label, count]) => {
          pdf.text(`• ${label}: ${count} unanswered`, 25, yPos)
          yPos += 6
        })
        yPos += 10
        pdf.setTextColor(0, 0, 0) // Reset to black
      }
    }

    // Executive Summary
    if (aiEnhancements?.executiveSummary) {
      checkPageBreak(30)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Executive Summary', 20, yPos)
      yPos += 10

      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'normal')
      const summaryLines = pdf.splitTextToSize(aiEnhancements.executiveSummary, 170)
      pdf.text(summaryLines, 20, yPos)
      yPos += (summaryLines.length * 7) + 10
    }

    // Framework Sections
    const config = frameworkConfigs[frameworkType]
    if (config?.sections) {
      config.sections.forEach(section => {
        if (data[section.key] && data[section.key].length > 0) {
          checkPageBreak(20)

          // Section header
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          pdf.text(`${section.label}`, 20, yPos)
          yPos += 10

          pdf.setFontSize(11)
          pdf.setFont('helvetica', 'normal')

          // Sort items: answered questions first for Q&A frameworks
          let sectionItems = [...data[section.key]]
          if (isQA) {
            sectionItems.sort((a: FrameworkItem, b: FrameworkItem) => {
              if (!isQuestionAnswerItem(a) || !isQuestionAnswerItem(b)) return 0
              const aAnswered = a.answer && a.answer.trim() !== ''
              const bAnswered = b.answer && b.answer.trim() !== ''
              if (aAnswered && !bAnswered) return -1
              if (!aAnswered && bAnswered) return 1
              return 0
            })
          }

          // Section items
          sectionItems.forEach((item: FrameworkItem, idx: number) => {
            if (isQA && isQuestionAnswerItem(item)) {
              // Q&A format
              checkPageBreak(15)

              const isAnswered = item.answer && item.answer.trim() !== ''

              pdf.setFont('helvetica', 'bold')
              const questionText = `Q: ${item.question}`
              const questionLines = pdf.splitTextToSize(questionText, 165)
              pdf.text(questionLines, 25, yPos)
              yPos += questionLines.length * 6

              pdf.setFont('helvetica', isAnswered ? 'normal' : 'italic')
              if (!isAnswered) {
                pdf.setTextColor(150, 150, 150) // Gray for unanswered
              }
              const answerText = `   A: ${item.answer || 'No answer provided'}`
              const answerLines = pdf.splitTextToSize(answerText, 160)
              pdf.text(answerLines, 30, yPos)
              yPos += answerLines.length * 6 + 4
              pdf.setTextColor(0, 0, 0) // Reset to black
            } else {
              // Text format
              checkPageBreak(10)

              const text = 'text' in item ? item.text : (item as any).question || ''
              const itemText = `${idx + 1}. ${text}`
              const itemLines = pdf.splitTextToSize(itemText, 165)
              pdf.text(itemLines, 25, yPos)
              yPos += itemLines.length * 6 + 2
            }
          })

          yPos += 8
        }
      })
    }

    // Key Insights
    if (aiEnhancements?.keyInsights && aiEnhancements.keyInsights.length > 0) {
      checkPageBreak(30)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Key Insights', 20, yPos)
      yPos += 10

      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'normal')
      aiEnhancements.keyInsights.forEach((insight, idx) => {
        checkPageBreak(10)
        const insightText = `${idx + 1}. ${insight}`
        const insightLines = pdf.splitTextToSize(insightText, 165)
        pdf.text(insightLines, 25, yPos)
        yPos += insightLines.length * 6 + 2
      })
      yPos += 8
    }

    // Recommendations
    if (aiEnhancements?.recommendations && aiEnhancements.recommendations.length > 0) {
      checkPageBreak(30)
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Recommendations', 20, yPos)
      yPos += 10

      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'normal')
      aiEnhancements.recommendations.forEach((rec, idx) => {
        checkPageBreak(10)
        const recText = `${idx + 1}. ${rec}`
        const recLines = pdf.splitTextToSize(recText, 165)
        pdf.text(recLines, 25, yPos)
        yPos += recLines.length * 6 + 2
      })
    }

    // Save PDF
    pdf.save(`${data.title || 'report'}.pdf`)
  }

  /**
   * Generate PowerPoint presentation
   */
  private static async generatePowerPoint(options: ReportOptions): Promise<void> {
    const { frameworkType, frameworkTitle, data, aiEnhancements } = options
    const pptx = new pptxgen()

    // Get item type from config
    const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'
    const isQA = itemType === 'qa'

    // Title Slide
    const titleSlide = pptx.addSlide()
    titleSlide.addText(`${frameworkTitle} Analysis`, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1,
      fontSize: 40,
      bold: true,
      align: 'center'
    })
    titleSlide.addText(data.title || 'Analysis Report', {
      x: 0.5,
      y: 2.8,
      w: 9,
      h: 0.5,
      fontSize: 24,
      align: 'center'
    })
    titleSlide.addText(new Date().toLocaleDateString(), {
      x: 0.5,
      y: 4.5,
      w: 9,
      h: 0.3,
      fontSize: 14,
      align: 'center',
      color: '666666'
    })

    // Source URL (if available)
    if (data.source_url) {
      titleSlide.addText(`Source: ${data.source_url}`, {
        x: 0.5,
        y: 5.0,
        w: 9,
        h: 0.3,
        fontSize: 12,
        align: 'center',
        color: '0066CC'
      })
    }

    // Executive Summary Slide (if AI enhanced)
    if (aiEnhancements?.executiveSummary) {
      const summarySlide = pptx.addSlide()
      summarySlide.addText('Executive Summary', {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.75,
        fontSize: 32,
        bold: true
      })
      summarySlide.addText(aiEnhancements.executiveSummary, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 4,
        fontSize: 18
      })
    }

    // Unanswered Questions Summary Slide (for Q&A frameworks)
    if (isQA) {
      const config = frameworkConfigs[frameworkType]
      const unansweredBySection: Record<string, number> = {}
      let totalUnanswered = 0

      if (config?.sections) {
        config.sections.forEach(section => {
          if (data[section.key] && data[section.key].length > 0) {
            const unanswered = data[section.key].filter((item: FrameworkItem) =>
              isQuestionAnswerItem(item) && (!item.answer || item.answer.trim() === '')
            ).length
            if (unanswered > 0) {
              unansweredBySection[section.label] = unanswered
              totalUnanswered += unanswered
            }
          }
        })
      }

      if (totalUnanswered > 0) {
        const summarySlide = pptx.addSlide()
        summarySlide.addText('⚠️ Unanswered Questions Summary', {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.75,
          fontSize: 32,
          bold: true,
          color: 'C83232'
        })
        summarySlide.addText(`Total unanswered questions: ${totalUnanswered}`, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 0.4,
          fontSize: 18,
          bold: true
        })

        let yPos = 2.1
        Object.entries(unansweredBySection).forEach(([label, count]) => {
          summarySlide.addText(`• ${label}: ${count} unanswered`, {
            x: 0.5,
            y: yPos,
            w: 9,
            h: 0.35,
            fontSize: 16
          })
          yPos += 0.4
        })
      }
    }

    // Framework Sections
    const config = frameworkConfigs[frameworkType]
    if (config?.sections) {
      config.sections.forEach(section => {
        if (data[section.key] && data[section.key].length > 0) {
          // Sort items: answered questions first for Q&A frameworks
          let items = [...data[section.key]]
          if (isQA) {
            items.sort((a: FrameworkItem, b: FrameworkItem) => {
              if (!isQuestionAnswerItem(a) || !isQuestionAnswerItem(b)) return 0
              const aAnswered = a.answer && a.answer.trim() !== ''
              const bAnswered = b.answer && b.answer.trim() !== ''
              if (aAnswered && !bAnswered) return -1
              if (!aAnswered && bAnswered) return 1
              return 0
            })
          }

          // Split items across multiple slides if needed (max 5-6 items per slide)
          const itemsPerSlide = isQA ? 3 : 6
          const numSlides = Math.ceil(items.length / itemsPerSlide)

          for (let slideNum = 0; slideNum < numSlides; slideNum++) {
            const slide = pptx.addSlide()
            const slideItems = items.slice(slideNum * itemsPerSlide, (slideNum + 1) * itemsPerSlide)

            // Section header
            const slideTitle = numSlides > 1
              ? `${section.label} (${slideNum + 1}/${numSlides})`
              : section.label

            slide.addText(slideTitle, {
              x: 0.5,
              y: 0.5,
              w: 9,
              h: 0.6,
              fontSize: 32,
              bold: true,
              color: '1F4788'
            })

            // Items
            let yPos = 1.3
            slideItems.forEach((item: FrameworkItem, idx: number) => {
              if (isQA && isQuestionAnswerItem(item)) {
                // Q&A format
                const isAnswered = item.answer && item.answer.trim() !== ''
                slide.addText(`Q: ${item.question}`, {
                  x: 0.5,
                  y: yPos,
                  w: 9,
                  h: 0.4,
                  fontSize: 16,
                  bold: true,
                  color: '333333'
                })
                yPos += 0.4

                slide.addText(`A: ${item.answer || 'No answer provided'}`, {
                  x: 0.8,
                  y: yPos,
                  w: 8.7,
                  h: 0.5,
                  fontSize: 14,
                  color: isAnswered ? '666666' : '999999',
                  italic: !isAnswered
                })
                yPos += 0.7
              } else {
                // Text format
                const text = 'text' in item ? item.text : (item as any).question || ''
                slide.addText(`${(slideNum * itemsPerSlide) + idx + 1}. ${text}`, {
                  x: 0.5,
                  y: yPos,
                  w: 9,
                  h: 0.5,
                  fontSize: 16,
                  color: '333333',
                  bullet: false
                })
                yPos += 0.6
              }
            })
          }
        }
      })
    }

    // Key Insights Slide
    if (aiEnhancements?.keyInsights && aiEnhancements.keyInsights.length > 0) {
      const insightsSlide = pptx.addSlide()
      insightsSlide.addText('Key Insights', {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: '1F4788'
      })

      let yPos = 1.3
      aiEnhancements.keyInsights.forEach((insight, idx) => {
        insightsSlide.addText(`${idx + 1}. ${insight}`, {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 0.5,
          fontSize: 16,
          color: '333333'
        })
        yPos += 0.6
      })
    }

    // Recommendations Slide
    if (aiEnhancements?.recommendations && aiEnhancements.recommendations.length > 0) {
      const recsSlide = pptx.addSlide()
      recsSlide.addText('Recommendations', {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: '1F4788'
      })

      let yPos = 1.3
      aiEnhancements.recommendations.forEach((rec, idx) => {
        recsSlide.addText(`${idx + 1}. ${rec}`, {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 0.5,
          fontSize: 16,
          color: '333333'
        })
        yPos += 0.6
      })
    }

    // Save presentation
    pptx.writeFile({ fileName: `${data.title || 'report'}.pptx` })
  }

  /**
   * Generate CSV export
   */
  private static generateCSV(options: ReportOptions): void {
    const { frameworkType, data } = options

    const rows: any[] = []

    // Add header row
    rows.push(['Framework Type', frameworkType])
    rows.push(['Title', data.title || 'Untitled'])
    rows.push(['Description', data.description || ''])
    rows.push(['Date', new Date().toLocaleDateString()])
    if (data.source_url) {
      rows.push(['Source URL', data.source_url])
    }
    rows.push([]) // Empty row

    // Check if this framework uses Q&A format
    const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'
    const isQA = itemType === 'qa'

    // Add framework-specific data
    if (frameworkType === 'swot') {
      rows.push(['Category', 'Item'])
      data.strengths?.forEach((item: any) => rows.push(['Strength', item.text]))
      data.weaknesses?.forEach((item: any) => rows.push(['Weakness', item.text]))
      data.opportunities?.forEach((item: any) => rows.push(['Opportunity', item.text]))
      data.threats?.forEach((item: any) => rows.push(['Threat', item.text]))
    } else if (isQA) {
      // Q&A format export
      rows.push(['Section', 'Question', 'Answer', 'Status'])

      const config = frameworkConfigs[frameworkType]
      if (config?.sections) {
        config.sections.forEach(section => {
          if (data[section.key] && data[section.key].length > 0) {
            // Sort items: answered questions first
            let items = [...data[section.key]]
            items.sort((a: FrameworkItem, b: FrameworkItem) => {
              if (!isQuestionAnswerItem(a) || !isQuestionAnswerItem(b)) return 0
              const aAnswered = a.answer && a.answer.trim() !== ''
              const bAnswered = b.answer && b.answer.trim() !== ''
              if (aAnswered && !bAnswered) return -1
              if (!aAnswered && bAnswered) return 1
              return 0
            })

            items.forEach((item: FrameworkItem) => {
              if (isQuestionAnswerItem(item)) {
                const isAnswered = item.answer && item.answer.trim() !== ''
                rows.push([
                  section.label,
                  item.question,
                  item.answer || 'No answer provided',
                  isAnswered ? 'Answered' : 'Unanswered'
                ])
              } else {
                const text = 'text' in item ? item.text : (item as any).question || ''
                rows.push([section.label, text, '', 'N/A'])
              }
            })
          }
        })
      }
    } else {
      // Generic text export
      rows.push(['Section', 'Item'])
      Object.keys(data).forEach(key => {
        if (Array.isArray(data[key])) {
          data[key].forEach((item: any) => {
            rows.push([key.toUpperCase(), item.text || item])
          })
        }
      })
    }

    // Convert to CSV and download
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    this.downloadFile(blob, `${data.title || 'report'}.csv`)
  }

  /**
   * Get framework-specific content for Word document
   */
  private static getFrameworkContent(options: ReportOptions): Paragraph[] {
    const { frameworkType, data } = options
    const paragraphs: Paragraph[] = []

    // Check if this framework uses Q&A format
    const itemType = frameworkConfigs[frameworkType]?.itemType || 'text'
    const isQA = itemType === 'qa'

    if (frameworkType === 'swot') {
      const sections = [
        { key: 'strengths', label: 'Strengths', icon: '💪' },
        { key: 'weaknesses', label: 'Weaknesses', icon: '⚠️' },
        { key: 'opportunities', label: 'Opportunities', icon: '🎯' },
        { key: 'threats', label: 'Threats', icon: '⚡' }
      ]

      sections.forEach(section => {
        if (data[section.key] && data[section.key].length > 0) {
          paragraphs.push(
            new Paragraph({
              text: `${section.icon} ${section.label}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 150 }
            })
          )

          data[section.key].forEach((item: any) => {
            paragraphs.push(
              new Paragraph({
                text: `• ${item.text}`,
                spacing: { after: 100 },
                indent: { left: 360 }
              })
            )
          })
        }
      })
    } else if (frameworkType === 'stakeholder') {
      // Stakeholder Analysis - Enhanced Export with Engagement Plans
      paragraphs.push(
        new Paragraph({
          text: 'Stakeholder Power/Interest Matrix',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        })
      )

      const sections = [
        {
          key: 'high_power_high_interest',
          label: '👑 Key Players (High Power, High Interest)',
          strategy: 'MANAGE CLOSELY',
          tactics: [
            'Schedule regular 1-on-1 meetings and personal engagement',
            'Involve directly in major decision-making processes',
            'Build strong, trust-based relationships',
            'Seek input on strategy and provide early visibility',
            'Respond immediately to concerns or requests'
          ]
        },
        {
          key: 'high_power_low_interest',
          label: '🤝 Keep Satisfied (High Power, Low Interest)',
          strategy: 'KEEP SATISFIED',
          tactics: [
            'Provide monthly progress updates and status reports',
            'Address concerns proactively before they escalate',
            'Keep informed but avoid over-engagement',
            'Monitor for changes in interest level or position',
            'Ensure their needs are met without excessive demands'
          ]
        },
        {
          key: 'low_power_high_interest',
          label: '📢 Keep Informed (Low Power, High Interest)',
          strategy: 'KEEP INFORMED',
          tactics: [
            'Send regular newsletters and project updates',
            'Leverage as advocates and champions for the initiative',
            'Consult on relevant issues where their expertise helps',
            'Build grassroots support and coalition',
            'Provide opportunities for meaningful participation'
          ]
        },
        {
          key: 'low_power_low_interest',
          label: '👥 Monitor (Low Power, Low Interest)',
          strategy: 'MONITOR',
          tactics: [
            'Include in periodic broad communications only',
            'Apply minimal engagement effort',
            'Watch for changes in power or interest status',
            'Keep on distribution lists for awareness',
            'Respond to inquiries but don\'t proactively engage'
          ]
        }
      ]

      sections.forEach(section => {
        const stakeholders = data[section.key] || []
        if (stakeholders.length > 0) {
          paragraphs.push(
            new Paragraph({
              text: section.label,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 150 }
            })
          )

          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `Strategy: ${section.strategy}`, bold: true })],
              spacing: { after: 100 },
              indent: { left: 360 }
            })
          )

          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `Stakeholder Count: ${stakeholders.length}`, italics: true })],
              spacing: { after: 150 },
              indent: { left: 360 }
            })
          )

          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: 'Engagement Tactics:', bold: true })],
              spacing: { after: 100 },
              indent: { left: 360 }
            })
          )

          section.tactics.forEach((tactic: string) => {
            paragraphs.push(
              new Paragraph({
                text: `• ${tactic}`,
                spacing: { after: 80 },
                indent: { left: 720 }
              })
            )
          })

          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: 'Stakeholders:', bold: true })],
              spacing: { before: 150, after: 100 },
              indent: { left: 360 }
            })
          )

          stakeholders.forEach((item: any) => {
            const text = item.text || item.name || 'Unnamed stakeholder'
            paragraphs.push(
              new Paragraph({
                text: `• ${text}`,
                spacing: { after: 80 },
                indent: { left: 720 }
              })
            )
          })

          paragraphs.push(new Paragraph({ text: '', spacing: { after: 200 } }))
        }
      })

      // Summary Section
      const totalStakeholders = (data.high_power_high_interest?.length || 0) +
                               (data.high_power_low_interest?.length || 0) +
                               (data.low_power_high_interest?.length || 0) +
                               (data.low_power_low_interest?.length || 0)
      const highPriority = (data.high_power_high_interest?.length || 0) +
                          (data.high_power_low_interest?.length || 0)

      paragraphs.push(
        new Paragraph({
          text: 'Stakeholder Engagement Summary',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 400, after: 200 }
        })
      )

      paragraphs.push(
        new Paragraph({
          text: `• Total Stakeholders Identified: ${totalStakeholders}`,
          spacing: { after: 100 },
          indent: { left: 360 }
        })
      )

      paragraphs.push(
        new Paragraph({
          text: `• High Priority (Requiring Active Management): ${highPriority} stakeholders`,
          spacing: { after: 100 },
          indent: { left: 360 }
        })
      )

      paragraphs.push(
        new Paragraph({
          text: `• Key Players (Top Priority): ${data.high_power_high_interest?.length || 0} stakeholders`,
          spacing: { after: 100 },
          indent: { left: 360 }
        })
      )

      paragraphs.push(
        new Paragraph({
          text: `• Potential Advocates: ${data.low_power_high_interest?.length || 0} stakeholders`,
          spacing: { after: 100 },
          indent: { left: 360 }
        })
      )
    } else if (frameworkType === 'behavior') {
      // Behavior Analysis Framework with BCW (Behaviour Change Wheel) recommendations

      // Add COM-B Assessment if available
      if (data.com_b_deficits) {
        const deficits = data.com_b_deficits as ComBDeficits

        paragraphs.push(
          new Paragraph({
            text: '🎯 COM-B Assessment Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          })
        )

        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: 'Capability, Opportunity, Motivation → Behavior (Michie et al., 2011)', italics: true })],
            spacing: { after: 300 }
          })
        )

        // Count deficits by severity
        const deficitCounts = {
          major_barrier: Object.values(deficits).filter((d) => d === 'major_barrier').length,
          deficit: Object.values(deficits).filter((d) => d === 'deficit').length,
          adequate: Object.values(deficits).filter((d) => d === 'adequate').length,
        }

        paragraphs.push(
          new Paragraph({
            text: `✓ Adequate: ${deficitCounts.adequate} components`,
            spacing: { after: 100 },
            indent: { left: 360 }
          })
        )
        paragraphs.push(
          new Paragraph({
            text: `⚠ Deficit: ${deficitCounts.deficit} components`,
            spacing: { after: 100 },
            indent: { left: 360 }
          })
        )
        paragraphs.push(
          new Paragraph({
            text: `✖ Major Barrier: ${deficitCounts.major_barrier} components`,
            spacing: { after: 300 },
            indent: { left: 360 }
          })
        )

        // Component-by-component breakdown
        paragraphs.push(
          new Paragraph({
            text: 'Component Status Breakdown',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 150 }
          })
        )

        const componentNames: Record<string, { label: string; icon: string }> = {
          physical_capability: { label: 'Physical Capability', icon: '💪' },
          psychological_capability: { label: 'Psychological Capability', icon: '🧠' },
          physical_opportunity: { label: 'Physical Opportunity', icon: '🌍' },
          social_opportunity: { label: 'Social Opportunity', icon: '👥' },
          reflective_motivation: { label: 'Reflective Motivation', icon: '🎯' },
          automatic_motivation: { label: 'Automatic Motivation', icon: '⚡' },
        }

        Object.entries(deficits).forEach(([component, level]) => {
          const info = componentNames[component as keyof typeof componentNames]
          const statusText = level === 'major_barrier' ? '✖ Major Barrier' : level === 'deficit' ? '⚠ Deficit' : '✓ Adequate'

          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${info.icon} ${info.label}: `, bold: true }),
                new TextRun({ text: statusText })
              ],
              spacing: { after: 100 },
              indent: { left: 360 }
            })
          )
        })

        // Feasibility Assessment
        const feasibility = assessBehaviorChangeFeasibility(deficits)

        paragraphs.push(
          new Paragraph({
            text: 'Behavior Change Feasibility',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 400, after: 150 }
          })
        )

        const feasibilityText = feasibility.feasibility.charAt(0).toUpperCase() + feasibility.feasibility.slice(1)
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Overall Feasibility: ', bold: true }),
              new TextRun({ text: feasibilityText })
            ],
            spacing: { after: 200 },
            indent: { left: 360 }
          })
        )

        if (feasibility.barriers.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: 'Barriers Identified:', bold: true })],
              spacing: { after: 100 },
              indent: { left: 360 }
            })
          )
          feasibility.barriers.forEach((barrier) => {
            paragraphs.push(
              new Paragraph({
                text: `• ${barrier}`,
                spacing: { after: 80 },
                indent: { left: 720 }
              })
            )
          })
        }

        if (feasibility.strengths.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: 'Strengths:', bold: true })],
              spacing: { before: 150, after: 100 },
              indent: { left: 360 }
            })
          )
          feasibility.strengths.forEach((strength) => {
            paragraphs.push(
              new Paragraph({
                text: `• ${strength}`,
                spacing: { after: 80 },
                indent: { left: 720 }
              })
            )
          })
        }

        // Intervention Recommendations
        const interventionRecs = generateInterventionRecommendations(deficits)

        if (interventionRecs.length > 0) {
          paragraphs.push(
            new Paragraph({
              text: 'Recommended Intervention Functions',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            })
          )

          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: 'Based on the Behaviour Change Wheel (Michie et al., 2011)', italics: true })],
              spacing: { after: 300 }
            })
          )

          interventionRecs.forEach((rec) => {
            paragraphs.push(
              new Paragraph({
                text: `${rec.component} (${rec.severity.replace('_', ' ').toUpperCase()})`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 300, after: 150 }
              })
            )

            rec.interventions.forEach((intervention) => {
              const info = INTERVENTION_DESCRIPTIONS[intervention.name]
              const priorityText = intervention.priority.toUpperCase()

              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${intervention.name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} [${priorityText} PRIORITY]`,
                      bold: true
                    })
                  ],
                  spacing: { before: 150, after: 100 },
                  indent: { left: 360 }
                })
              )

              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Definition: ', bold: true }),
                    new TextRun({ text: info.definition })
                  ],
                  spacing: { after: 100 },
                  indent: { left: 720 }
                })
              )

              paragraphs.push(
                new Paragraph({
                  children: [new TextRun({ text: 'Evidence Base:', bold: true })],
                  spacing: { after: 80 },
                  indent: { left: 720 }
                })
              )

              paragraphs.push(
                new Paragraph({
                  children: [new TextRun({ text: intervention.evidence_base, italics: true })],
                  spacing: { after: 150 },
                  indent: { left: 720 }
                })
              )
            })
          })
        }

        // Policy Recommendations (if interventions selected)
        if (data.selected_interventions && data.selected_interventions.length > 0) {
          const policyRecs = generatePolicyRecommendations(data.selected_interventions as InterventionFunction[])

          if (policyRecs.length > 0) {
            paragraphs.push(
              new Paragraph({
                text: 'Policy Category Recommendations',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 }
              })
            )

            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: `${policyRecs.length} policy categories support the selected intervention functions`, italics: true })],
                spacing: { after: 300 }
              })
            )

            policyRecs.forEach((policy) => {
              paragraphs.push(
                new Paragraph({
                  text: policy.name,
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 300, after: 150 }
                })
              )

              paragraphs.push(
                new Paragraph({
                  text: policy.description,
                  spacing: { after: 150 },
                  indent: { left: 360 }
                })
              )

              paragraphs.push(
                new Paragraph({
                  children: [new TextRun({ text: 'Examples:', bold: true })],
                  spacing: { after: 100 },
                  indent: { left: 360 }
                })
              )

              policy.examples.forEach((example) => {
                paragraphs.push(
                  new Paragraph({
                    text: `• ${example}`,
                    spacing: { after: 80 },
                    indent: { left: 720 }
                  })
                )
              })
            })
          }
        }
      }

      // Add regular framework sections (timeline, barriers, etc.)
      const config = frameworkConfigs[frameworkType]
      if (config?.sections) {
        paragraphs.push(
          new Paragraph({
            text: 'Detailed Analysis',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          })
        )

        config.sections.forEach(section => {
          // Skip COM-B component sections as they're already covered in assessment
          if (section.key.includes('capability') || section.key.includes('opportunity') || section.key.includes('motivation')) {
            return
          }

          if (data[section.key] && data[section.key].length > 0) {
            paragraphs.push(
              new Paragraph({
                text: `${section.icon || ''} ${section.label}`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 300, after: 150 }
              })
            )

            data[section.key].forEach((item: any) => {
              const text = item.text || item.title || JSON.stringify(item)
              paragraphs.push(
                new Paragraph({
                  text: `• ${text}`,
                  spacing: { after: 100 },
                  indent: { left: 360 }
                })
              )
            })
          }
        })
      }
    } else {
      // Generic framework content (supports Q&A)
      const config = frameworkConfigs[frameworkType]
      if (config?.sections) {
        config.sections.forEach(section => {
          if (data[section.key] && data[section.key].length > 0) {
            paragraphs.push(
              new Paragraph({
                text: `${section.icon || ''} ${section.label}`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 300, after: 150 }
              })
            )

            // Sort items: answered questions first for Q&A frameworks
            let sectionItems = [...data[section.key]]
            if (isQA) {
              sectionItems.sort((a: FrameworkItem, b: FrameworkItem) => {
                if (!isQuestionAnswerItem(a) || !isQuestionAnswerItem(b)) return 0
                const aAnswered = a.answer && a.answer.trim() !== ''
                const bAnswered = b.answer && b.answer.trim() !== ''
                if (aAnswered && !bAnswered) return -1
                if (!aAnswered && bAnswered) return 1
                return 0
              })
            }

            sectionItems.forEach((item: FrameworkItem) => {
              if (isQA && isQuestionAnswerItem(item)) {
                // Q&A format
                const isAnswered = item.answer && item.answer.trim() !== ''
                paragraphs.push(
                  new Paragraph({
                    text: `Q: ${item.question}`,
                    spacing: { after: 50 },
                    indent: { left: 360 },
                    bullet: { level: 0 }
                  })
                )
                paragraphs.push(
                  new Paragraph({
                    children: [new TextRun({
                      text: `A: ${item.answer || 'No answer provided'}`,
                      italics: !isAnswered,
                      color: isAnswered ? '000000' : '999999'
                    })],
                    spacing: { after: 100 },
                    indent: { left: 720 }
                  })
                )
              } else {
                // Text format
                const text = 'text' in item ? item.text : (item as any).question || ''
                paragraphs.push(
                  new Paragraph({
                    text: `• ${text}`,
                    spacing: { after: 100 },
                    indent: { left: 360 }
                  })
                )
              }
            })
          }
        })
      }
    }

    return paragraphs
  }

  /**
   * Download a file
   */
  private static downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    console.log(`✓ Downloaded: ${filename}`)
  }
}
