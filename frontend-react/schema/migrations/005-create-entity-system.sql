-- Migration 005: Entity System (Actors, Sources, Events, Places, Behaviors, Relationships)
-- Intelligence Entity Management with Deception Detection Integration
-- Date: October 3, 2025

-- ============================================================
-- WORKSPACES
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK(type IN ('PERSONAL', 'TEAM', 'PUBLIC')) NOT NULL,

  -- Ownership
  owner_id INTEGER NOT NULL,

  -- Settings
  is_public INTEGER DEFAULT 0,
  allow_cloning INTEGER DEFAULT 1,

  -- Statistics
  entity_count TEXT DEFAULT '{}', -- JSON: {actors: 0, sources: 0, evidence: 0, events: 0, places: 0, behaviors: 0}

  -- Library features (for public workspaces)
  votes INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type);
CREATE INDEX IF NOT EXISTS idx_workspaces_is_public ON workspaces(is_public);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('ADMIN', 'EDITOR', 'VIEWER')) NOT NULL,
  permissions TEXT, -- JSON array of specific permissions

  joined_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- ============================================================
-- ACTORS (People, Organizations, Units, Governments)
-- ============================================================

CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('PERSON', 'ORGANIZATION', 'UNIT', 'GOVERNMENT', 'GROUP', 'OTHER')) NOT NULL,

  -- Basic Info
  name TEXT NOT NULL,
  aliases TEXT, -- JSON array of strings
  description TEXT,

  -- Classification
  category TEXT, -- e.g., "Military", "Political", "Intelligence"
  role TEXT, -- e.g., "Commander", "Minister", "Operative"
  affiliation TEXT, -- e.g., "Russian Federation", "Wagner Group"

  -- Deception Profile (MOM-POP) - JSON
  deception_profile TEXT, -- JSON: {mom: {...}, pop: {...}, overall_assessment: {...}, last_updated: "..."}

  -- Framework Links
  causeway_analysis_id INTEGER,
  cog_analysis_id INTEGER,

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (causeway_analysis_id) REFERENCES framework_sessions(id),
  FOREIGN KEY (cog_analysis_id) REFERENCES framework_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_actors_workspace ON actors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_actors_type ON actors(type);
CREATE INDEX IF NOT EXISTS idx_actors_name ON actors(name);
CREATE INDEX IF NOT EXISTS idx_actors_is_public ON actors(is_public);

-- ============================================================
-- SOURCES (HUMINT, SIGINT, IMINT, OSINT, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('HUMINT', 'SIGINT', 'IMINT', 'OSINT', 'GEOINT', 'MASINT', 'TECHINT', 'CYBER')) NOT NULL,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT, -- e.g., "Agent", "Intercept", "Satellite"

  -- MOSES Assessment - JSON
  moses_assessment TEXT, -- JSON: {source_vulnerability: 0-5, manipulation_evidence: 0-5, access_level: "...", reliability: "A-F", notes: "..."}

  -- Relationships
  controlled_by TEXT, -- Actor ID

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (controlled_by) REFERENCES actors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_workspace ON sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_controlled_by ON sources(controlled_by);
CREATE INDEX IF NOT EXISTS idx_sources_is_public ON sources(is_public);

-- ============================================================
-- EVENTS (Operations, Incidents, Meetings, Activities)
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK(event_type IN ('OPERATION', 'INCIDENT', 'MEETING', 'ACTIVITY', 'OTHER')) NOT NULL,

  -- Temporal
  date_start TEXT NOT NULL,
  date_end TEXT,
  duration INTEGER, -- Duration in minutes

  -- Spatial
  location_id TEXT, -- Link to Place entity
  coordinates TEXT, -- JSON: {lat: number, lng: number}

  -- Analysis
  significance TEXT CHECK(significance IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  confidence TEXT CHECK(confidence IN ('CONFIRMED', 'PROBABLE', 'POSSIBLE', 'DOUBTFUL')),

  -- Framework Links
  timeline_id INTEGER, -- Link to timeline analysis framework

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (location_id) REFERENCES places(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_workspace ON events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_date_start ON events(date_start);
CREATE INDEX IF NOT EXISTS idx_events_significance ON events(significance);
CREATE INDEX IF NOT EXISTS idx_events_is_public ON events(is_public);

-- ============================================================
-- PLACES (Facilities, Cities, Regions, Installations)
-- ============================================================

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  place_type TEXT CHECK(place_type IN ('FACILITY', 'CITY', 'REGION', 'COUNTRY', 'INSTALLATION', 'OTHER')) NOT NULL,

  -- Geographic
  coordinates TEXT NOT NULL, -- JSON: {lat: number, lng: number}
  address TEXT,
  country TEXT,
  region TEXT,

  -- Analysis
  strategic_importance TEXT CHECK(strategic_importance IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),

  -- Relationships
  controlled_by TEXT, -- Actor ID

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (controlled_by) REFERENCES actors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_places_workspace ON places(workspace_id);
CREATE INDEX IF NOT EXISTS idx_places_type ON places(place_type);
CREATE INDEX IF NOT EXISTS idx_places_country ON places(country);
CREATE INDEX IF NOT EXISTS idx_places_controlled_by ON places(controlled_by);
CREATE INDEX IF NOT EXISTS idx_places_is_public ON places(is_public);

-- ============================================================
-- BEHAVIORS (TTPs, Patterns, Tactics, Techniques)
-- ============================================================

CREATE TABLE IF NOT EXISTS behaviors (
  id TEXT PRIMARY KEY,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  behavior_type TEXT CHECK(behavior_type IN ('TTP', 'PATTERN', 'TACTIC', 'TECHNIQUE', 'PROCEDURE')) NOT NULL,

  -- Pattern Details
  indicators TEXT, -- JSON array of observable indicators
  frequency TEXT CHECK(frequency IN ('CONTINUOUS', 'FREQUENT', 'OCCASIONAL', 'RARE')),
  first_observed TEXT,
  last_observed TEXT,

  -- Analysis
  sophistication TEXT CHECK(sophistication IN ('ADVANCED', 'INTERMEDIATE', 'BASIC')),
  effectiveness TEXT CHECK(effectiveness IN ('HIGHLY_EFFECTIVE', 'EFFECTIVE', 'MODERATELY_EFFECTIVE', 'INEFFECTIVE')),

  -- Framework Links
  behavior_analysis_id INTEGER,

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Library
  is_public INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (behavior_analysis_id) REFERENCES framework_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_behaviors_workspace ON behaviors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_behaviors_type ON behaviors(behavior_type);
CREATE INDEX IF NOT EXISTS idx_behaviors_frequency ON behaviors(frequency);
CREATE INDEX IF NOT EXISTS idx_behaviors_is_public ON behaviors(is_public);

-- ============================================================
-- RELATIONSHIPS (Typed connections between entities)
-- ============================================================

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,

  -- Entities
  source_entity_id TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,

  -- Relationship
  relationship_type TEXT NOT NULL, -- CONTROLS, REPORTS_TO, ALLIED_WITH, ADVERSARY_OF, MEMBER_OF, LOCATED_AT, PARTICIPATED_IN, PROVIDED_BY, EXHIBITS, CORROBORATES, CONTRADICTS, CUSTOM
  description TEXT,
  weight REAL DEFAULT 1.0, -- Relationship strength 0.0-1.0

  -- Temporal
  start_date TEXT,
  end_date TEXT,

  -- Confidence
  confidence TEXT CHECK(confidence IN ('CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED')),

  -- Supporting Evidence
  evidence_ids TEXT, -- JSON array of evidence IDs supporting this relationship

  -- Workspace
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_workspace ON relationships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id, source_entity_type);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id, target_entity_type);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type);

-- ============================================================
-- LIBRARY ITEMS (Public community contributions)
-- ============================================================

CREATE TABLE IF NOT EXISTS library_items (
  id TEXT PRIMARY KEY,

  entity_id TEXT NOT NULL,
  entity_type TEXT CHECK(entity_type IN ('ACTOR', 'SOURCE', 'EVIDENCE', 'EVENT', 'PLACE', 'BEHAVIOR')) NOT NULL,

  -- Publishing
  published_by INTEGER NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_id TEXT NOT NULL,

  -- Quality
  votes INTEGER DEFAULT 0,
  stars REAL DEFAULT 0.0, -- Average star rating 0.0-5.0
  views INTEGER DEFAULT 0,
  clones INTEGER DEFAULT 0,

  -- Moderation
  status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED')) DEFAULT 'PENDING',
  reviewed_by INTEGER,
  reviewed_at TEXT,

  -- Discovery
  tags TEXT, -- JSON array
  categories TEXT, -- JSON array

  -- Attribution
  original_creator INTEGER NOT NULL,
  contributors TEXT, -- JSON array of user IDs
  license TEXT,

  FOREIGN KEY (published_by) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (original_creator) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_library_entity ON library_items(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_library_status ON library_items(status);
CREATE INDEX IF NOT EXISTS idx_library_votes ON library_items(votes);
CREATE INDEX IF NOT EXISTS idx_library_stars ON library_items(stars);

-- ============================================================
-- JUNCTION TABLES (Many-to-many relationships)
-- ============================================================

-- Actor <-> Events
CREATE TABLE IF NOT EXISTS actor_events (
  actor_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  role TEXT, -- e.g., "Participant", "Organizer", "Target"
  PRIMARY KEY (actor_id, event_id),
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Evidence <-> Actors
CREATE TABLE IF NOT EXISTS evidence_actors (
  evidence_id INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  relevance TEXT, -- e.g., "Mentioned", "Involved", "Author"
  PRIMARY KEY (evidence_id, actor_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
);

-- Source <-> Evidence
CREATE TABLE IF NOT EXISTS source_evidence (
  source_id TEXT NOT NULL,
  evidence_id INTEGER NOT NULL,
  PRIMARY KEY (source_id, evidence_id),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
);

-- Actor <-> Behaviors
CREATE TABLE IF NOT EXISTS actor_behaviors (
  actor_id TEXT NOT NULL,
  behavior_id TEXT NOT NULL,
  frequency TEXT,
  last_exhibited TEXT,
  PRIMARY KEY (actor_id, behavior_id),
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (behavior_id) REFERENCES behaviors(id) ON DELETE CASCADE
);

-- Event <-> Evidence
CREATE TABLE IF NOT EXISTS event_evidence (
  event_id TEXT NOT NULL,
  evidence_id INTEGER NOT NULL,
  relevance TEXT,
  PRIMARY KEY (event_id, evidence_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
);

-- ============================================================
-- ENHANCED EVIDENCE TABLE (Add EVE assessment and workspace)
-- ============================================================

-- Add new columns to existing evidence_items table
ALTER TABLE evidence_items ADD COLUMN eve_assessment TEXT; -- JSON: {internal_consistency: 0-5, external_corroboration: 0-5, anomaly_detection: 0-5, notes: "...", assessed_at: "..."}
ALTER TABLE evidence_items ADD COLUMN source_id TEXT REFERENCES sources(id);
ALTER TABLE evidence_items ADD COLUMN event_id TEXT REFERENCES events(id);
ALTER TABLE evidence_items ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);
ALTER TABLE evidence_items ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE evidence_items ADD COLUMN votes INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_evidence_workspace ON evidence_items(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence_items(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_event ON evidence_items(event_id);
CREATE INDEX IF NOT EXISTS idx_evidence_is_public ON evidence_items(is_public);
