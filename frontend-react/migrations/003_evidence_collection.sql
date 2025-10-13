-- Evidence Collection System Migration
-- Phase 2A: Context-Adaptive Research Workflows
-- Integrates with existing investigation_packets system

-- Research Questions table (new - for Research Question Generator)
CREATE TABLE IF NOT EXISTS research_questions (
  id TEXT PRIMARY KEY,
  investigation_packet_id TEXT, -- link to investigation if part of one
  workspace_id TEXT DEFAULT '1',
  user_id TEXT NOT NULL,

  -- Research question details
  question TEXT NOT NULL,
  research_context TEXT, -- 'academic', 'osint', 'investigation', 'business', 'journalism', 'personal'
  project_type TEXT,

  -- Team structure
  team_size TEXT DEFAULT 'solo', -- 'solo', 'small-team', 'large-team'
  team_roles TEXT, -- JSON array

  -- 5 W's framework
  five_ws TEXT, -- JSON: {who, what, where, when, why}

  -- Resources and constraints
  duration TEXT,
  resources TEXT, -- JSON array
  experience_level TEXT,
  constraints TEXT,
  ethical_considerations TEXT,

  -- Generated outputs (stored for reference)
  generated_questions TEXT, -- JSON array of AI-generated questions
  selected_question_index INTEGER,
  generated_plan TEXT, -- JSON: complete research plan
  custom_edits TEXT, -- JSON: any manual modifications

  -- Status tracking
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'completed', 'archived'

  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Evidence Items (enhanced version - works with both research_questions and investigation_packets)
CREATE TABLE IF NOT EXISTS research_evidence (
  id TEXT PRIMARY KEY,
  research_question_id TEXT, -- can be null if only linked to investigation
  investigation_packet_id TEXT, -- can be null if only linked to research question
  workspace_id TEXT DEFAULT '1',

  -- Core fields
  evidence_type TEXT NOT NULL, -- 'source', 'document', 'interview', 'observation', 'data', 'media'
  title TEXT NOT NULL,
  content TEXT,

  -- Context-specific metadata (JSON for flexibility)
  metadata TEXT, -- {url, archive_link, location, date, etc.}

  -- Quality/Credibility (OSINT, Journalism)
  credibility_score REAL DEFAULT NULL, -- 0.0 to 1.0
  verification_status TEXT DEFAULT 'unverified', -- 'verified', 'probable', 'unverified', 'disproven'

  -- Chain of custody (Private Investigation)
  chain_of_custody TEXT, -- JSON: [{actor, action, timestamp, notes}]

  -- Organization
  tags TEXT, -- JSON array: ['osint', 'financial', 'russia', etc.]
  category TEXT, -- context-specific categorization

  -- Relationships
  linked_evidence TEXT, -- JSON: [evidence_id1, evidence_id2]
  entities TEXT, -- JSON: [{type: 'person', name: 'John Doe', id: 123}]

  -- Timestamps
  evidence_date TEXT, -- when the evidence was created/occurred
  collected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  collected_by TEXT,

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Analysis Notes (Timeline, SWOT, Network Analysis, etc.)
CREATE TABLE IF NOT EXISTS research_analysis (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  -- Analysis type
  analysis_type TEXT NOT NULL, -- 'timeline', 'swot', 'network', 'hypothesis', 'synthesis', 'fact_matrix'
  title TEXT NOT NULL,
  content TEXT,

  -- Structured data for visualizations
  structured_data TEXT, -- JSON: type-specific data structure

  -- Links to evidence
  linked_evidence TEXT, -- JSON: [evidence_id1, evidence_id2]

  -- Collaboration
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Research Tasks (Context-Adaptive Workflows)
CREATE TABLE IF NOT EXISTS research_tasks (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  -- Task details
  workflow_stage TEXT NOT NULL, -- context-specific stage (e.g., 'verify' for OSINT)
  task_title TEXT NOT NULL,
  task_description TEXT,

  -- Assignment and status
  assigned_to TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'review', 'completed', 'blocked'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'

  -- Timing
  due_date TEXT,
  completed_at TEXT,
  estimated_hours REAL,
  actual_hours REAL,

  -- Dependencies
  depends_on TEXT, -- JSON: [task_id1, task_id2]
  blocks TEXT, -- JSON: [task_id1, task_id2]

  -- Links to evidence/analysis
  related_evidence TEXT, -- JSON
  related_analysis TEXT, -- JSON

  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Activity Feed (Collaboration and History)
CREATE TABLE IF NOT EXISTS research_activity (
  id TEXT PRIMARY KEY,
  research_question_id TEXT,
  investigation_packet_id TEXT,
  workspace_id TEXT DEFAULT '1',

  -- Activity details
  activity_type TEXT NOT NULL, -- 'comment', 'status_change', 'evidence_added', 'task_completed', etc.
  actor TEXT NOT NULL,

  -- Target
  target_type TEXT, -- 'evidence', 'task', 'analysis', 'research_question'
  target_id TEXT,

  -- Content
  content TEXT,
  metadata TEXT, -- JSON: additional context-specific data

  -- Timestamp
  timestamp TEXT DEFAULT (datetime('now')),

  FOREIGN KEY(research_question_id) REFERENCES research_questions(id) ON DELETE CASCADE,
  FOREIGN KEY(investigation_packet_id) REFERENCES investigation_packets(id) ON DELETE CASCADE
);

-- Workflow Templates (Context-Specific)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  research_context TEXT NOT NULL, -- 'osint', 'investigation', 'business', etc.
  template_name TEXT NOT NULL,
  description TEXT,

  -- Workflow stages
  stages TEXT NOT NULL, -- JSON: [{id: 'leads', name: 'Leads', order: 1}, ...]

  -- Default tasks for each stage
  default_tasks TEXT, -- JSON: [{stage: 'leads', title: 'Identify sources', ...}]

  -- Evidence types for this workflow
  evidence_types TEXT, -- JSON: ['source', 'document', 'interview']

  -- Analysis types for this workflow
  analysis_types TEXT, -- JSON: ['timeline', 'network', 'swot']

  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_questions_investigation ON research_questions(investigation_packet_id);
CREATE INDEX IF NOT EXISTS idx_research_questions_workspace ON research_questions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_research_questions_user ON research_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_research_questions_status ON research_questions(status);

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
-- OSINT Workflow
('wf_osint_001', 'osint', 'OSINT Investigation', 'Open source intelligence investigation workflow',
  '[{"id":"leads","name":"Leads","order":1},{"id":"verify","name":"Verify Sources","order":2},{"id":"map","name":"Map Relationships","order":3},{"id":"analyze","name":"Analyze","order":4},{"id":"report","name":"Report","order":5}]',
  '[{"stage":"leads","title":"Identify initial sources","priority":"high"},{"stage":"verify","title":"Verify source credibility","priority":"high"},{"stage":"map","title":"Map entity relationships","priority":"medium"},{"stage":"analyze","title":"Build timeline","priority":"medium"},{"stage":"report","title":"Document findings","priority":"high"}]',
  '["source","document","media","observation"]',
  '["timeline","network","hypothesis","synthesis"]'),

-- Private Investigation
('wf_investigation_001', 'investigation', 'Case Investigation', 'Private investigation case management workflow',
  '[{"id":"intake","name":"Case Intake","order":1},{"id":"collect","name":"Evidence Collection","order":2},{"id":"analyze","name":"Analysis","order":3},{"id":"report","name":"Client Report","order":4},{"id":"close","name":"Case Closure","order":5}]',
  '[{"stage":"intake","title":"Client interview","priority":"urgent"},{"stage":"collect","title":"Gather evidence","priority":"high"},{"stage":"analyze","title":"Analyze evidence","priority":"medium"},{"stage":"report","title":"Prepare client report","priority":"high"},{"stage":"close","title":"Archive case files","priority":"low"}]',
  '["document","interview","media","observation"]',
  '["timeline","evidence_matrix","synthesis"]'),

-- Business Research
('wf_business_001', 'business', 'Business Research Sprint', 'Market and competitive research workflow',
  '[{"id":"define","name":"Define Scope","order":1},{"id":"gather","name":"Data Gathering","order":2},{"id":"analyze","name":"Analysis","order":3},{"id":"recommend","name":"Recommendations","order":4},{"id":"present","name":"Presentation","order":5}]',
  '[{"stage":"define","title":"Define research questions","priority":"urgent"},{"stage":"gather","title":"Collect market data","priority":"high"},{"stage":"analyze","title":"SWOT analysis","priority":"medium"},{"stage":"recommend","title":"Formulate recommendations","priority":"high"},{"stage":"present","title":"Prepare executive summary","priority":"high"}]',
  '["data","document","interview"]',
  '["swot","competitive_analysis","synthesis"]'),

-- Investigative Journalism
('wf_journalism_001', 'journalism', 'Story Investigation', 'Investigative journalism story pipeline',
  '[{"id":"tip","name":"Tip Intake","order":1},{"id":"verify","name":"Verification","order":2},{"id":"draft","name":"Draft Story","order":3},{"id":"review","name":"Editorial Review","order":4},{"id":"publish","name":"Publication","order":5}]',
  '[{"stage":"tip","title":"Document tip/lead","priority":"high"},{"stage":"verify","title":"Verify facts with sources","priority":"urgent"},{"stage":"draft","title":"Write initial draft","priority":"medium"},{"stage":"review","title":"Editorial review","priority":"high"},{"stage":"publish","title":"Prepare for publication","priority":"high"}]',
  '["source","document","interview","media"]',
  '["fact_matrix","timeline","synthesis"]'),

-- Academic Research
('wf_academic_001', 'academic', 'Academic Research', 'Academic research methodology workflow',
  '[{"id":"review","name":"Literature Review","order":1},{"id":"design","name":"Research Design","order":2},{"id":"collect","name":"Data Collection","order":3},{"id":"analyze","name":"Analysis","order":4},{"id":"write","name":"Write-up","order":5}]',
  '[{"stage":"review","title":"Systematic literature review","priority":"high"},{"stage":"design","title":"Finalize methodology","priority":"high"},{"stage":"collect","title":"Collect data","priority":"medium"},{"stage":"analyze","title":"Statistical analysis","priority":"medium"},{"stage":"write","title":"Write manuscript","priority":"high"}]',
  '["data","document","observation"]',
  '["literature_matrix","statistical_analysis","synthesis"]'),

-- Personal/Hobby
('wf_personal_001', 'personal', 'Learning Journey', 'Personal research and learning workflow',
  '[{"id":"explore","name":"Explore","order":1},{"id":"learn","name":"Learn","order":2},{"id":"practice","name":"Practice","order":3},{"id":"share","name":"Share","order":4},{"id":"reflect","name":"Reflect","order":5}]',
  '[{"stage":"explore","title":"Find interesting resources","priority":"low"},{"stage":"learn","title":"Study core concepts","priority":"medium"},{"stage":"practice","title":"Apply knowledge","priority":"medium"},{"stage":"share","title":"Share findings","priority":"low"},{"stage":"reflect","title":"Document learnings","priority":"low"}]',
  '["source","document","observation","media"]',
  '["mindmap","timeline","synthesis"]');
