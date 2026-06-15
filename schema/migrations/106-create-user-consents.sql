-- Recorded, versioned user consent for sensitive-use features.
-- Tier-1 endpoints (person/entity profiling, relationship inference, arbitrary
-- generation) require an affirmative, logged acknowledgement of lawful/authorized
-- use before they run. Enforced server-side (functions/api/_shared/consent.ts);
-- bump the version constant to re-prompt everyone when terms change.

CREATE TABLE IF NOT EXISTS user_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id, consent_type);
