export type DiscoveryGroup = 'Tools' | 'Navigate' | 'Frameworks'
export type DiscoveryIcon =
  | 'activity'
  | 'archive'
  | 'bar-chart'
  | 'book'
  | 'brain'
  | 'calendar'
  | 'code'
  | 'database'
  | 'file-stack'
  | 'file-text'
  | 'folder'
  | 'globe'
  | 'home'
  | 'lightbulb'
  | 'mail'
  | 'map'
  | 'network'
  | 'search'
  | 'settings'
  | 'share'
  | 'shield'
  | 'sparkles'
  | 'table'
  | 'users'
  | 'zap'

export interface DiscoveryEntry {
  group: DiscoveryGroup
  label: string
  href: string
  description: string
  keywords: string[]
  icon: DiscoveryIcon
}

export const DISCOVERY_ENTRIES: DiscoveryEntry[] = [
  // Research tools
  {
    group: 'Tools', label: 'Research Question Generator', href: '/dashboard/tools/research-question-generator', icon: 'sparkles',
    description: 'Generate and assess research questions, hypotheses, and methodology.',
    keywords: ['SMART', 'FINER', 'PICO', 'question builder', 'research plan', 'methodology', 'hypothesis'],
  },
  {
    group: 'Tools', label: 'Content Research', href: '/dashboard/tools/content-intelligence', icon: 'search',
    description: 'Extract and analyze articles, entities, claims, topics, links, and archives.',
    keywords: ['content intelligence', 'analyze URL', 'article analysis', 'framework enhanced analysis', 'entity extraction', 'claim extraction', 'DIME', 'timeline from article', 'archive recovery'],
  },
  {
    group: 'Tools', label: 'Timeline Analysis', href: '/dashboard/tools/timeline', icon: 'calendar',
    description: 'Build event chronologies, place known events, expose gaps, and drive follow-up research.',
    keywords: ['timeline', 'chronology', 'event sequence', 'date time', 'relative event', 'before after', 'first second third last', 'positional event', 'information gap', 'what happened here', 'analyst timeline', 'cited finding'],
  },
  {
    group: 'Tools', label: 'Email Header Analyzer', href: '/dashboard/tools/email-header-analyzer', icon: 'mail',
    description: 'Inspect email routing, delays, SPF, DKIM, DMARC, and message metadata.',
    keywords: ['email headers', 'routing hops', 'authentication', 'phishing', 'SPF', 'DKIM', 'DMARC', 'message ID'],
  },
  {
    group: 'Tools', label: 'Behavior Analysis Intake', href: '/dashboard/tools/behavior-analysis', icon: 'brain',
    description: 'Start an intelligence or product behavior diagnosis using COM-B.',
    keywords: ['behavior analysis', 'behaviour analysis', 'audience diagnosis', 'COM-B intake', 'intervention recommendation', 'motivation'],
  },
  {
    group: 'Tools', label: 'Cross Table', href: '/dashboard/tools/cross-table', icon: 'table',
    description: 'Compare options with weighted criteria, AHP, Delphi scoring, and sensitivity analysis.',
    keywords: ['comparison matrix', 'CARVER', 'CARVAR', 'course of action', 'COA', 'Pugh', 'risk matrix', 'AHP', 'Delphi', 'tornado chart'],
  },
  {
    group: 'Tools', label: 'Content Extraction', href: '/dashboard/tools/content-extraction', icon: 'file-text',
    description: 'Extract readable text and metadata from documents and web content.',
    keywords: ['extract text', 'readability', 'document parser', 'metadata', 'article text', 'PDF extraction'],
  },
  {
    group: 'Tools', label: 'Batch Processing', href: '/dashboard/tools/batch-processing', icon: 'file-stack',
    description: 'Process multiple URLs or research items in a bounded batch.',
    keywords: ['bulk URLs', 'batch URLs', 'multiple links', 'queue', 'bulk processing'],
  },
  {
    group: 'Tools', label: 'URL Processing', href: '/dashboard/tools/url', icon: 'globe',
    description: 'Normalize, inspect, and process URLs for research workflows.',
    keywords: ['URL parser', 'link processing', 'normalize URL', 'domain', 'web address'],
  },
  {
    group: 'Tools', label: 'Web Scraping', href: '/dashboard/tools/scraping', icon: 'code',
    description: 'Run bounded web extraction with safe fetching, structured output, and observability.',
    keywords: ['scrape', 'scraper', 'web extraction', 'safe fetch', 'browser rendering', 'fallback chain', 'HTML', 'structured extraction', 'robots', 'scraping analytics'],
  },
  {
    group: 'Tools', label: 'Social Media', href: '/dashboard/tools/social-media', icon: 'share',
    description: 'Collect and analyze supported social-media content and profiles.',
    keywords: ['social extraction', 'YouTube', 'TikTok', 'Bluesky', 'Facebook', 'Instagram', 'Twitter', 'X posts'],
  },
  {
    group: 'Tools', label: 'Citation Library', href: '/dashboard/tools/citations-generator', icon: 'book',
    description: 'Create, manage, and export research citations.',
    keywords: ['citation generator', 'bibliography', 'references', 'cite source', 'APA', 'MLA', 'Chicago'],
  },
  {
    group: 'Tools', label: 'Documents', href: '/dashboard/tools/documents', icon: 'file-text',
    description: 'Work with research documents and document-oriented tools.',
    keywords: ['document library', 'files', 'uploads', 'reports'],
  },
  {
    group: 'Tools', label: 'Equilibrium Analysis', href: '/dashboard/tools/equilibrium-analysis', icon: 'bar-chart',
    description: 'Model strategic interactions and pure or mixed Nash equilibria.',
    keywords: ['game theory', 'payoff matrix', 'Nash equilibrium', 'best response', 'mixed strategy', 'prisoners dilemma'],
  },
  {
    group: 'Tools', label: 'Hamilton Rule', href: '/dashboard/tools/hamilton-rule', icon: 'users',
    description: 'Model relatedness, benefit, cost, altruism, and cooperation thresholds.',
    keywords: ['rB greater than C', 'kin selection', 'altruism', 'cooperation', 'relatedness'],
  },
  {
    group: 'Tools', label: 'Agentic Research', href: '/dashboard/tools/collection', icon: 'zap',
    description: 'Launch collection jobs, triage sources, and approve evidence-oriented findings.',
    keywords: ['collection', 'research agent', 'OSINT search', 'source triage', 'research question', 'evidence approval'],
  },
  {
    group: 'Tools', label: 'RAGE Check', href: '/dashboard/tools/rage-check', icon: 'shield',
    description: 'Review language for manipulation, outrage, absolutism, and engagement pressure.',
    keywords: ['rage bait', 'loaded language', 'absolutist', 'threat panic', 'us versus them', 'engagement bait'],
  },

  // Analysis frameworks
  {
    group: 'Frameworks', label: 'Behavior Decision Analysis', href: '/dashboard/analysis-frameworks/behavior', icon: 'brain',
    description: 'Model an actor decision sequence, psychological state, coping plans, forks, and competing behaviors.',
    keywords: ['behavior framework', 'behaviour framework', 'decision timeline', 'decision type', 'psychological state', 'TTM', 'HAPA', 'coping branch', 'coping plan', 'competing behavior', 'sub-step', 'fork outcome', 'COM-B target'],
  },
  {
    group: 'Frameworks', label: 'COM-B & Behaviour Change Wheel', href: '/dashboard/analysis-frameworks/comb-analysis', icon: 'brain',
    description: 'Diagnose capability, opportunity, and motivation; select interventions and policy options.',
    keywords: ['COM-B', 'COMB', 'behavior change wheel', 'behaviour change wheel', 'BCW', 'BCT', 'APEASE', 'intervention functions', 'policy categories', 'capability opportunity motivation'],
  },
  {
    group: 'Frameworks', label: 'ACH Analysis', href: '/dashboard/analysis-frameworks/ach-dashboard', icon: 'brain',
    description: 'Test competing hypotheses against evidence and inconsistency.',
    keywords: ['analysis of competing hypotheses', 'hypothesis matrix', 'evidence scoring', 'diagnosticity', 'inconsistency'],
  },
  {
    group: 'Frameworks', label: 'SWOT Analysis', href: '/dashboard/analysis-frameworks/swot-dashboard', icon: 'brain',
    description: 'Assess strengths, weaknesses, opportunities, and threats.',
    keywords: ['strengths', 'weaknesses', 'opportunities', 'threats', 'strategy'],
  },
  {
    group: 'Frameworks', label: 'PEST Analysis', href: '/dashboard/analysis-frameworks/pest', icon: 'brain',
    description: 'Assess political, economic, social, and technological conditions.',
    keywords: ['political', 'economic', 'social', 'technological', 'environment scan'],
  },
  {
    group: 'Frameworks', label: 'PMESII-PT', href: '/dashboard/analysis-frameworks/pmesii-pt', icon: 'brain',
    description: 'Analyze political, military, economic, social, information, infrastructure, physical, and time factors.',
    keywords: ['operational environment', 'civil considerations', 'physical environment', 'time'],
  },
  {
    group: 'Frameworks', label: 'DIME Framework', href: '/dashboard/analysis-frameworks/dime', icon: 'brain',
    description: 'Analyze diplomatic, information, military, and economic instruments.',
    keywords: ['diplomatic', 'information', 'military', 'economic', 'national power'],
  },
  {
    group: 'Frameworks', label: 'DOTMLPF', href: '/dashboard/analysis-frameworks/dotmlpf', icon: 'brain',
    description: 'Assess doctrine, organization, training, materiel, leadership, personnel, and facilities.',
    keywords: ['capability assessment', 'doctrine', 'organization', 'training', 'materiel', 'leadership', 'personnel', 'facilities'],
  },
  {
    group: 'Frameworks', label: 'Center of Gravity Analysis', href: '/dashboard/analysis-frameworks/cog', icon: 'brain',
    description: 'Map centers of gravity, critical capabilities, requirements, and vulnerabilities.',
    keywords: ['COG', 'center of gravity', 'centre of gravity', 'critical capability', 'critical requirement', 'critical vulnerability', 'DIMEFIL'],
  },
  {
    group: 'Frameworks', label: 'Causeway', href: '/dashboard/analysis-frameworks/causeway', icon: 'brain',
    description: 'Structure causal pathways, drivers, outcomes, and intervention points.',
    keywords: ['causal analysis', 'cause effect', 'causal pathway', 'drivers', 'outcomes'],
  },
  {
    group: 'Frameworks', label: 'Deception Analysis', href: '/dashboard/analysis-frameworks/deception', icon: 'brain',
    description: 'Evaluate deception indicators, competing explanations, and evidence.',
    keywords: ['deception detection', 'MOM', 'motive opportunity means', 'SATS', 'indicators', 'claims'],
  },
  {
    group: 'Frameworks', label: 'Stakeholder Analysis', href: '/dashboard/analysis-frameworks/stakeholder', icon: 'users',
    description: 'Map stakeholder power, interest, influence, and engagement.',
    keywords: ['power interest matrix', 'stakeholder map', 'engagement plan', 'key players'],
  },
  {
    group: 'Frameworks', label: 'Starbursting', href: '/dashboard/analysis-frameworks/starbursting', icon: 'sparkles',
    description: 'Generate structured who, what, when, where, why, and how questions.',
    keywords: ['5W1H', 'five Ws', 'question generation', 'who what when where why how'],
  },
  {
    group: 'Frameworks', label: 'Fundamental Flow', href: '/dashboard/analysis-frameworks/fundamental-flow', icon: 'brain',
    description: 'Analyze flows, dependencies, constraints, and system relationships.',
    keywords: ['flow analysis', 'dependency', 'constraints', 'system mapping'],
  },
  {
    group: 'Frameworks', label: 'Surveillance Framework', href: '/dashboard/analysis-frameworks/surveillance', icon: 'brain',
    description: 'Structure monitoring requirements, indicators, collection, and review.',
    keywords: ['monitoring', 'indicators', 'collection plan', 'watch list', 'surveillance'],
  },
  {
    group: 'Frameworks', label: 'Deception Risk Dashboard', href: '/dashboard/deception-risk', icon: 'shield',
    description: 'Review deception risk signals and aggregate assessments.',
    keywords: ['deception risk', 'risk dashboard', 'SATS', 'aggregate deception'],
  },

  // Main navigation and durable work areas
  { group: 'Navigate', label: 'Dashboard', href: '/dashboard', icon: 'home', description: 'ResearchTools overview and recent work.', keywords: ['home', 'overview'] },
  { group: 'Navigate', label: 'Investigations', href: '/dashboard/investigations', icon: 'folder', description: 'Manage research investigations and their evidence.', keywords: ['projects', 'cases', 'research project'] },
  { group: 'Navigate', label: 'New Investigation', href: '/dashboard/investigations/new', icon: 'folder', description: 'Start a durable investigation.', keywords: ['create case', 'new project'] },
  { group: 'Navigate', label: 'Intelligence Synthesis', href: '/dashboard/intelligence', icon: 'lightbulb', description: 'Synthesize entities, timelines, contradictions, predictions, and KPIs.', keywords: ['intelligence', 'synthesis', 'contradictions', 'predictions', 'KPI'] },
  { group: 'Navigate', label: 'Workspaces (COP)', href: '/dashboard/cop', icon: 'map', description: 'Coordinate shared operational pictures, tasks, RFIs, events, and evidence.', keywords: ['COP', 'common operational picture', 'team workspace', 'RFI', 'collaboration'] },
  { group: 'Navigate', label: 'New Workspace', href: '/dashboard/workspace/new', icon: 'map', description: 'Create an authenticated team workspace.', keywords: ['create workspace', 'new COP', 'team'] },
  { group: 'Navigate', label: 'Evidence', href: '/dashboard/evidence', icon: 'archive', description: 'Review and manage collected evidence.', keywords: ['evidence library', 'sources', 'citations'] },
  { group: 'Navigate', label: 'Evidence Submissions & Forms', href: '/dashboard/research/submissions', icon: 'archive', description: 'Review submissions and manage research collection forms.', keywords: ['submission inbox', 'research forms', 'intake forms', 'crowdsourcing'] },
  { group: 'Navigate', label: 'Research Form Builder', href: '/dashboard/research/forms/new', icon: 'file-text', description: 'Create a public or team research collection form.', keywords: ['form builder', 'questionnaire', 'survey', 'intake'] },
  { group: 'Navigate', label: 'Claims', href: '/dashboard/entities/claims', icon: 'shield', description: 'Review claims and their linked evidence and entities.', keywords: ['claim analysis', 'claim evidence'] },
  { group: 'Navigate', label: 'Actors', href: '/dashboard/entities/actors', icon: 'users', description: 'Manage people and organization entities.', keywords: ['people', 'organizations', 'entities'] },
  { group: 'Navigate', label: 'Sources', href: '/dashboard/entities/sources', icon: 'book', description: 'Manage research sources and provenance.', keywords: ['source library', 'provenance'] },
  { group: 'Navigate', label: 'Events', href: '/dashboard/entities/events', icon: 'activity', description: 'Manage durable event entities.', keywords: ['event library', 'incidents'] },
  { group: 'Navigate', label: 'Network Analysis', href: '/dashboard/network', icon: 'network', description: 'Explore entity and relationship networks.', keywords: ['graph', 'relationships', 'centrality', 'network graph'] },
  { group: 'Navigate', label: 'Dataset Library', href: '/dashboard/datasets', icon: 'database', description: 'Browse and manage structured datasets.', keywords: ['data', 'CSV', 'dataset'] },
  { group: 'Navigate', label: 'Reports', href: '/dashboard/reports', icon: 'file-text', description: 'Create and review research reports.', keywords: ['report builder', 'export', 'deliverable'] },
  { group: 'Navigate', label: 'Collaboration', href: '/dashboard/collaboration', icon: 'users', description: 'Manage team collaboration and shared work.', keywords: ['team', 'members', 'sharing'] },
  { group: 'Navigate', label: 'Activity Feed', href: '/dashboard/activity', icon: 'activity', description: 'Review recent platform activity.', keywords: ['audit', 'history', 'recent changes'] },
  { group: 'Navigate', label: 'Settings', href: '/dashboard/settings', icon: 'settings', description: 'Manage account and workspace settings.', keywords: ['preferences', 'account'] },
  { group: 'Navigate', label: 'AI Configuration', href: '/dashboard/settings/ai', icon: 'sparkles', description: 'Configure available AI models and providers.', keywords: ['AI settings', 'model settings', 'OpenAI'] },
]

export function discoverySearchText(entry: DiscoveryEntry): string {
  return [entry.label, entry.group, entry.description, ...entry.keywords].join(' ')
}

export function discoveryTextForHref(href: string): string {
  const entry = DISCOVERY_ENTRIES.find(candidate => candidate.href === href)
  return entry ? discoverySearchText(entry) : ''
}
