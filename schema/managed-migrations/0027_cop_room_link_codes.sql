-- Linking a Signal room to a COP needs the COP side's consent.
--
-- Members can create breakout rooms, and the Signal bot's principal can open every COP it
-- created, so "!cop link <session id>" alone would let any member pull a whole COP into
-- their own room (the chat feed posts what happens in the COP into each linked room).
-- Instead the COP's owner, an editor or an admin makes a one-time code in the share
-- dialog (POST /api/cop/:id/room-link-codes) and the room's organizer types
-- "!cop link <code>"; the bot redeems it (POST /api/cop/room-link-codes/redeem).
--
-- cop_room_link_codes: one row per code. Only the SHA-256 of the code is stored; the code
--   itself is shown once. A code lasts 24 hours and links one room: redeeming sets
--   used_at in the same UPDATE that checks it is unused and unexpired, so two redeems of
--   one code can't both succeed. used_by_service is the integration client that redeemed it.
-- cop_link_code_redeem_slots: redeem attempts per integration client per UTC hour, taken
--   atomically (INSERT … ON CONFLICT DO UPDATE SET n = n + 1 WHERE n < cap RETURNING n).
--
-- The routes answer 503 while this migration is pending; nothing else depends on it.
CREATE TABLE IF NOT EXISTS cop_room_link_codes (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    used_by_service TEXT
);
CREATE INDEX IF NOT EXISTS idx_cop_room_link_codes_session ON cop_room_link_codes(cop_session_id, created_at);

CREATE TABLE IF NOT EXISTS cop_link_code_redeem_slots (
    client_id TEXT NOT NULL,
    hour TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (client_id, hour)
);
