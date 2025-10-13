-- Evidence Collection System Migration for PRODUCTION
-- Phase 2A: Context-Adaptive Research Workflows
-- Adds columns to existing research_questions table

-- Alter research_questions to add new fields
ALTER TABLE research_questions ADD COLUMN investigation_packet_id TEXT REFERENCES investigation_packets(id) ON DELETE CASCADE;
ALTER TABLE research_questions ADD COLUMN research_context TEXT;
ALTER TABLE research_questions ADD COLUMN team_size TEXT DEFAULT 'solo';
ALTER TABLE research_questions ADD COLUMN team_roles TEXT;
ALTER TABLE research_questions ADD COLUMN generated_plan TEXT;

-- Evidence Items (new table - works with both research_questions and investigation_packets)
CREATE TABLE IF NOT EXISTS research_evidence (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  -- Core fields
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,

  -- Context-specific metadata
  metadata TEXT,

  -- Quality/Credibility
  credibility_score REAL DEFAULT NULL,
  verification_status TEXT DEFAULT 'unverified',

  -- Chain of custody
  chain_of_custody TEXT,

  -- Organization
  tags TEXT,
  category TEXT,

  -- Relationships
  linked_evidence TEXT,
  entities TEXT,

  -- Timestamps
  evidence_date TEXT,
  collected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  collected_by TEXT,

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Analysis Notes
CREATE TABLE IF NOT EXISTS research_analysis (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  analysis_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,

  structured_data TEXT,
  linked_evidence TEXT,

  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Research Tasks
CREATE TABLE IF NOT EXISTS research_tasks (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  workflow_stage TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,

  assigned_to TEXT,
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',

  due_date TEXT,
  completed_at TEXT,
  estimated_hours REAL,
  actual_hours REAL,

  depends_on TEXT,
  blocks TEXT,

  related_evidence TEXT,
  related_analysis TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Activity Feed
CREATE TABLE IF NOT EXISTS research_activity (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  activity_type TEXT NOT NULL,
  actor TEXT NOT NULL,

  target_type TEXT,
  target_id TEXT,

  content TEXT,
  metadata TEXT,

  timestamp TEXT DEFAULT (datetime('now')),

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Workflow Templates
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  research_context TEXT NOT NULL,
  template_name TEXT NOT NULL,
  description TEXT,

  stages TEXT NOT NULL,
  default_tasks TEXT,
  evidence_types TEXT,
  analysis_types TEXT,

  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_research_questions_investigation ON research_questions(investigation_packet_id);
CREATE INDEX IF NOT EXISTS idx_research_questions_context ON research_questions(research_context);

CREATE INDEX IF NOT EXISTS idx_research_evidence_question ON research_evidence(research_question_id);
CREATE INDEX IF NOT EXISTS idx_research_evidence_investigation ON research_evidence(investigation_packet_id);
CREATE INDEX IF NOT EXISTS idx_research_evidence_type ON research_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_research_evidence_date ON research_evidence(evidence_date);
CREATE INDEX IF NOT EXISTS idx_research_evidence_verification ON research_evidence(verification_status);

CREATE INDEX IF NOT EXISTS idx_research_analysis_question ON research_analysis(research_question_id);
CREATE INDEX IF NOT EXISTS idx_research_analysis_investigation ON research_analysis(investigation_packet_id);
CREATE INDEX IF NOT EXISTS idx_research_analysis_type ON research_analysis(analysis_type);

CREATE INDEX IF NOT EXISTS idx_research_tasks_question ON research_tasks(research_question_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_investigation ON research_tasks(investigation_packet_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
CREATE INDEX IF NOT EXISTS idx_research_tasks_assigned ON research_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_research_tasks_stage ON research_tasks(workflow_stage);

CREATE INDEX IF NOT EXISTS idx_research_activity_question ON research_activity(research_question_id);
CREATE INDEX IF NOT EXISTS idx_research_activity_investigation ON research_activity(investigation_packet_id);
CREATE INDEX IF NOT EXISTS idx_research_activity_timestamp ON research_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_research_activity_type ON research_activity(activity_type);

-- Insert default workflow templates
INSERT INTO workflow_templates (id, research_context, template_name, description, stages, default_tasks, evidence_types, analysis_types) VALUES
('wf_osint_001', 'osint', 'OSINT Investigation', 'Open source intelligence investigation workflow',
  '[{"id":"leads","name":"Leads","order":1},{"id":"verify","name":"Verify Sources","order":2},{"id":"map","name":"Map Relationships","order":3},{"id":"analyze","name":"Analyze","order":4},{"id":"report","name":"Report","order":5}]',
  '[{"stage":"leads","title":"Identify initial sources","priority":"high"},{"stage":"verify","title":"Verify source credibility","priority":"high"},{"stage":"map","title":"Map entity relationships","priority":"medium"},{"stage":"analyze","title":"Build timeline","priority":"medium"},{"stage":"report","title":"Document findings","priority":"high"}]',
  '["source","document","media","observation"]',
  '["timeline","network","hypothesis","synthesis"]'),

('wf_investigation_001', 'investigation', 'Case Investigation', 'Private investigation case management workflow',
  '[{"id":"intake","name":"Case Intake","order":1},{"id":"collect","name":"Evidence Collection","order":2},{"id":"analyze","name":"Analysis","order":3},{"id":"report","name":"Client Report","order":4},{"id":"close","name":"Case Closure","order":5}]',
  '[{"stage":"intake","title":"Client interview","priority":"urgent"},{"stage":"collect","title":"Gather evidence","priority":"high"},{"stage":"analyze","title":"Analyze evidence","priority":"medium"},{"stage":"report","title":"Prepare client report","priority":"high"},{"stage":"close","title":"Archive case files","priority":"low"}]',
  '["document","interview","media","observation"]',
  '["timeline","evidence_matrix","synthesis"]'),

('wf_business_001', 'business', 'Business Research Sprint', 'Market and competitive research workflow',
  '[{"id":"define","name":"Define Scope","order":1},{"id":"gather","name":"Data Gathering","order":2},{"id":"analyze","name":"Analysis","order":3},{"id":"recommend","name":"Recommendations","order":4},{"id":"present","name":"Presentation","order":5}]',
  '[{"stage":"define","title":"Define research questions","priority":"urgent"},{"stage":"gather","title":"Collect market data","priority":"high"},{"stage":"analyze","title":"SWOT analysis","priority":"medium"},{"stage":"recommend","title":"Formulate recommendations","priority":"high"},{"stage":"present","title":"Prepare executive summary","priority":"high"}]',
  '["data","document","interview"]',
  '["swot","competitive_analysis","synthesis"]'),

('wf_journalism_001', 'journalism', 'Story Investigation', 'Investigative journalism story pipeline',
  '[{"id":"tip","name":"Tip Intake","order":1},{"id":"verify","name":"Verification","order":2},{"id":"draft","name":"Draft Story","order":3},{"id":"review","name":"Editorial Review","order":4},{"id":"publish","name":"Publication","order":5}]',
  '[{"stage":"tip","title":"Document tip/lead","priority":"high"},{"stage":"verify","title":"Verify facts with sources","priority":"urgent"},{"stage":"draft","title":"Write initial draft","priority":"medium"},{"stage":"review","title":"Editorial review","priority":"high"},{"stage":"publish","title":"Prepare for publication","priority":"high"}]',
  '["source","document","interview","media"]',
  '["fact_matrix","timeline","synthesis"]'),

('wf_academic_001', 'academic', 'Academic Research', 'Academic research methodology workflow',
  '[{"id":"review","name":"Literature Review","order":1},{"id":"design","name":"Research Design","order":2},{"id":"collect","name":"Data Collection","order":3},{"id":"analyze","name":"Analysis","order":4},{"id":"write","name":"Write-up","order":5}]',
  '[{"stage":"review","title":"Systematic literature review","priority":"high"},{"stage":"design","title":"Finalize methodology","priority":"high"},{"stage":"collect","title":"Collect data","priority":"medium"},{"stage":"analyze","title":"Statistical analysis","priority":"medium"},{"stage":"write","title":"Write manuscript","priority":"high"}]',
  '["data","document","observation"]',
  '["literature_matrix","statistical_analysis","synthesis"]'),

('wf_personal_001', 'personal', 'Learning Journey', 'Personal research and learning workflow',
  '[{"id":"explore","name":"Explore","order":1},{"id":"learn","name":"Learn","order":2},{"id":"practice","name":"Practice","order":3},{"id":"share","name":"Share","order":4},{"id":"reflect","name":"Reflect","order":5}]',
  '[{"stage":"explore","title":"Find interesting resources","priority":"low"},{"stage":"learn","title":"Study core concepts","priority":"medium"},{"stage":"practice","title":"Apply knowledge","priority":"medium"},{"stage":"share","title":"Share findings","priority":"low"},{"stage":"reflect","title":"Document learnings","priority":"low"}]',
  '["source","document","observation","media"]',
  '["mindmap","timeline","synthesis"]');
