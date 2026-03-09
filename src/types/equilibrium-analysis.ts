/**
 * Equilibrium Analysis Types
 *
 * For analyzing longitudinal behavioral data to detect equilibrium states.
 * Supports CSV upload of time series data (crime rates, voting participation, etc.)
 * and AI-assisted detection of sustained rate patterns.
 */

/**
 * A single data point in the time series
 */
export interface TimeSeriesDataPoint {
  timestamp: string
  rate: number
  group?: string
  metadata?: Record<string, number | string>
}

/**
 * Data source configuration
 */
export interface DataSource {
  type: 'csv_upload' | 'manual'
  filename?: string
  uploaded_at?: string
  original_headers?: string[]
  row_count?: number
}

/**
 * Variable mapping configuration
 */
export interface VariableConfig {
  time_column: string           // e.g., "date", "year"
  rate_column: string           // e.g., "crime_rate", "voter_turnout"
  group_column?: string         // e.g., "region", "demographic"
  additional_columns?: string[] // Other variables to track
}

/**
 * Trend direction for equilibrium analysis
 */
export type EquilibriumTrend = 'approaching' | 'at_equilibrium' | 'departing' | 'oscillating'

/**
 * AI-detected equilibrium analysis results
 */
export interface EquilibriumResult {
  equilibrium_rate: number      // Highest sustained rate
  equilibrium_period: {
    start: string
    end: string
  }
  current_rate: number
  rate_delta: number            // current - equilibrium
  rate_delta_percent: number    // percentage difference
  trend: EquilibriumTrend
  stability_score: number       // 0-100
  ai_explanation: string        // GPT analysis
  resistors: string[]           // Environmental factors limiting growth
  enablers: string[]            // Factors that could push rate higher
  hamilton_interpretation?: string  // How this relates to rB > C
}

/**
 * Statistical summary of the time series
 */
export interface TimeSeriesStatistics {
  mean: number
  median: number
  std_deviation: number
  variance: number
  min: number
  max: number
  trend_coefficient: number     // Slope of linear regression
  r_squared?: number            // Fit quality
  data_points: number
  time_span_days?: number
}

/**
 * Main Equilibrium Analysis interface
 */
export interface EquilibriumAnalysis {
  id?: string
  title: string
  description: string
  linked_behavior_id?: string
  linked_behavior_title?: string

  // Data source
  data_source: DataSource

  // Time series data
  time_series: TimeSeriesDataPoint[]

  // Variable configuration
  variables: VariableConfig

  // AI-detected equilibrium points
  equilibrium_analysis?: EquilibriumResult

  // Statistics
  statistics?: TimeSeriesStatistics

  // Metadata
  workspace_id?: string
  created_by?: number
  created_at?: string
  updated_at?: string
  is_public?: boolean
  tags?: string[]
}

/**
 * Request payload for creating/updating equilibrium analysis
 */
export interface EquilibriumAnalysisRequest {
  title: string
  description?: string
  linked_behavior_id?: string
  workspace_id: string
  variables?: VariableConfig
  time_series?: TimeSeriesDataPoint[]
  is_public?: boolean
  tags?: string[]
}

/**
 * Response from AI equilibrium analysis
 */
export interface EquilibriumAIResponse {
  equilibrium_rate: number
  equilibrium_period: { start: string; end: string }
  rate_delta: number
  trend: EquilibriumTrend
  stability_score: number
  resistors: string[]
  enablers: string[]
  explanation: string
  hamilton_interpretation?: string
}

/**
 * CSV parsing result
 */
export interface CSVParseResult {
  headers: string[]
  rows: Record<string, string | number>[]
  errors?: string[]
  row_count: number
}

/**
 * Chart data point for visualization
 */
export interface EquilibriumChartPoint {
  x: string | number  // timestamp or index
  y: number           // rate value
  isEquilibrium?: boolean
  isCurrent?: boolean
}
