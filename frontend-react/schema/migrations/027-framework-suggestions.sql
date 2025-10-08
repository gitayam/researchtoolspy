-- ============================================================================
-- Migration 027: Framework Suggestion System
-- Description: AI-powered framework suggestions based on content analysis
-- Date: 2025-10-08
-- Priority: MEDIUM (Phase 3)
-- ============================================================================

-- ============================================================
-- CONTENT FRAMEWORK SUGGESTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS content_framework_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Source content
  content_analysis_id INTEGER NOT NULL,

  -- Suggested frameworks (ordered by relevance)
  -- JSON structure: [
  --   {
  --     "framework_type": "pmesii-pt",
  --     "confidence": 0.92,
  --     "reasoning": "Content contains political, military, and economic analysis...",
  --     "sample_population": {
  --       "political": "Mentions of government policy...",
  --       "military": "Discussion of armed forces..."
  --     },
  --     "priority": 1
  --   },
  --   { "framework_type": "dime", "confidence": 0.78, ... }
  -- ]
  suggested_frameworks TEXT NOT NULL, -- JSON array

  -- Top suggestion (denormalized for quick queries)
  top_suggestion_type TEXT, -- 'pmesii-pt'
  top_suggestion_confidence REAL, -- 0.92

  -- Analysis metadata
  analysis_model TEXT NOT NULL, -- 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o-mini'
  analysis_prompt_version TEXT NOT NULL, -- 'v1.0', 'v1.1' (track prompt iterations)
  analysis_tokens_used INTEGER, -- Token count for cost tracking
  analysis_duration_ms INTEGER, -- Processing time

  -- Cache control
  is_stale BOOLEAN DEFAULT FALSE, -- Mark for refresh if content re-analyzed
  expires_at TEXT, -- Optional cache expiration

  -- User feedback (for prompt improvement)
  user_clicked_suggestion TEXT, -- Which framework user actually chose
  user_rating INTEGER, -- 1-5 stars on suggestion quality
  user_feedback TEXT, -- Optional text feedback

  -- Timestamps
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign key
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,

  -- One suggestion set per content
  UNIQUE(content_analysis_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_framework_suggestions_content
  ON content_framework_suggestions(content_analysis_id);

CREATE INDEX IF NOT EXISTS idx_framework_suggestions_top_type
  ON content_framework_suggestions(top_suggestion_type);

CREATE INDEX IF NOT EXISTS idx_framework_suggestions_stale
  ON content_framework_suggestions(is_stale);

CREATE INDEX IF NOT EXISTS idx_framework_suggestions_expires
  ON content_framework_suggestions(expires_at);

-- Update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_framework_suggestions_timestamp
AFTER UPDATE ON content_framework_suggestions
BEGIN
    UPDATE content_framework_suggestions
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================================
-- SUGGESTION ANALYTICS TABLE (for prompt optimization)
-- ============================================================

CREATE TABLE IF NOT EXISTS suggestion_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Suggestion reference
  suggestion_id INTEGER NOT NULL,
  content_analysis_id INTEGER NOT NULL,

  -- User action
  action_type TEXT NOT NULL CHECK(action_type IN (
    'viewed',         -- User saw suggestions
    'clicked',        -- User clicked a suggestion
    'created',        -- User created framework from suggestion
    'ignored',        -- User ignored suggestions
    'rated',          -- User rated suggestion quality
    'reported'        -- User reported bad suggestion
  )),

  -- Action metadata
  selected_framework_type TEXT, -- Which framework user selected
  suggested_rank INTEGER, -- Was it top suggestion (1), 2nd (2), etc.?
  time_to_action_seconds INTEGER, -- How long until user acted

  -- Context
  user_id INTEGER,
  workspace_id TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (suggestion_id) REFERENCES content_framework_suggestions(id) ON DELETE CASCADE,
  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_suggestion
  ON suggestion_analytics(suggestion_id);

CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_action
  ON suggestion_analytics(action_type);

CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_framework
  ON suggestion_analytics(selected_framework_type);

CREATE INDEX IF NOT EXISTS idx_suggestion_analytics_created_at
  ON suggestion_analytics(created_at);

-- ============================================================
-- PROMPT TEMPLATES TABLE (versioned prompts for A/B testing)
-- ============================================================

CREATE TABLE IF NOT EXISTS suggestion_prompt_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Version control
  version TEXT NOT NULL UNIQUE, -- 'v1.0', 'v1.1', 'v2.0-beta'
  prompt_name TEXT NOT NULL, -- 'framework_suggestion', 'pmesii_population', etc.

  -- Prompt content
  system_prompt TEXT NOT NULL, -- System message for GPT
  user_prompt_template TEXT NOT NULL, -- Template with placeholders {content}, {word_count}, etc.

  -- Metadata
  model_recommendation TEXT, -- 'gpt-5-mini', 'gpt-5-nano'
  temperature REAL, -- For GPT-4 models
  verbosity TEXT, -- 'low', 'medium', 'high' (for GPT-5)
  reasoning_effort TEXT, -- 'minimal', 'default', 'high' (for GPT-5)

  -- Performance tracking
  average_tokens_used INTEGER,
  average_duration_ms INTEGER,
  success_rate REAL, -- % of successful suggestions (user clicked/created)

  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE, -- Current production version
  deprecated_at TEXT, -- When this version was retired

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_version
  ON suggestion_prompt_templates(version);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_name
  ON suggestion_prompt_templates(prompt_name);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_active
  ON suggestion_prompt_templates(is_active)
  WHERE is_active = TRUE;

-- Update trigger
CREATE TRIGGER IF NOT EXISTS update_prompt_templates_timestamp
AFTER UPDATE ON suggestion_prompt_templates
BEGIN
    UPDATE suggestion_prompt_templates
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- ============================================================
-- SEED DATA: Initial Prompt Template
-- ============================================================

INSERT INTO suggestion_prompt_templates (
  version,
  prompt_name,
  system_prompt,
  user_prompt_template,
  model_recommendation,
  verbosity,
  reasoning_effort,
  is_active
) VALUES (
  'v1.0',
  'framework_suggestion',
  'You are an intelligence analysis expert. Given web content, suggest the most applicable analysis frameworks from this list:

1. PMESII-PT: Political, Military, Economic, Social, Infrastructure, Information, Physical Environment, Time
2. DIME: Diplomatic, Information, Military, Economic
3. COG (Center of Gravity): Critical Capabilities, Requirements, Vulnerabilities
4. SWOT: Strengths, Weaknesses, Opportunities, Threats
5. Causeway: Network analysis of actors and relationships
6. ACH (Analysis of Competing Hypotheses): Multiple hypothesis evaluation
7. Deception Detection: MOM-POP deception indicators
8. Behavior Analysis: Patterns, tactics, techniques, procedures
9. Starbursting: Who, What, When, Where, Why, How questions
10. DOTMLPF: Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities

Respond with JSON only, no explanation.',

  'Analyze the following content and suggest the top 3 most applicable frameworks. For each, provide:
- framework_type (lowercase with hyphens, e.g. "pmesii-pt")
- confidence (0.0-1.0)
- reasoning (1 sentence why this framework fits)
- sample_population (object with 1-2 example fields pre-populated)

Content metadata:
- Word count: {word_count}
- Entities: {entity_summary}
- Top topics: {top_phrases}

Content excerpt (first 2000 chars):
{content_excerpt}

Return JSON array ordered by confidence (highest first):
[{"framework_type": "...", "confidence": 0.92, "reasoning": "...", "sample_population": {...}}, ...]',

  'gpt-5-mini',
  'low',
  'default',
  TRUE
);

-- ============================================================
-- NOTES
-- ============================================================
-- 1. content_framework_suggestions: Cache GPT-generated framework suggestions
-- 2. suggestion_analytics: Track user behavior to improve suggestions over time
-- 3. suggestion_prompt_templates: Version control for GPT prompts (A/B testing)
--
-- WORKFLOW:
-- 1. User analyzes content → analyze-url API
-- 2. Async: Generate framework suggestions → store in content_framework_suggestions
-- 3. User views suggestions → log 'viewed' in suggestion_analytics
-- 4. User clicks suggestion → log 'clicked', create framework via /frameworks/create-from-content
-- 5. Track success rate → update prompt template performance metrics
--
-- PROMPT IMPROVEMENT LOOP:
-- - Query suggestion_analytics for low success rates
-- - Identify which content types get bad suggestions
-- - Create new prompt template version (v1.1, v2.0)
-- - A/B test new prompt vs old prompt
-- - Promote winning prompt to is_active=TRUE
-- ============================================================
