/**
 * Shared, privacy-safe product analytics taxonomy.
 *
 * Only values from these closed lists may reach Analytics Engine. Routes are
 * reduced to feature/action pairs here so IDs, search terms, URLs, titles, and
 * other user-provided values never become telemetry dimensions.
 */

export const PRODUCT_ANALYTICS_SCHEMA_VERSION = 'product.metric.v1' as const

export const PRODUCT_EVENTS = ['page_view', 'intent', 'api_request'] as const
export type ProductEventName = (typeof PRODUCT_EVENTS)[number]

export const PRODUCT_FEATURES = [
  'landing', 'dashboard', 'authentication', 'tools_catalog',
  'content_intelligence', 'timeline', 'web_scraping', 'content_extraction',
  'citations', 'url_processing', 'rage_check', 'batch_processing',
  'equilibrium_analysis', 'hamilton_rule', 'collection', 'email_header',
  'cross_table', 'social_media', 'research_questions', 'behavior_analysis',
  'swot', 'ach', 'cog', 'pmesii_pt', 'dotmlpf', 'deception', 'comb_analysis',
  'starbursting', 'causeway', 'dime', 'pest', 'stakeholder', 'surveillance',
  'fundamental_flow', 'frameworks', 'research_workspace', 'evidence', 'datasets',
  'entities', 'network_analysis', 'reports', 'content_library', 'collaboration',
  'activity', 'intelligence', 'drops', 'cop', 'investigations', 'workspace',
  'settings', 'feedback', 'integrations', 'uploads', 'notifications',
  'ai_assistance', 'answer_packets', 'mom_assessment',
] as const
export type ProductFeature = (typeof PRODUCT_FEATURES)[number]

export const PRODUCT_ACTIONS = [
  'view', 'read', 'create', 'update', 'delete', 'analyze', 'extract', 'generate',
  'search', 'save', 'share', 'export', 'import', 'convert', 'submit', 'approve',
  'assist', 'classify', 'start', 'complete', 'save_gate', 'authenticate', 'other',
] as const
export type ProductAction = (typeof PRODUCT_ACTIONS)[number]

export type BrowserProductEvent = {
  event: Extract<ProductEventName, 'page_view' | 'intent'>
  feature: ProductFeature
  action: ProductAction
}

export interface ProductClassification {
  feature: ProductFeature
  action: ProductAction
}

const EVENT_SET = new Set<string>(PRODUCT_EVENTS)
const FEATURE_SET = new Set<string>(PRODUCT_FEATURES)
const ACTION_SET = new Set<string>(PRODUCT_ACTIONS)

export function isProductEventName(value: unknown): value is ProductEventName {
  return typeof value === 'string' && EVENT_SET.has(value)
}

export function isProductFeature(value: unknown): value is ProductFeature {
  return typeof value === 'string' && FEATURE_SET.has(value)
}

export function isProductAction(value: unknown): value is ProductAction {
  return typeof value === 'string' && ACTION_SET.has(value)
}

function starts(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Classify a browser pathname without retaining dynamic path segments. */
export function classifyProductPage(pathname: string): ProductClassification | null {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/') return { feature: 'landing', action: 'view' }
  if (path === '/login' || path === '/register' || path === '/auth/callback') {
    return { feature: 'authentication', action: 'view' }
  }
  if (starts(path, '/invite')) return { feature: 'authentication', action: 'view' }
  if (path === '/tools' || path === '/dashboard/tools') return { feature: 'tools_catalog', action: 'view' }

  const pagePrefixes: ReadonlyArray<readonly [string, ProductFeature]> = [
    ['/dashboard/tools/content-intelligence', 'content_intelligence'],
    ['/public/content-analysis', 'content_intelligence'],
    ['/dashboard/tools/timeline', 'timeline'],
    ['/dashboard/tools/scraping', 'web_scraping'],
    ['/dashboard/tools/content-extraction', 'content_extraction'],
    ['/dashboard/tools/citations-generator', 'citations'],
    ['/dashboard/tools/url', 'url_processing'],
    ['/dashboard/tools/rage-check', 'rage_check'],
    ['/dashboard/tools/batch-processing', 'batch_processing'],
    ['/dashboard/tools/equilibrium-analysis', 'equilibrium_analysis'],
    ['/dashboard/tools/hamilton-rule', 'hamilton_rule'],
    ['/dashboard/tools/collection', 'collection'],
    ['/dashboard/tools/email-header-analyzer', 'email_header'],
    ['/dashboard/tools/cross-table', 'cross_table'],
    ['/public/cross-table', 'cross_table'],
    ['/dashboard/tools/social-media', 'social_media'],
    ['/dashboard/tools/research-question-generator', 'research_questions'],
    ['/dashboard/tools/behavior-analysis', 'behavior_analysis'],
    ['/dashboard/analysis-frameworks/behavior', 'behavior_analysis'],
    ['/shared/behavior', 'behavior_analysis'],
    ['/dashboard/analysis-frameworks/swot-dashboard', 'swot'],
    ['/dashboard/analysis-frameworks/ach-dashboard', 'ach'],
    ['/dashboard/tools/ach', 'ach'],
    ['/public/ach', 'ach'],
    ['/dashboard/analysis-frameworks/cog', 'cog'],
    ['/dashboard/analysis-frameworks/pmesii-pt', 'pmesii_pt'],
    ['/dashboard/analysis-frameworks/dotmlpf', 'dotmlpf'],
    ['/dashboard/analysis-frameworks/deception', 'deception'],
    ['/dashboard/deception-risk', 'deception'],
    ['/dashboard/analysis-frameworks/comb-analysis', 'comb_analysis'],
    ['/dashboard/analysis-frameworks/starbursting', 'starbursting'],
    ['/dashboard/analysis-frameworks/causeway', 'causeway'],
    ['/dashboard/analysis-frameworks/dime', 'dime'],
    ['/dashboard/analysis-frameworks/pest', 'pest'],
    ['/dashboard/analysis-frameworks/stakeholder', 'stakeholder'],
    ['/dashboard/analysis-frameworks/surveillance', 'surveillance'],
    ['/dashboard/analysis-frameworks/fundamental-flow', 'fundamental_flow'],
    ['/public/framework', 'frameworks'],
    ['/dashboard/research/workspace', 'research_workspace'],
    ['/dashboard/research/submissions', 'research_workspace'],
    ['/dashboard/research/forms', 'research_workspace'],
    ['/dashboard/tools', 'tools_catalog'],
    ['/dashboard/evidence', 'evidence'],
    ['/dashboard/datasets', 'datasets'],
    ['/dashboard/entities', 'entities'],
    ['/dashboard/network', 'network_analysis'],
    ['/dashboard/network-graph', 'network_analysis'],
    ['/dashboard/reports', 'reports'],
    ['/dashboard/library', 'content_library'],
    ['/dashboard/collaboration', 'collaboration'],
    ['/dashboard/activity', 'activity'],
    ['/dashboard/intelligence', 'intelligence'],
    ['/dashboard/drops', 'drops'],
    ['/drop', 'drops'],
    ['/survey', 'drops'],
    ['/dashboard/cop', 'cop'],
    ['/public/cop', 'cop'],
    ['/dashboard/investigations', 'investigations'],
    ['/dashboard/workspace', 'workspace'],
    ['/dashboard/settings', 'settings'],
    ['/public/intake', 'integrations'],
  ]

  for (const [prefix, feature] of pagePrefixes) {
    if (starts(path, prefix)) return { feature, action: 'view' }
  }
  if (path === '/dashboard') return { feature: 'dashboard', action: 'view' }
  return null
}

function actionFromApiPath(pathname: string, method: string): ProductAction {
  const lower = pathname.toLowerCase()
  if (lower.includes('authenticate')) return 'authenticate'
  if (lower.includes('analy')) return 'analyze'
  if (lower.includes('extract')) return 'extract'
  if (lower.includes('generate') || lower.includes('recommend')) return 'generate'
  if (lower.includes('search')) return 'search'
  if (lower.includes('assist')) return 'assist'
  if (lower.includes('classif')) return 'classify'
  if (lower.includes('share')) return 'share'
  if (lower.includes('export')) return 'export'
  if (lower.includes('import')) return 'import'
  if (lower.includes('convert') || lower.includes('guest-conversions')) return 'convert'
  if (lower.includes('submit')) return 'submit'
  if (lower.includes('approve')) return 'approve'
  if (lower.endsWith('/start')) return 'start'
  if (lower.includes('/save')) return 'save'
  if (method === 'GET' || method === 'HEAD') return 'read'
  if (method === 'POST') return 'create'
  if (method === 'PUT' || method === 'PATCH') return 'update'
  if (method === 'DELETE') return 'delete'
  return 'other'
}

/** Classify an API request while explicitly excluding telemetry and health traffic. */
export function classifyProductApi(pathname: string, method: string): ProductClassification | null {
  const path = pathname.replace(/\/+$/, '')
  if (!path.startsWith('/api/') || method === 'OPTIONS') return null
  if (starts(path, '/api/analytics') || starts(path, '/api/client-error')
    || starts(path, '/api/health') || starts(path, '/api/cron')) return null

  const apiPrefixes: ReadonlyArray<readonly [string, ProductFeature]> = [
    ['/api/content-intelligence', 'content_intelligence'],
    ['/api/tools/extract-timeline', 'timeline'],
    ['/api/tools/timeline-assist', 'timeline'],
    ['/api/tools/classify-timeline-entry', 'timeline'],
    ['/api/ai/generate-timeline', 'timeline'],
    ['/api/intelligence/timeline', 'timeline'],
    ['/api/web-scraper', 'web_scraping'],
    ['/api/tools/scrape-metadata', 'web_scraping'],
    ['/api/ai/scrape-url', 'web_scraping'],
    ['/api/tools/extract', 'content_extraction'],
    ['/api/citations', 'citations'],
    ['/api/evidence-citations', 'citations'],
    ['/api/tools/analyze-url', 'url_processing'],
    ['/api/tools/rage-check', 'rage_check'],
    ['/api/tools/batch-process', 'batch_processing'],
    ['/api/tools/extract-claims', 'evidence'],
    ['/api/tools/claim-match', 'evidence'],
    ['/api/tools/geoconfirmed', 'entities'],
    ['/api/equilibrium-analysis', 'equilibrium_analysis'],
    ['/api/hamilton-rule', 'hamilton_rule'],
    ['/api/collection', 'collection'],
    ['/api/cross-table', 'cross_table'],
    ['/api/social-media', 'social_media'],
    ['/api/research', 'research_questions'],
    ['/api/ai/generate-questions', 'research_questions'],
    ['/api/ai/questions', 'research_questions'],
    ['/api/behaviors', 'behavior_analysis'],
    ['/api/ai/behavior-analysis', 'behavior_analysis'],
    ['/api/frameworks/behavior', 'behavior_analysis'],
    ['/api/ach', 'ach'],
    ['/api/frameworks/swot', 'swot'],
    ['/api/frameworks/pmesii', 'pmesii_pt'],
    ['/api/frameworks/comb', 'comb_analysis'],
    ['/api/frameworks', 'frameworks'],
    ['/api/framework-datasets', 'frameworks'],
    ['/api/framework-entities', 'frameworks'],
    ['/api/framework-evidence', 'frameworks'],
    ['/api/evidence', 'evidence'],
    ['/api/datasets', 'datasets'],
    ['/api/actors', 'entities'],
    ['/api/sources', 'entities'],
    ['/api/events', 'entities'],
    ['/api/claims', 'entities'],
    ['/api/relationships', 'network_analysis'],
    ['/api/reports', 'reports'],
    ['/api/content-library', 'content_library'],
    ['/api/library', 'content_library'],
    ['/api/comments', 'collaboration'],
    ['/api/invites', 'collaboration'],
    ['/api/activity', 'activity'],
    ['/api/intelligence', 'intelligence'],
    ['/api/drops', 'drops'],
    ['/api/surveys', 'drops'],
    ['/api/cop', 'cop'],
    ['/api/investigations', 'investigations'],
    ['/api/investigation-packets', 'investigations'],
    ['/api/answer-packets', 'answer_packets'],
    ['/api/mom-assessments', 'mom_assessment'],
    ['/api/deception', 'deception'],
    ['/api/entities', 'entities'],
    ['/api/places', 'entities'],
    ['/api/workspaces', 'workspace'],
    ['/api/settings', 'settings'],
    ['/api/hash-auth', 'authentication'],
    ['/api/auth', 'authentication'],
    ['/api/guest-conversions', 'authentication'],
    ['/api/feedback', 'feedback'],
    ['/api/integrations', 'integrations'],
    ['/api/uploads', 'uploads'],
    ['/api/notifications', 'notifications'],
    ['/api/user', 'settings'],
    ['/api/public', 'integrations'],
    ['/api/ai', 'ai_assistance'],
    ['/api/tools', 'tools_catalog'],
  ]

  for (const [prefix, feature] of apiPrefixes) {
    if (starts(path, prefix)) return { feature, action: actionFromApiPath(path, method) }
  }
  return null
}
