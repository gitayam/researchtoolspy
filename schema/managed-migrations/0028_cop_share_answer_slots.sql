-- A per-share cap on anonymous answers through share links.
--
-- A share link with RFI answers on is an anonymous text channel into the COP, and the
-- chat feed now carries those answers into the COP's linked Signal rooms. The per-address
-- KV limit (10 per 10 minutes) is read-then-write and an attacker can rotate addresses, so
-- each share also gets an hourly cap counted here: one row per share per UTC hour, taken
-- atomically (INSERT … ON CONFLICT DO UPDATE SET n = n + 1 WHERE n < cap RETURNING n;
-- no row back means the cap is reached and the answer is refused with 429).
--
-- Until this migration is applied the route keeps the per-address limit only, and logs it.
CREATE TABLE IF NOT EXISTS cop_share_answer_slots (
    share_id TEXT NOT NULL,
    hour TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (share_id, hour)
);
