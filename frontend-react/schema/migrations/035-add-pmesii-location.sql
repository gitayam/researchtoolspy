-- Add geographic context to PMESII-PT framework
-- PMESII-PT is fundamentally location-based analysis

-- Add location columns to framework_analyses
ALTER TABLE framework_analyses ADD COLUMN location_country TEXT;
ALTER TABLE framework_analyses ADD COLUMN location_region TEXT; -- State/province
ALTER TABLE framework_analyses ADD COLUMN location_city TEXT;
ALTER TABLE framework_analyses ADD COLUMN time_period_start TEXT; -- ISO 8601 date
ALTER TABLE framework_analyses ADD COLUMN time_period_end TEXT; -- ISO 8601 date
ALTER TABLE framework_analyses ADD COLUMN scope_objectives TEXT; -- Analysis objectives

-- Create indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_framework_location_country
ON framework_analyses(location_country)
WHERE location_country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_framework_location_region
ON framework_analyses(location_region)
WHERE location_region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_framework_type_location
ON framework_analyses(framework_type, location_country)
WHERE location_country IS NOT NULL;

-- Add comment explaining usage
-- For PMESII-PT analyses:
-- - location_country is REQUIRED
-- - location_region and location_city are optional but recommended
-- - time_period helps temporal analysis
-- - scope_objectives provides context for the analysis

-- Example: A PMESII-PT analysis of Ukraine in 2024
-- location_country: "Ukraine"
-- location_region: "Donbas" (optional)
-- location_city: "Mariupol" (optional)
-- time_period_start: "2024-01-01"
-- time_period_end: "2024-12-31"
-- scope_objectives: "Assess military and economic situation in contested regions"
