-- One guest principal may be attached to a given authenticated account once.
-- Keep the earliest legacy metric if an older deployment recorded duplicates.
DELETE FROM guest_conversions
WHERE id NOT IN (
  SELECT MIN(id) FROM guest_conversions GROUP BY guest_session_id, user_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_conversions_identity
  ON guest_conversions(guest_session_id, user_id);
