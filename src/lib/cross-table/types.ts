/** Scoring method types for cross-table cells */
export type ScoringMethod = 'numeric' | 'likert' | 'traffic' | 'ternary' | 'binary' | 'ach'

/** Traffic light values */
export type TrafficValue = 'R' | 'A' | 'G'

/** Ternary values */
export type TernaryValue = '+' | '0' | '-'

/** Binary values */
export type BinaryValue = 'yes' | 'no'

/** ACH consistency values */
export type ACHValue = 'CC' | 'C' | 'N' | 'I' | 'II'

/** Template types */
export type TemplateType =
  | 'carvar'
  | 'coa'
  | 'weighted'
  | 'pugh'
  | 'risk'
  | 'kepner-tregoe'
  | 'prioritization'
  | 'blank'

/** Weighting method */
export type WeightingMethod = 'equal' | 'manual' | 'ahp'

/** A row (alternative/option) in the matrix */
export interface CrossTableRow {
  id: string
  label: string
  description?: string
  order: number
}

/** A column (criterion) in the matrix */
export interface CrossTableColumn {
  id: string
  label: string
  description?: string
  order: number
  weight: number
  /** Per-column scoring override (e.g., Kepner-Tregoe: Musts=binary, Wants=numeric) */
  scoring_override?: ScoringMethod
  /** Numeric scoring config when scoring_override or matrix method is 'numeric' */
  numeric_config?: { min: number; max: number }
  /** Likert labels when scoring_override or matrix method is 'likert' */
  likert_labels?: string[]
  /** Column group for K-T (e.g., 'must' | 'want') */
  group?: string
}

/** Weighting configuration */
export interface WeightingConfig {
  method: WeightingMethod
  /** AHP pairwise comparison matrix (upper triangle, 1-9 scale) */
  ahp_matrix?: number[][]
  /** AHP consistency ratio */
  ahp_cr?: number
}

/** Scoring configuration nested under config.scoring */
export interface ScoringConfig {
  method: ScoringMethod
  scale?: { min: number; max: number } | null
  labels?: string[] | null
}

/** Display configuration nested under config.display */
export interface DisplayConfig {
  show_totals: boolean
  sort_by_score: boolean
  color_scale: string
}

/** Delphi configuration nested under config.delphi */
export interface DelphiConfig {
  current_round: number
  results_released: boolean
}

/** Full cross-table configuration stored as JSON in config column */
export interface CrossTableConfig {
  scoring: ScoringConfig
  display: DisplayConfig
  delphi: DelphiConfig
  rows: CrossTableRow[]
  columns: CrossTableColumn[]
  weighting: WeightingConfig
}

/** A single score entry */
export interface Score {
  id: string
  cross_table_id: string
  row_id: string
  col_id: string
  user_id: number
  round: number
  score: number | null
  confidence: number
  notes?: string
  created_at: string
  updated_at: string
}

/** A scorer/collaborator */
export interface Scorer {
  id: string
  cross_table_id: string
  user_id: number | null
  invite_token: string
  status: 'invited' | 'accepted' | 'scoring' | 'submitted'
  invited_at: string
  accepted_at?: string
}

/** The full cross-table record */
export interface CrossTable {
  id: string
  user_id: number
  title: string
  description?: string
  template_type: TemplateType
  config: CrossTableConfig
  status: 'draft' | 'scoring' | 'complete'
  is_public: boolean
  share_token?: string
  created_at: string
  updated_at: string
}

/** Weighted score result for a single row */
export interface RowResult {
  row_id: string
  weighted_score: number
  rank: number
  /** Per-column normalized scores */
  normalized_scores: Record<string, number>
}

/** Sensitivity analysis result for a single perturbation */
export interface SensitivityPoint {
  col_id: string
  original_weight: number
  perturbed_weight: number
  /** Row ID → new weighted score */
  scores: Record<string, number>
  /** Row ID → new rank */
  ranks: Record<string, number>
}

/** Tornado chart data for one criterion */
export interface TornadoEntry {
  col_id: string
  label: string
  /** Score swing when weight goes down */
  low: number
  /** Score swing when weight goes up */
  high: number
  /** Base score */
  base: number
}

/** Delphi round statistics for a single cell */
export interface DelphiCellStats {
  row_id: string
  col_id: string
  round: number
  median: number
  iqr: number
  min: number
  max: number
  count: number
  high_disagreement: boolean
}

/** Delphi consensus metrics */
export interface DelphiConsensus {
  kendall_w: number
  round: number
  cell_stats: DelphiCellStats[]
  /** Number of cells with IQR > 1.5 (on 0-5 scale) */
  high_disagreement_count: number
}

/** Template configuration */
export interface TemplateConfig {
  type: TemplateType
  label: string
  description: string
  scoring: ScoringConfig
  display: DisplayConfig
  delphi: DelphiConfig
  default_rows: Omit<CrossTableRow, 'id'>[]
  default_columns: Omit<CrossTableColumn, 'id'>[]
  weighting: WeightingConfig
}
