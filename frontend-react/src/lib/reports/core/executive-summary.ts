/**
 * Executive Summary Generator
 * Creates professional executive summaries for all framework types
 */

export interface ExecutiveSummaryData {
  frameworkType: string
  frameworkTitle: string
  analysisDate: Date
  analyst?: string
  classification?: string

  // Key metrics
  totalElements: number
  completeness: number // 0-100%
  confidence?: number // 0-100%

  // Content sections
  purpose: string
  keyFindings: string[]
  recommendations: string[]
  methodology?: string
  limitations?: string[]

  // Framework-specific data
  frameworkData?: any
}

export interface ExecutiveSummary {
  title: string
  sections: Array<{
    heading: string
    content: string | string[]
    priority?: 'high' | 'medium' | 'low'
  }>
  keyMetrics: Array<{
    label: string
    value: string | number
    context?: string
  }>
  visualizations?: string[] // SVG or chart references
}

/**
 * Generates a comprehensive executive summary for any framework
 */
export function generateExecutiveSummary(data: ExecutiveSummaryData): ExecutiveSummary {
  const summary: ExecutiveSummary = {
    title: `Executive Summary: ${data.frameworkTitle}`,
    sections: [],
    keyMetrics: [],
  }

  // Analysis Overview
  summary.sections.push({
    heading: 'Analysis Overview',
    content: `This ${data.frameworkType} analysis was conducted on ${formatDate(data.analysisDate)}${data.analyst ? ` by ${data.analyst}` : ''}. ${data.purpose}`,
  })

  // Key Metrics
  summary.keyMetrics.push(
    {
      label: 'Analysis Elements',
      value: data.totalElements,
      context: 'Total data points analyzed',
    },
    {
      label: 'Completeness',
      value: `${data.completeness}%`,
      context: getCompletenessContext(data.completeness),
    }
  )

  if (data.confidence !== undefined) {
    summary.keyMetrics.push({
      label: 'Analytical Confidence',
      value: `${data.confidence}%`,
      context: getConfidenceContext(data.confidence),
    })
  }

  // Key Findings
  if (data.keyFindings.length > 0) {
    summary.sections.push({
      heading: 'Key Findings',
      content: data.keyFindings.slice(0, 5), // Top 5 findings
      priority: 'high',
    })
  }

  // Recommendations
  if (data.recommendations.length > 0) {
    summary.sections.push({
      heading: 'Recommendations',
      content: data.recommendations.slice(0, 5), // Top 5 recommendations
      priority: 'high',
    })
  }

  // Framework-Specific Insights
  const frameworkInsights = generateFrameworkSpecificInsights(data.frameworkType, data.frameworkData)
  if (frameworkInsights) {
    summary.sections.push({
      heading: `${data.frameworkType} Insights`,
      content: frameworkInsights,
      priority: 'medium',
    })
  }

  // Methodology
  if (data.methodology) {
    summary.sections.push({
      heading: 'Methodology',
      content: data.methodology,
      priority: 'low',
    })
  }

  // Limitations
  if (data.limitations && data.limitations.length > 0) {
    summary.sections.push({
      heading: 'Limitations & Caveats',
      content: data.limitations,
      priority: 'medium',
    })
  }

  return summary
}

/**
 * Generates framework-specific insights
 */
function generateFrameworkSpecificInsights(frameworkType: string, data: any): string | string[] | null {
  if (!data) return null

  switch (frameworkType.toUpperCase()) {
    case 'SWOT':
      return generateSWOTInsights(data)
    case 'ACH':
      return generateACHInsights(data)
    case 'PMESII-PT':
      return generatePMESIIPTInsights(data)
    case 'COG':
      return generateCOGInsights(data)
    case 'PEST':
      return generatePESTInsights(data)
    case 'DIME':
      return generateDIMEInsights(data)
    case 'STAKEHOLDER':
      return generateStakeholderInsights(data)
    default:
      return null
  }
}

function generateSWOTInsights(data: any): string[] {
  const insights: string[] = []

  const strengths = data.strengths?.length || 0
  const weaknesses = data.weaknesses?.length || 0
  const opportunities = data.opportunities?.length || 0
  const threats = data.threats?.length || 0
  const total = strengths + weaknesses + opportunities + threats

  if (total === 0) return []

  // Balance analysis
  const internal = strengths + weaknesses
  const external = opportunities + threats
  if (internal > external * 1.5) {
    insights.push('Analysis shows strong internal focus, consider expanding environmental scanning')
  } else if (external > internal * 1.5) {
    insights.push('Analysis heavily weighted toward external factors, internal capabilities may need deeper examination')
  } else {
    insights.push('Analysis demonstrates balanced coverage of internal and external factors')
  }

  // Sentiment analysis
  const positive = strengths + opportunities
  const negative = weaknesses + threats
  if (positive > negative * 1.3) {
    insights.push('Overall positive outlook with strengths and opportunities outweighing challenges')
  } else if (negative > positive * 1.3) {
    insights.push('Significant challenges identified, defensive strategies recommended')
  }

  // Strategic recommendations
  if (strengths > 0 && opportunities > 0) {
    insights.push(`${strengths} strengths identified that could be leveraged against ${opportunities} opportunities (SO strategies)`)
  }
  if (weaknesses > 0 && threats > 0) {
    insights.push(`${weaknesses} weaknesses and ${threats} threats require defensive strategies (WT strategies)`)
  }

  return insights
}

function generateACHInsights(data: any): string[] {
  const insights: string[] = []

  const hypotheses = data.hypotheses?.length || 0
  const evidence = data.evidence?.length || 0

  if (hypotheses === 0 || evidence === 0) return []

  insights.push(`Analysis evaluated ${hypotheses} competing hypotheses against ${evidence} pieces of evidence`)

  if (data.mostLikely) {
    insights.push(`Most likely hypothesis: "${data.mostLikely.name}" with ${data.mostLikely.likelihood}% likelihood`)
  }

  if (data.diagnosticEvidence) {
    insights.push(`${data.diagnosticEvidence.count} highly diagnostic evidence items identified for hypothesis discrimination`)
  }

  if (data.inconsistencies) {
    insights.push(`${data.inconsistencies} evidence-hypothesis inconsistencies requiring further investigation`)
  }

  return insights
}

function generatePMESIIPTInsights(data: any): string[] {
  const insights: string[] = []

  const domains = ['political', 'military', 'economic', 'social', 'information', 'infrastructure', 'physical', 'time']
  const domainCounts = domains.map(d => ({
    name: d,
    count: data[d]?.length || 0
  })).filter(d => d.count > 0)

  if (domainCounts.length === 0) return []

  const total = domainCounts.reduce((sum, d) => sum + d.count, 0)
  insights.push(`Analysis covers ${domainCounts.length} of 8 PMESII-PT domains with ${total} total factors`)

  // Find most/least covered domains
  const sorted = [...domainCounts].sort((a, b) => b.count - a.count)
  insights.push(`Primary focus on ${sorted[0].name.toUpperCase()} domain (${sorted[0].count} factors)`)

  if (sorted.length >= 3 && sorted[sorted.length - 1].count < sorted[0].count * 0.3) {
    insights.push(`${sorted[sorted.length - 1].name.toUpperCase()} domain may require additional analysis`)
  }

  // Interconnection analysis
  if (data.interconnections) {
    insights.push(`${data.interconnections.length} cross-domain interconnections identified, highlighting systemic complexity`)
  }

  return insights
}

function generateCOGInsights(data: any): string[] {
  const insights: string[] = []

  if (data.cog) {
    insights.push(`Center of Gravity identified: ${data.cog}`)
  }

  const cc = data.criticalCapabilities?.length || 0
  const cr = data.criticalRequirements?.length || 0
  const cv = data.criticalVulnerabilities?.length || 0

  if (cc > 0) insights.push(`${cc} critical capabilities identified`)
  if (cr > 0) insights.push(`${cr} critical requirements supporting the COG`)
  if (cv > 0) insights.push(`${cv} critical vulnerabilities that could be exploited`)

  if (cv > 0 && cr > 0) {
    insights.push(`Vulnerability-to-requirement ratio: ${(cv / cr).toFixed(2)} (higher indicates more exploitable weaknesses)`)
  }

  return insights
}

function generatePESTInsights(data: any): string[] {
  const insights: string[] = []

  const political = data.political?.length || 0
  const economic = data.economic?.length || 0
  const social = data.social?.length || 0
  const technological = data.technological?.length || 0
  const total = political + economic + social + technological

  if (total === 0) return []

  insights.push(`Environmental scan identified ${total} factors across PEST dimensions`)

  const factors = [
    { name: 'Political', count: political },
    { name: 'Economic', count: economic },
    { name: 'Social', count: social },
    { name: 'Technological', count: technological },
  ].sort((a, b) => b.count - a.count)

  insights.push(`Primary environmental driver: ${factors[0].name} (${factors[0].count} factors)`)

  if (factors[factors.length - 1].count < total * 0.1) {
    insights.push(`${factors[factors.length - 1].name} factors may be underrepresented in analysis`)
  }

  return insights
}

function generateDIMEInsights(data: any): string[] {
  const insights: string[] = []

  const diplomatic = data.diplomatic?.length || 0
  const informational = data.informational?.length || 0
  const military = data.military?.length || 0
  const economic = data.economic?.length || 0
  const total = diplomatic + informational + military + economic

  if (total === 0) return []

  insights.push(`National power analysis identified ${total} elements across DIME framework`)

  const instruments = [
    { name: 'Diplomatic', count: diplomatic },
    { name: 'Informational', count: informational },
    { name: 'Military', count: military },
    { name: 'Economic', count: economic },
  ].sort((a, b) => b.count - a.count)

  insights.push(`Dominant instrument of power: ${instruments[0].name} (${instruments[0].count} elements)`)

  // Balanced power assessment
  const avgCount = total / 4
  const isBalanced = instruments.every(i => Math.abs(i.count - avgCount) < avgCount * 0.5)
  if (isBalanced) {
    insights.push('Power distribution is relatively balanced across all instruments')
  } else {
    insights.push('Power distribution shows significant asymmetry, consider multi-instrument integration')
  }

  return insights
}

function generateStakeholderInsights(data: any): string[] {
  const insights: string[] = []

  const stakeholders = data.stakeholders?.length || 0
  if (stakeholders === 0) return []

  insights.push(`${stakeholders} stakeholders identified and mapped`)

  // Power/Interest distribution
  if (data.powerInterestMatrix) {
    const highPowerHighInterest = data.powerInterestMatrix.manageClosely?.length || 0
    const highPowerLowInterest = data.powerInterestMatrix.keepSatisfied?.length || 0
    const lowPowerHighInterest = data.powerInterestMatrix.keepInformed?.length || 0
    const lowPowerLowInterest = data.powerInterestMatrix.monitor?.length || 0

    insights.push(`${highPowerHighInterest} stakeholders require close management (high power, high interest)`)

    if (highPowerLowInterest > highPowerHighInterest) {
      insights.push('Significant high-power/low-interest stakeholders may need engagement to increase interest')
    }

    if (lowPowerHighInterest > 0) {
      insights.push(`${lowPowerHighInterest} stakeholders with high interest could be leveraged as advocates`)
    }
  }

  return insights
}

/**
 * Helper functions
 */

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function getCompletenessContext(completeness: number): string {
  if (completeness >= 90) return 'Highly comprehensive analysis'
  if (completeness >= 70) return 'Substantial coverage'
  if (completeness >= 50) return 'Moderate coverage, consider expanding'
  return 'Limited coverage, additional analysis recommended'
}

function getConfidenceContext(confidence: number): string {
  if (confidence >= 80) return 'High confidence assessment'
  if (confidence >= 60) return 'Moderate confidence'
  if (confidence >= 40) return 'Low confidence, validate findings'
  return 'Very low confidence, requires significant additional analysis'
}

/**
 * Formats executive summary for different output formats
 */
export function formatExecutiveSummaryForPDF(summary: ExecutiveSummary): string {
  let output = `# ${summary.title}\n\n`

  // Key Metrics
  if (summary.keyMetrics.length > 0) {
    output += '## Key Metrics\n\n'
    summary.keyMetrics.forEach(metric => {
      output += `**${metric.label}**: ${metric.value}`
      if (metric.context) output += ` (${metric.context})`
      output += '\n\n'
    })
  }

  // Sections
  summary.sections.forEach(section => {
    output += `## ${section.heading}\n\n`
    if (Array.isArray(section.content)) {
      section.content.forEach(item => {
        output += `- ${item}\n`
      })
      output += '\n'
    } else {
      output += `${section.content}\n\n`
    }
  })

  return output
}

export function formatExecutiveSummaryForHTML(summary: ExecutiveSummary): string {
  let html = `<div class="executive-summary">\n`
  html += `  <h1>${summary.title}</h1>\n\n`

  // Key Metrics
  if (summary.keyMetrics.length > 0) {
    html += '  <div class="key-metrics">\n'
    html += '    <h2>Key Metrics</h2>\n'
    html += '    <div class="metrics-grid">\n'
    summary.keyMetrics.forEach(metric => {
      html += `      <div class="metric">\n`
      html += `        <div class="metric-label">${metric.label}</div>\n`
      html += `        <div class="metric-value">${metric.value}</div>\n`
      if (metric.context) html += `        <div class="metric-context">${metric.context}</div>\n`
      html += `      </div>\n`
    })
    html += '    </div>\n'
    html += '  </div>\n\n'
  }

  // Sections
  summary.sections.forEach(section => {
    const priority = section.priority || 'medium'
    html += `  <div class="summary-section priority-${priority}">\n`
    html += `    <h2>${section.heading}</h2>\n`
    if (Array.isArray(section.content)) {
      html += '    <ul>\n'
      section.content.forEach(item => {
        html += `      <li>${item}</li>\n`
      })
      html += '    </ul>\n'
    } else {
      html += `    <p>${section.content}</p>\n`
    }
    html += '  </div>\n\n'
  })

  html += '</div>'
  return html
}
