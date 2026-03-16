-- Add missing index on cop_personas.cop_session_id for stats queries
CREATE INDEX IF NOT EXISTS idx_cop_personas_session ON cop_personas(cop_session_id);
