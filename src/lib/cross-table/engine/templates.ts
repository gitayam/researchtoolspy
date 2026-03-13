import type { TemplateConfig, DisplayConfig, DelphiConfig } from '../types'

const DEFAULT_DISPLAY: DisplayConfig = {
  show_totals: true,
  sort_by_score: false,
  color_scale: 'red-green',
}

const DEFAULT_DELPHI: DelphiConfig = {
  current_round: 1,
  results_released: false,
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  carvar: {
    type: 'carvar',
    label: 'CARVER Matrix',
    description: 'Target analysis using Criticality, Accessibility, Recuperability, Vulnerability, Effect, Recognizability',
    scoring: { method: 'numeric', scale: { min: 1, max: 5 }, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Target 1', order: 0 },
      { label: 'Target 2', order: 1 },
      { label: 'Target 3', order: 2 },
    ],
    default_columns: [
      { label: 'Criticality', order: 0, weight: 1 },
      { label: 'Accessibility', order: 1, weight: 1 },
      { label: 'Recuperability', order: 2, weight: 1 },
      { label: 'Vulnerability', order: 3, weight: 1 },
      { label: 'Effect', order: 4, weight: 1 },
      { label: 'Recognizability', order: 5, weight: 1 },
    ],
    weighting: { method: 'equal' },
  },

  coa: {
    type: 'coa',
    label: 'Course of Action Analysis',
    description: 'Compare courses of action against mission criteria',
    scoring: { method: 'traffic', scale: null, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'COA 1', order: 0 },
      { label: 'COA 2', order: 1 },
      { label: 'COA 3', order: 2 },
    ],
    default_columns: [
      { label: 'Feasibility', order: 0, weight: 1 },
      { label: 'Acceptability', order: 1, weight: 1 },
      { label: 'Suitability', order: 2, weight: 1 },
      { label: 'Distinguishability', order: 3, weight: 1 },
      { label: 'Completeness', order: 4, weight: 1 },
    ],
    weighting: { method: 'manual' },
  },

  weighted: {
    type: 'weighted',
    label: 'Weighted Decision Matrix',
    description: 'Generic weighted scoring matrix with numeric criteria',
    scoring: { method: 'numeric', scale: { min: 1, max: 10 }, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Option A', order: 0 },
      { label: 'Option B', order: 1 },
      { label: 'Option C', order: 2 },
    ],
    default_columns: [
      { label: 'Criterion 1', order: 0, weight: 3 },
      { label: 'Criterion 2', order: 1, weight: 2 },
      { label: 'Criterion 3', order: 2, weight: 1 },
    ],
    weighting: { method: 'manual' },
  },

  pugh: {
    type: 'pugh',
    label: 'Pugh Matrix',
    description: 'Compare alternatives against a baseline using better/same/worse',
    scoring: { method: 'ternary', scale: null, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Baseline', order: 0 },
      { label: 'Concept A', order: 1 },
      { label: 'Concept B', order: 2 },
    ],
    default_columns: [
      { label: 'Criterion 1', order: 0, weight: 1 },
      { label: 'Criterion 2', order: 1, weight: 1 },
      { label: 'Criterion 3', order: 2, weight: 1 },
      { label: 'Criterion 4', order: 3, weight: 1 },
    ],
    weighting: { method: 'equal' },
  },

  risk: {
    type: 'risk',
    label: 'Risk Assessment Matrix',
    description: 'Evaluate risks by likelihood and impact using traffic light scoring',
    scoring: { method: 'traffic', scale: null, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Risk 1', order: 0 },
      { label: 'Risk 2', order: 1 },
      { label: 'Risk 3', order: 2 },
    ],
    default_columns: [
      { label: 'Likelihood', order: 0, weight: 1 },
      { label: 'Impact', order: 1, weight: 1 },
      { label: 'Detectability', order: 2, weight: 1 },
      { label: 'Mitigation Feasibility', order: 3, weight: 1 },
    ],
    weighting: { method: 'manual' },
  },

  'kepner-tregoe': {
    type: 'kepner-tregoe',
    label: 'Kepner-Tregoe Decision Analysis',
    description: 'Structured decision analysis with Must-have (binary) and Want (numeric weighted) criteria',
    scoring: { method: 'numeric', scale: { min: 1, max: 10 }, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Alternative 1', order: 0 },
      { label: 'Alternative 2', order: 1 },
      { label: 'Alternative 3', order: 2 },
    ],
    default_columns: [
      { label: 'Must: Budget Limit', order: 0, weight: 1, scoring_override: 'binary', group: 'must' },
      { label: 'Must: Timeline', order: 1, weight: 1, scoring_override: 'binary', group: 'must' },
      { label: 'Want: Quality', order: 2, weight: 8, scoring_override: 'numeric', numeric_config: { min: 1, max: 10 }, group: 'want' },
      { label: 'Want: Cost', order: 3, weight: 6, scoring_override: 'numeric', numeric_config: { min: 1, max: 10 }, group: 'want' },
      { label: 'Want: Flexibility', order: 4, weight: 4, scoring_override: 'numeric', numeric_config: { min: 1, max: 10 }, group: 'want' },
    ],
    weighting: { method: 'manual' },
  },

  prioritization: {
    type: 'prioritization',
    label: 'Prioritization Matrix',
    description: 'Prioritize items using AHP-weighted criteria',
    scoring: { method: 'likert', scale: null, labels: ['Very Low', 'Low', 'Medium', 'High', 'Very High'] },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Item 1', order: 0 },
      { label: 'Item 2', order: 1 },
      { label: 'Item 3', order: 2 },
    ],
    default_columns: [
      { label: 'Urgency', order: 0, weight: 1 },
      { label: 'Impact', order: 1, weight: 1 },
      { label: 'Effort', order: 2, weight: 1 },
      { label: 'Strategic Alignment', order: 3, weight: 1 },
    ],
    weighting: { method: 'ahp' },
  },

  blank: {
    type: 'blank',
    label: 'Blank Matrix',
    description: 'Start from scratch with a custom decision matrix',
    scoring: { method: 'numeric', scale: { min: 1, max: 10 }, labels: null },
    display: DEFAULT_DISPLAY,
    delphi: DEFAULT_DELPHI,
    default_rows: [
      { label: 'Option 1', order: 0 },
      { label: 'Option 2', order: 1 },
    ],
    default_columns: [
      { label: 'Criterion 1', order: 0, weight: 1 },
      { label: 'Criterion 2', order: 1, weight: 1 },
    ],
    weighting: { method: 'equal' },
  },
}

/** Get all template configs */
export function getTemplates(): TemplateConfig[] {
  return Object.values(TEMPLATES)
}

/** Get a specific template config */
export function getTemplate(type: string): TemplateConfig | undefined {
  return TEMPLATES[type]
}
