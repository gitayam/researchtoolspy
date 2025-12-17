-- ============================================================================
-- Migration 026: Content-Entity Linking & Framework Integration
-- Description: Junction tables for content → entities and content → frameworks
-- Date: 2025-10-08
-- Priority: HIGH (Phase 1)
-- ============================================================================

-- ============================================================
-- CONTENT-TO-ENTITY JUNCTION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS content_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Source content
  content_analysis_id INTEGER NOT NULL,

  -- Target entity (polymorphic reference)
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR', 'EVIDENCE')),

  -- Extraction metadata
  extraction_method TEXT DEFAULT 'gpt', -- 'gpt', 'manual', 'regex', 'ner'
  confidence REAL DEFAULT 1.0, -- 0.0 to 1.0
  mention_count INTEGER DEFAULT 1, -- How many times entity mentioned in content

  -- Context preservation
  first_mention_context TEXT, -- Sentence or paragraph where entity first appears
  mention_locations TEXT, -- JSON array of paragraph numbers where entity appears

  -- Review tracking
  user_reviewed BOOLEAN DEFAULT FALSE,
  user_confirmed BOOLEAN DEFAULT FALSE, -- User explicitly confirmed this entity link

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,

  -- Prevent duplicates
  UNIQUE(content_analysis_id, entity_id, entity_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_entities_content
  ON content_entities(content_analysis_id);

CREATE INDEX IF NOT EXISTS idx_content_entities_entity
  ON content_entities(entity_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_content_entities_method
  ON content_entities(extraction_method);

CREATE INDEX IF NOT EXISTS idx_content_entities_confidence
  ON content_entities(confidence);

-- Update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_content_entities_timestamp
AFTER UPDATE ON content_entities
BEGIN
    UPDATE content_entities
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================================
-- FRAMEWORK-TO-CONTENT JUNCTION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS framework_content_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Framework session
  framework_session_id INTEGER NOT NULL,

  -- Source content
  content_analysis_id INTEGER NOT NULL,

  -- Field mapping (which content populated which framework field)
  -- JSON structure: {
  --   "pmesii.political": ["paragraph_3", "paragraph_7"],
  --   "pmesii.military": ["paragraph_12", "paragraph_15"],
  --   "swot.strengths": ["paragraph_2"]
  -- }
  field_mappings TEXT, -- JSON

  -- Auto-population metadata
  auto_populated BOOLEAN DEFAULT FALSE,
  auto_population_confidence REAL, -- 0.0 to 1.0
  auto_population_model TEXT, -- 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o-mini'
  auto_population_prompt_version TEXT, -- Track prompt changes for improvement

  -- User review tracking
  user_reviewed BOOLEAN DEFAULT FALSE,
  user_accepted BOOLEAN DEFAULT FALSE, -- User accepted auto-populated data
  user_edited_fields TEXT, -- JSON array of field names user modified

  -- Usage tracking
  usage_count INTEGER DEFAULT 1, -- How many times this content referenced in framework

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (framework_session_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,

  -- Prevent duplicates (but allow multiple links if re-analyzed)
  UNIQUE(framework_session_id, content_analysis_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_framework_content_framework
  ON framework_content_sources(framework_session_id);

CREATE INDEX IF NOT EXISTS idx_framework_content_content
  ON framework_content_sources(content_analysis_id);

CREATE INDEX IF NOT EXISTS idx_framework_content_auto_populated
  ON framework_content_sources(auto_populated);

CREATE INDEX IF NOT EXISTS idx_framework_content_reviewed
  ON framework_content_sources(user_reviewed);

-- Update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_framework_content_timestamp
AFTER UPDATE ON framework_content_sources
BEGIN
    UPDATE framework_content_sources
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================================
-- CONTENT DEDUPLICATION TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS content_deduplication (
  -- Content hash is primary key (SHA-256)
  content_hash TEXT PRIMARY KEY,

  -- Canonical content record (first analyzed)
  canonical_content_id INTEGER NOT NULL,

  -- Deduplication stats
  duplicate_count INTEGER DEFAULT 1, -- How many times this content was submitted
  total_access_count INTEGER DEFAULT 1, -- Sum of access_count across all duplicates

  -- Timestamps
  first_analyzed_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,

  -- Foreign key
  FOREIGN KEY (canonical_content_id) REFERENCES content_analysis(id) ON DELETE CASCADE
);

-- Index for canonical content lookup
CREATE INDEX IF NOT EXISTS idx_content_dedup_canonical
  ON content_deduplication(canonical_content_id);

-- Index for access tracking (cache eviction)
CREATE INDEX IF NOT EXISTS idx_content_dedup_last_accessed
  ON content_deduplication(last_accessed_at);

-- ============================================================
-- EVIDENCE-TO-CONTENT LINKING
-- ============================================================

-- Add source_content_id to evidence_items (if not exists)
ALTER TABLE evidence_items ADD COLUMN source_content_id INTEGER;

-- Add paragraph reference for traceability
ALTER TABLE evidence_items ADD COLUMN source_paragraph INTEGER;

-- Add extraction metadata
ALTER TABLE evidence_items ADD COLUMN extracted_from_content BOOLEAN DEFAULT FALSE;

-- Create index for content-to-evidence queries
CREATE INDEX IF NOT EXISTS idx_evidence_source_content
  ON evidence_items(source_content_id);

-- ============================================================
-- CONTENT CHUNKS TABLE (for large documents)
-- ============================================================

CREATE TABLE IF NOT EXISTS content_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Parent content
  content_analysis_id INTEGER NOT NULL,

  -- Chunk metadata
  chunk_index INTEGER NOT NULL, -- 0, 1, 2, ...
  chunk_size INTEGER NOT NULL, -- Bytes in this chunk
  chunk_hash TEXT NOT NULL, -- SHA-256 of chunk (integrity check)

  -- Chunk data
  chunk_text TEXT NOT NULL, -- Actual text content

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign key
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,

  -- Ensure chunk ordering
  UNIQUE(content_analysis_id, chunk_index)
);

-- Indexes for chunk retrieval
CREATE INDEX IF NOT EXISTS idx_content_chunks_content
  ON content_chunks(content_analysis_id);

CREATE INDEX IF NOT EXISTS idx_content_chunks_index
  ON content_chunks(content_analysis_id, chunk_index);

-- ============================================================
-- NOTES
-- ============================================================
-- 1. content_entities: Polymorphic reference to actors, places, events, etc.
-- 2. framework_content_sources: Tracks which content populated which framework fields
-- 3. content_deduplication: Maps content hash to canonical content_analysis record
-- 4. evidence_items.source_content_id: Links evidence to originating content
-- 5. content_chunks: Stores large content in manageable pieces (>500KB documents)
--
-- IMPORTANT: When querying entities from content, join content_entities table.
--            When displaying framework sources, join framework_content_sources table.
--            When checking for duplicate content, query content_deduplication first.
-- ============================================================
