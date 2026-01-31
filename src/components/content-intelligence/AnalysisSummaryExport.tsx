import React, { useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileDown, FileText, Table, Copy, Check } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import type { ContentAnalysis, DIMEAnalysis, EntityMention } from '@/types/content-intelligence'

interface ClaimsAnalysis {
  claims: Array<{
    claim: string
    category: string
    source?: string
    deception_analysis: {
      overall_risk: 'low' | 'medium' | 'high'
      risk_score: number
      red_flags: string[]
    }
  }>
  summary: {
    total_claims: number
    high_risk_claims: number
    medium_risk_claims: number
    low_risk_claims: number
    overall_content_credibility: number
  }
}

interface AnalysisSummaryExportProps {
  analysis: ContentAnalysis
  dimeAnalysis?: DIMEAnalysis | null
  claimsAnalysis?: ClaimsAnalysis | null
}

export const AnalysisSummaryExport: React.FC<AnalysisSummaryExportProps> = ({
  analysis,
  dimeAnalysis,
  claimsAnalysis,
}) => {
  const { copied, copyToClipboard } = useClipboard({
    successMessage: 'Report copied to clipboard',
  })

  // Generate comprehensive markdown report
  const markdownReport = useMemo(() => {
    const sections: string[] = []

    // Header
    sections.push('# Content Analysis Report')
    sections.push('')
    sections.push(`**Generated:** ${new Date().toISOString()}`)
    sections.push(`**URL:** ${analysis.url}`)
    if (analysis.title) {
      sections.push(`**Title:** ${analysis.title}`)
    }
    if (analysis.author) {
      sections.push(`**Author:** ${analysis.author}`)
    }
    if (analysis.publish_date) {
      sections.push(`**Published:** ${analysis.publish_date}`)
    }
    sections.push(`**Domain:** ${analysis.domain}`)
    sections.push(`**Word Count:** ${analysis.word_count.toLocaleString()}`)
    sections.push(`**Analysis Mode:** ${analysis.processing_mode}`)
    sections.push('')

    // Summary
    if (analysis.summary) {
      sections.push('## Summary')
      sections.push('')
      sections.push(analysis.summary)
      sections.push('')
    }

    // Key Topics
    if (analysis.topics && analysis.topics.length > 0) {
      sections.push('## Key Topics')
      sections.push('')
      for (const topic of analysis.topics) {
        sections.push(`### ${topic.name}`)
        sections.push('')
        sections.push(topic.description)
        sections.push('')
        sections.push(`**Keywords:** ${topic.keywords.join(', ')}`)
        sections.push(`**Coverage:** ${(topic.coverage * 100).toFixed(1)}%`)
        sections.push('')
      }
    }

    // Keyphrases
    if (analysis.keyphrases && analysis.keyphrases.length > 0) {
      sections.push('## Key Phrases')
      sections.push('')
      sections.push('| Phrase | Score | Category | Relevance |')
      sections.push('|--------|-------|----------|-----------|')
      for (const kp of analysis.keyphrases.slice(0, 15)) {
        sections.push(
          `| ${kp.phrase} | ${(kp.score * 100).toFixed(0)}% | ${kp.category} | ${kp.relevance} |`
        )
      }
      sections.push('')
    }

    // Sentiment Analysis
    if (analysis.sentiment_analysis) {
      const sa = analysis.sentiment_analysis
      sections.push('## Sentiment Analysis')
      sections.push('')
      sections.push(`**Overall Sentiment:** ${sa.overall}`)
      sections.push(`**Score:** ${sa.score.toFixed(2)} (${sa.score > 0 ? 'positive' : sa.score < 0 ? 'negative' : 'neutral'})`)
      sections.push(`**Confidence:** ${(sa.confidence * 100).toFixed(0)}%`)
      sections.push('')

      if (sa.emotions) {
        sections.push('### Emotions Detected')
        sections.push('')
        sections.push(`- Joy: ${(sa.emotions.joy * 100).toFixed(0)}%`)
        sections.push(`- Anger: ${(sa.emotions.anger * 100).toFixed(0)}%`)
        sections.push(`- Fear: ${(sa.emotions.fear * 100).toFixed(0)}%`)
        sections.push(`- Sadness: ${(sa.emotions.sadness * 100).toFixed(0)}%`)
        sections.push(`- Surprise: ${(sa.emotions.surprise * 100).toFixed(0)}%`)
        sections.push('')
      }

      if (sa.keyInsights && sa.keyInsights.length > 0) {
        sections.push('### Key Insights')
        sections.push('')
        for (const insight of sa.keyInsights) {
          sections.push(`- ${insight}`)
        }
        sections.push('')
      }
    }

    // Entities
    if (analysis.entities) {
      const e = analysis.entities
      const hasEntities =
        (e.people && e.people.length > 0) ||
        (e.organizations && e.organizations.length > 0) ||
        (e.locations && e.locations.length > 0)

      if (hasEntities) {
        sections.push('## Entities Extracted')
        sections.push('')

        if (e.people && e.people.length > 0) {
          sections.push('### People')
          sections.push('')
          for (const p of e.people.slice(0, 10)) {
            sections.push(`- **${p.name}** (mentioned ${p.count} times)`)
          }
          sections.push('')
        }

        if (e.organizations && e.organizations.length > 0) {
          sections.push('### Organizations')
          sections.push('')
          for (const o of e.organizations.slice(0, 10)) {
            sections.push(`- **${o.name}** (mentioned ${o.count} times)`)
          }
          sections.push('')
        }

        if (e.locations && e.locations.length > 0) {
          sections.push('### Locations')
          sections.push('')
          for (const l of e.locations.slice(0, 10)) {
            sections.push(`- **${l.name}** (mentioned ${l.count} times)`)
          }
          sections.push('')
        }
      }
    }

    // Top Phrases
    if (analysis.top_phrases && analysis.top_phrases.length > 0) {
      sections.push('## Top Phrases')
      sections.push('')
      sections.push('| Phrase | Count | Percentage |')
      sections.push('|--------|-------|------------|')
      for (const phrase of analysis.top_phrases.slice(0, 10)) {
        sections.push(
          `| ${phrase.phrase} | ${phrase.count} | ${phrase.percentage.toFixed(1)}% |`
        )
      }
      sections.push('')
    }

    // Claims Analysis
    if (claimsAnalysis || analysis.claim_analysis) {
      const ca = claimsAnalysis || analysis.claim_analysis
      if (ca) {
        sections.push('## Claims Analysis')
        sections.push('')
        sections.push(`**Total Claims:** ${ca.summary.total_claims}`)
        sections.push(`**High Risk:** ${ca.summary.high_risk_claims}`)
        sections.push(`**Medium Risk:** ${ca.summary.medium_risk_claims}`)
        sections.push(`**Low Risk:** ${ca.summary.low_risk_claims}`)
        sections.push(
          `**Overall Credibility:** ${(ca.summary.overall_content_credibility * 100).toFixed(0)}%`
        )
        sections.push('')

        if (ca.claims && ca.claims.length > 0) {
          sections.push('### Claims Identified')
          sections.push('')
          for (const claim of ca.claims.slice(0, 10)) {
            const riskEmoji =
              claim.deception_analysis.overall_risk === 'high'
                ? '[HIGH RISK]'
                : claim.deception_analysis.overall_risk === 'medium'
                  ? '[MEDIUM RISK]'
                  : '[LOW RISK]'
            sections.push(`- ${riskEmoji} ${claim.claim}`)
            if (claim.deception_analysis.red_flags.length > 0) {
              sections.push(`  - Red flags: ${claim.deception_analysis.red_flags.join(', ')}`)
            }
          }
          sections.push('')
        }
      }
    }

    // DIME Analysis
    if (dimeAnalysis) {
      sections.push('## DIME Framework Analysis')
      sections.push('')

      if (dimeAnalysis.summary) {
        sections.push('### Summary')
        sections.push('')
        sections.push(dimeAnalysis.summary)
        sections.push('')
      }

      const dimeCategories = [
        { key: 'diplomatic', label: 'Diplomatic' },
        { key: 'information', label: 'Information' },
        { key: 'military', label: 'Military' },
        { key: 'economic', label: 'Economic' },
      ] as const

      for (const cat of dimeCategories) {
        const qas = dimeAnalysis[cat.key]
        if (qas && qas.length > 0) {
          sections.push(`### ${cat.label}`)
          sections.push('')
          for (const qa of qas) {
            sections.push(`**Q:** ${qa.question}`)
            sections.push('')
            sections.push(`**A:** ${qa.answer}`)
            sections.push('')
          }
        }
      }
    }

    // Links Analysis
    if (analysis.links_analysis && analysis.links_analysis.length > 0) {
      sections.push('## Links Found')
      sections.push('')
      const externalLinks = analysis.links_analysis.filter((l) => l.is_external)
      const internalLinks = analysis.links_analysis.filter((l) => !l.is_external)

      if (externalLinks.length > 0) {
        sections.push(`### External Links (${externalLinks.length})`)
        sections.push('')
        for (const link of externalLinks.slice(0, 15)) {
          sections.push(`- [${link.anchor_text[0] || link.domain}](${link.url})`)
        }
        sections.push('')
      }

      if (internalLinks.length > 0) {
        sections.push(`### Internal Links (${internalLinks.length})`)
        sections.push('')
        for (const link of internalLinks.slice(0, 10)) {
          sections.push(`- [${link.anchor_text[0] || 'Link'}](${link.url})`)
        }
        sections.push('')
      }
    }

    // Archive URLs
    if (analysis.archive_urls) {
      sections.push('## Archive Links')
      sections.push('')
      if (analysis.archive_urls.wayback) {
        sections.push(`- [Wayback Machine](${analysis.archive_urls.wayback})`)
      }
      if (analysis.archive_urls.archive_is) {
        sections.push(`- [Archive.is](${analysis.archive_urls.archive_is})`)
      }
      sections.push('')
    }

    // Footer
    sections.push('---')
    sections.push('')
    sections.push(`*Analysis ID: ${analysis.id}*`)
    sections.push(`*Processing time: ${analysis.processing_duration_ms}ms*`)
    if (analysis.gpt_model_used) {
      sections.push(`*Model: ${analysis.gpt_model_used}*`)
    }

    return sections.join('\n')
  }, [analysis, dimeAnalysis, claimsAnalysis])

  // Generate JSON export data
  const jsonExportData = useMemo(() => {
    return {
      exportedAt: new Date().toISOString(),
      analysis: {
        id: analysis.id,
        url: analysis.url,
        title: analysis.title,
        author: analysis.author,
        publishDate: analysis.publish_date,
        domain: analysis.domain,
        wordCount: analysis.word_count,
        summary: analysis.summary,
        processingMode: analysis.processing_mode,
        processingDurationMs: analysis.processing_duration_ms,
        gptModelUsed: analysis.gpt_model_used,
        createdAt: analysis.created_at,
      },
      topics: analysis.topics,
      keyphrases: analysis.keyphrases,
      sentimentAnalysis: analysis.sentiment_analysis,
      entities: analysis.entities,
      topPhrases: analysis.top_phrases,
      linksAnalysis: analysis.links_analysis,
      claimsAnalysis: claimsAnalysis || analysis.claim_analysis,
      dimeAnalysis: dimeAnalysis,
      archiveUrls: analysis.archive_urls,
      bypassUrls: analysis.bypass_urls,
    }
  }, [analysis, dimeAnalysis, claimsAnalysis])

  // Generate CSV for entities
  const entitiesCsv = useMemo(() => {
    const rows: string[] = []
    rows.push('Type,Name,Count,Contexts')

    const addEntities = (type: string, entities: EntityMention[] | undefined) => {
      if (!entities) return
      for (const entity of entities) {
        const contexts = entity.contexts
          .slice(0, 3)
          .map((c) => c.replace(/"/g, '""'))
          .join(' | ')
        rows.push(`"${type}","${entity.name}",${entity.count},"${contexts}"`)
      }
    }

    if (analysis.entities) {
      addEntities('Person', analysis.entities.people)
      addEntities('Organization', analysis.entities.organizations)
      addEntities('Location', analysis.entities.locations)
      addEntities('Date', analysis.entities.dates)
      addEntities('Money', analysis.entities.money)
      addEntities('Event', analysis.entities.events)
      addEntities('Product', analysis.entities.products)
    }

    return rows.join('\n')
  }, [analysis.entities])

  // Copy markdown to clipboard
  const handleCopyMarkdown = useCallback(() => {
    copyToClipboard(markdownReport)
  }, [copyToClipboard, markdownReport])

  // Download markdown file
  const handleDownloadMarkdown = useCallback(() => {
    const blob = new Blob([markdownReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analysis-${analysis.id || Date.now()}.md`
    link.click()
    URL.revokeObjectURL(url)
  }, [markdownReport, analysis.id])

  // Download JSON file
  const handleDownloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(jsonExportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analysis-${analysis.id || Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [jsonExportData, analysis.id])

  // Download entities CSV
  const handleDownloadEntitiesCsv = useCallback(() => {
    const blob = new Blob([entitiesCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `entities-${analysis.id || Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [entitiesCsv, analysis.id])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Analysis</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopyMarkdown} className="cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy as Markdown
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDownloadMarkdown} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2" />
          Download Markdown (.md)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleDownloadJson} className="cursor-pointer">
          <FileDown className="h-4 w-4 mr-2" />
          Download JSON (.json)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDownloadEntitiesCsv} className="cursor-pointer">
          <Table className="h-4 w-4 mr-2" />
          Download Entities CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
