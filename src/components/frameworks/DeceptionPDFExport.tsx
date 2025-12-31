import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DeceptionScores, DeceptionAssessment } from '@/lib/deception-scoring'
import { calculateDeceptionLikelihood } from '@/lib/deception-scoring'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface DeceptionAnalysisData {
  title: string
  description?: string
  scenario: string
  mom: string
  pop: string
  moses: string
  eve: string
  assessment: string
  scores: Partial<DeceptionScores>
  aiAnalysis?: any
  calculatedAssessment?: DeceptionAssessment
  claimReferences?: string[]
  lastUpdated?: string
}

interface DeceptionPDFExportProps {
  analysis: DeceptionAnalysisData
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function DeceptionPDFExport({
  analysis,
  variant = 'outline',
  size = 'default',
  className
}: DeceptionPDFExportProps) {
  const { t } = useTranslation('deception')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      })

      const assessment = analysis.calculatedAssessment || calculateDeceptionLikelihood(analysis.scores)

      // Define colors
      const colors = {
        primary: [30, 58, 138] as [number, number, number],
        critical: [220, 38, 38] as [number, number, number],
        high: [234, 88, 12] as [number, number, number],
        medium: [202, 138, 4] as [number, number, number],
        low: [22, 163, 74] as [number, number, number],
        text: [31, 41, 55] as [number, number, number],
        light: [249, 250, 251] as [number, number, number],
      }

      let currentY = 20
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 20

      const addNewPage = () => {
        pdf.addPage()
        currentY = 20
        addPageNumber()
      }

      const addPageNumber = () => {
        const pageNum = pdf.internal.pages.length - 1
        if (pageNum > 1) {
          pdf.setFontSize(9)
          pdf.setTextColor(100, 116, 139)
          pdf.text(`Page ${pageNum}`, pageWidth - margin - 10, pageHeight - 10)
        }
      }

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

      pdf.setFontSize(22)
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.text('DECEPTION DETECTION ANALYSIS', pageWidth / 2, 35, { align: 'center' })
      pdf.text('MOM-POP-MOSES-EVE Framework', pageWidth / 2, 50, { align: 'center' })

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
      pdf.text(analysis.lastUpdated ? new Date(analysis.lastUpdated).toLocaleDateString() : new Date().toLocaleDateString(), margin + 50, currentY)

      currentY += 10
      pdf.setFont('helvetica', 'bold')
      pdf.text('Framework:', margin, currentY)
      pdf.setFont('helvetica', 'normal')
      pdf.text('CIA SATS MOM-POP-MOSES-EVE', margin + 50, currentY)

      // Overall Deception Likelihood Box
      currentY += 25
      checkNewPage(60)

      const riskColor =
        assessment.riskLevel === 'CRITICAL' ? colors.critical :
        assessment.riskLevel === 'HIGH' ? colors.high :
        assessment.riskLevel === 'MEDIUM' ? colors.medium : colors.low

      pdf.setFillColor(...riskColor)
      pdf.roundedRect(margin, currentY, pageWidth - 2 * margin, 50, 3, 3, 'F')

      pdf.setFontSize(16)
      pdf.setTextColor(255, 255, 255)
      pdf.setFont('helvetica', 'bold')
      pdf.text('OVERALL DECEPTION LIKELIHOOD', pageWidth / 2, currentY + 15, { align: 'center' })

      pdf.setFontSize(36)
      pdf.text(`${assessment.overallLikelihood}%`, pageWidth / 2, currentY + 32, { align: 'center' })

      pdf.setFontSize(14)
      pdf.text(`${assessment.riskLevel} RISK - ${assessment.confidenceLevel} CONFIDENCE`, pageWidth / 2, currentY + 45, { align: 'center' })

      currentY += 65

      // Description
      if (analysis.description) {
        checkNewPage(30)
        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Description:', margin, currentY)
        currentY += 6
        pdf.setFont('helvetica', 'normal')
        const descLines = pdf.splitTextToSize(analysis.description, pageWidth - 2 * margin)
        pdf.text(descLines, margin, currentY)
        currentY += descLines.length * 5 + 10
      }

      // ===== SCENARIO =====
      addNewPage()
      pdf.setFontSize(16)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('SCENARIO DESCRIPTION', margin, currentY)
      currentY += 10

      pdf.setFontSize(10)
      pdf.setTextColor(...colors.text)
      pdf.setFont('helvetica', 'normal')
      const scenarioLines = pdf.splitTextToSize(analysis.scenario, pageWidth - 2 * margin)
      pdf.text(scenarioLines, margin, currentY)
      currentY += scenarioLines.length * 5 + 15

      // ===== CATEGORY SCORES =====
      checkNewPage(80)
      pdf.setFontSize(16)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('CATEGORY SCORES', margin, currentY)
      currentY += 12

      const categories = [
        { name: 'MOM (Motive, Opportunity, Means)', score: assessment.categoryScores.mom, max: 15, color: colors.critical },
        { name: 'POP (Patterns of Practice)', score: assessment.categoryScores.pop, max: 15, color: colors.high },
        { name: 'MOSES (Source Vulnerability)', score: assessment.categoryScores.moses, max: 10, color: colors.medium },
        { name: 'EVE (Evidence Evaluation)', score: assessment.categoryScores.eve, max: 15, color: colors.low }
      ]

      categories.forEach(cat => {
        checkNewPage(15)

        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'bold')
        pdf.text(cat.name, margin, currentY)

        pdf.setFont('helvetica', 'normal')
        pdf.text(`${cat.score.toFixed(1)} / ${cat.max}`, pageWidth - margin - 25, currentY)

        currentY += 5

        // Draw progress bar
        const barWidth = pageWidth - 2 * margin
        const fillWidth = (cat.score / cat.max) * barWidth

        pdf.setFillColor(220, 220, 220)
        pdf.rect(margin, currentY, barWidth, 5, 'F')

        pdf.setFillColor(...cat.color)
        pdf.rect(margin, currentY, fillWidth, 5, 'F')

        currentY += 12
      })

      // ===== MOM ANALYSIS =====
      if (analysis.mom) {
        addNewPage()
        pdf.setFontSize(16)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('MOM ANALYSIS', margin, currentY)
        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        pdf.text('(Motive, Opportunity, Means)', margin, currentY + 6)
        currentY += 14

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const momLines = pdf.splitTextToSize(analysis.mom, pageWidth - 2 * margin)
        pdf.text(momLines, margin, currentY)
        currentY += momLines.length * 5 + 10
      }

      // ===== POP ANALYSIS =====
      if (analysis.pop) {
        checkNewPage(40)
        pdf.setFontSize(16)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('POP ANALYSIS', margin, currentY)
        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        pdf.text('(Patterns of Practice)', margin, currentY + 6)
        currentY += 14

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const popLines = pdf.splitTextToSize(analysis.pop, pageWidth - 2 * margin)
        pdf.text(popLines, margin, currentY)
        currentY += popLines.length * 5 + 10
      }

      // ===== MOSES ANALYSIS =====
      if (analysis.moses) {
        checkNewPage(40)
        pdf.setFontSize(16)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('MOSES ANALYSIS', margin, currentY)
        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        pdf.text('(My Own Sources Evaluation)', margin, currentY + 6)
        currentY += 14

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const mosesLines = pdf.splitTextToSize(analysis.moses, pageWidth - 2 * margin)
        pdf.text(mosesLines, margin, currentY)
        currentY += mosesLines.length * 5 + 10
      }

      // ===== EVE ANALYSIS =====
      if (analysis.eve) {
        checkNewPage(40)
        pdf.setFontSize(16)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('EVE ANALYSIS', margin, currentY)
        pdf.setFontSize(11)
        pdf.setTextColor(...colors.text)
        pdf.text('(Evaluation of Evidence)', margin, currentY + 6)
        currentY += 14

        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const eveLines = pdf.splitTextToSize(analysis.eve, pageWidth - 2 * margin)
        pdf.text(eveLines, margin, currentY)
        currentY += eveLines.length * 5 + 10
      }

      // ===== DETAILED SCORING =====
      addNewPage()
      pdf.setFontSize(16)
      pdf.setTextColor(...colors.primary)
      pdf.setFont('helvetica', 'bold')
      pdf.text('DETAILED SCORING MATRIX', margin, currentY)
      currentY += 12

      const scoringData = [
        ['Criterion', 'Score', 'Category'],
        ['Motive', (analysis.scores.motive || 0).toFixed(1), 'MOM'],
        ['Opportunity', (analysis.scores.opportunity || 0).toFixed(1), 'MOM'],
        ['Means', (analysis.scores.means || 0).toFixed(1), 'MOM'],
        ['Historical Pattern', (analysis.scores.historicalPattern || 0).toFixed(1), 'POP'],
        ['Sophistication Level', (analysis.scores.sophisticationLevel || 0).toFixed(1), 'POP'],
        ['Success Rate', (analysis.scores.successRate || 0).toFixed(1), 'POP'],
        ['Source Vulnerability', (analysis.scores.sourceVulnerability || 0).toFixed(1), 'MOSES'],
        ['Manipulation Evidence', (analysis.scores.manipulationEvidence || 0).toFixed(1), 'MOSES'],
        ['Internal Consistency', (analysis.scores.internalConsistency || 3).toFixed(1), 'EVE'],
        ['External Corroboration', (analysis.scores.externalCorroboration || 3).toFixed(1), 'EVE'],
        ['Anomaly Detection', (analysis.scores.anomalyDetection || 0).toFixed(1), 'EVE']
      ]

      autoTable(pdf, {
        startY: currentY,
        head: [scoringData[0]],
        body: scoringData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: colors.primary, textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: colors.light },
        margin: { left: margin, right: margin }
      })

      currentY = (pdf as any).lastAutoTable.finalY + 15

      // ===== OVERALL ASSESSMENT =====
      if (analysis.assessment) {
        checkNewPage(40)
        pdf.setFontSize(16)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('OVERALL ASSESSMENT', margin, currentY)
        currentY += 12

        pdf.setFontSize(10)
        pdf.setTextColor(...colors.text)
        pdf.setFont('helvetica', 'normal')
        const assessmentLines = pdf.splitTextToSize(analysis.assessment, pageWidth - 2 * margin)
        pdf.text(assessmentLines, margin, currentY)
      }

      // ===== AI ANALYSIS (if available) =====
      if (analysis.aiAnalysis) {
        addNewPage()
        pdf.setFontSize(16)
        pdf.setTextColor(...colors.primary)
        pdf.setFont('helvetica', 'bold')
        pdf.text('AI-POWERED ANALYSIS', margin, currentY)
        currentY += 12

        if (analysis.aiAnalysis.bottomLine) {
          pdf.setFontSize(11)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Bottom Line:', margin, currentY)
          currentY += 6
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'normal')
          const blLines = pdf.splitTextToSize(analysis.aiAnalysis.bottomLine, pageWidth - 2 * margin)
          pdf.text(blLines, margin, currentY)
          currentY += blLines.length * 5 + 10
        }

        if (analysis.aiAnalysis.executiveSummary) {
          pdf.setFontSize(11)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Executive Summary:', margin, currentY)
          currentY += 6
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'normal')
          const esLines = pdf.splitTextToSize(analysis.aiAnalysis.executiveSummary, pageWidth - 2 * margin)
          pdf.text(esLines, margin, currentY)
          currentY += esLines.length * 5 + 10
        }

        if (analysis.aiAnalysis.keyIndicators && analysis.aiAnalysis.keyIndicators.length > 0) {
          pdf.setFontSize(11)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Key Indicators:', margin, currentY)
          currentY += 6
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'normal')
          analysis.aiAnalysis.keyIndicators.forEach((indicator: string) => {
            checkNewPage(8)
            pdf.text(`• ${indicator}`, margin + 5, currentY)
            currentY += 5
          })
          currentY += 5
        }

        if (analysis.aiAnalysis.recommendations && analysis.aiAnalysis.recommendations.length > 0) {
          pdf.setFontSize(11)
          pdf.setFont('helvetica', 'bold')
          pdf.text('Recommendations:', margin, currentY)
          currentY += 6
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'normal')
          analysis.aiAnalysis.recommendations.forEach((rec: string) => {
            checkNewPage(8)
            pdf.text(`• ${rec}`, margin + 5, currentY)
            currentY += 5
          })
        }
      }

      // ===== FOOTER ON ALL PAGES =====
      const totalPages = pdf.internal.pages.length - 1
      for (let i = 2; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(9)
        pdf.setTextColor(100, 116, 139)
        pdf.setFont('helvetica', 'italic')
        pdf.text('Generated by OmniCore Research Tools - CIA SATS MOM-POP-MOSES-EVE Framework', pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      // Save PDF
      pdf.save(`Deception_Analysis_${analysis.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)

    } catch (error) {
      console.error('PDF export error:', error)
      alert(t('export.exportFailed'))
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
          {t('export.exporting')}
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          {t('export.pdf')}
        </>
      )}
    </Button>
  )
}
