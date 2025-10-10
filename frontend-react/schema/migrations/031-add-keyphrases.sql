-- ========================================
-- Add Keyphrase Extraction to Content Analysis
-- ========================================
-- Adds TextRank-style keyphrase extraction for identifying
-- important concepts, domain terminology, and central themes

ALTER TABLE content_analysis ADD COLUMN keyphrases TEXT; -- JSON array

-- JSON Structure:
-- [
--   {
--     "phrase": "artificial intelligence",
--     "score": 0.95,
--     "category": "technology|concept|event|location|other",
--     "relevance": "high|medium|low"
--   }
-- ]
