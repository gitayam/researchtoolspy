/**
 * SWOT Analysis Visualizations
 * Creates visual representations of SWOT analysis for reports
 */

import { create2x2Matrix, createBarChart, defaultColors } from './chart-utils'
import type { ChartConfiguration } from 'chart.js'

export interface SWOTData {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

/**
 * Creates a 2x2 SWOT matrix visualization
 */
export function createSWOTMatrix(data: SWOTData, title: string = 'SWOT Analysis Matrix'): ChartConfiguration {
  return create2x2Matrix(
    {
      topLeft: {
        label: 'Strengths (Internal Positive)',
        items: data.strengths,
        color: defaultColors.success,
      },
      topRight: {
        label: 'Opportunities (External Positive)',
        items: data.opportunities,
        color: defaultColors.info,
      },
      bottomLeft: {
        label: 'Weaknesses (Internal Negative)',
        items: data.weaknesses,
        color: defaultColors.warning,
      },
      bottomRight: {
        label: 'Threats (External Negative)',
        items: data.threats,
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
  const createTextList = (items: string[], x: number, y: number, maxWidth: number): string => {
    let yOffset = y + 25
    return items
      .slice(0, 5) // Limit to 5 items per quadrant for readability
      .map((item, i) => {
        const truncated = item.length > 40 ? item.substring(0, 37) + '...' : item
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
