-- ========================================
-- Add Topic Modeling to Content Analysis
-- ========================================
-- Adds LDA-style topic extraction for identifying
-- main themes, subject areas, and document clustering

ALTER TABLE content_analysis ADD COLUMN topics TEXT; -- JSON array

-- JSON Structure:
-- [
--   {
--     "name": "Artificial Intelligence Ethics",
--     "keywords": ["AI", "ethics", "bias", "transparency", "accountability"],
--     "coherence": 0.85,
--     "coverage": 0.35,
--     "description": "Discussion of ethical considerations in AI development"
--   }
-- ]
--
-- coherence: 0.0 to 1.0 - how well-defined the topic is
-- coverage: 0.0 to 1.0 - what percentage of document relates to this topic
