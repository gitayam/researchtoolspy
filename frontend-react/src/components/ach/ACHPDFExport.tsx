import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ACHAnalysis, ACHHypothesis, ACHEvidenceLink, ACHScore } from '@/types/ach'
import { useState } from 'react'
import { calculateAllDiagnosticity, calculateHypothesisLikelihoods } from '@/lib/ach-diagnosticity'

interface ACHPDFExportProps {
  analysis: ACHAnalysis
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function ACHPDFExport({
  analysis,
  variant = 'outline',
  size = 'default',
  className
}: ACHPDFExportProps) {
  const [exporting, setExporting] = useState(false)

  const formatScore = (score: number): string => {
    if (score > 0) return `+${score}`
    return score.toString()
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 3) return 'Strongly Supports'
    if (score >= 1) return 'Supports'
    if (score === 0) return 'Neutral'
    if (score >= -2) return 'Contradicts'
    return 'Strongly Contradicts'
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      })

      const hypotheses = analysis.hypotheses || []
      const evidence = analysis.evidence || []
      const scores = analysis.scores || []

      // Calculate analytics
      const diagnosticity = calculateAllDiagnosticity(evidence, scores, hypotheses)
      const likelihoods = calculateHypothesisLikelihoods(hypotheses, scores, evidence)

      // Define colors and styles
      const colors = {
        primary: [30, 58, 138] as [number, number, number], // Navy blue
        secondary: [100, 116, 139] as [number, number, number], // Slate
        accent: [239, 68, 68] as [number, number, number], // Red
        success: [34, 197, 94] as [number, number, number], // Green
        warning: [245, 158, 11] as [number, number, number], // Orange
        text: [31, 41, 55] as [number, number, number], // Gray-800
        light: [249, 250, 251] as [number, number, number], // Gray-50
      }

      let currentY = 20
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20

      // Helper function to add new page with header/footer
      const addNewPage = () => {
        pdf.addPage()
        currentY = 20
        addPageNumber()
      }

      // Helper function to add page number
      const addPageNumber = () => {
        const pageNum = pdf.internal.pages.length - 1
        if (pageNum > 1) {
          pdf.setFontSize(9)
          pdf.setTextColor(100, 116, 139)
          pdf.text(`Page ${pageNum}`, pageWidth - margin - 10, pageHeight - 10)
        }
      }

      // Helper function to check if we need a new page
      const checkNewPage = (neededSpace: number) => {
        if (currentY + neededSpace > pageHeight - 30) {
          addNewPage()
          return true
        }
        return false
      }

      // ===== COVER PAGE =====
      pdf.setFillColor(...colors.primary)
      pdf.rect(0, 0, pageWidth, 80, 'F')

      pdf.setFontSize(24)
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.text('ANALYSIS OF COMPETING', pageWidth / 2, 35, { align: 'center' })
      pdf.text('HYPOTHESES (ACH)', pageWidth / 2, 50, { align: 'center' })

      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'normal')
      pdf.text(analysis.title, pageWidth / 2, 65, { align: 'center' })

      // Metadata
      currentY = 100
      pdf.setFontSize(12)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Classification:', margin, currentY)
      pdf.setFont('helvetica', 'normal')
      pdf.text('UNCLASSIFIED', margin + 50, currentY)

      currentY += 10
      pdf.setFont('helvetica', 'bold')
      pdf.text('Date:', margin, currentY)
      pdf.setFont('helvetica', 'normal')
      pdf.text(new Date(analysis.created_at).toLocaleDateString(), margin + 50, currentY)

      currentY += 10
      pdf.setFont('helvetica', 'bold')
      pdf.text('Analyst:', margin, currentY)
      pdf.setFont('helvetica', 'normal')
      pdf.text(analysis.analyst || 'Not specified', margin + 50, currentY)

      currentY += 10
      pdf.setFont('helvetica', 'bold')
      pdf.text('Scale Type:', margin, currentY)
      pdf.setFont('helvetica', 'normal')
      pdf.text(analysis.scale_type.toUpperCase(), margin + 50, currentY)

      currentY += 10
      pdf.setFont('helvetica', 'bold')
      pdf.text('Status:', margin, currentY)
      pdf.setFont('helvetica', 'normal')
      pdf.text(analysis.status.toUpperCase(), margin + 50, currentY)

      // Disclaimer
      currentY = pageHeight - 60
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      pdf.setFont('helvetica', 'italic')
      const disclaimer = 'This document is generated for analytical purposes. ACH is designed to mitigate cognitive biases and identify the most likely hypothesis based on evidence.'
      pdf.text(disclaimer, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 40 })

      currentY = pageHeight - 40
      pdf.setFontSize(8)
      pdf.text('Generated by ACH Analysis Tool', pageWidth / 2, currentY, { align: 'center' })
      pdf.text('https://github.com/gitayam/researchtoolspy', pageWidth / 2, currentY + 5, { align: 'center' })

      // ===== PAGE 2: EXECUTIVE SUMMARY =====
      addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('EXECUTIVE SUMMARY', margin, currentY)
      currentY += 12

      pdf.setFontSize(11)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'normal')

      const execSummary = `This Analysis of Competing Hypotheses (ACH) evaluates ${hypotheses.length} competing hypotheses against ${evidence.length} pieces of evidence to answer the intelligence question. ACH methodology systematically evaluates all hypotheses simultaneously to identify which is least contradicted by the evidence, rather than seeking confirmation of a preferred hypothesis.`

      const lines = pdf.splitTextToSize(execSummary, pageWidth - 2 * margin)
      pdf.text(lines, margin, currentY)
      currentY += (lines.length * 6) + 8

      // Key Statistics
      pdf.setFont('helvetica', 'bold')
      pdf.text('KEY STATISTICS', margin, currentY)
      currentY += 8

      const stats = [
        ['Hypotheses Evaluated:', hypotheses.length.toString()],
        ['Evidence Items:', evidence.length.toString()],
        ['Total Assessments:', scores.length.toString()],
        ['Most Likely Hypothesis:', likelihoods[0]?.hypothesis.substring(0, 40) + '...' || 'N/A'],
      ]

      pdf.setFont('helvetica', 'normal')
      stats.forEach(([label, value]) => {
        pdf.text(label, margin + 5, currentY)
        pdf.setFont('helvetica', 'bold')
        pdf.text(value, margin + 70, currentY)
        pdf.setFont('helvetica', 'normal')
        currentY += 6
      })

      currentY += 8

      // Top Diagnostic Evidence
      pdf.setFont('helvetica', 'bold')
      pdf.text('TOP 5 DIAGNOSTIC EVIDENCE (Most Differentiating)', margin, currentY)
      currentY += 8

      const top5Diagnostic = diagnosticity.slice(0, 5)

      pdf.setFont('helvetica', 'normal')
      top5Diagnostic.forEach((diag, idx) => {
        const scoreColor: [number, number, number] = diag.score >= 80 ? colors.success :
                      diag.score >= 50 ? colors.warning :
                      colors.secondary

        pdf.setTextColor(...scoreColor)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`${idx + 1}.`, margin + 5, currentY)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'normal')

        const diagText = pdf.splitTextToSize(diag.evidenceTitle, pageWidth - 2 * margin - 30)
        pdf.text(diagText, margin + 12, currentY)

        pdf.setFont('helvetica', 'bold')
        pdf.text(`${diag.score.toFixed(0)}%`, pageWidth - margin - 30, currentY)

        currentY += Math.max(diagText.length * 5, 5) + 3

        if (checkNewPage(20)) {
          pdf.setFont('helvetica', 'normal')
        }
      })

      // ===== PAGE 3: INTELLIGENCE QUESTION =====
      checkNewPage(100) || addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('INTELLIGENCE QUESTION', margin, currentY)
      currentY += 12

      pdf.setFontSize(12)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'normal')

      const questionLines = pdf.splitTextToSize(analysis.question, pageWidth - 2 * margin)
      pdf.text(questionLines, margin, currentY)
      currentY += (questionLines.length * 6) + 10

      if (analysis.description) {
        pdf.setFont('helvetica', 'bold')
        pdf.text('BACKGROUND:', margin, currentY)
        currentY += 7

        pdf.setFont('helvetica', 'normal')
        const descLines = pdf.splitTextToSize(analysis.description, pageWidth - 2 * margin)
        pdf.text(descLines, margin, currentY)
        currentY += (descLines.length * 5) + 10
      }

      // ===== HYPOTHESIS LIKELIHOOD RANKING =====
      checkNewPage(80) || addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('HYPOTHESIS LIKELIHOOD RANKING', margin, currentY)
      currentY += 12

      pdf.setFontSize(10)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'italic')
      pdf.text('Note: The hypothesis with the LEAST contradictory evidence is typically most likely.', margin, currentY)
      currentY += 10

      likelihoods.forEach((likelihood, idx) => {
        checkNewPage(35)

        // Rank badge
        const isTop = idx === 0
        if (isTop) {
          pdf.setFillColor(...colors.success)
        } else {
          pdf.setFillColor(...colors.secondary)
        }
        pdf.roundedRect(margin, currentY - 4, 12, 7, 1, 1, 'F')
        pdf.setFontSize(10)
        pdf.setTextColor(255, 255, 255)
        pdf.setFont('helvetica', 'bold')
        pdf.text(`#${likelihood.rank}`, margin + 6, currentY, { align: 'center' })

        // Hypothesis text
        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        if (isTop) {
          pdf.setFont('helvetica', 'bold')
        } else {
          pdf.setFont('helvetica', 'normal')
        }
        const hypText = pdf.splitTextToSize(likelihood.hypothesis, pageWidth - 2 * margin - 20)
        pdf.text(hypText, margin + 15, currentY)
        currentY += Math.max(hypText.length * 5, 5) + 2

        // Evidence breakdown
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...colors.secondary)
        pdf.text(`Score: ${formatScore(likelihood.weightedScore)} | `, margin + 15, currentY)
        pdf.setTextColor(...colors.success)
        pdf.text(`+${likelihood.supportingEvidence} support | `, margin + 50, currentY)
        pdf.setTextColor(...colors.accent)
        pdf.text(`−${likelihood.contradictingEvidence} contradict | `, margin + 85, currentY)
        pdf.setTextColor(...colors.secondary)
        pdf.text(`${likelihood.neutralEvidence} neutral`, margin + 120, currentY)

        currentY += 5

        // Likelihood bar
        const barWidth = (pageWidth - 2 * margin - 15) * (likelihood.likelihood / 100)
        pdf.setFillColor(...(isTop ? colors.success : colors.secondary))
        pdf.rect(margin + 15, currentY, barWidth, 3, 'F')
        pdf.setDrawColor(...colors.secondary)
        pdf.rect(margin + 15, currentY, pageWidth - 2 * margin - 15, 3, 'S')

        pdf.setFontSize(8)
        pdf.setTextColor(...colors.secondary)
        pdf.text(`${likelihood.likelihood.toFixed(1)}%`, pageWidth - margin, currentY + 2)

        currentY += 10
      })

      // ===== EVIDENCE-HYPOTHESIS MATRIX =====
      checkNewPage(80) || addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('EVIDENCE-HYPOTHESIS MATRIX', margin, currentY)
      currentY += 12

      // Matrix explanation
      pdf.setFontSize(9)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'italic')
      pdf.text('This matrix shows how each piece of evidence relates to each hypothesis.', margin, currentY)
      currentY += 5
      pdf.text('Green = Supporting | Red = Contradicting | Gray = Neutral/Inconsistent', margin, currentY)
      currentY += 10

      // Create matrix table
      const matrixData = evidence.slice(0, 15).map(ev => {
        const row = [ev.evidence_title.substring(0, 40) + (ev.evidence_title.length > 40 ? '...' : '')]
        hypotheses.forEach(hyp => {
          const score = scores.find(s => s.hypothesis_id === hyp.id && s.evidence_id === ev.evidence_id)
          row.push(formatScore(score?.score ?? 0))
        })
        return row
      })

      const matrixHeaders = ['Evidence', ...hypotheses.map((_, i) => `H${i + 1}`)]

      autoTable(pdf, {
        startY: currentY,
        head: [matrixHeaders],
        body: matrixData,
        theme: 'grid',
        headStyles: {
          fillColor: colors.primary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 1.5
        },
        columnStyles: {
          0: { cellWidth: 80 }
        },
        didDrawCell: (data) => {
          if (data.column.index > 0 && data.section === 'body') {
            const scoreText = data.cell.text[0]
            const score = parseInt(scoreText.replace('+', ''))

            if (score > 0) {
              data.cell.styles.textColor = colors.success
              data.cell.styles.fontStyle = 'bold'
            } else if (score < 0) {
              data.cell.styles.textColor = colors.accent
              data.cell.styles.fontStyle = 'bold'
            } else {
              data.cell.styles.textColor = colors.secondary
            }
          }
        }
      })

      currentY = (pdf as any).lastAutoTable.finalY + 10

      // ===== EVIDENCE DIAGNOSTICITY =====
      checkNewPage(80) || addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('EVIDENCE DIAGNOSTICITY ANALYSIS', margin, currentY)
      currentY += 12

      pdf.setFontSize(10)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'italic')
      pdf.text('Diagnosticity measures how well evidence differentiates between hypotheses.', margin, currentY)
      currentY += 5
      pdf.text('Higher diagnosticity = more useful for distinguishing competing explanations.', margin, currentY)
      currentY += 12

      diagnosticity.slice(0, 10).forEach((diag, idx) => {
        checkNewPage(25)

        // Diagnosticity score badge
        const diagColor: [number, number, number] = diag.score >= 80 ? colors.success :
                                                     diag.score >= 50 ? colors.warning :
                                                     colors.secondary

        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(...diagColor)
        pdf.text(`${diag.score.toFixed(0)}%`, margin, currentY)

        // Evidence title
        pdf.setFontSize(10)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'normal')
        const evText = pdf.splitTextToSize(`${idx + 1}. ${diag.evidenceTitle}`, pageWidth - 2 * margin - 25)
        pdf.text(evText, margin + 20, currentY)
        currentY += Math.max(evText.length * 5, 5) + 2

        // Reasoning
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'italic')
        pdf.setTextColor(...colors.secondary)
        const reasonText = pdf.splitTextToSize(diag.reasoning, pageWidth - 2 * margin - 25)
        pdf.text(reasonText, margin + 20, currentY)
        currentY += (reasonText.length * 4) + 6
      })

      // ===== KEY FINDINGS & RECOMMENDATIONS =====
      checkNewPage(80) || addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('KEY FINDINGS & RECOMMENDATIONS', margin, currentY)
      currentY += 12

      pdf.setFontSize(11)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'normal')

      const findings = [
        `1. MOST LIKELY HYPOTHESIS (Least Contradicted):`,
        `   ${likelihoods[0]?.hypothesis || 'N/A'}`,
        `   Likelihood: ${likelihoods[0]?.likelihood.toFixed(1)}% | Score: ${formatScore(likelihoods[0]?.weightedScore || 0)}`,
        ``,
        `2. ALTERNATIVE HYPOTHESES TO MONITOR:`,
        ...likelihoods.slice(1, 3).map((l, i) => `   ${i + 2}. ${l.hypothesis} (${l.likelihood.toFixed(1)}%)`),
        ``,
        `3. CRITICAL EVIDENCE REQUIRING VALIDATION:`,
        ...diagnosticity.slice(0, 3).map((d, i) => `   ${i + 1}. ${d.evidenceTitle} (${d.score.toFixed(0)}% diagnostic)`),
        ``,
        `4. COGNITIVE BIAS MITIGATION:`,
        `   • ACH methodology reduces confirmation bias by evaluating all hypotheses equally`,
        `   • Focus on disconfirming evidence rather than confirming evidence`,
        `   • Reassess when new evidence emerges that changes diagnosticity`,
        ``,
        `5. COLLECTION RECOMMENDATIONS:`,
        `   • Prioritize gathering evidence with high diagnostic potential`,
        `   • Seek evidence that strongly differentiates between top hypotheses`,
        `   • Re-evaluate low-diagnosticity evidence for continued relevance`,
        ``,
        `6. ANALYTICAL CONFIDENCE:`,
        ...(() => {
          const topLikelihood = likelihoods[0]?.likelihood || 0
          const secondLikelihood = likelihoods[1]?.likelihood || 0
          const gap = topLikelihood - secondLikelihood

          if (gap > 20) {
            return [`   HIGH - Clear separation between most likely and alternative hypotheses (${gap.toFixed(1)}% gap)`]
          } else if (gap > 10) {
            return [`   MEDIUM - Moderate separation suggests need for more diagnostic evidence (${gap.toFixed(1)}% gap)`]
          } else {
            return [`   LOW - Competing hypotheses remain close; additional evidence critical (${gap.toFixed(1)}% gap)`]
          }
        })()
      ]

      findings.forEach(line => {
        checkNewPage(10)
        const lineText = pdf.splitTextToSize(line, pageWidth - 2 * margin - 5)
        pdf.text(lineText, margin, currentY)
        currentY += (lineText.length * 5) + 2
      })

      // ===== METHODOLOGY APPENDIX =====
      checkNewPage(80) || addNewPage()
      currentY = 20

      pdf.setFontSize(18)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('APPENDIX: ACH METHODOLOGY', margin, currentY)
      currentY += 12

      pdf.setFontSize(10)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'normal')

      const methodology = [
        'Analysis of Competing Hypotheses (ACH) is a structured analytical technique developed',
        'by Richards J. Heuer Jr. to overcome cognitive limitations and biases in intelligence analysis.',
        '',
        'KEY PRINCIPLES:',
        '',
        '1. Evaluate ALL hypotheses simultaneously, not sequentially',
        '2. Focus on disconfirming evidence rather than confirming evidence',
        '3. Identify the hypothesis with the LEAST contradictory evidence',
        '4. Use diagnosticity to prioritize evidence collection',
        '5. Make reasoning explicit and transparent for review',
        '',
        'SCORING SYSTEM:',
        '',
        `This analysis used a ${analysis.scale_type} scale:`,
        '  +5: Very Strongly Supports',
        '  +3: Strongly Supports',
        '  +1: Supports',
        '   0: Neutral/Inconsistent',
        '  -1: Contradicts',
        '  -3: Strongly Contradicts',
        '  -5: Very Strongly Contradicts',
        '',
        'DIAGNOSTICITY CALCULATION:',
        '',
        'Diagnosticity = (Score Range / Maximum Possible Range) × 100',
        '',
        'High diagnosticity (>80%): Evidence strongly differentiates hypotheses',
        'Medium diagnosticity (50-80%): Evidence provides some differentiation',
        'Low diagnosticity (<50%): Evidence does not significantly favor any hypothesis',
        '',
        'LIKELIHOOD CALCULATION:',
        '',
        'Hypotheses are ranked by weighted score (sum of all evidence scores).',
        'The hypothesis with the highest score (least negative) is most likely.',
        'Likelihood percentage is normalized for visualization purposes.',
        '',
        'REFERENCES:',
        '',
        'Heuer, R. J. (1999). Psychology of Intelligence Analysis. CIA Center for the Study',
        '   of Intelligence.',
        'Pherson, R. H., & Heuer, R. J. (2020). Structured Analytic Techniques for',
        '   Intelligence Analysis (3rd ed.). CQ Press.',
      ]

      methodology.forEach(line => {
        checkNewPage(8)
        pdf.text(line, margin, currentY)
        currentY += 5
      })

      // Add page numbers to all pages
      const totalPages = pdf.internal.pages.length - 1
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i)
        addPageNumber()
      }

      // Save PDF
      const filename = `${analysis.title.replace(/[^a-z0-9]/gi, '_')}-ACH-Report.pdf`
      pdf.save(filename)

    } catch (error) {
      console.error('PDF export error:', error)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={exporting}
      className={className}
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating PDF...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </>
      )}
    </Button>
  )
}
