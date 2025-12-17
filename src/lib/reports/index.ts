/**
 * Enhanced Report Generation Library
 *
 * Phase 1: Visual Analytics & Executive Summary Enhancement
 *
 * This module provides enhanced reporting capabilities for all frameworks,
 * with specialized support for SWOT analysis including:
 * - Visual analytics (2x2 matrices, radar charts, bar charts, network diagrams)
 * - Executive summary generation with framework-specific insights
 * - TOWS strategic analysis
 * - Professional PDF/Word/PowerPoint exports
 *
 * Usage:
 *
 * ```typescript
 * import { generateEnhancedSWOTPDF } from '@/lib/reports'
 *
 * await generateEnhancedSWOTPDF({
 *   title: 'Market Analysis',
 *   swotData: {
 *     strengths: ['Strong brand', 'Loyal customers'],
 *     weaknesses: ['Limited resources'],
 *     opportunities: ['New markets', 'Technology trends'],
 *     threats: ['Competition', 'Regulations']
 *   },
 *   includeVisualizations: true,
 *   includeTOWS: true,
 *   includeExecutiveSummary: true
 * })
 * ```
 */

// Core utilities
export {
  generateExecutiveSummary,
  formatExecutiveSummaryForPDF,
  formatExecutiveSummaryForHTML,
  type ExecutiveSummary,
  type ExecutiveSummaryData,
} from './core/executive-summary'

// Visualization utilities
export {
  create2x2Matrix,
  createRadarChart,
  createBarChart,
  createNetworkDiagramSVG,
  defaultColors,
  type ChartColors,
  type NetworkNode,
  type NetworkEdge,
  type NetworkDiagram,
} from './visualizations/chart-utils'

// SWOT-specific
export {
  createSWOTMatrix,
  createSWOTCountChart,
  createSWOTMatrixSVG,
  analyzeSWOTData,
  generateTOWSStrategies,
  generateDecisionRecommendation,
  itemToString,
  getConfidenceWeight,
  getEvidenceBonus,
  type SWOTData,
  type SwotItem,
  type SWOTInsights,
  type TOWSStrategies,
  type OptionScore,
  type DecisionRecommendation,
} from './visualizations/swot-visuals'

export {
  generateEnhancedSWOTPDF,
  generateSWOTInsightsSummary,
  type EnhancedSWOTReportOptions,
} from './frameworks/swot-enhanced'
