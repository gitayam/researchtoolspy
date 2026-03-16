-- Migration 097: Add COM-B analysis dimensions to behaviors table
-- Adds structured WHY fields (capability, opportunity, motivation) alongside existing WHAT fields (TTP, indicators)
-- Supports both intelligence (adversary analysis) and product (stakeholder analysis) use cases

-- COM-B assessment stored as JSON: {physical_capability, psychological_capability, physical_opportunity, social_opportunity, reflective_motivation, automatic_motivation}
-- Each sub-field: {deficit_level: "adequate"|"deficit"|"major_barrier", evidence_notes: "...", confidence: "low"|"medium"|"high"}
ALTER TABLE behaviors ADD COLUMN comb_assessment TEXT;

-- Analysis context: "intelligence" or "product" — drives vocabulary/framing
ALTER TABLE behaviors ADD COLUMN analysis_context TEXT CHECK(analysis_context IN ('intelligence', 'product'));

-- Target audience / subject description (who are we analyzing?)
ALTER TABLE behaviors ADD COLUMN target_subject TEXT;

-- AI-generated intervention recommendations (JSON array)
ALTER TABLE behaviors ADD COLUMN intervention_recommendations TEXT;

-- Rich behavior analysis data (location_context, temporal_context, consequences, symbols, etc.)
-- Stored as JSON to match the BehaviorAnalysis type without schema explosion
ALTER TABLE behaviors ADD COLUMN analysis_data TEXT;

-- Completeness score (0-100) for research debt tracking
ALTER TABLE behaviors ADD COLUMN completeness_score INTEGER DEFAULT 0;
