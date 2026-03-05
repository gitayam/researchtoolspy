-- Migration: Add Common Operating Picture tables
-- Date: 2026-03-05
-- Description: Creates cop_sessions for COP instances and cop_markers for tactical markers (CoT-compatible)

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
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_sessions_workspace ON cop_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_sessions_status ON cop_sessions(status);

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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_markers_session ON cop_markers(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_markers_bbox ON cop_markers(lat, lon);
CREATE INDEX IF NOT EXISTS idx_cop_markers_time ON cop_markers(event_time);
