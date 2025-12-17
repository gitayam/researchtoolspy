-- Claims Investigation System
-- Integrates claims with evidence, entities, and investigation workflows

-- Store user claim adjustments with full audit trail
CREATE TABLE IF NOT EXISTS claim_adjustments (
  id TEXT PRIMARY KEY,
  content_analysis_id INTEGER NOT NULL,
  claim_index INTEGER NOT NULL, -- Position in original claims array
  claim_text TEXT NOT NULL,
  claim_category TEXT, -- statement, quote, statistic, etc.

  -- Original AI analysis
  original_risk_score INTEGER NOT NULL, -- 0-100
  original_overall_risk TEXT NOT NULL, -- low, medium, high
  original_methods TEXT, -- JSON of 6 detection method scores

  -- User adjustments
  adjusted_risk_score INTEGER, -- User's adjusted score
  user_comment TEXT, -- User's reasoning
  verification_status TEXT DEFAULT 'pending', -- pending, investigating, verified, debunked

  -- Metadata
  adjusted_by TEXT NOT NULL, -- user_id
  workspace_id TEXT DEFAULT '1',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (content_analysis_id) REFERENCES content_analysis(id) ON DELETE CASCADE
);

CREATE INDEX idx_claim_adjustments_content ON claim_adjustments(content_analysis_id);
CREATE INDEX idx_claim_adjustments_user ON claim_adjustments(adjusted_by);
CREATE INDEX idx_claim_adjustments_status ON claim_adjustments(verification_status);

-- Link claims to evidence items (supports/contradicts relationship)
CREATE TABLE IF NOT EXISTS claim_evidence_links (
  id TEXT PRIMARY KEY,
  claim_adjustment_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,

  -- Relationship details
  relationship TEXT NOT NULL, -- 'supports', 'contradicts', 'provides_context'
  relevance_score INTEGER DEFAULT 50, -- 0-100, how relevant is this evidence
  confidence INTEGER DEFAULT 50, -- 0-100, how confident in this relationship
  notes TEXT, -- User notes on why this evidence relates

  -- Metadata
  linked_by TEXT NOT NULL, -- user_id
  created_at TEXT NOT NULL,

  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE INDEX idx_claim_evidence_claim ON claim_evidence_links(claim_adjustment_id);
CREATE INDEX idx_claim_evidence_evidence ON claim_evidence_links(evidence_id);
CREATE INDEX idx_claim_evidence_relationship ON claim_evidence_links(relationship);

-- Link claims to entities (who made the claim, who is mentioned)
CREATE TABLE IF NOT EXISTS claim_entity_mentions (
  id TEXT PRIMARY KEY,
  claim_adjustment_id TEXT NOT NULL,
  entity_id TEXT NOT NULL, -- From actors/sources/events tables
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- person, organization, location, event, etc.

  -- Role in claim
  role TEXT NOT NULL, -- 'claim_maker', 'subject', 'mentioned', 'affected'
  context TEXT, -- Additional context about the mention

  -- Credibility tracking
  credibility_impact INTEGER, -- -50 to +50, how this entity affects claim credibility

  -- Metadata
  extracted_at TEXT NOT NULL,

  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE
);

CREATE INDEX idx_claim_entity_claim ON claim_entity_mentions(claim_adjustment_id);
CREATE INDEX idx_claim_entity_entity ON claim_entity_mentions(entity_id);
CREATE INDEX idx_claim_entity_type ON claim_entity_mentions(entity_type);
CREATE INDEX idx_claim_entity_role ON claim_entity_mentions(role);

-- Investigation Packets: Collections of claims being investigated together
CREATE TABLE IF NOT EXISTS investigation_packets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT DEFAULT '1',

  -- Packet details
  title TEXT NOT NULL,
  description TEXT,
  investigation_type TEXT, -- 'fact_check', 'narrative_analysis', 'source_verification', 'trend_analysis'
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  status TEXT DEFAULT 'active', -- active, completed, archived, abandoned

  -- Investigation metadata
  lead_investigator TEXT, -- user_id
  assigned_team TEXT, -- JSON array of user_ids
  deadline TEXT, -- ISO datetime

  -- Tags and categorization
  tags TEXT, -- JSON array
  category TEXT,

  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,

  -- Sharing
  is_public INTEGER DEFAULT 0,
  share_token TEXT UNIQUE
);

CREATE INDEX idx_investigation_packets_user ON investigation_packets(user_id);
CREATE INDEX idx_investigation_packets_workspace ON investigation_packets(workspace_id);
CREATE INDEX idx_investigation_packets_status ON investigation_packets(status);
CREATE INDEX idx_investigation_packets_share ON investigation_packets(share_token);

-- Link claims to investigation packets
CREATE TABLE IF NOT EXISTS packet_claims (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  claim_adjustment_id TEXT NOT NULL,

  -- Prioritization within packet
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  order_num INTEGER DEFAULT 0, -- Display order

  -- Investigation notes
  investigation_notes TEXT, -- Notes specific to this claim in this packet
  assigned_to TEXT, -- user_id who's investigating this specific claim

  -- Status tracking
  verification_status TEXT DEFAULT 'pending', -- pending, investigating, verified, debunked, inconclusive
  verification_confidence INTEGER, -- 0-100
  final_conclusion TEXT,

  -- Timestamps
  added_at TEXT NOT NULL,
  status_updated_at TEXT,

  FOREIGN KEY (packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE,
  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE
);

CREATE INDEX idx_packet_claims_packet ON packet_claims(packet_id);
CREATE INDEX idx_packet_claims_claim ON packet_claims(claim_adjustment_id);
CREATE INDEX idx_packet_claims_status ON packet_claims(verification_status);
CREATE INDEX idx_packet_claims_assigned ON packet_claims(assigned_to);

-- Investigation activity log for audit trails
CREATE TABLE IF NOT EXISTS investigation_activity_log (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  claim_adjustment_id TEXT,

  -- Activity details
  activity_type TEXT NOT NULL, -- 'claim_added', 'evidence_linked', 'status_changed', 'comment_added', 'score_adjusted'
  description TEXT NOT NULL,
  old_value TEXT, -- JSON of previous state
  new_value TEXT, -- JSON of new state

  -- Who did it
  user_id TEXT NOT NULL,

  -- When
  created_at TEXT NOT NULL,

  FOREIGN KEY (packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE,
  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE SET NULL
);

CREATE INDEX idx_investigation_activity_packet ON investigation_activity_log(packet_id);
CREATE INDEX idx_investigation_activity_claim ON investigation_activity_log(claim_adjustment_id);
CREATE INDEX idx_investigation_activity_type ON investigation_activity_log(activity_type);
CREATE INDEX idx_investigation_activity_time ON investigation_activity_log(created_at);

-- Claim sharing (share individual claims publicly)
CREATE TABLE IF NOT EXISTS claim_shares (
  id TEXT PRIMARY KEY,
  claim_adjustment_id TEXT NOT NULL,

  -- Sharing settings
  share_token TEXT NOT NULL UNIQUE,
  is_public INTEGER DEFAULT 1,
  allow_comments INTEGER DEFAULT 0,
  show_evidence INTEGER DEFAULT 1,
  show_entities INTEGER DEFAULT 1,

  -- Analytics
  view_count INTEGER DEFAULT 0,

  -- Metadata
  shared_by TEXT NOT NULL,
  shared_at TEXT NOT NULL,
  expires_at TEXT, -- Optional expiration

  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE
);

CREATE INDEX idx_claim_shares_token ON claim_shares(share_token);
CREATE INDEX idx_claim_shares_claim ON claim_shares(claim_adjustment_id);
