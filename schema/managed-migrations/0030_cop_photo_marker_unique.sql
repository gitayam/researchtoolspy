-- One "Photo location" marker per evidence item (source_type PHOTO_GPS, source_id = the
-- evidence id; functions/api/_shared/cop-photo-location.ts). The insert already checks
-- (INSERT … SELECT … WHERE NOT EXISTS); this index is the backstop for two writers at
-- once. Until it exists that check alone holds.
--
-- Kept apart from 0029 so a duplicate can only stop this index, never half-apply the
-- columns. Read-only pre-check before applying (expect no rows):
--   SELECT cop_session_id, source_id, COUNT(*) AS n FROM cop_markers WHERE source_type = 'PHOTO_GPS' GROUP BY cop_session_id, source_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cop_markers_photo_gps
    ON cop_markers(cop_session_id, source_id) WHERE source_type = 'PHOTO_GPS';
