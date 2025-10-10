import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { ACHAnalysis } from '@/types/ach'
import { useState } from 'react'
import { calculateAllDiagnosticity, calculateHypothesisLikelihoods } from '@/lib/ach-diagnosticity'

interface ACHExcelExportProps {
  analysis: ACHAnalysis
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function ACHExcelExport({
  analysis,
  variant = 'outline',
  size = 'default',
  className
}: ACHExcelExportProps) {
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
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'ACH Analysis Tool'
      workbook.created = new Date()
      workbook.modified = new Date()
      workbook.properties.date1904 = false

      const hypotheses = analysis.hypotheses || []
      const evidence = analysis.evidence || []
      const scores = analysis.scores || []

      // Calculate analytics
      const diagnosticity = calculateAllDiagnosticity(evidence, scores, hypotheses)
      const likelihoods = calculateHypothesisLikelihoods(hypotheses, scores, evidence)

      // ===== SHEET 1: Evidence-Hypothesis Matrix =====
      const matrixSheet = workbook.addWorksheet('Evidence-Hypothesis Matrix', {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
      })

      // Define columns - Evidence column + one per hypothesis
      const matrixColumns: Partial<ExcelJS.Column>[] = [
        { header: 'Evidence', key: 'evidence', width: 45 }
      ]

      hypotheses.forEach((hyp, idx) => {
        matrixColumns.push({
          header: `H${idx + 1}`,
          key: `h${idx + 1}`,
          width: 12
        })
      })

      matrixSheet.columns = matrixColumns

      // Style header row
      const matrixHeaderRow = matrixSheet.getRow(1)
      matrixHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      matrixHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Navy blue
      }
      matrixHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      matrixHeaderRow.height = 30

      // Add hypothesis details as second row
      const hypDetailsRow = matrixSheet.getRow(2)
      hypDetailsRow.getCell(1).value = 'Hypothesis Details:'
      hypDetailsRow.getCell(1).font = { bold: true, italic: true }
      hypDetailsRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' }
      }

      hypotheses.forEach((hyp, idx) => {
        const cell = hypDetailsRow.getCell(idx + 2)
        cell.value = hyp.text
        cell.alignment = { wrapText: true, vertical: 'top' }
        cell.font = { size: 9, italic: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' }
        }
      })
      hypDetailsRow.height = 60

      // Populate evidence rows
      evidence.forEach((ev) => {
        const rowData: any = {
          evidence: ev.evidence_title
        }

        hypotheses.forEach((hyp, idx) => {
          const score = scores.find(s => s.hypothesis_id === hyp.id && s.evidence_id === ev.evidence_id)
          rowData[`h${idx + 1}`] = score?.score ?? 0
        })

        const row = matrixSheet.addRow(rowData)
        row.alignment = { vertical: 'top', wrapText: true }
        row.height = 35

        // Color-code scores
        hypotheses.forEach((hyp, idx) => {
          const scoreCell = row.getCell(idx + 2)
          const scoreValue = rowData[`h${idx + 1}`]
          scoreCell.font = { bold: scoreValue !== 0 }

          if (scoreValue > 0) {
            // Supporting - Green shades
            const intensity = Math.min(scoreValue / 5, 1) // 0 to 1
            const greenColor = Math.floor(200 - (intensity * 100)) // Lighter to darker green
            scoreCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: `FF${greenColor.toString(16).padStart(2, '0')}F${greenColor.toString(16).padStart(2, '0')}${greenColor.toString(16).padStart(2, '0')}` }
            }
            if (scoreValue >= 3) {
              scoreCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            }
          } else if (scoreValue < 0) {
            // Contradicting - Red shades
            const intensity = Math.min(Math.abs(scoreValue) / 5, 1)
            const redIntensity = Math.floor(200 - (intensity * 100))
            scoreCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: `FFF${redIntensity.toString(16).padStart(2, '0')}${redIntensity.toString(16).padStart(2, '0')}${redIntensity.toString(16).padStart(2, '0')}` }
            }
            if (scoreValue <= -3) {
              scoreCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            }
          } else {
            // Neutral - Gray
            scoreCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE5E7EB' }
            }
          }

          // Add note with score label
          scoreCell.note = getScoreLabel(scoreValue)
        })

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      // Add totals row
      const totalsRow = matrixSheet.addRow({ evidence: 'TOTALS (Sum of Scores)' })
      totalsRow.font = { bold: true }
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFBBF24' } // Yellow
      }

      hypotheses.forEach((hyp, idx) => {
        const hypScores = scores.filter(s => s.hypothesis_id === hyp.id)
        const total = hypScores.reduce((sum, s) => sum + s.score, 0)
        const cell = totalsRow.getCell(idx + 2)
        cell.value = total
        cell.font = { bold: true, size: 12 }
        cell.alignment = { horizontal: 'center' }
      })

      // Add AutoFilter
      matrixSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hypotheses.length + 1 }
      }

      // ===== SHEET 2: Hypothesis Analysis =====
      const hypSheet = workbook.addWorksheet('Hypothesis Analysis', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      })

      hypSheet.columns = [
        { header: 'Rank', key: 'rank', width: 8 },
        { header: 'Hypothesis', key: 'hypothesis', width: 50 },
        { header: 'Weighted Score', key: 'score', width: 15 },
        { header: 'Likelihood %', key: 'likelihood', width: 13 },
        { header: 'Supporting', key: 'supporting', width: 12 },
        { header: 'Contradicting', key: 'contradicting', width: 14 },
        { header: 'Neutral', key: 'neutral', width: 10 },
        { header: 'Total Evidence', key: 'total', width: 14 },
        { header: 'Assessment', key: 'assessment', width: 20 },
      ]

      // Style header
      const hypHeaderRow = hypSheet.getRow(1)
      hypHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      hypHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      }
      hypHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      hypHeaderRow.height = 25

      // Populate hypothesis rows
      likelihoods.forEach((likelihood) => {
        const assessment = likelihood.isLeastContradicted
          ? 'MOST LIKELY'
          : likelihood.rank <= 3
          ? 'ALTERNATIVE'
          : 'UNLIKELY'

        const row = hypSheet.addRow({
          rank: likelihood.rank,
          hypothesis: likelihood.hypothesis,
          score: formatScore(likelihood.weightedScore),
          likelihood: `${likelihood.likelihood.toFixed(1)}%`,
          supporting: likelihood.supportingEvidence,
          contradicting: likelihood.contradictingEvidence,
          neutral: likelihood.neutralEvidence,
          total: likelihood.supportingEvidence + likelihood.contradictingEvidence + likelihood.neutralEvidence,
          assessment,
        })

        row.alignment = { vertical: 'top', wrapText: true }
        row.height = 40

        // Highlight most likely hypothesis
        if (likelihood.isLeastContradicted) {
          row.font = { bold: true }
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' } // Light green
          }
        }

        // Color rank cell
        const rankCell = row.getCell('rank')
        rankCell.font = { bold: true, size: 14 }
        rankCell.alignment = { horizontal: 'center' }
        if (likelihood.rank === 1) {
          rankCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' } // Green
          }
          rankCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      // ===== SHEET 3: Evidence Diagnosticity =====
      const diagSheet = workbook.addWorksheet('Evidence Diagnosticity', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      })

      diagSheet.columns = [
        { header: 'Rank', key: 'rank', width: 8 },
        { header: 'Evidence', key: 'evidence', width: 50 },
        { header: 'Diagnosticity %', key: 'diagnosticity', width: 16 },
        { header: 'Score Range', key: 'range', width: 13 },
        { header: 'Top Hypothesis', key: 'top_hyp', width: 40 },
        { header: 'Reasoning', key: 'reasoning', width: 60 },
      ]

      // Style header
      const diagHeaderRow = diagSheet.getRow(1)
      diagHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      diagHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      }
      diagHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      diagHeaderRow.height = 25

      // Populate diagnosticity rows
      diagnosticity.forEach((diag, index) => {
        const row = diagSheet.addRow({
          rank: index + 1,
          evidence: diag.evidenceTitle,
          diagnosticity: `${diag.score.toFixed(1)}%`,
          range: diag.range.toFixed(1),
          top_hyp: diag.topHypothesis.text,
          reasoning: diag.reasoning,
        })

        row.alignment = { vertical: 'top', wrapText: true }
        row.height = 35

        // Color-code diagnosticity
        const diagCell = row.getCell('diagnosticity')
        diagCell.font = { bold: true }

        if (diag.score >= 80) {
          diagCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' } // Green
          }
          diagCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        } else if (diag.score >= 50) {
          diagCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF59E0B' } // Orange
          }
          diagCell.font = { bold: true, color: { argb: 'FF000000' } }
        } else {
          diagCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5E7EB' } // Gray
          }
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      // ===== SHEET 4: Analysis Summary =====
      const summarySheet = workbook.addWorksheet('Analysis Summary')

      // Add title
      summarySheet.mergeCells('A1:D1')
      const titleCell = summarySheet.getCell('A1')
      titleCell.value = 'ANALYSIS OF COMPETING HYPOTHESES'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E3A8A' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      summarySheet.getRow(1).height = 30

      // Analysis Info
      summarySheet.addRow([])
      summarySheet.addRow(['Analysis Title:', analysis.title])
      summarySheet.addRow(['Created:', new Date(analysis.created_at).toLocaleDateString()])
      summarySheet.addRow(['Analyst:', analysis.analyst || 'Not specified'])
      summarySheet.addRow(['Scale Type:', analysis.scale_type.toUpperCase()])
      summarySheet.addRow(['Status:', analysis.status.toUpperCase()])
      summarySheet.addRow([])

      // Intelligence Question
      summarySheet.addRow(['INTELLIGENCE QUESTION'])
      summarySheet.getRow(9).font = { bold: true, color: { argb: 'FF1E3A8A' }, size: 14 }
      summarySheet.addRow([analysis.question])
      const questionCell = summarySheet.getRow(10).getCell(1)
      questionCell.alignment = { wrapText: true }
      summarySheet.getRow(10).height = 40
      summarySheet.addRow([])

      if (analysis.description) {
        summarySheet.addRow(['BACKGROUND'])
        summarySheet.getRow(12).font = { bold: true, color: { argb: 'FF1E3A8A' } }
        summarySheet.addRow([analysis.description])
        const descCell = summarySheet.getRow(13).getCell(1)
        descCell.alignment = { wrapText: true }
        summarySheet.getRow(13).height = 50
        summarySheet.addRow([])
      }

      const statsStartRow = analysis.description ? 15 : 12

      // Statistics
      summarySheet.addRow(['STATISTICS'])
      summarySheet.getRow(statsStartRow).font = { bold: true, color: { argb: 'FF1E3A8A' }, size: 12 }
      summarySheet.addRow(['Hypotheses:', hypotheses.length])
      summarySheet.addRow(['Evidence Items:', evidence.length])
      summarySheet.addRow(['Total Assessments:', scores.length])
      summarySheet.addRow(['Avg Evidence per Hypothesis:', (scores.length / hypotheses.length).toFixed(1)])
      summarySheet.addRow([])

      // Key Findings
      const findingsStartRow = statsStartRow + 6
      summarySheet.addRow(['KEY FINDINGS'])
      summarySheet.getRow(findingsStartRow).font = { bold: true, color: { argb: 'FF1E3A8A' }, size: 12 }
      summarySheet.addRow([])

      summarySheet.addRow(['Most Likely Hypothesis (Least Contradicted):'])
      summarySheet.getRow(findingsStartRow + 2).font = { bold: true }
      summarySheet.addRow([likelihoods[0]?.hypothesis || 'N/A'])
      summarySheet.getRow(findingsStartRow + 3).getCell(1).alignment = { wrapText: true }
      summarySheet.getRow(findingsStartRow + 3).height = 40

      summarySheet.addRow([
        `Likelihood: ${likelihoods[0]?.likelihood.toFixed(1)}%`,
        `Score: ${formatScore(likelihoods[0]?.weightedScore || 0)}`,
        `Supporting: ${likelihoods[0]?.supportingEvidence}`,
        `Contradicting: ${likelihoods[0]?.contradictingEvidence}`
      ])
      summarySheet.addRow([])

      summarySheet.addRow(['Top 3 Diagnostic Evidence:'])
      summarySheet.getRow(findingsStartRow + 6).font = { bold: true }
      diagnosticity.slice(0, 3).forEach((diag, idx) => {
        summarySheet.addRow([
          `${idx + 1}.`,
          diag.evidenceTitle,
          `${diag.score.toFixed(0)}% diagnostic`
        ])
      })
      summarySheet.addRow([])

      // Analytical Confidence
      const confStartRow = findingsStartRow + 11
      summarySheet.addRow(['ANALYTICAL CONFIDENCE'])
      summarySheet.getRow(confStartRow).font = { bold: true, color: { argb: 'FF1E3A8A' }, size: 12 }

      const gap = (likelihoods[0]?.likelihood || 0) - (likelihoods[1]?.likelihood || 0)
      let confidence = 'LOW'
      let confColor = 'FFEF4444' // Red
      if (gap > 20) {
        confidence = 'HIGH'
        confColor = 'FF10B981' // Green
      } else if (gap > 10) {
        confidence = 'MEDIUM'
        confColor = 'FFF59E0B' // Orange
      }

      summarySheet.addRow([`${confidence} (${gap.toFixed(1)}% gap between top hypotheses)`])
      const confCell = summarySheet.getRow(confStartRow + 1).getCell(1)
      confCell.font = { bold: true, size: 12 }
      confCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: confColor }
      }
      if (confidence !== 'MEDIUM') {
        confCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      }

      // Set column widths for summary
      summarySheet.getColumn(1).width = 35
      summarySheet.getColumn(2).width = 60
      summarySheet.getColumn(3).width = 20
      summarySheet.getColumn(4).width = 20

      // Apply word wrap to summary sheet
      summarySheet.eachRow({ includeEmpty: false }, (row) => {
        row.alignment = { vertical: 'top', wrapText: true }
      })

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const filename = `${analysis.title.replace(/[^a-z0-9]/gi, '_')}-ACH-Analysis.xlsx`
      saveAs(blob, filename)

    } catch (error) {
      console.error('Excel export error:', error)
      alert('Failed to export Excel file. Please try again.')
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
          Generating Excel...
        </>
      ) : (
        <>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </>
      )}
    </Button>
  )
}
