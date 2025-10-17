/**
 * SWOT Analysis Visualizations
 * Creates visual representations of SWOT analysis for reports
 */

import { create2x2Matrix, createBarChart, defaultColors } from './chart-utils'
import type { ChartConfiguration } from 'chart.js'

export interface SwotItem {
  id?: string
  text: string
  details?: string
  confidence?: 'low' | 'medium' | 'high'
  evidence_ids?: string[]
  tags?: string[]
  appliesTo?: string[]  // Which option(s) this item applies to
}

export interface SWOTData {
  strengths: string[] | SwotItem[]
  weaknesses: string[] | SwotItem[]
  opportunities: string[] | SwotItem[]
  threats: string[] | SwotItem[]
  goal?: string  // Overall goal or decision being made
  options?: string[]  // Options being considered
}

/**
 * Creates a 2x2 SWOT matrix visualization
 */
export function createSWOTMatrix(data: SWOTData, title: string = 'SWOT Analysis Matrix'): ChartConfiguration {
  return create2x2Matrix(
    {
      topLeft: {
        label: 'Strengths (Internal Positive)',
        items: data.strengths.map(itemToString),
        color: defaultColors.success,
      },
      topRight: {
        label: 'Opportunities (External Positive)',
        items: data.opportunities.map(itemToString),
        color: defaultColors.info,
      },
      bottomLeft: {
        label: 'Weaknesses (Internal Negative)',
        items: data.weaknesses.map(itemToString),
        color: defaultColors.warning,
      },
      bottomRight: {
        label: 'Threats (External Negative)',
        items: data.threats.map(itemToString),
        color: defaultColors.danger,
      },
    },
    title
  )
}

/**
 * Creates a count comparison bar chart showing distribution of SWOT elements
 */
export function createSWOTCountChart(data: SWOTData): ChartConfiguration {
  return createBarChart(
    ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
    [
      {
        label: 'Number of Items',
        data: [
          data.strengths.length,
          data.weaknesses.length,
          data.opportunities.length,
          data.threats.length,
        ],
        color: defaultColors.primary,
      },
    ],
    {
      title: 'SWOT Element Distribution',
      horizontal: false,
    }
  )
}

/**
 * Generates SWOT matrix SVG for PDF/PowerPoint export
 */
export function createSWOTMatrixSVG(
  data: SWOTData,
  width: number = 600,
  height: number = 400
): string {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const padding = 20
  const titleHeight = 30

  // Quadrant colors
  const colors = {
    strengths: '#22c55e',
    opportunities: '#3b82f6',
    weaknesses: '#f59e0b',
    threats: '#ef4444',
  }

  // Helper to create text elements with word wrapping
  const createTextList = (items: (string | SwotItem)[], x: number, y: number, maxWidth: number): string => {
    let yOffset = y + 25
    return items
      .slice(0, 5) // Limit to 5 items per quadrant for readability
      .map((item, i) => {
        const itemText = itemToString(item)
        const truncated = itemText.length > 40 ? itemText.substring(0, 37) + '...' : itemText
        const text = `<text x="${x + 10}" y="${yOffset}" font-size="11" fill="#1e293b">• ${truncated}</text>`
        yOffset += 18
        return text
      })
      .join('')
  }

  return `
    <svg width="${width}" height="${height + titleHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Title -->
      <text x="${width / 2}" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">
        SWOT Analysis Matrix
      </text>

      <!-- Grid Lines -->
      <line x1="0" y1="${titleHeight}" x2="0" y2="${height + titleHeight}" stroke="#1e293b" stroke-width="2"/>
      <line x1="${width}" y1="${titleHeight}" x2="${width}" y2="${height + titleHeight}" stroke="#1e293b" stroke-width="2"/>
      <line x1="0" y1="${titleHeight}" x2="${width}" y2="${titleHeight}" stroke="#1e293b" stroke-width="2"/>
      <line x1="0" y1="${height + titleHeight}" x2="${width}" y2="${height + titleHeight}" stroke="#1e293b" stroke-width="2"/>
      <line x1="${halfWidth}" y1="${titleHeight}" x2="${halfWidth}" y2="${height + titleHeight}" stroke="#1e293b" stroke-width="2"/>
      <line x1="0" y1="${halfHeight + titleHeight}" x2="${width}" y2="${halfHeight + titleHeight}" stroke="#1e293b" stroke-width="2"/>

      <!-- Strengths (Top Left) -->
      <rect x="0" y="${titleHeight}" width="${halfWidth}" height="${halfHeight}" fill="${colors.strengths}" opacity="0.1"/>
      <text x="${halfWidth / 2}" y="${titleHeight + 20}" text-anchor="middle" font-size="14" font-weight="bold" fill="${colors.strengths}">
        STRENGTHS
      </text>
      <text x="${halfWidth / 2}" y="${titleHeight + 35}" text-anchor="middle" font-size="10" fill="#64748b">
        Internal • Positive
      </text>
      ${createTextList(data.strengths, 5, titleHeight, halfWidth - 10)}

      <!-- Opportunities (Top Right) -->
      <rect x="${halfWidth}" y="${titleHeight}" width="${halfWidth}" height="${halfHeight}" fill="${colors.opportunities}" opacity="0.1"/>
      <text x="${halfWidth + halfWidth / 2}" y="${titleHeight + 20}" text-anchor="middle" font-size="14" font-weight="bold" fill="${colors.opportunities}">
        OPPORTUNITIES
      </text>
      <text x="${halfWidth + halfWidth / 2}" y="${titleHeight + 35}" text-anchor="middle" font-size="10" fill="#64748b">
        External • Positive
      </text>
      ${createTextList(data.opportunities, halfWidth + 5, titleHeight, halfWidth - 10)}

      <!-- Weaknesses (Bottom Left) -->
      <rect x="0" y="${halfHeight + titleHeight}" width="${halfWidth}" height="${halfHeight}" fill="${colors.weaknesses}" opacity="0.1"/>
      <text x="${halfWidth / 2}" y="${halfHeight + titleHeight + 20}" text-anchor="middle" font-size="14" font-weight="bold" fill="${colors.weaknesses}">
        WEAKNESSES
      </text>
      <text x="${halfWidth / 2}" y="${halfHeight + titleHeight + 35}" text-anchor="middle" font-size="10" fill="#64748b">
        Internal • Negative
      </text>
      ${createTextList(data.weaknesses, 5, halfHeight + titleHeight, halfWidth - 10)}

      <!-- Threats (Bottom Right) -->
      <rect x="${halfWidth}" y="${halfHeight + titleHeight}" width="${halfWidth}" height="${halfHeight}" fill="${colors.threats}" opacity="0.1"/>
      <text x="${halfWidth + halfWidth / 2}" y="${halfHeight + titleHeight + 20}" text-anchor="middle" font-size="14" font-weight="bold" fill="${colors.threats}">
        THREATS
      </text>
      <text x="${halfWidth + halfWidth / 2}" y="${halfHeight + titleHeight + 35}" text-anchor="middle" font-size="10" fill="#64748b">
        External • Negative
      </text>
      ${createTextList(data.threats, halfWidth + 5, halfHeight + titleHeight, halfWidth - 10)}
    </svg>
  `
}

/**
 * Analyzes SWOT data to generate strategic insights
 */
export interface SWOTInsights {
  totalItems: number
  internalVsExternal: {
    internal: number // strengths + weaknesses
    external: number // opportunities + threats
  }
  positiveVsNegative: {
    positive: number // strengths + opportunities
    negative: number // weaknesses + threats
  }
  balance: 'internal-focused' | 'external-focused' | 'balanced'
  sentiment: 'positive' | 'negative' | 'neutral'
}

export function analyzeSWOTData(data: SWOTData): SWOTInsights {
  const internal = data.strengths.length + data.weaknesses.length
  const external = data.opportunities.length + data.threats.length
  const positive = data.strengths.length + data.opportunities.length
  const negative = data.weaknesses.length + data.threats.length
  const total = internal + external

  let balance: SWOTInsights['balance'] = 'balanced'
  if (internal > external * 1.5) balance = 'internal-focused'
  else if (external > internal * 1.5) balance = 'external-focused'

  let sentiment: SWOTInsights['sentiment'] = 'neutral'
  if (positive > negative * 1.3) sentiment = 'positive'
  else if (negative > positive * 1.3) sentiment = 'negative'

  return {
    totalItems: total,
    internalVsExternal: { internal, external },
    positiveVsNegative: { positive, negative },
    balance,
    sentiment,
  }
}

/**
 * Generates TOWS strategic recommendations based on SWOT data
 */
export interface TOWSStrategies {
  SO: string[] // Strengths + Opportunities (Growth strategies)
  ST: string[] // Strengths + Threats (Diversification strategies)
  WO: string[] // Weaknesses + Opportunities (Development strategies)
  WT: string[] // Weaknesses + Threats (Defensive strategies)
}

export function generateTOWSStrategies(data: SWOTData): TOWSStrategies {
  // This is a simplified version - in practice, this would use AI or more sophisticated matching
  return {
    SO: [
      `Leverage identified strengths to capitalize on ${data.opportunities.length} opportunities`,
      'Pursue growth strategies in areas where strengths align with market opportunities',
    ],
    ST: [
      `Use organizational strengths to mitigate ${data.threats.length} identified threats`,
      'Diversify capabilities to reduce vulnerability to external threats',
    ],
    WO: [
      `Address ${data.weaknesses.length} weaknesses to better exploit opportunities`,
      'Develop capabilities in weak areas where opportunities exist',
    ],
    WT: [
      'Implement defensive strategies to minimize weaknesses and avoid threats',
      'Consider strategic partnerships to address critical vulnerabilities',
    ],
  }
}

/**
 * Helper: Convert SwotItem to string for visualization
 */
export function itemToString(item: string | SwotItem): string {
  return typeof item === 'string' ? item : item.text
}

/**
 * Helper: Get confidence weight for scoring
 */
export function getConfidenceWeight(item: string | SwotItem): number {
  if (typeof item === 'string') return 1.0

  switch (item.confidence) {
    case 'high': return 1.0
    case 'medium': return 0.7
    case 'low': return 0.4
    default: return 0.5
  }
}

/**
 * Helper: Get evidence bonus for scoring
 */
export function getEvidenceBonus(item: string | SwotItem): number {
  if (typeof item === 'string') return 0
  return (item.evidence_ids?.length || 0) * 0.15
}

/**
 * Decision Recommendation Algorithm
 * Analyzes SWOT data for multiple options and recommends the best choice
 */
export interface OptionScore {
  option: string
  strengthScore: number
  weaknessScore: number
  opportunityScore: number
  threatScore: number
  totalPositive: number
  totalNegative: number
  netScore: number
  confidenceScore: number
  evidenceCount: number
  recommendation: 'highly_recommended' | 'recommended' | 'viable' | 'not_recommended'
  reasoning: string[]
}

export interface DecisionRecommendation {
  goal?: string
  topChoice: string
  scores: OptionScore[]
  comparisonMatrix: {
    option: string
    strengths: number
    weaknesses: number
    opportunities: number
    threats: number
    score: number
  }[]
  reasoning: string[]
}

export function generateDecisionRecommendation(data: SWOTData): DecisionRecommendation | null {
  if (!data.options || data.options.length === 0) {
    return null
  }

  // Helper to filter items by option and calculate score
  const scoreItemsForOption = (items: (string | SwotItem)[], option: string) => {
    const relevantItems = items.filter(item => {
      if (typeof item === 'string') return true // All items if no options specified on items
      if (!item.appliesTo || item.appliesTo.length === 0) return true // Applies to all
      return item.appliesTo.includes(option)
    })

    const score = relevantItems.reduce((sum, item) => {
      const confidenceWeight = getConfidenceWeight(item)
      const evidenceBonus = getEvidenceBonus(item)
      return sum + confidenceWeight + evidenceBonus
    }, 0)

    return { count: relevantItems.length, score }
  }

  // Calculate scores for each option
  const scores: OptionScore[] = data.options.map(option => {
    const strengths = scoreItemsForOption(data.strengths, option)
    const weaknesses = scoreItemsForOption(data.weaknesses, option)
    const opportunities = scoreItemsForOption(data.opportunities, option)
    const threats = scoreItemsForOption(data.threats, option)

    const totalPositive = strengths.score + opportunities.score
    const totalNegative = weaknesses.score + threats.score
    const netScore = (totalPositive * 2.0) - (totalNegative * 1.5)

    // Calculate confidence score (based on evidence)
    const allItems = [
      ...data.strengths,
      ...data.weaknesses,
      ...data.opportunities,
      ...data.threats
    ].filter(item => {
      if (typeof item === 'string') return true
      if (!item.appliesTo || item.appliesTo.length === 0) return true
      return item.appliesTo.includes(option)
    })

    const evidenceCount = allItems.reduce((sum, item) => {
      if (typeof item === 'string') return sum
      return sum + (item.evidence_ids?.length || 0)
    }, 0)

    const highConfidenceCount = allItems.filter(item => {
      if (typeof item === 'string') return false
      return item.confidence === 'high'
    }).length

    const confidenceScore = highConfidenceCount * 0.3 + (evidenceCount * 0.1)

    // Determine recommendation level
    let recommendation: OptionScore['recommendation']
    if (netScore > 5 && totalPositive > totalNegative * 2) {
      recommendation = 'highly_recommended'
    } else if (netScore > 2 && totalPositive > totalNegative) {
      recommendation = 'recommended'
    } else if (netScore > -2) {
      recommendation = 'viable'
    } else {
      recommendation = 'not_recommended'
    }

    // Generate reasoning
    const reasoning: string[] = []
    if (strengths.count > 0) {
      reasoning.push(`${strengths.count} strengths identified (score: ${strengths.score.toFixed(1)})`)
    }
    if (opportunities.count > 0) {
      reasoning.push(`${opportunities.count} opportunities available (score: ${opportunities.score.toFixed(1)})`)
    }
    if (weaknesses.count > 0) {
      reasoning.push(`${weaknesses.count} weaknesses to address (score: ${weaknesses.score.toFixed(1)})`)
    }
    if (threats.count > 0) {
      reasoning.push(`${threats.count} threats to mitigate (score: ${threats.score.toFixed(1)})`)
    }
    if (totalPositive > totalNegative * 1.5) {
      reasoning.push('Strong positive outlook')
    } else if (totalNegative > totalPositive) {
      reasoning.push('Challenging factors outweigh positives')
    }
    if (evidenceCount > 5) {
      reasoning.push(`Well-evidenced with ${evidenceCount} supporting items`)
    }

    return {
      option,
      strengthScore: strengths.score,
      weaknessScore: weaknesses.score,
      opportunityScore: opportunities.score,
      threatScore: threats.score,
      totalPositive,
      totalNegative,
      netScore,
      confidenceScore,
      evidenceCount,
      recommendation,
      reasoning
    }
  })

  // Sort by net score (descending)
  scores.sort((a, b) => b.netScore - a.netScore)

  // Build comparison matrix
  const comparisonMatrix = scores.map(score => ({
    option: score.option,
    strengths: Math.round(score.strengthScore * 10) / 10,
    weaknesses: Math.round(score.weaknessScore * 10) / 10,
    opportunities: Math.round(score.opportunityScore * 10) / 10,
    threats: Math.round(score.threatScore * 10) / 10,
    score: Math.round(score.netScore * 10) / 10
  }))

  // Overall recommendation reasoning
  const overallReasoning: string[] = []
  const topChoice = scores[0]
  const secondChoice = scores[1]

  if (topChoice.recommendation === 'highly_recommended') {
    overallReasoning.push(`${topChoice.option} is the clear leader with strong positive factors and minimal risks`)
  } else if (topChoice.recommendation === 'recommended') {
    overallReasoning.push(`${topChoice.option} emerges as the best option with favorable characteristics`)
  } else if (topChoice.recommendation === 'viable') {
    overallReasoning.push(`${topChoice.option} is viable but requires careful risk management`)
  } else {
    overallReasoning.push(`No option is strongly recommended - all have significant challenges`)
  }

  if (secondChoice && Math.abs(topChoice.netScore - secondChoice.netScore) < 1) {
    overallReasoning.push(`Close competition with ${secondChoice.option} (difference: ${Math.abs(topChoice.netScore - secondChoice.netScore).toFixed(1)})`)
  } else if (secondChoice) {
    overallReasoning.push(`${topChoice.option} leads by ${(topChoice.netScore - secondChoice.netScore).toFixed(1)} points`)
  }

  // Highlight differentiators
  if (topChoice.strengthScore > (secondChoice?.strengthScore || 0) * 1.5) {
    overallReasoning.push(`${topChoice.option} has significantly stronger capabilities`)
  }
  if (topChoice.opportunityScore > (secondChoice?.opportunityScore || 0) * 1.5) {
    overallReasoning.push(`${topChoice.option} has better growth opportunities`)
  }
  if (secondChoice && topChoice.threatScore < secondChoice.threatScore * 0.7) {
    overallReasoning.push(`${topChoice.option} faces fewer external risks`)
  }

  return {
    goal: data.goal,
    topChoice: topChoice.option,
    scores,
    comparisonMatrix,
    reasoning: overallReasoning
  }
}
