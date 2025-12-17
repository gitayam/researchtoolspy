import { Button } from '@/components/ui/button'
import { Presentation, Loader2 } from 'lucide-react'
import type { ACHAnalysis } from '@/types/ach'
import { useState } from 'react'
import { calculateAllDiagnosticity, calculateHypothesisLikelihoods } from '@/lib/ach-diagnosticity'

interface ACHPowerPointExportProps {
  analysis: ACHAnalysis
  variant?: 'default' | 'outline' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function ACHPowerPointExport({
  analysis,
  variant = 'outline',
  size = 'default',
  className
}: ACHPowerPointExportProps) {
  const [exporting, setExporting] = useState(false)

  const formatScore = (score: number): string => {
    if (score > 0) return `+${score}`
    return score.toString()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Dynamic import to reduce initial bundle size
      const pptxgenModule = await import('pptxgenjs')
      const pptxgen = pptxgenModule.default
      const pptx = new pptxgen()

      // Set presentation properties
      pptx.author = 'ACH Analysis Tool'
      pptx.company = 'Research Tools'
      pptx.title = analysis.title
      pptx.subject = 'Analysis of Competing Hypotheses'

      const hypotheses = analysis.hypotheses || []
      const evidence = analysis.evidence || []
      const scores = analysis.scores || []

      // Calculate analytics
      const diagnosticity = calculateAllDiagnosticity(evidence, scores, hypotheses)
      const likelihoods = calculateHypothesisLikelihoods(hypotheses, scores, evidence)

      // Define colors and styles
      const colors = {
        primary: '1E3A8A', // blue-900
        secondary: '64748B', // slate-600
        accent: 'EF4444', // red-500
        success: '22C55E', // green-500
        warning: 'F59E0B', // orange-500
        text: '1F2937', // gray-800
        light: 'F9FAFB', // gray-50
      }

      // ===== SLIDE 1: Title Slide =====
      const slide1 = pptx.addSlide()
      slide1.background = { color: colors.primary }

      slide1.addText('ANALYSIS OF COMPETING', {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 0.6,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      })

      slide1.addText('HYPOTHESES', {
        x: 0.5,
        y: 2.1,
        w: 9,
        h: 0.6,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      })

      slide1.addText(analysis.title, {
        x: 0.5,
        y: 3.2,
        w: 9,
        h: 0.8,
        fontSize: 28,
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
        { text: 'Analyst: ', options: { fontSize: 14, color: 'CBD5E1' } },
        { text: analysis.analyst || 'Not specified', options: { fontSize: 14, color: 'FFFFFF' } },
      ], {
        x: 0.5,
        y: 5.5,
        w: 9,
        h: 0.4,
        align: 'center',
      })

      slide1.addText([
        { text: 'Scale: ', options: { fontSize: 14, color: 'CBD5E1' } },
        { text: analysis.scale_type.toUpperCase(), options: { fontSize: 14, color: 'FFFFFF', bold: true } },
      ], {
        x: 0.5,
        y: 6.0,
        w: 9,
        h: 0.4,
        align: 'center',
      })

      // ===== SLIDE 2: Intelligence Question =====
      const slide2 = pptx.addSlide()
      slide2.addText('INTELLIGENCE QUESTION', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: colors.primary,
      })

      // Question box
      slide2.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 1.3,
        w: 9,
        h: 1.5,
        fill: { color: colors.light },
        line: { color: colors.primary, width: 3 },
      })

      slide2.addText(analysis.question, {
        x: 0.8,
        y: 1.6,
        w: 8.4,
        h: 1.0,
        fontSize: 18,
        bold: true,
        color: colors.text,
        valign: 'middle',
      })

      // Background (if available)
      if (analysis.description) {
        slide2.addText('BACKGROUND', {
          x: 0.5,
          y: 3.1,
          w: 9,
          h: 0.4,
          fontSize: 18,
          bold: true,
          color: colors.secondary,
        })

        slide2.addText(analysis.description.substring(0, 300) + (analysis.description.length > 300 ? '...' : ''), {
          x: 0.5,
          y: 3.7,
          w: 9,
          h: 2.5,
          fontSize: 14,
          color: colors.text,
        })
      }

      // Analysis stats
      const statsY = analysis.description ? 6.3 : 3.3
      const stats = [
        { label: 'Hypotheses', value: hypotheses.length, color: colors.primary },
        { label: 'Evidence Items', value: evidence.length, color: colors.success },
        { label: 'Assessments', value: scores.length, color: colors.warning },
      ]

      stats.forEach((stat, idx) => {
        const xPos = 1.5 + (idx * 2.5)
        slide2.addShape(pptx.ShapeType.rect, {
          x: xPos,
          y: statsY,
          w: 2,
          h: 0.8,
          fill: { color: stat.color },
        })

        slide2.addText(stat.value.toString(), {
          x: xPos,
          y: statsY + 0.1,
          w: 2,
          h: 0.4,
          fontSize: 32,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
        })

        slide2.addText(stat.label, {
          x: xPos,
          y: statsY + 0.5,
          w: 2,
          h: 0.3,
          fontSize: 12,
          color: 'FFFFFF',
          align: 'center',
        })
      })

      // ===== SLIDE 3: Hypothesis Likelihood Ranking =====
      const slide3 = pptx.addSlide()
      slide3.addText('HYPOTHESIS LIKELIHOOD RANKING', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: colors.primary,
      })

      slide3.addText('The hypothesis with the LEAST contradictory evidence is most likely', {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 0.3,
        fontSize: 12,
        italic: true,
        color: colors.secondary,
        align: 'center',
      })

      // Display top 5 hypotheses
      likelihoods.slice(0, 5).forEach((likelihood, idx) => {
        const yPos = 1.5 + (idx * 1.1)
        const isTop = idx === 0
        const barColor = isTop ? colors.success : colors.secondary

        // Rank badge
        slide3.addShape(pptx.ShapeType.rect, {
          x: 0.5,
          y: yPos,
          w: 0.4,
          h: 0.4,
          fill: { color: barColor },
        })

        slide3.addText(`#${likelihood.rank}`, {
          x: 0.5,
          y: yPos + 0.05,
          w: 0.4,
          h: 0.3,
          fontSize: 14,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
        })

        // Hypothesis text
        slide3.addText(likelihood.hypothesis.substring(0, 80) + (likelihood.hypothesis.length > 80 ? '...' : ''), {
          x: 1.0,
          y: yPos,
          w: 5.5,
          h: 0.4,
          fontSize: isTop ? 14 : 12,
          bold: isTop,
          color: colors.text,
        })

        // Evidence breakdown
        slide3.addText(`Score: ${formatScore(likelihood.weightedScore)}`, {
          x: 6.6,
          y: yPos,
          w: 1.0,
          h: 0.4,
          fontSize: 10,
          color: colors.secondary,
          align: 'right',
        })

        slide3.addText(`+${likelihood.supportingEvidence}`, {
          x: 7.7,
          y: yPos,
          w: 0.5,
          h: 0.4,
          fontSize: 10,
          color: colors.success,
          align: 'right',
        })

        slide3.addText(`−${likelihood.contradictingEvidence}`, {
          x: 8.3,
          y: yPos,
          w: 0.5,
          h: 0.4,
          fontSize: 10,
          color: colors.accent,
          align: 'right',
        })

        // Likelihood bar
        const barWidth = 8.3 * (likelihood.likelihood / 100)
        slide3.addShape(pptx.ShapeType.rect, {
          x: 1.0,
          y: yPos + 0.5,
          w: barWidth,
          h: 0.25,
          fill: { color: barColor },
        })

        slide3.addShape(pptx.ShapeType.rect, {
          x: 1.0,
          y: yPos + 0.5,
          w: 8.3,
          h: 0.25,
          fill: { type: 'solid', transparency: 80, color: colors.secondary },
        })

        slide3.addText(`${likelihood.likelihood.toFixed(1)}%`, {
          x: 1.0,
          y: yPos + 0.8,
          w: 1.0,
          h: 0.2,
          fontSize: 9,
          color: colors.secondary,
        })
      })

      // ===== SLIDE 4: Evidence-Hypothesis Matrix =====
      const slide4 = pptx.addSlide()
      slide4.addText('EVIDENCE-HYPOTHESIS MATRIX', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: colors.primary,
      })

      slide4.addText('Green = Supporting | Red = Contradicting | Gray = Neutral', {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 0.3,
        fontSize: 11,
        italic: true,
        color: colors.secondary,
        align: 'center',
      })

      // Create matrix table
      const matrixRows: any[] = []

      // Header row
      const headerRow = [
        { text: 'Evidence', options: { fontSize: 10, color: 'FFFFFF', fill: colors.primary } }
      ]
      hypotheses.slice(0, 8).forEach((_, idx) => {
        headerRow.push({ text: `H${idx + 1}`, options: { fontSize: 10, color: 'FFFFFF', fill: colors.primary } })
      })
      matrixRows.push(headerRow)

      // Evidence rows (limit to 12 for space)
      evidence.slice(0, 12).forEach(ev => {
        const row = [
          { text: ev.evidence_title.substring(0, 35) + (ev.evidence_title.length > 35 ? '...' : ''), options: { fontSize: 9 } }
        ]

        hypotheses.slice(0, 8).forEach(hyp => {
          const score = scores.find(s => s.hypothesis_id === hyp.id && s.evidence_id === ev.evidence_id)
          const scoreValue = score?.score ?? 0
          const scoreColor = scoreValue > 0 ? colors.success : scoreValue < 0 ? colors.accent : colors.secondary
          const scoreText = formatScore(scoreValue)

          row.push({
            text: scoreText,
            options: {
              fontSize: 10,
              color: scoreColor
            } as any
          })
        })

        matrixRows.push(row)
      })

      // Column widths
      const colWidths = [3.5]
      for (let i = 0; i < Math.min(hypotheses.length, 8); i++) {
        colWidths.push(0.7)
      }

      slide4.addTable(matrixRows, {
        x: 0.5,
        y: 1.4,
        w: 9,
        colW: colWidths,
        fontSize: 9,
        border: { pt: 1, color: 'D1D5DB' },
        fill: { color: 'FFFFFF' },
      })

      // ===== SLIDE 5: Top Diagnostic Evidence =====
      const slide5 = pptx.addSlide()
      slide5.addText('TOP DIAGNOSTIC EVIDENCE', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 28,
        bold: true,
        color: colors.primary,
      })

      slide5.addText('Most useful for differentiating between competing hypotheses', {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 0.3,
        fontSize: 12,
        italic: true,
        color: colors.secondary,
        align: 'center',
      })

      diagnosticity.slice(0, 8).forEach((diag, idx) => {
        const yPos = 1.5 + (idx * 0.7)
        const diagColor = diag.score >= 80 ? colors.success : diag.score >= 50 ? colors.warning : colors.secondary

        // Rank
        slide5.addText(`${idx + 1}.`, {
          x: 0.5,
          y: yPos,
          w: 0.3,
          h: 0.4,
          fontSize: 12,
          bold: true,
          color: colors.text,
        })

        // Evidence title
        slide5.addText(diag.evidenceTitle.substring(0, 65) + (diag.evidenceTitle.length > 65 ? '...' : ''), {
          x: 0.9,
          y: yPos,
          w: 7.0,
          h: 0.4,
          fontSize: 11,
          color: colors.text,
        })

        // Diagnosticity badge
        slide5.addShape(pptx.ShapeType.rect, {
          x: 8.0,
          y: yPos + 0.05,
          w: 1.4,
          h: 0.3,
          fill: { color: diagColor },
        })

        slide5.addText(`${diag.score.toFixed(0)}% diagnostic`, {
          x: 8.0,
          y: yPos + 0.05,
          w: 1.4,
          h: 0.3,
          fontSize: 9,
          bold: true,
          color: 'FFFFFF',
          align: 'center',
          valign: 'middle',
        })
      })

      // ===== SLIDE 6: Key Findings =====
      const slide6 = pptx.addSlide()
      slide6.addText('KEY FINDINGS', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: colors.primary,
      })

      const findings = [
        {
          title: '1. MOST LIKELY HYPOTHESIS (Least Contradicted)',
          content: likelihoods[0]?.hypothesis || 'N/A',
          meta: `Likelihood: ${likelihoods[0]?.likelihood.toFixed(1)}% | Score: ${formatScore(likelihoods[0]?.weightedScore || 0)}`
        },
        {
          title: '2. KEY ALTERNATIVE HYPOTHESES',
          content: likelihoods.slice(1, 3).map((l, i) => `${i + 2}. ${l.hypothesis} (${l.likelihood.toFixed(1)}%)`).join('\n'),
          meta: 'Monitor for new evidence that could shift likelihood'
        },
        {
          title: '3. ANALYTICAL CONFIDENCE',
          content: (() => {
            const gap = (likelihoods[0]?.likelihood || 0) - (likelihoods[1]?.likelihood || 0)
            if (gap > 20) return `HIGH - Clear separation (${gap.toFixed(1)}% gap)`
            if (gap > 10) return `MEDIUM - Moderate separation (${gap.toFixed(1)}% gap)`
            return `LOW - Competing hypotheses remain close (${gap.toFixed(1)}% gap)`
          })(),
          meta: 'Based on likelihood gap between top hypotheses'
        }
      ]

      let findingsY = 1.3
      findings.forEach(finding => {
        slide6.addText(finding.title, {
          x: 0.7,
          y: findingsY,
          w: 8.6,
          h: 0.4,
          fontSize: 14,
          bold: true,
          color: colors.primary,
        })

        slide6.addText(finding.content, {
          x: 1.0,
          y: findingsY + 0.5,
          w: 8.3,
          h: 0.8,
          fontSize: 12,
          color: colors.text,
        })

        slide6.addText(finding.meta, {
          x: 1.0,
          y: findingsY + 1.3,
          w: 8.3,
          h: 0.3,
          fontSize: 10,
          italic: true,
          color: colors.secondary,
        })

        findingsY += 2.0
      })

      // ===== SLIDE 7: Recommendations =====
      const slide7 = pptx.addSlide()
      slide7.addText('RECOMMENDATIONS', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: colors.primary,
      })

      const recommendations = [
        '• Focus collection on high-diagnostic evidence to differentiate top hypotheses',
        '• Reassess analysis when new evidence emerges that changes diagnosticity',
        '• Actively seek disconfirming evidence for the most likely hypothesis',
        '• Monitor alternative hypotheses - likelihood can shift with new evidence',
        '• Document reasoning and assumptions for transparency',
        '• Consider cognitive biases: confirmation bias, anchoring, groupthink',
        '• Use ACH to challenge conventional thinking and surface blind spots',
      ]

      recommendations.forEach((rec, idx) => {
        slide7.addText(rec, {
          x: 0.8,
          y: 1.5 + (idx * 0.6),
          w: 8.4,
          h: 0.5,
          fontSize: 14,
          color: colors.text,
        })
      })

      slide7.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 6.0,
        w: 9,
        h: 1.0,
        fill: { color: colors.light },
        line: { color: colors.warning, width: 2 },
      })

      slide7.addText('CRITICAL REMINDER: ACH identifies the hypothesis with the LEAST contradictory evidence, NOT the most confirming evidence. This reduces confirmation bias.', {
        x: 0.8,
        y: 6.2,
        w: 8.4,
        h: 0.6,
        fontSize: 11,
        italic: true,
        color: colors.text,
      })

      // ===== FINAL SLIDE: Summary =====
      const slideFinal = pptx.addSlide()
      slideFinal.background = { color: colors.primary }

      slideFinal.addText('ANALYSIS COMPLETE', {
        x: 0.5,
        y: 2.0,
        w: 9,
        h: 1,
        fontSize: 40,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
      })

      slideFinal.addText('Continue analysis in the ACH Analysis Tool for:', {
        x: 1,
        y: 3.3,
        w: 8,
        h: 0.4,
        fontSize: 16,
        color: 'CBD5E1',
        align: 'center',
      })

      const features = [
        '• Interactive evidence-hypothesis matrix',
        '• Real-time diagnosticity calculations',
        '• Visual analytics and heatmaps',
        '• AI-assisted hypothesis generation',
        '• Collaboration and sharing',
      ]

      features.forEach((feature, idx) => {
        slideFinal.addText(feature, {
          x: 2,
          y: 4.0 + (idx * 0.5),
          w: 6,
          h: 0.4,
          fontSize: 16,
          color: 'FFFFFF',
          align: 'center',
        })
      })

      // Save the presentation
      const filename = `${analysis.title.replace(/[^a-z0-9]/gi, '_')}-ACH-Briefing.pptx`
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
          Generating PPTX...
        </>
      ) : (
        <>
          <Presentation className="h-4 w-4 mr-2" />
          Export PowerPoint
        </>
      )}
    </Button>
  )
}
