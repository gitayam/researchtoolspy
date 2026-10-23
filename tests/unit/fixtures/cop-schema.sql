-- Production DDL (schema only) for the COP tables, read 2026-10-23 from researchtoolspy-prod.
-- Used by tests/unit/cop-core-harness.mjs; managed migrations from 0020 on are applied on top.

CREATE TABLE IF NOT EXISTS "claim_evidence_links" (
  id TEXT PRIMARY KEY,
  claim_adjustment_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,

  -- Relationship details
  relationship TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 50,
  confidence INTEGER DEFAULT 50,
  notes TEXT,

  -- Metadata
  linked_by TEXT NOT NULL,
  created_at TEXT NOT NULL, source_passage_id TEXT REFERENCES source_passages(id) ON DELETE SET NULL,

  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS cop_activity (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, user_id INTEGER, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, summary TEXT, created_at TEXT DEFAULT (datetime('now')), actor_name TEXT, details TEXT, FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id));
CREATE TABLE IF NOT EXISTS cop_alert_state (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT,
  redsight_incident_id TEXT NOT NULL,
  status TEXT DEFAULT 'new',  -- new, dismissed, action, analysis
  linked_rfi_id TEXT,
  linked_task_id TEXT,
  notes TEXT,
  severity TEXT,
  incident_type TEXT,
  location_name TEXT,
  summary TEXT,
  actioned_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id),
  FOREIGN KEY (linked_rfi_id) REFERENCES cop_rfis(id)
);
CREATE TABLE IF NOT EXISTS cop_asset_log (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (asset_id) REFERENCES cop_assets(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_assets (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,  -- 'human', 'source', 'infrastructure', 'digital'
  name TEXT NOT NULL,
  status TEXT DEFAULT 'available',  -- 'available', 'deployed', 'degraded', 'offline', 'compromised', 'exhausted'
  details TEXT DEFAULT '{}',
  assigned_to_task_id TEXT,
  location TEXT,
  lat REAL,
  lon REAL,
  sensitivity TEXT DEFAULT 'unclassified',  -- 'unclassified', 'internal', 'restricted'
  last_checked_at TEXT,
  notes TEXT,

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS "cop_claims" (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT,
  url TEXT,
  url_title TEXT,
  url_domain TEXT,
  claim_text TEXT NOT NULL,
  category TEXT,
  confidence INTEGER DEFAULT 50,
  summary TEXT,
  status TEXT DEFAULT 'unverified',
  evidence_item_id INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cop_collaborators (id TEXT PRIMARY KEY, cop_session_id TEXT NOT NULL, user_id INTEGER, email TEXT, role TEXT NOT NULL DEFAULT 'viewer', invite_token TEXT UNIQUE, invited_by INTEGER, invited_at TEXT DEFAULT (datetime('now')), accepted_at TEXT, skills TEXT DEFAULT '[]', max_concurrent INTEGER DEFAULT 5, timezone TEXT, availability TEXT DEFAULT 'available', FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id));
CREATE TABLE IF NOT EXISTS cop_events (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_evidence_tags (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  tag_category TEXT NOT NULL,
  tag_value TEXT NOT NULL,
  confidence INTEGER DEFAULT 100,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cop_exports (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  format TEXT NOT NULL,  -- 'geojson', 'kml', 'cot', 'stix', 'csv'
  scope TEXT DEFAULT 'full',  -- 'full', 'layers', 'entities', 'evidence', 'tasks'
  filters_json TEXT DEFAULT '{}',
  file_url TEXT,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'pending',  -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,

  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_hypotheses (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  confidence INTEGER DEFAULT 50,
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_hypothesis_evidence (
  id TEXT PRIMARY KEY,
  hypothesis_id TEXT NOT NULL,
  evidence_id TEXT,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'supporting',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hypothesis_id) REFERENCES cop_hypotheses(id)
);
CREATE TABLE IF NOT EXISTS cop_intake_forms (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',  -- 'draft', 'active', 'closed'
  auto_tag_category TEXT,
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), access_level TEXT DEFAULT 'public', password_hash TEXT, allowed_countries TEXT DEFAULT '[]', rate_limit_per_hour INTEGER DEFAULT 0, custom_slug TEXT, expires_at TEXT, theme_color TEXT, logo_url TEXT, success_message TEXT, redirect_url TEXT,

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_marker_changelog (
  id TEXT PRIMARY KEY,
  marker_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'created', 'moved', 'confidence_changed', 'rationale_updated', 'evidence_linked', 'deleted'
  old_value TEXT,  -- JSON of previous state
  new_value TEXT,  -- JSON of new state
  rationale TEXT,  -- Why this change was made
  created_by INTEGER NOT NULL,
  created_by_name TEXT,  -- Human-readable name
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (marker_id) REFERENCES cop_markers(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_markers (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    uid TEXT NOT NULL,
    cot_type TEXT DEFAULT 'a-u-G',
    callsign TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    hae REAL DEFAULT 0,

    label TEXT,
    description TEXT,
    icon TEXT,
    color TEXT,
    detail TEXT DEFAULT '{}',

    event_time TEXT DEFAULT (datetime('now')),
    stale_time TEXT,

    source_type TEXT DEFAULT 'MANUAL',
    source_id TEXT,

    workspace_id TEXT NOT NULL DEFAULT '1',
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), confidence TEXT DEFAULT 'POSSIBLE', rationale TEXT,

    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS cop_persona_links (
  id TEXT PRIMARY KEY,
  persona_a_id TEXT NOT NULL REFERENCES cop_personas(id),
  persona_b_id TEXT NOT NULL REFERENCES cop_personas(id),
  link_type TEXT DEFAULT 'alias',
  confidence INTEGER DEFAULT 50,
  evidence_id TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cop_personas (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT,
  profile_url TEXT,
  status TEXT DEFAULT 'active',
  linked_actor_id TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cop_playbook_log (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  playbook_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  trigger_event_id TEXT,
  actions_taken TEXT DEFAULT '[]',
  status TEXT DEFAULT 'success',  -- 'success', 'partial', 'failed'
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (rule_id) REFERENCES cop_playbook_rules(id),
  FOREIGN KEY (playbook_id) REFERENCES cop_playbooks(id)
);
CREATE TABLE IF NOT EXISTS cop_playbook_rules (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  trigger_event TEXT NOT NULL,
  trigger_filter TEXT DEFAULT '{}',
  conditions TEXT DEFAULT '[]',
  actions TEXT DEFAULT '[]',
  cooldown_seconds INTEGER DEFAULT 0,
  last_fired_at TEXT,
  fire_count INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (playbook_id) REFERENCES cop_playbooks(id)
);
CREATE TABLE IF NOT EXISTS cop_playbooks (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',  -- 'active', 'paused', 'draft'
  source TEXT DEFAULT 'custom',  -- 'custom', 'template'
  template_id TEXT,
  execution_count INTEGER DEFAULT 0,
  last_triggered_at TEXT,
  last_processed_event_id TEXT,  -- Cursor for polling cop_events

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_poo_estimates (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Impact point (where the drone/projectile hit)
  impact_lat REAL NOT NULL,
  impact_lon REAL NOT NULL,

  -- Range circle
  max_range_km REAL NOT NULL DEFAULT 10.0,
  min_range_km REAL DEFAULT 0,

  -- Probability sector (approach direction)
  approach_bearing REAL,            -- degrees from north (0-360), direction drone CAME FROM
  sector_width_deg REAL DEFAULT 90, -- width of probability cone in degrees

  -- Assessment
  confidence TEXT DEFAULT 'POSSIBLE' CHECK (confidence IN ('CONFIRMED', 'PROBABLE', 'POSSIBLE', 'DOUBTFUL')),
  range_basis TEXT,                 -- e.g. "10km fiber optic spool", "max flight range 5km"
  bearing_basis TEXT,               -- e.g. "WNW approach observed in video", "terrain analysis"

  -- Styling
  color TEXT DEFAULT '#ef4444',
  opacity REAL DEFAULT 0.15,

  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
CREATE TABLE IF NOT EXISTS cop_rfi_answers (
    id TEXT PRIMARY KEY,
    rfi_id TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    source_url TEXT,
    source_description TEXT,
    is_accepted INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1,
    responder_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (rfi_id) REFERENCES cop_rfis(id)
);
CREATE TABLE IF NOT EXISTS cop_rfis (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    created_by INTEGER NOT NULL DEFAULT 1,
    assigned_to INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), is_blocker INTEGER DEFAULT 0, requester_name TEXT,
    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_scrape_imports (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  item_key TEXT NOT NULL,
  provider_item_id TEXT,
  canonical_url TEXT,
  run_id TEXT NOT NULL,
  evidence_item_id INTEGER,
  imported_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cop_session_id, workspace_id, provider, item_key),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (run_id) REFERENCES cop_scrape_runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_item_id) REFERENCES evidence_items(id) ON DELETE SET NULL,
  FOREIGN KEY (imported_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS cop_scrape_requests (
  request_id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  request_fingerprint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL CHECK (state IN ('initiating', 'started', 'failed')),
  run_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cop_session_id, workspace_id, requested_by, request_fingerprint, idempotency_key),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (run_id) REFERENCES cop_scrape_runs(run_id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS cop_scrape_runs (
  run_id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  scraper_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  dataset_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS cop_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL DEFAULT 'custom',
    status TEXT DEFAULT 'ACTIVE',

    bbox_min_lat REAL,
    bbox_min_lon REAL,
    bbox_max_lat REAL,
    bbox_max_lon REAL,
    center_lat REAL,
    center_lon REAL,
    zoom_level INTEGER DEFAULT 6,

    time_window_start TEXT,
    time_window_end TEXT,
    rolling_hours INTEGER,

    active_layers TEXT DEFAULT '[]',
    layer_config TEXT DEFAULT '{}',
    linked_frameworks TEXT DEFAULT '[]',
    key_questions TEXT DEFAULT '[]',

    workspace_id TEXT NOT NULL DEFAULT '1',
    created_by INTEGER NOT NULL,
    is_public INTEGER DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), event_type TEXT, event_description TEXT, event_facts TEXT DEFAULT '[]', content_analyses TEXT DEFAULT '[]', investigation_id TEXT DEFAULT NULL, workspace_mode TEXT DEFAULT 'progress', panel_layout TEXT DEFAULT NULL, mission_brief TEXT, global_alerts_enabled INTEGER DEFAULT 0, global_alerts_region TEXT, team_workspace_id TEXT,

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS cop_shares (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    visible_panels TEXT NOT NULL DEFAULT '["map","event"]',
    allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    view_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT,
    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (task_id) REFERENCES cop_tasks(id),
  FOREIGN KEY (depends_on_task_id) REFERENCES cop_tasks(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'universal',
  tasks_json TEXT DEFAULT '[]',

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cop_tasks (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',  -- 'todo', 'in_progress', 'done', 'blocked'
  priority TEXT DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
  task_type TEXT DEFAULT 'general',  -- 'pimeyes', 'geoguessr', 'forensic', 'osint', 'reverse_image', 'social_media', 'general'
  assigned_to TEXT,  -- collaborator name or handle
  linked_persona_id TEXT,  -- FK to cop_personas (optional)
  linked_marker_id TEXT,  -- FK to cop_markers (optional)
  linked_hypothesis_id TEXT,  -- FK to cop_hypotheses (optional)
  due_date TEXT,
  completed_at TEXT,
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), parent_task_id TEXT, depth INTEGER DEFAULT 0, position INTEGER DEFAULT 0, sla_hours INTEGER, sla_started_at TEXT, sla_breached INTEGER DEFAULT 0,
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS cop_timeline_entries (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT,
  event_date TEXT NOT NULL,          -- ISO date or datetime of the real-world event
  title TEXT NOT NULL,               -- Short description
  description TEXT,                  -- Longer detail / context
  category TEXT DEFAULT 'event',     -- event, meeting, communication, financial, legal, travel, publication
  source_type TEXT DEFAULT 'manual', -- manual, url_extract
  source_url TEXT,                   -- URL if extracted from article
  source_title TEXT,                 -- Title of source article
  importance TEXT DEFAULT 'normal',  -- low, normal, high, critical
  created_by INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), entity_type TEXT, entity_id TEXT, action TEXT,

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS evidence_actors (
  evidence_id INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  relevance TEXT, auto_linked INTEGER NOT NULL DEFAULT 0
  CHECK (auto_linked IN (0, 1)), -- e.g., "Mentioned", "Involved", "Author"
  PRIMARY KEY (evidence_id, actor_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS evidence_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Core
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  summary TEXT,

  -- Classification
  evidence_type TEXT NOT NULL, -- observation, document_excerpt, statement, event, measurement, artifact
  evidence_level TEXT, -- tactical, operational, strategic

  -- 5 W's + How
  who_involved TEXT, -- JSON array
  what_happened TEXT,
  when_occurred TEXT, -- ISO timestamp or range
  where_occurred TEXT, -- JSON: {lat, lng, address, region}
  why_significant TEXT,
  how_obtained TEXT,

  -- Assessment
  credibility TEXT NOT NULL, -- 1-6
  reliability TEXT NOT NULL, -- A-F
  confidence_level TEXT, -- high, medium, low
  priority TEXT, -- low, normal, high, critical

  -- Relationships
  related_evidence_ids TEXT, -- JSON
  contradicts_evidence_ids TEXT, -- JSON
  corroborates_evidence_ids TEXT, -- JSON

  -- Metadata
  tags TEXT, -- JSON
  keywords TEXT, -- JSON
  sensitivity_level TEXT, -- public, sensitive, classified

  -- Tracking
  status TEXT DEFAULT 'draft', -- draft, verified, archived
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  verified_by INTEGER, is_public INTEGER NOT NULL DEFAULT 0, shared_by_user_id INTEGER, source_classification TEXT, source_name TEXT, source_url TEXT, source_id TEXT, category TEXT, updated_by INTEGER DEFAULT 1, who TEXT, what TEXT, where_location TEXT, why_purpose TEXT, how_method TEXT, source_content_id INTEGER, source_paragraph INTEGER, extracted_from_content BOOLEAN DEFAULT FALSE, workspace_id TEXT, metadata TEXT, research_question_id TEXT, investigation_packet_id TEXT, eve_assessment TEXT, source_artifact_id TEXT REFERENCES source_artifacts(id) ON DELETE SET NULL,

  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS survey_drops (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  access_level TEXT DEFAULT 'public',
  password_hash TEXT,
  allowed_countries TEXT DEFAULT '[]',
  rate_limit_per_hour INTEGER DEFAULT 0,
  custom_slug TEXT,
  expires_at TEXT,
  theme_color TEXT,
  logo_url TEXT,
  success_message TEXT,
  redirect_url TEXT,
  auto_tag_category TEXT,
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  cop_session_id TEXT,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')), facts TEXT DEFAULT '[]', changelog TEXT DEFAULT '[]', intent TEXT NOT NULL DEFAULT 'survey' CHECK(intent IN ('survey', 'drop')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  form_data TEXT DEFAULT '{}',
  submitter_name TEXT,
  submitter_contact TEXT,
  lat REAL,
  lon REAL,
  submitter_country TEXT,
  submitter_city TEXT,
  submitter_ip_hash TEXT,
  content_hash TEXT,
  status TEXT DEFAULT 'pending',
  triaged_by INTEGER,
  rejection_reason TEXT,
  cop_session_id TEXT,
  linked_evidence_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (survey_id) REFERENCES survey_drops(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_claim ON claim_evidence_links(claim_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_evidence ON claim_evidence_links(evidence_id);
CREATE INDEX IF NOT EXISTS idx_cop_activity_session ON cop_activity(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_activity_session_created
  ON cop_activity(cop_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_activity_time ON cop_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_cop_alert_state_incident ON cop_alert_state(redsight_incident_id);
CREATE INDEX IF NOT EXISTS idx_cop_alert_state_session ON cop_alert_state(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_alert_state_status ON cop_alert_state(cop_session_id, status);
CREATE INDEX IF NOT EXISTS idx_cop_asset_log_asset ON cop_asset_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_cop_asset_log_session ON cop_asset_log(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_assets_session ON cop_assets(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_assets_status ON cop_assets(status);
CREATE INDEX IF NOT EXISTS idx_cop_assets_task ON cop_assets(assigned_to_task_id);
CREATE INDEX IF NOT EXISTS idx_cop_assets_type ON cop_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_cop_claims_session ON cop_claims(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_claims_status ON cop_claims(cop_session_id, status);
CREATE INDEX IF NOT EXISTS idx_cop_claims_workspace ON cop_claims(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_session ON cop_collaborators(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_session_user
  ON cop_collaborators(cop_session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_token ON cop_collaborators(invite_token);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_user ON cop_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_cop_events_created ON cop_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cop_events_session ON cop_events(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_events_session_type ON cop_events(cop_session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cop_events_type ON cop_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cop_exports_session ON cop_exports(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_exports_status ON cop_exports(status);
CREATE INDEX IF NOT EXISTS idx_cop_hypotheses_session ON cop_hypotheses(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_hyp_ev_hypothesis ON cop_hypothesis_evidence(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_session ON cop_intake_forms(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_status ON cop_intake_forms(status);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_token ON cop_intake_forms(share_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_forms_slug
  ON cop_intake_forms(custom_slug) WHERE custom_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cop_marker_changelog_marker ON cop_marker_changelog(marker_id);
CREATE INDEX IF NOT EXISTS idx_cop_marker_changelog_session ON cop_marker_changelog(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_markers_bbox ON cop_markers(lat, lon);
CREATE INDEX IF NOT EXISTS idx_cop_markers_session ON cop_markers(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_markers_time ON cop_markers(event_time);
CREATE INDEX IF NOT EXISTS idx_cop_personas_session ON cop_personas(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_playbook ON cop_playbook_log(playbook_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_rule ON cop_playbook_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_session ON cop_playbook_log(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_rules_playbook ON cop_playbook_rules(playbook_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_rules_trigger ON cop_playbook_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_cop_playbooks_session ON cop_playbooks(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbooks_status ON cop_playbooks(status);
CREATE INDEX IF NOT EXISTS idx_poo_estimates_session ON cop_poo_estimates(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_poo_estimates_workspace ON cop_poo_estimates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_rfi_answers_rfi ON cop_rfi_answers(rfi_id);
CREATE INDEX IF NOT EXISTS idx_cop_rfis_session ON cop_rfis(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_rfis_status ON cop_rfis(status);
CREATE INDEX IF NOT EXISTS idx_cop_scrape_imports_evidence
  ON cop_scrape_imports(evidence_item_id);
CREATE INDEX IF NOT EXISTS idx_cop_scrape_requests_owner
  ON cop_scrape_requests(cop_session_id, requested_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_scrape_runs_owner
  ON cop_scrape_runs(cop_session_id, requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_owner_status_updated
  ON cop_sessions(created_by, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_status ON cop_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_team_workspace ON cop_sessions(team_workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_workspace ON cop_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_workspace_status_owner_updated
  ON cop_sessions(workspace_id, status, created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cop_shares_token ON cop_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_depends ON cop_task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_session ON cop_task_dependencies(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_task ON cop_task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_templates_type ON cop_task_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_cop_task_templates_workspace ON cop_task_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_assigned ON cop_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_parent ON cop_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_session ON cop_tasks(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_session_assigned
  ON cop_tasks(cop_session_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_session_status
  ON cop_tasks(cop_session_id, status);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_sla ON cop_tasks(sla_breached, sla_started_at);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_status ON cop_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cop_timeline_date ON cop_timeline_entries(event_date);
CREATE INDEX IF NOT EXISTS idx_cop_timeline_dedup
  ON cop_timeline_entries(cop_session_id, entity_type, entity_id, action);
CREATE INDEX IF NOT EXISTS idx_cop_timeline_session ON cop_timeline_entries(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_timeline_session_date ON cop_timeline_entries(cop_session_id, event_date);
CREATE INDEX IF NOT EXISTS idx_evidence_items_category ON evidence_items(category);
CREATE INDEX IF NOT EXISTS idx_evidence_items_created_at ON evidence_items(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_items_created_by ON evidence_items(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_items_level ON evidence_items(evidence_level);
CREATE INDEX IF NOT EXISTS idx_evidence_items_research_question
  ON evidence_items(research_question_id) WHERE research_question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_items_source_classification ON evidence_items(source_classification);
CREATE INDEX IF NOT EXISTS idx_evidence_items_status ON evidence_items(status);
CREATE INDEX IF NOT EXISTS idx_evidence_items_type ON evidence_items(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_created
  ON evidence_items(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_eve
  ON evidence_items(workspace_id)
  WHERE eve_assessment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_status_created
  ON evidence_items(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_public ON evidence_items(is_public);
CREATE INDEX IF NOT EXISTS idx_evidence_source_content ON evidence_items(source_content_id);
CREATE INDEX IF NOT EXISTS idx_evidence_workspace ON evidence_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_survey_drops_cop ON survey_drops(cop_session_id) WHERE cop_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_drops_creator ON survey_drops(created_by);
CREATE INDEX IF NOT EXISTS idx_survey_drops_intent ON survey_drops(intent);
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_drops_slug ON survey_drops(custom_slug) WHERE custom_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_drops_status ON survey_drops(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_drops_token ON survey_drops(share_token);
CREATE INDEX IF NOT EXISTS idx_survey_responses_cop ON survey_responses(cop_session_id) WHERE cop_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_country ON survey_responses(submitter_country);
CREATE INDEX IF NOT EXISTS idx_survey_responses_dedup ON survey_responses(survey_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_survey_responses_rate ON survey_responses(survey_id, submitter_ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_status ON survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
