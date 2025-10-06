import { Button } from '@/components/ui/button'
import { FilePresentation, Loader2 } from 'lucide-react'
import pptxgen from 'pptxgenjs'
import type { COGAnalysis, CenterOfGravity, CriticalVulnerability, NetworkEdge } from '@/types/cog-analysis'
import { useState } from 'react'

interface COGPowerPointExportProps {
  analysis: COGAnalysis
  vulnerabilities: CriticalVulnerability[]
  edges?: NetworkEdge[]
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function COGPowerPointExport({
  analysis,
  vulnerabilities,
  edges,
  variant = 'outline',
  size = 'default',
  className
}: COGPowerPointExportProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const pptx = new pptxgen()

      // Set presentation properties
      pptx.author = 'COG Analysis Tool'
      pptx.company = 'Research Tools'
      pptx.title = analysis.title
      pptx.subject = 'Center of Gravity Analysis'

      // Define colors and styles
      const colors = {
        primary: '1E3A8A', // blue-900
        secondary: '64748B', // slate-600
        accent: 'EF4444', // red-500
        text: '1F2937', // gray-800
        light: 'F9FAFB', // gray-50
      }

      // ===== SLIDE 1: Title Slide =====
      const slide1 = pptx.addSlide()
      slide1.background = { color: colors.primary }

      slide1.addText('CENTER OF GRAVITY ANALYSIS', {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 1,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      })

      slide1.addText(analysis.title, {
        x: 0.5,
        y: 2.7,
        w: 9,
        h: 0.8,
        fontSize: 32,
        color: 'FFFFFF',
        align: 'center',
      })

      slide1.addText([
        { text: 'Created: ', options: { fontSize: 14, color: 'CBD5E1' } },
        { text: new Date(analysis.created_at).toLocaleDateString(), options: { fontSize: 14, color: 'FFFFFF' } },
      ], {
        x: 0.5,
        y: 5.0,
        w: 9,
        h: 0.4,
        align: 'center',
      })

      slide1.addText([
        { text: 'Scoring System: ', options: { fontSize: 14, color: 'CBD5E1' } },
        { text: analysis.scoring_system.toUpperCase(), options: { fontSize: 14, color: 'FFFFFF', bold: true } },
      ], {
        x: 0.5,
        y: 5.5,
        w: 9,
        h: 0.4,
        align: 'center',
      })

      // ===== SLIDE 2: Operational Context =====
      const slide2 = pptx.addSlide()
      slide2.addText('OPERATIONAL CONTEXT', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: colors.primary,
      })

      const contextY = 1.2
      const contextItems = [
        { label: 'Objective', value: analysis.operational_context.objective || 'Not specified' },
        { label: 'Desired Impact', value: analysis.operational_context.desired_impact || 'Not specified' },
        { label: 'Our Identity', value: analysis.operational_context.our_identity || 'Not specified' },
        { label: 'Operating Environment', value: analysis.operational_context.operating_environment || 'Not specified' },
        { label: 'Timeframe', value: analysis.operational_context.timeframe || 'Not specified' },
        { label: 'Strategic Level', value: analysis.operational_context.strategic_level || 'Not specified' },
      ]

      contextItems.forEach((item, idx) => {
        slide2.addText(item.label, {
          x: 0.5,
          y: contextY + (idx * 0.8),
          w: 2.5,
          h: 0.6,
          fontSize: 16,
          bold: true,
          color: colors.secondary,
        })

        slide2.addText(item.value, {
          x: 3.2,
          y: contextY + (idx * 0.8),
          w: 6.3,
          h: 0.6,
          fontSize: 14,
          color: colors.text,
        })
      })

      // ===== SLIDES 3-6: COGs by Actor Category =====
      const actorCategories = ['friendly', 'adversary', 'host_nation', 'third_party'] as const
      const actorLabels = {
        friendly: 'FRIENDLY FORCES',
        adversary: 'ADVERSARY',
        host_nation: 'HOST NATION',
        third_party: 'THIRD PARTY',
      }
      const actorColors = {
        friendly: '10B981', // green
        adversary: 'EF4444', // red
        host_nation: '3B82F6', // blue
        third_party: '6B7280', // gray
      }

      actorCategories.forEach(actor => {
        const cogs = analysis.centers_of_gravity.filter(c => c.actor_category === actor)
        if (cogs.length === 0) return

        const slide = pptx.addSlide()
        slide.addText(actorLabels[actor] + ' CENTERS OF GRAVITY', {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.6,
          fontSize: 28,
          bold: true,
          color: actorColors[actor],
        })

        cogs.forEach((cog, idx) => {
          const yPos = 1.2 + (idx * 1.8)

          // COG box
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.5,
            y: yPos,
            w: 9,
            h: 1.6,
            fill: { color: colors.light },
            line: { color: actorColors[actor], width: 2 },
          })

          // COG description
          slide.addText(cog.description || 'COG', {
            x: 0.7,
            y: yPos + 0.15,
            w: 8.6,
            h: 0.5,
            fontSize: 18,
            bold: true,
            color: colors.text,
          })

          // Domain badge
          slide.addText(cog.domain.toUpperCase(), {
            x: 0.7,
            y: yPos + 0.7,
            w: 2,
            h: 0.35,
            fontSize: 12,
            color: 'FFFFFF',
            fill: { color: colors.secondary },
            align: 'center',
          })

          // Capabilities count
          const capCount = analysis.critical_capabilities.filter(c => c.cog_id === cog.id).length
          slide.addText(`${capCount} Capabilities`, {
            x: 3,
            y: yPos + 0.7,
            w: 2,
            h: 0.35,
            fontSize: 11,
            color: colors.secondary,
          })

          // Rationale
          if (cog.rationale) {
            slide.addText(cog.rationale.substring(0, 150) + (cog.rationale.length > 150 ? '...' : ''), {
              x: 0.7,
              y: yPos + 1.1,
              w: 8.6,
              h: 0.4,
              fontSize: 10,
              color: colors.secondary,
              italic: true,
            })
          }
        })
      })

      // ===== SLIDE: Vulnerability Matrix =====
      const slideVuln = pptx.addSlide()
      slideVuln.addText('TOP VULNERABILITIES', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: colors.primary,
      })

      // Sort vulnerabilities by score
      const sortedVulns = [...vulnerabilities]
        .sort((a, b) => b.composite_score - a.composite_score)
        .slice(0, 10) // Top 10

      // Create table data
      const tableRows: any[] = []
      tableRows.push([
        { text: '#', options: { bold: true, fontSize: 12, color: 'FFFFFF', fill: colors.primary } },
        { text: 'Vulnerability', options: { bold: true, fontSize: 12, color: 'FFFFFF', fill: colors.primary } },
        { text: 'Type', options: { bold: true, fontSize: 12, color: 'FFFFFF', fill: colors.primary } },
        { text: 'Score', options: { bold: true, fontSize: 12, color: 'FFFFFF', fill: colors.primary } },
      ])

      sortedVulns.forEach((vuln, idx) => {
        const scoreColor = vuln.composite_score >= 12 ? 'EF4444' : vuln.composite_score >= 9 ? 'F59E0B' : '10B981'
        tableRows.push([
          { text: (idx + 1).toString(), options: { fontSize: 11 } },
          { text: vuln.vulnerability.substring(0, 60) + (vuln.vulnerability.length > 60 ? '...' : ''), options: { fontSize: 11 } },
          { text: vuln.vulnerability_type, options: { fontSize: 10 } },
          { text: vuln.composite_score.toString(), options: { fontSize: 11, bold: true, color: scoreColor } },
        ])
      })

      slideVuln.addTable(tableRows, {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 5,
        colW: [0.5, 6, 1.5, 1],
        fontSize: 11,
        border: { pt: 1, color: 'D1D5DB' },
        fill: 'FFFFFF',
      })

      // ===== SLIDE: Network Statistics =====
      if (edges && edges.length > 0) {
        const slideNetwork = pptx.addSlide()
        slideNetwork.addText('NETWORK ANALYSIS', {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.6,
          fontSize: 28,
          bold: true,
          color: colors.primary,
        })

        const stats = [
          { label: 'Total Centers of Gravity', value: analysis.centers_of_gravity.length },
          { label: 'Total Capabilities', value: analysis.critical_capabilities.length },
          { label: 'Total Requirements', value: analysis.critical_requirements.length },
          { label: 'Total Vulnerabilities', value: analysis.critical_vulnerabilities.length },
          { label: 'Network Edges', value: edges.length },
        ]

        stats.forEach((stat, idx) => {
          const yPos = 1.5 + (idx * 0.9)

          slideNetwork.addShape(pptx.ShapeType.rect, {
            x: 1,
            y: yPos,
            w: 8,
            h: 0.7,
            fill: { color: colors.light },
            line: { color: colors.secondary, width: 1 },
          })

          slideNetwork.addText(stat.label, {
            x: 1.3,
            y: yPos + 0.15,
            w: 5,
            h: 0.4,
            fontSize: 16,
            color: colors.text,
          })

          slideNetwork.addText(stat.value.toString(), {
            x: 6.5,
            y: yPos + 0.15,
            w: 2,
            h: 0.4,
            fontSize: 24,
            bold: true,
            color: colors.accent,
            align: 'center',
          })
        })

        slideNetwork.addText('Note: Use the Network tab in the application for interactive visualization.', {
          x: 0.5,
          y: 6.5,
          w: 9,
          h: 0.4,
          fontSize: 11,
          italic: true,
          color: colors.secondary,
          align: 'center',
        })
      }

      // ===== SLIDE: Recommendations =====
      const slideRec = pptx.addSlide()
      slideRec.addText('KEY RECOMMENDATIONS', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: colors.primary,
      })

      // Get top 5 vulnerabilities with recommended actions
      const topVulnsWithActions = sortedVulns
        .filter(v => v.recommended_actions)
        .slice(0, 5)

      topVulnsWithActions.forEach((vuln, idx) => {
        const yPos = 1.3 + (idx * 1.1)

        slideRec.addText(`${idx + 1}. ${vuln.vulnerability}`, {
          x: 0.7,
          y: yPos,
          w: 8.6,
          h: 0.4,
          fontSize: 14,
          bold: true,
          color: colors.text,
        })

        slideRec.addText(vuln.recommended_actions || 'No specific actions recommended', {
          x: 1.0,
          y: yPos + 0.45,
          w: 8.3,
          h: 0.5,
          fontSize: 11,
          color: colors.secondary,
        })
      })

      // ===== FINAL SLIDE: Summary =====
      const slideFinal = pptx.addSlide()
      slideFinal.background = { color: colors.primary }

      slideFinal.addText('ANALYSIS COMPLETE', {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1,
        fontSize: 36,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      })

      slideFinal.addText('Continue analysis in the COG Analysis Tool for:', {
        x: 1,
        y: 3.8,
        w: 8,
        h: 0.4,
        fontSize: 16,
        color: 'CBD5E1',
        align: 'center',
      })

      const features = [
        '• Interactive network visualization',
        '• "What if?" simulation mode',
        '• Vulnerability scoring and comparison',
        '• AI-assisted analysis',
      ]

      features.forEach((feature, idx) => {
        slideFinal.addText(feature, {
          x: 2,
          y: 4.4 + (idx * 0.4),
          w: 6,
          h: 0.3,
          fontSize: 14,
          color: 'FFFFFF',
          align: 'center',
        })
      })

      // Save the presentation
      const filename = `${analysis.title.replace(/[^a-z0-9]/gi, '_')}-COG-Analysis.pptx`
      await pptx.writeFile({ fileName: filename })

    } catch (error) {
      console.error('PowerPoint export error:', error)
      alert('Failed to export PowerPoint. Please try again.')
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
          <FilePresentation className="h-4 w-4 mr-2" />
          Export PowerPoint
        </>
      )}
    </Button>
  )
}
