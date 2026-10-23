-- Webcams on a COP session: a link to a provider's own player or feed.
--
-- A row stores a provider reference (Windy webcam id, YouTube video id) or an
-- allow-listed image/HLS URL, never a user-supplied iframe URL: the embed URL is
-- derived from provider_ref at read time (functions/api/_shared/webcam-url.ts).
-- Nothing here holds frames; viewers' browsers load the provider directly.
--
-- The routes tolerate this table being absent: writes return 503
-- (code WEBCAMS_UNAVAILABLE) and reads return an empty list or layer.
-- Rows follow their session on delete (ON DELETE CASCADE), so the workspace
-- delete cascade needs no change.
--
-- Applied with the managed runner: npm run migrate:prod
CREATE TABLE IF NOT EXISTS cop_webcams (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('windy', 'youtube', 'image', 'hls')),
    provider_ref TEXT,
    page_url TEXT,
    image_url TEXT,
    stream_url TEXT,
    label TEXT NOT NULL,
    lat REAL,
    lon REAL,
    bearing_deg INTEGER,
    fov_deg INTEGER,
    delivery TEXT NOT NULL CHECK (delivery IN ('live', 'timelapse', 'snapshot')),
    refresh_s INTEGER,
    attribution TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cop_webcams_session ON cop_webcams(cop_session_id);

-- One live row per camera per session: a re-add of the same Windy/YouTube id or
-- image/HLS URL answers 409 WEBCAM_DUPLICATE. Archived rows don't count.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cop_webcams_live_source ON cop_webcams(
    cop_session_id, provider, COALESCE(provider_ref, image_url, stream_url, '')
) WHERE archived_at IS NULL;
