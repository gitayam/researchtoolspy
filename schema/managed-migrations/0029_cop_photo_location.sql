-- A COP photo's location, kept for the team (decision 2026-10-23: "for our case we don't
-- want to strip gps as this is a research cop").
--
-- cop_uploads.r2_key keeps meaning what it always has: the PUBLIC copy, every identifying
-- block removed (Orientation kept). It is the only copy a share link is ever served.
-- team_r2_key is the TEAM copy: the public copy plus a fresh Exif block with only GPS
-- position, capture time (DateTimeOriginal, OffsetTimeOriginal) and Orientation
-- (functions/api/_shared/photo-location.ts). It is set only when a photo has a position
-- or capture time to keep, so it is NULL for every upload stored before this migration:
-- those were stripped at upload and serve the team and share links alike.
-- gps_lat / gps_lon / gps_alt / captured_at: what the photo said, validated (no 0,0, no
-- out-of-range values); read by the team only.
--
-- survey_responses.keep_photo_location: 1 on a row stored by the anonymous tip form's
-- drop-submit, whose notice tells the tipster that photos keep where and when they were
-- taken. Only such a row keeps a photo's location when it becomes COP evidence; every
-- other row (surveys, intake forms, rows from before this migration: 0) is fully stripped.
--
-- idx_cop_markers_photo_gps: one "Photo location" marker per evidence item
-- (source_type PHOTO_GPS, source_id = the evidence id). The insert already checks
-- (INSERT … SELECT … WHERE NOT EXISTS); the index is the backstop for two writers at once.
--
-- Until this runs, uploads are stored as before (only the stripped copy; the team copy
-- is removed again) and the possible marker is still placed from the position read at
-- upload; a drop-form tip is stored fully stripped (there is nowhere to record consent).
ALTER TABLE cop_uploads ADD COLUMN team_r2_key TEXT;
ALTER TABLE cop_uploads ADD COLUMN gps_lat REAL;
ALTER TABLE cop_uploads ADD COLUMN gps_lon REAL;
ALTER TABLE cop_uploads ADD COLUMN gps_alt REAL;
ALTER TABLE cop_uploads ADD COLUMN captured_at TEXT;
ALTER TABLE survey_responses ADD COLUMN keep_photo_location INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cop_markers_photo_gps
    ON cop_markers(cop_session_id, source_id) WHERE source_type = 'PHOTO_GPS';
