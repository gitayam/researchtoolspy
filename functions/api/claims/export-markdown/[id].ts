/**
 * Export Claim to Markdown API
 * GET /api/claims/export-markdown/:claim_adjustment_id
 * Generates Obsidian-compatible Markdown for a claim with all linked data
 */

import { requireAuth } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Extract claim_adjustment_id from URL path
    const claimAdjustmentId = context.params.id as string

    if (!claimAdjustmentId) {
      return new Response(JSON.stringify({
        error: 'claim_adjustment_id is required in URL path'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get claim adjustment with content analysis
    const claim = await context.env.DB.prepare(`
      SELECT
        ca.id,
        ca.claim_text,
        ca.claim_category,
        ca.original_risk_score,
        ca.original_overall_risk,
        ca.original_methods,
        ca.adjusted_risk_score,
        ca.user_comment,
        ca.verification_status,
        ca.created_at,
        ca.updated_at,
        co.url as source_url,
        co.title as source_title,
        co.publication_date
      FROM claim_adjustments ca
      JOIN content_analysis co ON ca.content_analysis_id = co.id
      WHERE ca.id = ? AND co.user_id = ?
    `).bind(claimAdjustmentId, auth.user.id).first()

    if (!claim) {
      return new Response(JSON.stringify({ error: 'Claim not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get linked evidence
    const evidenceLinks = await context.env.DB.prepare(`
      SELECT
        cel.id,
        cel.relationship,
        cel.relevance_score,
        cel.confidence,
        cel.notes,
        cel.created_at,
        e.title as evidence_title,
        e.description as evidence_description,
        e.source_url as evidence_url,
        e.evidence_type
      FROM claim_evidence_links cel
      JOIN evidence e ON cel.evidence_id = e.id
      WHERE cel.claim_adjustment_id = ?
      ORDER BY cel.relationship, cel.relevance_score DESC
    `).bind(claimAdjustmentId).all()

    // Get entity mentions
    const entityMentions = await context.env.DB.prepare(`
      SELECT
        id,
        entity_name,
        entity_type,
        role,
        context,
        credibility_impact,
        extracted_at
      FROM claim_entity_mentions
      WHERE claim_adjustment_id = ?
      ORDER BY role, entity_name
    `).bind(claimAdjustmentId).all()

    // Generate Markdown
    const markdown = generateMarkdown(
      claim as any,
      evidenceLinks.results || [],
      entityMentions.results || []
    )

    // Return as downloadable file
    const filename = `claim-${claimAdjustmentId.substring(0, 8)}-${Date.now()}.md`

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('[Export Markdown] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to export claim to Markdown',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

function generateMarkdown(
  claim: any,
  evidenceLinks: any[],
  entityMentions: any[]
): string {
  const lines: string[] = []

  // Title
  lines.push(`# Claim Analysis: ${claim.claim_category || 'Uncategorized'}`)
  lines.push('')

  // Metadata
  lines.push('---')
  lines.push(`created: ${new Date(claim.created_at).toISOString()}`)
  lines.push(`updated: ${new Date(claim.updated_at).toISOString()}`)
  lines.push(`status: ${claim.verification_status}`)
  if (claim.claim_category) {
    lines.push(`category: ${claim.claim_category}`)
  }
  lines.push('---')
  lines.push('')

  // Claim Text
  lines.push('## Claim')
  lines.push('')
  lines.push(`> ${claim.claim_text}`)
  lines.push('')

  // Source
  if (claim.source_url) {
    lines.push('**Source:** ')
    if (claim.source_title) {
      lines.push(`- [${claim.source_title}](${claim.source_url})`)
    } else {
      lines.push(`- ${claim.source_url}`)
    }
    if (claim.publication_date) {
      lines.push(`- Published: ${new Date(claim.publication_date).toLocaleDateString()}`)
    }
    lines.push('')
  }

  // Risk Assessment
  lines.push('## Risk Assessment')
  lines.push('')
  lines.push('| Metric | Original | Adjusted |')
  lines.push('|--------|----------|----------|')
  lines.push(`| Risk Score | ${claim.original_risk_score} | ${claim.adjusted_risk_score || claim.original_risk_score} |`)
  lines.push(`| Overall Risk | ${claim.original_overall_risk} | ${claim.adjusted_risk_score ? getRiskLevel(claim.adjusted_risk_score) : claim.original_overall_risk} |`)
  lines.push('')

  // User Analysis
  if (claim.user_comment) {
    lines.push('### Analyst Notes')
    lines.push('')
    lines.push(claim.user_comment)
    lines.push('')
  }

  // Deception Methods
  if (claim.original_methods) {
    const methods = JSON.parse(claim.original_methods)
    if (Object.keys(methods).length > 0) {
      lines.push('### Deception Analysis Methods')
      lines.push('')
      for (const [method, data] of Object.entries(methods)) {
        lines.push(`#### ${formatMethodName(method)}`)
        lines.push(`**Score:** ${(data as any).score}/100`)
        lines.push('')
        lines.push((data as any).reasoning)
        lines.push('')
      }
    }
  }

  // Entity Mentions
  if (entityMentions.length > 0) {
    lines.push('## Entities')
    lines.push('')

    // Group by role
    const grouped: Record<string, any[]> = {}
    for (const mention of entityMentions) {
      if (!grouped[mention.role]) {
        grouped[mention.role] = []
      }
      grouped[mention.role].push(mention)
    }

    for (const [role, mentions] of Object.entries(grouped)) {
      lines.push(`### ${formatRole(role)}`)
      lines.push('')

      for (const mention of mentions) {
        // Obsidian wikilink format
        lines.push(`- [[${mention.entity_name}]]`)
        lines.push(`  - Type: ${mention.entity_type}`)
        if (mention.credibility_impact !== 0) {
          const impact = mention.credibility_impact > 0 ? `+${mention.credibility_impact}` : mention.credibility_impact
          const direction = mention.credibility_impact > 0 ? '↑ increases' : '↓ decreases'
          lines.push(`  - Credibility Impact: ${impact} (${direction})`)
        }
        if (mention.context) {
          lines.push(`  - Context: ${mention.context}`)
        }
        lines.push('')
      }
    }
  }

  // Evidence Links
  if (evidenceLinks.length > 0) {
    lines.push('## Evidence')
    lines.push('')

    // Group by relationship
    const supports = evidenceLinks.filter(e => e.relationship === 'supports')
    const contradicts = evidenceLinks.filter(e => e.relationship === 'contradicts')
    const context = evidenceLinks.filter(e => e.relationship === 'provides_context')

    if (supports.length > 0) {
      lines.push('### ✅ Supporting Evidence')
      lines.push('')
      for (const link of supports) {
        lines.push(formatEvidenceLink(link))
      }
    }

    if (contradicts.length > 0) {
      lines.push('### ❌ Contradicting Evidence')
      lines.push('')
      for (const link of contradicts) {
        lines.push(formatEvidenceLink(link))
      }
    }

    if (context.length > 0) {
      lines.push('### ℹ️ Contextual Evidence')
      lines.push('')
      for (const link of context) {
        lines.push(formatEvidenceLink(link))
      }
    }
  }

  // Footer
  lines.push('---')
  lines.push('')
  lines.push('*Generated by Research Tools - Claims Investigation System*')
  lines.push(`*Export Date: ${new Date().toISOString()}*`)

  return lines.join('\n')
}

function formatEvidenceLink(link: any): string {
  const lines: string[] = []

  if (link.evidence_url) {
    lines.push(`- [${link.evidence_title || 'Evidence'}](${link.evidence_url})`)
  } else {
    lines.push(`- **${link.evidence_title || 'Evidence'}**`)
  }

  if (link.evidence_type) {
    lines.push(`  - Type: ${link.evidence_type}`)
  }

  if (link.evidence_description) {
    lines.push(`  - ${link.evidence_description}`)
  }

  lines.push(`  - Relevance: ${link.relevance_score}% | Confidence: ${link.confidence}%`)

  if (link.notes) {
    lines.push(`  - Notes: ${link.notes}`)
  }

  lines.push('')
  return lines.join('\n')
}

function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    claim_maker: '🗣️ Claim Makers',
    subject: '🎯 Subjects',
    mentioned: '📌 Mentioned',
    affected: '⚠️ Affected Parties'
  }
  return roleMap[role] || role.replace('_', ' ').toUpperCase()
}

function formatMethodName(method: string): string {
  return method
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getRiskLevel(score: number): string {
  if (score >= 75) return 'VERY HIGH RISK'
  if (score >= 50) return 'HIGH RISK'
  if (score >= 25) return 'MEDIUM RISK'
  return 'LOW RISK'
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
