/**
 * Shared test data and constants for COP E2E tests.
 */

export const URLS = {
  copList: '/dashboard/cop',
  copViewer: (id: string) => `/dashboard/cop/${id}`,
  copWorkspace: (id: string) => `/dashboard/cop/${id}`,
  publicCop: (token: string) => `/public/cop/${token}`,
  deceptionCreate: '/dashboard/analysis-frameworks/deception/create',
  crossTableList: '/dashboard/tools/cross-table',
  crossTableNew: '/dashboard/tools/cross-table/new',
  crossTableEditor: (id: string) => `/dashboard/tools/cross-table/${id}`,
  crossTableScorer: (id: string) => `/dashboard/tools/cross-table/${id}/score`,
}

export const TEMPLATES = {
  quick_brief: 'Quick Brief',
  event_monitor: 'Event Monitor',
  area_study: 'Area Study',
  crisis_response: 'Crisis Response',
  event_analysis: 'Event Analysis',
  custom: 'Custom',
} as const

export const EVENT_TYPES = [
  'natural_disaster',
  'armed_conflict',
  'election',
  'protest',
  'terror_attack',
  'mass_shooting',
  'pandemic',
  'cyber_attack',
  'sports_event',
  'political_event',
  'economic_event',
  'other',
] as const

export const VALID_LOCATIONS = {
  tehran: { name: 'Tehran, Iran', lat: 35.6892, lon: 51.389 },
  dc: { name: 'Washington, DC', lat: 38.9072, lon: -77.0369 },
  london: { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
  coords: { name: '35.6892, 51.389', lat: 35.6892, lon: 51.389 },
}

export const INVALID_LOCATIONS = {
  outOfRange: '200, 300',
  noNumbers: 'not a location',
}

export const TIME_WINDOWS = ['1h', '6h', '24h', '48h', '7d', 'Ongoing'] as const

export const RFI_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

export const SAMPLE_QUESTIONS = [
  'What are the main actors involved?',
  'What is the current threat level?',
  'What infrastructure is at risk?',
]

export const SAMPLE_EVENT = {
  type: 'natural_disaster' as const,
  description: 'Major earthquake in the region causing significant damage to infrastructure',
  urls: ['https://example.com/article1', 'https://example.com/article2'],
}

export const SAMPLE_RFI = {
  question: 'What are the latest casualty figures?',
  priority: 'high' as const,
}

export const SAMPLE_ANSWER = {
  text: 'Latest reports indicate approximately 50 casualties confirmed.',
  sourceUrl: 'https://example.com/report',
  sourceDescription: 'Official government press release',
}

export const CROSS_TABLE_TEMPLATES = [
  'carvar',
  'coa',
  'weighted',
  'pugh',
  'risk',
  'kepner-tregoe',
  'prioritization',
  'blank',
] as const

export const CROSS_TABLE_SCORING_METHODS = [
  'numeric',
  'traffic_light',
  'ternary',
  'binary',
  'ach',
  'likert',
] as const
