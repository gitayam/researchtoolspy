// Common Operating Picture types

export const CopTemplateType = {
  QUICK_BRIEF: 'quick_brief',
  EVENT_MONITOR: 'event_monitor',
  AREA_STUDY: 'area_study',
  CRISIS_RESPONSE: 'crisis_response',
  EVENT_ANALYSIS: 'event_analysis',
  CUSTOM: 'custom',
} as const

export type CopTemplateType = typeof CopTemplateType[keyof typeof CopTemplateType]

export const CopStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const

export type CopStatus = typeof CopStatus[keyof typeof CopStatus]

export const CopLayerCategory = {
  ENTITIES: 'entities',
  EXTERNAL: 'external',
  ANALYSIS: 'analysis',
  TACTICAL: 'tactical',
} as const

export type CopLayerCategory = typeof CopLayerCategory[keyof typeof CopLayerCategory]

export interface CopSession {
  id: string
  name: string
  description: string | null
  template_type: CopTemplateType
  status: CopStatus

  bbox_min_lat: number | null
  bbox_min_lon: number | null
  bbox_max_lat: number | null
  bbox_max_lon: number | null
  center_lat: number | null
  center_lon: number | null
  zoom_level: number

  time_window_start: string | null
  time_window_end: string | null
  rolling_hours: number | null

  active_layers: string[]
  layer_config: Record<string, LayerOverride>
  linked_frameworks: string[]
  key_questions: string[]
  mission_brief?: string | null

  // Event analysis fields (only populated when template_type === 'event_analysis')
  event_type: string | null
  event_description: string | null
  event_facts: EventFact[]
  content_analyses: string[]

  // Workspace fields (optional — only populated for workspace sessions)
  panel_layout?: CopPanelLayout | null
  workspace_mode?: CopWorkspaceMode
  investigation_id?: string | null

  workspace_id: string
  created_by: number
  is_public: number

  created_at: string
  updated_at: string
}

export interface LayerOverride {
  opacity?: number
  color?: string
  visible?: boolean
  filters?: Record<string, string>
}

export interface CopMarker {
  id: string
  cop_session_id: string
  uid: string
  cot_type: string
  callsign: string | null
  lat: number
  lon: number
  hae: number

  label: string | null
  description: string | null
  icon: string | null
  color: string | null
  detail: Record<string, unknown>

  event_time: string
  stale_time: string | null

  source_type: 'MANUAL' | 'ENTITY' | 'ACLED' | 'GDELT' | 'FRAMEWORK' | 'EVIDENCE' | 'HYPOTHESIS'
  source_id: string | null

  workspace_id: string
  created_by: number
  created_at: string
}

export interface CopLayerDef {
  id: string
  name: string
  description: string
  category: CopLayerCategory
  icon: string

  source: {
    type: 'api' | 'geojson-url' | 'static'
    endpoint: string
    refreshSeconds?: number
    params?: Record<string, string>
  }

  render: {
    type: 'point' | 'cluster' | 'heatmap' | 'line' | 'polygon'
    color: string
    iconMapping?: Record<string, string>
    clusterRadius?: number
    minZoom?: number
    maxZoom?: number
  }

  defaultFor: CopTemplateType[]
  filterable: boolean
  filterFields?: string[]
}

export interface CopGeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

export interface CopFeatureCollection {
  type: 'FeatureCollection'
  features: CopGeoJsonFeature[]
}

export interface CopWizardInput {
  purpose: CopTemplateType
  location: {
    search?: string
    bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number }
    center?: { lat: number; lon: number }
    zoom?: number
  }
  timeWindow: {
    type: 'snapshot' | 'rolling' | 'fixed' | 'ongoing'
    rollingHours?: number
    start?: string
    end?: string
  }
  questions: string[]
  // Event analysis fields (optional, only used for event_analysis template)
  eventType?: CopEventType
  eventDescription?: string
  initialUrls?: string[]
}

export interface CopWizardOutput {
  name: string
  description: string
  recommended_layers: string[]
  suggested_frameworks: string[]
  additional_questions: string[]
}

// ── Event Analysis Types ────────────────────────────────────────

export interface EventFact {
  time: string
  text: string
  source_url?: string
}

export const CopEventType = {
  NATURAL_DISASTER: 'natural_disaster',
  MASS_CASUALTY: 'mass_casualty',
  ELECTION: 'election',
  PROTEST: 'protest',
  MILITARY: 'military',
  SPORTS: 'sports',
  CYBER: 'cyber',
  PUBLIC_HEALTH: 'public_health',
  OTHER: 'other',
} as const

export type CopEventType = typeof CopEventType[keyof typeof CopEventType]

export const EVENT_TYPE_LABELS: Record<CopEventType, string> = {
  natural_disaster: 'Natural Disaster',
  mass_casualty: 'Mass Casualty',
  election: 'Election / Political',
  protest: 'Protest / Civil Unrest',
  military: 'Military / Conflict',
  sports: 'Sports Event',
  cyber: 'Cyber Incident',
  public_health: 'Public Health',
  other: 'Other',
}

export const EVENT_TYPE_COLORS: Record<CopEventType, string> = {
  natural_disaster: '#22c55e',
  mass_casualty: '#ef4444',
  election: '#8b5cf6',
  protest: '#f59e0b',
  military: '#dc2626',
  sports: '#3b82f6',
  cyber: '#06b6d4',
  public_health: '#10b981',
  other: '#6b7280',
}

// ── RFI Types ───────────────────────────────────────────────────

export const CopRfiStatus = {
  OPEN: 'open',
  ANSWERED: 'answered',
  ACCEPTED: 'accepted',
  CLOSED: 'closed',
} as const

export type CopRfiStatus = typeof CopRfiStatus[keyof typeof CopRfiStatus]

export const CopRfiPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

export type CopRfiPriority = typeof CopRfiPriority[keyof typeof CopRfiPriority]

export const RFI_PRIORITY_COLORS: Record<CopRfiPriority, string> = {
  critical: '#dc2626',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
}

export interface CopRfi {
  id: string
  cop_session_id: string
  question: string
  priority: CopRfiPriority
  status: CopRfiStatus
  is_blocker: number
  created_by: number
  assigned_to: number | null
  created_at: string
  updated_at: string
  answers?: CopRfiAnswer[]
  /** Evidence filed under this question (migration 0024); filing never changes the status. */
  evidence_count?: number
}

/** How an evidence item bears on the question or task it is filed under. */
export type CopEvidenceRelation = 'supports' | 'contradicts' | 'context'
export type CopEvidenceLinkTarget = 'rfi' | 'task'

/** An evidence item filed under an RFI (question) or task: GET /api/cop/:id/evidence-links. */
export interface CopEvidenceLink {
  id: string
  evidence_id: string
  target_type: CopEvidenceLinkTarget
  target_id: string
  relation: CopEvidenceRelation
  note: string | null
  created_at: string
  /** The team's votes on this filing (is it helpful for this question?), and the caller's own. */
  up: number
  down: number
  my_vote: CopVoteValue
}

/** 1 helpful, -1 not helpful, 0 no vote. */
export type CopVoteValue = -1 | 0 | 1

/** Filed evidence as a share link shows it under a question (only with the evidence panel). */
export interface CopPublicFiledEvidence {
  title: string
  url: string | null
  credibility: string | null
  /** null for an unreviewed drop-form tip (its tipster's say-so is not shown). */
  relation: CopEvidenceRelation | null
  created_at: string
  /** The team's vote counts (absent from servers before the votes change). */
  up?: number
  down?: number
}

export interface CopRfiAnswer {
  id: string
  rfi_id: string
  answer_text: string
  source_url: string | null
  source_description: string | null
  is_accepted: number
  created_by: number
  responder_name: string | null
  created_at: string
}

// ── Share Types ─────────────────────────────────────────────────

export interface CopShare {
  id: string
  cop_session_id: string
  share_token: string
  visible_panels: string[]
  allow_rfi_answers: number
  created_by: number
  created_at: string
  view_count: number
}

export type CopSidebarTab = 'event' | 'intel' | 'rfi' | 'questions' | 'layers'

// ── Webcams ─────────────────────────────────────────────────

export type CopWebcamProvider = 'windy' | 'youtube' | 'image' | 'hls'
export type CopWebcamDelivery = 'live' | 'timelapse' | 'snapshot'

/** A webcam as GET /api/cop/:id/webcams and the public share return it. */
export interface CopWebcam {
  id: string
  provider: CopWebcamProvider
  provider_ref: string | null
  page_url: string | null
  image_url: string | null
  stream_url: string | null
  /** Derived by the server from provider_ref (Windy, YouTube); never user-supplied. */
  embed_url: string | null
  label: string
  lat: number | null
  lon: number | null
  bearing_deg: number | null
  fov_deg: number | null
  delivery: CopWebcamDelivery
  refresh_s: number | null
  attribution: string | null
  created_at: string
  /** The camera operator's own page (Windy urls.provider); https only. Absent on older servers. */
  source_url?: string | null
  /** Windy's last reported status (active, inactive, …); null for non-Windy cameras. */
  windy_status?: string | null
  status_checked_at?: string | null
  position_source?: 'user' | 'windy' | null
  bearing_source?: 'user' | 'estimated' | null
}

/** Error codes the webcam routes put beside `error`. */
export type CopWebcamErrorCode =
  | 'WEBCAM_INVALID'
  | 'WEBCAM_UNSUPPORTED_LINK'
  | 'WEBCAM_NOT_FOUND'
  | 'WEBCAM_UNAVAILABLE'
  | 'WEBCAM_DUPLICATE'
  | 'WEBCAM_LIMIT'
  | 'WEBCAMS_UNAVAILABLE'
  | 'WEBCAM_DISCOVERY_UNAVAILABLE'
  | 'WEBCAM_NO_CENTER'
  | 'WEBCAM_NO_POSITION'
  | 'PLACE_NOT_FOUND'
  | 'GEOCODER_UNAVAILABLE'
  | 'NO_VIEW_TARGET'
  | 'AI_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'WINDY_ERROR'

/** One Windy camera from GET /api/cop/:id/webcams/nearby. */
export interface CopWebcamCandidate {
  windy_id: string
  title: string
  status: string
  lat: number
  lon: number
  distance_km: number
  city: string | null
  region: string | null
  country: string | null
  live: boolean
  delivery: 'live' | 'timelapse'
  /** Windy's token image URL; expires about 10 minutes after the search. */
  preview_url: string | null
  detail_url: string
  categories: string[]
  on_session: boolean
}

export interface CopWebcamNearbyResponse {
  center: { lat: number; lon: number; label: string | null; source: 'query' | 'session' | 'place' | 'url' }
  /** How a place or page link was turned into a search center; null for coordinates. */
  resolution: { input: string; query: string; display_name: string; ai_used: boolean; ambiguous: boolean } | null
  radius_km: number
  total: number
  webcams: CopWebcamCandidate[]
  attribution: string
  attribution_url: string
  /** Present when a geocoder placed the center (Nominatim: "© OpenStreetMap contributors"). */
  geocoder_attribution?: string
  geocoder_attribution_url?: string
}

/** POST /api/cop/:id/webcams/:camId/estimate-bearing. Not saved until PATCHed. */
export interface CopWebcamBearingEstimate {
  bearing_deg: number
  target: { name: string; display_name: string; lat: number; lon: number; distance_km: number }
  ai_used: boolean
  geocoder_attribution?: string
  geocoder_attribution_url?: string
}

// ── Workspace Types ─────────────────────────────────────────

export type CopWorkspaceMode = 'progress' | 'monitor'

export type CopPanelId = 'graph' | 'timeline' | 'questions' | 'analysis' | 'feed' | 'map' | 'cams'

export interface CopPanelState {
  visible: boolean
  expanded: boolean
  position: [number, number] // [column, row]
}

export interface CopPanelLayout {
  mode: CopWorkspaceMode
  panels: Record<CopPanelId, CopPanelState>
}

export const DEFAULT_PANEL_LAYOUT: CopPanelLayout = {
  mode: 'progress',
  panels: {
    graph:     { visible: true, expanded: false, position: [0, 1] },
    timeline:  { visible: true, expanded: false, position: [1, 1] },
    questions: { visible: true, expanded: false, position: [0, 2] },
    analysis:  { visible: true, expanded: false, position: [1, 2] },
    feed:      { visible: true, expanded: false, position: [0, 3] },
    map:       { visible: false, expanded: false, position: [0, 4] },
    cams:      { visible: true, expanded: false, position: [1, 4] },
  },
}

// ── Workspace Stats ─────────────────────────────────────────

export interface CopWorkspaceStats {
  evidence_count: number
  entity_count: number
  actor_count: number
  source_count: number
  event_count: number
  relationship_count: number
  framework_count: number
  open_questions: number
  answered_questions: number
  open_rfis: number
  blocker_count: number
  hypothesis_count?: number
}

// ── Persona Types ────────────────────────────────────────────

export interface CopPersona {
  id: string
  cop_session_id: string
  display_name: string
  platform: CopPersonaPlatform
  handle: string | null
  profile_url: string | null
  status: CopPersonaStatus
  linked_actor_id: string | null
  notes: string | null
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
  links?: CopPersonaLink[]
}

export const CopPersonaPlatform = {
  TWITTER: 'twitter',
  TELEGRAM: 'telegram',
  REDDIT: 'reddit',
  ONLYFANS: 'onlyfans',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  OTHER: 'other',
} as const

export type CopPersonaPlatform = typeof CopPersonaPlatform[keyof typeof CopPersonaPlatform]

export const CopPersonaStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
  UNKNOWN: 'unknown',
} as const

export type CopPersonaStatus = typeof CopPersonaStatus[keyof typeof CopPersonaStatus]

export interface CopPersonaLink {
  id: string
  persona_a_id: string
  persona_b_id: string
  link_type: 'alias' | 'operator' | 'affiliated' | 'unknown'
  confidence: number
  evidence_id: string | null
  created_by: number
  created_at: string
}

// ── Evidence Tag Types ───────────────────────────────────────

export interface CopEvidenceTag {
  id: string
  evidence_id: string
  tag_category: string
  tag_value: string
  confidence: number
  created_by: number
  created_at: string
}

// -- Task Dependencies & Templates (Phase 3) --

export interface CopTaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
  cop_session_id: string
  created_at: string
}

export interface CopTaskTemplate {
  id: string
  name: string
  description: string | null
  template_type: string
  tasks_json: string
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface CopTaskTemplateDef {
  ref: string
  title: string
  description?: string
  task_type?: string
  priority?: string
  depends_on?: string[]
  subtasks?: CopTaskTemplateSubDef[]
}

export interface CopTaskTemplateSubDef {
  ref: string
  title: string
  task_type?: string
  priority?: string
}

export interface CopCollaboratorSkillsData {
  skills: string[]
  max_concurrent: number
  timezone: string | null
  availability: 'available' | 'busy' | 'offline'
}

export const CLUE_TAXONOMY: Record<string, string[]> = {
  architecture: ['Building style', 'Window type', 'Roof type', 'Door style', 'Construction material'],
  infrastructure: ['Power outlet type', 'Street light', 'Road marking', 'Traffic sign', 'Utility pole'],
  flora_fauna: ['Tree species', 'Vegetation type', 'Crop type', 'Animal species'],
  logos_brands: ['Vehicle brand', 'Store chain', 'Telecom provider', 'Bus company', 'Fuel station'],
  language_text: ['Script type', 'Language detected', 'Sign text', 'License plate format'],
  geography: ['Terrain type', 'Coastline', 'Mountain range', 'Water body', 'Soil color'],
  transport: ['Vehicle type', 'Road surface', 'Rail type', 'Port infrastructure'],
  people_culture: ['Clothing style', 'Religious symbol', 'Flag', 'Currency'],
}

// -- COP Assets (Phase 4: Asset & Resource Tracking) --

export type AssetType = 'human' | 'source' | 'infrastructure' | 'digital'
export type AssetStatus = 'available' | 'deployed' | 'degraded' | 'offline' | 'compromised' | 'exhausted'
export type AssetSensitivity = 'unclassified' | 'internal' | 'restricted'

export interface HumanAssetDetails {
  skills: string[]
  timezone: string
  languages: string[]
  hours_available_per_week: number
  current_load: number
}

export interface SourceAssetDetails {
  source_type: 'humint' | 'sigint' | 'osint' | 'geoint'
  reliability_rating: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  access_status: 'active' | 'intermittent' | 'denied' | 'unknown'
  coverage_area: string
  last_contact: string
  linked_source_id: string
}

export interface InfraAssetDetails {
  infra_type: 'server' | 'vpn' | 'account' | 'device' | 'platform'
  provider: string
  expiry_date: string
  opsec_notes: string
  shared_by: string[]
}

export interface DigitalAssetDetails {
  resource_type: 'api_quota' | 'license' | 'dataset' | 'document'
  total_units: number
  used_units: number
  reset_date: string
  cost_per_unit: number
  currency: string
}

export type AssetDetails = HumanAssetDetails | SourceAssetDetails | InfraAssetDetails | DigitalAssetDetails

export interface CopAsset {
  id: string
  cop_session_id: string
  asset_type: AssetType
  name: string
  status: AssetStatus
  details: AssetDetails
  assigned_to_task_id: string | null
  location: string | null
  lat: number | null
  lon: number | null
  sensitivity: AssetSensitivity
  last_checked_at: string | null
  notes: string | null
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface CopAssetLog {
  id: string
  asset_id: string
  cop_session_id: string
  previous_status: string | null
  new_status: string
  changed_by: number
  reason: string | null
  created_at: string
}

export const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; color: string }> = {
  human: { label: 'People', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  source: { label: 'Sources', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  infrastructure: { label: 'Infrastructure', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  digital: { label: 'Digital', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

export const ASSET_STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-green-500' },
  deployed: { label: 'Deployed', color: 'bg-blue-500' },
  degraded: { label: 'Degraded', color: 'bg-yellow-500' },
  offline: { label: 'Offline', color: 'bg-gray-500' },
  compromised: { label: 'Compromised', color: 'bg-red-500' },
  exhausted: { label: 'Exhausted', color: 'bg-red-800' },
}

// -- COP Exports (Phase 5: Standard Export Formats) --

export type ExportFormat = 'geojson' | 'kml' | 'cot' | 'stix' | 'csv'
export type ExportScope = 'full' | 'layers' | 'entities' | 'evidence' | 'tasks'
export type ExportStatus = 'pending' | 'generating' | 'completed' | 'failed'

export interface CopExport {
  id: string
  cop_session_id: string
  format: ExportFormat
  scope: ExportScope
  filters_json: Record<string, unknown>
  file_url: string | null
  file_size_bytes: number | null
  status: ExportStatus
  error_message: string | null
  created_by: number
  created_at: string
}

export const EXPORT_FORMAT_CONFIG: Record<ExportFormat, { label: string; ext: string; mime: string; description: string }> = {
  geojson: { label: 'GeoJSON Bundle', ext: '.geojson', mime: 'application/geo+json', description: 'Machine-readable map data' },
  kml: { label: 'KML', ext: '.kml', mime: 'application/vnd.google-earth.kml+xml', description: 'Google Earth compatible' },
  cot: { label: 'CoT XML', ext: '.xml', mime: 'application/xml', description: 'Cursor on Target (TAK)' },
  stix: { label: 'STIX 2.1', ext: '.stix.json', mime: 'application/json', description: 'Cyber threat intel standard' },
  csv: { label: 'CSV', ext: '.csv', mime: 'text/csv', description: 'Spreadsheet-friendly tables' },
}

// -- COP Intake Forms & Submissions (Phase 2: Crowdsource/Ingest) --

export type IntakeFormFieldType =
  | 'text' | 'textarea' | 'number' | 'datetime' | 'select' | 'multiselect' | 'file' | 'checkbox'
  // OSINT field types
  | 'url' | 'email' | 'phone' | 'ip_address' | 'onion' | 'crypto_address'
  | 'geopoint' | 'rating' | 'likert' | 'country' | 'handle'

export interface IntakeFormField {
  name: string
  type: IntakeFormFieldType
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]     // For select/multiselect/likert
  accept?: string        // For file (e.g., "image/*")
  min?: number           // For number/rating
  max?: number           // For number/rating
  help_text?: string     // Shown below the field
}

export type IntakeFormStatus = 'draft' | 'active' | 'closed'
export type SubmissionStatus = 'pending' | 'triaged' | 'accepted' | 'rejected'

export type IntakeAccessLevel = 'public' | 'password' | 'internal'

export interface CopIntakeForm {
  id: string
  cop_session_id: string
  title: string
  description: string | null
  form_schema: IntakeFormField[]
  share_token: string
  status: IntakeFormStatus
  auto_tag_category: string | null
  require_location: number
  require_contact: number
  submission_count: number
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
  // Survey Drops extensions
  access_level: IntakeAccessLevel
  allowed_countries: string[]
  rate_limit_per_hour: number
  custom_slug: string | null
  expires_at: string | null
  theme_color: string | null
  logo_url: string | null
  success_message: string | null
  redirect_url: string | null
}

export interface CopSubmission {
  id: string
  intake_form_id: string
  cop_session_id: string
  form_data: Record<string, unknown>
  submitter_name: string | null
  submitter_contact: string | null
  lat: number | null
  lon: number | null
  status: SubmissionStatus
  triaged_by: number | null
  rejection_reason: string | null
  linked_evidence_id: string | null
  linked_task_id: string | null
  created_at: string
  // Survey Drops extensions
  submitter_country: string | null
  submitter_city: string | null
  content_hash: string | null
  updated_at: string | null
}

// -- Survey Drops (Standalone) --

export interface SurveyDrop {
  id: string
  title: string
  description: string | null
  form_schema: IntakeFormField[]
  share_token: string
  status: IntakeFormStatus
  access_level: IntakeAccessLevel
  allowed_countries: string[]
  rate_limit_per_hour: number
  custom_slug: string | null
  expires_at: string | null
  theme_color: string | null
  logo_url: string | null
  success_message: string | null
  redirect_url: string | null
  auto_tag_category: string | null
  require_location: number
  require_contact: number
  submission_count: number
  facts: { text: string; as_of: string }[]
  changelog: { date: string; entry: string }[]
  cop_session_id: string | null
  /** Tipsters may pick which key question their tip is about (migration 0024). */
  question_picker?: boolean
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface SurveyResponse {
  id: string
  survey_id: string
  form_data: Record<string, unknown>
  submitter_name: string | null
  submitter_contact: string | null
  lat: number | null
  lon: number | null
  submitter_country: string | null
  submitter_city: string | null
  content_hash: string | null
  status: SubmissionStatus
  triaged_by: number | null
  rejection_reason: string | null
  cop_session_id: string | null
  linked_evidence_id: string | null
  created_at: string
  updated_at: string | null
}

// -- COP Playbooks (Phase 6: Playbook Engine) --

export type PlaybookStatus = 'active' | 'paused' | 'draft'
export type PlaybookLogStatus = 'success' | 'partial' | 'failed'

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'contains' | 'exists'

export interface PlaybookCondition {
  field: string   // dot-path: payload.priority, session.open_rfi_count, time.hours_since_created
  op: ConditionOp
  value: unknown
}

export type PlaybookActionType =
  | 'create_task' | 'update_status' | 'assign_task'
  | 'create_evidence' | 'send_notification' | 'update_priority'
  | 'add_tag' | 'create_rfi' | 'reserve_asset' | 'run_pipeline'

export interface PlaybookAction {
  action: PlaybookActionType
  params: Record<string, unknown>
}

export interface PipelineStage {
  name: string
  action: PlaybookActionType
  params: Record<string, unknown>
}

export interface CopPlaybook {
  id: string
  cop_session_id: string
  name: string
  description: string | null
  status: PlaybookStatus
  source: 'custom' | 'template'
  template_id: string | null
  execution_count: number
  last_triggered_at: string | null
  last_processed_event_id: string | null
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface CopPlaybookRule {
  id: string
  playbook_id: string
  name: string
  position: number
  enabled: boolean
  trigger_event: string
  trigger_filter: Record<string, unknown>
  conditions: PlaybookCondition[]
  actions: PlaybookAction[]
  cooldown_seconds: number
  last_fired_at: string | null
  fire_count: number
  created_at: string
  updated_at: string
}

export interface CopPlaybookLogEntry {
  id: string
  rule_id: string
  playbook_id: string
  cop_session_id: string
  trigger_event_id: string | null
  actions_taken: PlaybookAction[]
  status: PlaybookLogStatus
  error_message: string | null
  duration_ms: number | null
  created_at: string
}

// -- COP Events (Phase 1: Event System Foundation) --

export interface CopEvent {
  id: string
  cop_session_id: string
  event_type: string
  entity_type: string
  entity_id: string | null
  payload: Record<string, unknown>
  created_by: number
  created_at: string
}

// -- COP input contract (2026-10-23): tags, change feed, suggestions, uploads --

/** What a tag can sit on (`cop_item_tags.target_type`). */
export type CopTagTargetType =
  | 'evidence' | 'marker' | 'rfi' | 'task' | 'timeline' | 'claim' | 'hypothesis'
  | 'persona' | 'asset' | 'webcam' | 'upload' | 'submission'

/** Where an item's tag came from. */
export type CopItemTagSource = 'user' | 'ai' | 'rule' | 'drop' | 'chat'

/** A tag in a session's vocabulary (`GET /api/cop/:id/tags`). */
export interface CopTag {
  id: string
  name: string
  /** A palette name ("blue", "amber"…) or a #rrggbb colour; anything else is ignored. */
  color: string | null
  category: string | null
  /** How many items carry it. */
  count: number
}

/** One item's tags (`GET /api/cop/:id/item-tags`). */
export interface CopItemTags {
  target_type: CopTagTargetType
  target_id: string
  tags: string[]
}

export interface CopTagTarget {
  target_type: CopTagTargetType
  target_id: string
}

/** `cop_events.entity_type`: what changed, for panels deciding whether to refetch. */
export type CopEntityType =
  | 'evidence' | 'marker' | 'rfi' | 'task' | 'timeline' | 'claim' | 'hypothesis'
  | 'persona' | 'poo' | 'asset' | 'webcam' | 'tag' | 'upload' | 'submission'
  | 'share' | 'session' | 'playbook' | 'activity'

/** One entry of `GET /api/cop/:id/changes`. */
export interface CopChangeEvent {
  id: string
  entity_type: CopEntityType
  entity_id: string | null
  event_type: string
  created_at: string
}

export interface CopChangesResponse {
  events: CopChangeEvent[]
  cursor: string
  has_more: boolean
}

/** `detail` of the window `cop:changed` CustomEvent. */
export interface CopChangedDetail {
  types: CopEntityType[]
}

/** What `POST /api/cop/:id/suggest` may propose for unprefixed text. */
export type CopSuggestKind = 'note' | 'evidence' | 'rfi' | 'task' | 'timeline' | 'hypothesis' | 'marker'

export interface CopSuggestResponse {
  kind: { value: CopSuggestKind; confidence: number } | null
  /** Names from the session's vocabulary only. */
  tags: string[]
  places: { text: string; query: string }[]
}

/** `GET /api/cop/:id/geocode`. */
export interface CopGeocodeResponse {
  results: { display_name: string; lat: number; lon: number; importance: number }[]
  resolution: {
    input: string
    query: string
    display_name: string
    ai_used: boolean
    ambiguous: boolean
  } | null
  geocoder_attribution?: string
  geocoder_attribution_url?: string
}

/** A file stored for a COP (`POST /api/cop/:id/uploads`). */
export interface CopUpload {
  id: string
  url: string
  content_type: string
  bytes: number
  width?: number
  height?: number
}

export interface CopUploadResponse {
  upload: CopUpload
  evidence?: { id: string | number }
}

/** Drop-form fields the inbox reads when the server sends them (Wave 4). */
export interface CopSubmissionIngest {
  /** 'drop' for a survey drop linked to the COP, 'intake' for a COP intake form. */
  source?: 'drop' | 'intake'
  /** True when the server filed it into the COP on arrival (unverified). */
  auto_ingested?: boolean
  /** The drop's or intake form's title. */
  form_title?: string | null
  tags?: string[]
}
