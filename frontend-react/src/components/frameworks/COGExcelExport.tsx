import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { COGAnalysis, CriticalVulnerability, NetworkEdge } from '@/types/cog-analysis'
import { useState } from 'react'

interface COGExcelExportProps {
  analysis: COGAnalysis
  vulnerabilities: CriticalVulnerability[]
  edges?: NetworkEdge[]
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function COGExcelExport({
  analysis,
  vulnerabilities,
  edges,
  variant = 'outline',
  size = 'default',
  className
}: COGExcelExportProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'COG Analysis Tool'
      workbook.created = new Date()
      workbook.modified = new Date()
      workbook.properties.date1904 = false

      // ===== SHEET 1: Targeting Matrix =====
      const targetingSheet = workbook.addWorksheet('Targeting Matrix', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      })

      // Define columns
      targetingSheet.columns = [
        { header: 'Priority', key: 'priority', width: 10 },
        { header: 'Vulnerability', key: 'vulnerability', width: 40 },
        { header: 'COG', key: 'cog', width: 35 },
        { header: 'Actor', key: 'actor', width: 15 },
        { header: 'Domain', key: 'domain', width: 15 },
        { header: 'Capability', key: 'capability', width: 35 },
        { header: 'Requirement', key: 'requirement', width: 35 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Impact', key: 'impact', width: 10 },
        { header: 'Attainability', key: 'attainability', width: 13 },
        { header: 'Follow-up', key: 'followup', width: 11 },
        { header: 'Composite Score', key: 'composite', width: 15 },
        { header: 'Recommended Actions', key: 'actions', width: 45 },
        { header: 'Expected Effect', key: 'effect', width: 40 },
        { header: 'Confidence', key: 'confidence', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
      ]

      // Style header row
      const headerRow = targetingSheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Navy blue
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      headerRow.height = 30

      // Sort vulnerabilities by composite score
      const sortedVulns = [...vulnerabilities].sort((a, b) => b.composite_score - a.composite_score)

      // Populate rows
      sortedVulns.forEach((vuln, index) => {
        // Find related entities
        const requirement = analysis.critical_requirements.find(r => r.id === vuln.requirement_id)
        const capability = requirement
          ? analysis.critical_capabilities.find(c => c.id === requirement.capability_id)
          : null
        const cog = capability
          ? analysis.centers_of_gravity.find(c => c.id === capability.cog_id)
          : null

        const row = targetingSheet.addRow({
          priority: index + 1,
          vulnerability: vuln.vulnerability || 'N/A',
          cog: cog?.description || 'N/A',
          actor: cog?.actor_category || 'N/A',
          domain: cog?.domain || 'N/A',
          capability: capability?.capability || 'N/A',
          requirement: requirement?.requirement || 'N/A',
          type: vuln.vulnerability_type || 'N/A',
          impact: vuln.scoring?.impact_on_cog || vuln.custom_scoring?.impact || 0,
          attainability: vuln.scoring?.attainability || vuln.custom_scoring?.attainability || 0,
          followup: vuln.scoring?.follow_up_potential || vuln.custom_scoring?.follow_up || 0,
          composite: vuln.composite_score,
          actions: Array.isArray(vuln.recommended_actions) ? vuln.recommended_actions.join(', ') : (vuln.recommended_actions || 'N/A'),
          effect: vuln.expected_effect || 'N/A',
          confidence: vuln.confidence || 'N/A',
          status: 'Open', // Default status
        })

        // Apply row formatting
        row.alignment = { vertical: 'top', wrapText: true }
        row.height = 45

        // Color-code composite score based on priority
        const compositeCell = row.getCell('composite')
        compositeCell.font = { bold: true }

        if (vuln.composite_score >= 12) {
          compositeCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' } // Red
          }
          compositeCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        } else if (vuln.composite_score >= 9) {
          compositeCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF59E0B' } // Orange
          }
          compositeCell.font = { bold: true, color: { argb: 'FF000000' } }
        } else if (vuln.composite_score >= 6) {
          compositeCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFBBF24' } // Yellow
          }
          compositeCell.font = { bold: true, color: { argb: 'FF000000' } }
        } else {
          compositeCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' } // Green
          }
          compositeCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        }

        // Add borders
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      // Add AutoFilter to all columns
      targetingSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 16 }
      }

      // Add conditional formatting for impact, attainability, and follow-up columns
      targetingSheet.addConditionalFormatting({
        ref: `I2:I${sortedVulns.length + 1}`, // Impact column
        rules: [
          {
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: [3],
            priority: 1,
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                bgColor: { argb: 'FFFECACA' } // Light red
              }
            }
          }
        ]
      })

      targetingSheet.addConditionalFormatting({
        ref: `J2:J${sortedVulns.length + 1}`, // Attainability column
        rules: [
          {
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: [3],
            priority: 1,
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                bgColor: { argb: 'FFD1FAE5' } // Light green
              }
            }
          }
        ]
      })

      targetingSheet.addConditionalFormatting({
        ref: `K2:K${sortedVulns.length + 1}`, // Follow-up column
        rules: [
          {
            type: 'cellIs',
            operator: 'greaterThan',
            formulae: [3],
            priority: 1,
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                bgColor: { argb: 'FFFEF3C7' } // Light yellow
              }
            }
          }
        ]
      })

      // ===== SHEET 2: COG Summary =====
      const cogSheet = workbook.addWorksheet('COG Summary', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      })

      cogSheet.columns = [
        { header: 'COG', key: 'cog', width: 40 },
        { header: 'Actor', key: 'actor', width: 15 },
        { header: 'Domain', key: 'domain', width: 15 },
        { header: 'Rationale', key: 'rationale', width: 50 },
        { header: 'Capabilities', key: 'capabilities', width: 12 },
        { header: 'Requirements', key: 'requirements', width: 13 },
        { header: 'Vulnerabilities', key: 'vulnerabilities', width: 14 },
        { header: 'Avg Score', key: 'avg_score', width: 12 },
      ]

      // Style header
      const cogHeaderRow = cogSheet.getRow(1)
      cogHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cogHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }
      }
      cogHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cogHeaderRow.height = 25

      // Populate COG data
      analysis.centers_of_gravity.forEach(cog => {
        const relatedCaps = analysis.critical_capabilities.filter(c => c.cog_id === cog.id)
        const relatedReqs = analysis.critical_requirements.filter(r =>
          relatedCaps.some(cap => cap.id === r.capability_id)
        )
        const relatedVulns = vulnerabilities.filter(v =>
          relatedReqs.some(req => req.id === v.requirement_id)
        )

        const avgScore = relatedVulns.length > 0
          ? relatedVulns.reduce((sum, v) => sum + v.composite_score, 0) / relatedVulns.length
          : 0

        const row = cogSheet.addRow({
          cog: cog.description || 'N/A',
          actor: cog.actor_category || 'N/A',
          domain: cog.domain || 'N/A',
          rationale: cog.rationale || 'N/A',
          capabilities: relatedCaps.length,
          requirements: relatedReqs.length,
          vulnerabilities: relatedVulns.length,
          avg_score: avgScore.toFixed(2),
        })

        row.alignment = { vertical: 'top', wrapText: true }
        row.height = 35

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      // ===== SHEET 3: Analysis Summary =====
      const summarySheet = workbook.addWorksheet('Analysis Summary')

      // Add title
      summarySheet.mergeCells('A1:D1')
      const titleCell = summarySheet.getCell('A1')
      titleCell.value = 'CENTER OF GRAVITY ANALYSIS'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E3A8A' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      summarySheet.getRow(1).height = 30

      // Analysis Info
      summarySheet.addRow([])
      summarySheet.addRow(['Analysis Title:', analysis.title])
      summarySheet.addRow(['Created:', new Date(analysis.created_at).toLocaleDateString()])
      summarySheet.addRow(['Scoring System:', analysis.scoring_system.toUpperCase()])
      summarySheet.addRow([])

      // Operational Context
      summarySheet.addRow(['OPERATIONAL CONTEXT'])
      summarySheet.getRow(7).font = { bold: true, color: { argb: 'FF1E3A8A' } }
      summarySheet.addRow(['Objective:', analysis.operational_context.objective || 'N/A'])
      summarySheet.addRow(['Desired Impact:', analysis.operational_context.desired_impact || 'N/A'])
      summarySheet.addRow(['Our Identity:', analysis.operational_context.our_identity || 'N/A'])
      summarySheet.addRow(['Operating Environment:', analysis.operational_context.operating_environment || 'N/A'])
      summarySheet.addRow(['Timeframe:', analysis.operational_context.timeframe || 'N/A'])
      summarySheet.addRow(['Strategic Level:', analysis.operational_context.strategic_level || 'N/A'])
      summarySheet.addRow([])

      // Statistics
      summarySheet.addRow(['STATISTICS'])
      summarySheet.getRow(15).font = { bold: true, color: { argb: 'FF1E3A8A' } }
      summarySheet.addRow(['Total COGs:', analysis.centers_of_gravity.length])
      summarySheet.addRow(['Total Capabilities:', analysis.critical_capabilities.length])
      summarySheet.addRow(['Total Requirements:', analysis.critical_requirements.length])
      summarySheet.addRow(['Total Vulnerabilities:', analysis.critical_vulnerabilities.length])
      if (edges) {
        summarySheet.addRow(['Network Edges:', edges.length])
      }
      summarySheet.addRow([])

      // Top Vulnerabilities
      summarySheet.addRow(['TOP 10 VULNERABILITIES'])
      summarySheet.getRow(edges ? 22 : 21).font = { bold: true, color: { argb: 'FF1E3A8A' } }
      const topVulns = sortedVulns.slice(0, 10)
      topVulns.forEach((vuln, idx) => {
        summarySheet.addRow([
          `${idx + 1}.`,
          vuln.vulnerability,
          `Score: ${vuln.composite_score}`
        ])
      })

      // Set column widths for summary
      summarySheet.getColumn(1).width = 25
      summarySheet.getColumn(2).width = 60
      summarySheet.getColumn(3).width = 15
      summarySheet.getColumn(4).width = 15

      // Apply word wrap to summary sheet
      summarySheet.eachRow({ includeEmpty: false }, (row) => {
        row.alignment = { vertical: 'top', wrapText: true }
      })

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const filename = `${analysis.title.replace(/[^a-z0-9]/gi, '_')}-Targeting-Matrix.xlsx`
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
          Generating...
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
