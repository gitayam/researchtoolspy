-- Where a COP webcam's facts came from (webcams Phase 2).
--
-- source_url        The camera operator's own page (Windy urls.provider), https only.
-- windy_status      The last status Windy reported (active, inactive, ...); NULL for
--                   other providers and for Windy cameras never checked.
-- status_checked_at ISO time of that status.
-- position_source   'user' (typed in) or 'windy' (filled from Windy); NULL when unknown.
-- bearing_source    'user' (typed in) or 'estimated' (computed from a landmark the
--                   camera's title names); NULL when there is no bearing.
--
-- The routes tolerate these columns being absent: reads fall back to the 0020 column
-- list and writes skip the new fields, so code and migration may ship in either order.

ALTER TABLE cop_webcams ADD COLUMN source_url TEXT;
ALTER TABLE cop_webcams ADD COLUMN windy_status TEXT;
ALTER TABLE cop_webcams ADD COLUMN status_checked_at TEXT;
ALTER TABLE cop_webcams ADD COLUMN position_source TEXT;
ALTER TABLE cop_webcams ADD COLUMN bearing_source TEXT;
