-- POO (Point of Origin) estimates for COP map overlays
-- Stores estimated launch origins for drone/projectile attacks

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

CREATE INDEX IF NOT EXISTS idx_poo_estimates_session ON cop_poo_estimates(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_poo_estimates_workspace ON cop_poo_estimates(workspace_id);
