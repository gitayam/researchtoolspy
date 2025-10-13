# Context-Adaptive Research Workflow Analysis

## Core Insight
Different research types have fundamentally different workflows, evidence standards, and collaboration patterns. Instead of forcing all research into a generic Kanban board, we should provide context-specific tools that match how researchers actually work.

## Research Type Analysis

### 🔍 OSINT (Open Source Intelligence)
**How They Work:**
- Start with a question or target
- Discover sources through pivoting
- Verify each source's credibility
- Map relationships between entities
- Build a timeline of events
- Document digital trails

**Key Workflow Needs:**
- Source verification checklist (CRAAP test, lateral reading)
- Entity relationship mapping
- Timeline reconstruction
- Digital evidence preservation (screenshots, archives)
- OPSEC tracking (what footprint did we leave?)
- Attribution methodology

**Critical Features:**
- Evidence locker with metadata (URL, archive link, timestamp, credibility score)
- Relationship graph (Person A → worked at → Company B)
- Timeline view (event sequencing)
- Source grading (verified, probable, unverified, disproven)

### 🕵️ Private Investigation
**How They Work:**
- Client intake and case definition
- Evidence collection with chain of custody
- Surveillance and field work
- Witness interviews
- Periodic client reporting
- Case closure with deliverables

**Key Workflow Needs:**
- Case file management
- Evidence chain of custody tracking
- Billable hours tracking
- Client communication log
- Legal compliance checklist
- Report generation

**Critical Features:**
- Evidence vault (photo, video, document with chain of custody)
- Activity log (who accessed what, when)
- Billing integration
- Report templates
- Legal review checkpoints

### 💼 Business Research
**How They Work:**
- Define business question
- Gather market/competitor data
- Analyze with frameworks (SWOT, Porter's 5 Forces)
- Stakeholder interviews
- Synthesize findings
- Present recommendations

**Key Workflow Needs:**
- Competitive intelligence tracking
- Market data collection
- Stakeholder mapping
- Analysis frameworks
- Executive summary generation
- ROI calculation

**Critical Features:**
- Competitor profiles
- Market data dashboard
- SWOT/Porter analysis tools
- Stakeholder matrix
- Presentation builder
- Recommendation tracker

### 📰 Investigative Journalism
**How They Work:**
- Tip/lead intake
- Source cultivation (anonymity critical)
- Document verification
- Multi-source corroboration
- Fact-checking
- Editorial/legal review
- Publication

**Key Workflow Needs:**
- Encrypted source communication
- Document verification workflow
- Multi-source fact-checking
- Editorial review process
- Legal review checkpoints
- Publication timeline

**Critical Features:**
- Encrypted note-taking
- Source protection (anonymized contacts)
- Document authenticity checks
- Fact vs. allegation tracker
- Editorial workflow (draft → review → publish)
- Retraction tracking

### 🎓 Academic Research
**How They Work:**
- Literature review
- Hypothesis formation
- IRB approval (if needed)
- Data collection
- Analysis
- Peer review
- Publication

**Key Workflow Needs:**
- Literature review tracking
- IRB compliance tracking
- Data collection logs
- Methodology documentation
- Peer review preparation
- Citation management

**Critical Features:**
- Literature database
- IRB checklist and timeline
- Data collection templates
- Analysis notebook
- Citation manager
- Peer review tracker

### 🌱 Personal/Hobby Research
**How They Work:**
- Curiosity-driven exploration
- Learning as you go
- Share with community
- No strict deadlines
- Iterative refinement

**Key Workflow Needs:**
- Flexible note-taking
- Learning milestones
- Resource bookmarks
- Community sharing
- Progress visualization

**Critical Features:**
- Personal wiki
- Learning journal
- Resource library
- Community integration
- Progress gamification

---

## Unified Architecture

### Core Components (All Research Types)

1. **Research Question Hub**
   - Central research question
   - Sub-questions
   - Hypotheses
   - Status tracking

2. **Evidence/Data Collection**
   - Context-specific templates
   - Metadata tracking
   - Version control
   - Search and filter

3. **Analysis Workspace**
   - Context-specific tools
   - Structured Analytic Techniques (SATs)
   - Visualization tools
   - Synthesis notes

4. **Collaboration**
   - Team communication
   - Task assignments
   - Review workflows
   - Access control

5. **Output Generation**
   - Context-specific templates
   - Export formats
   - Version tracking
   - Distribution

### Context-Specific Extensions

Each research type gets:
- Custom evidence/data schemas
- Specialized workflow stages
- Appropriate analysis tools
- Relevant output templates

---

## Implementation Strategy

### Phase 2A: Evidence Collection System
**Universal Base:**
- Evidence entry form
- Metadata fields
- Tags and categorization
- Search and filter
- Evidence timeline

**Context-Specific:**
- OSINT: Source credibility scoring, OPSEC tracker
- Investigation: Chain of custody, legal admissibility
- Business: Competitive intel tagging, market data validation
- Journalism: Source protection, fact-check status
- Academic: Citation tracking, IRB compliance
- Personal: Learning notes, skill development

### Phase 2B: Workflow Templates
**Instead of generic Kanban, provide:**
- OSINT: Investigation Board (Leads → Verify → Map → Analyze → Report)
- Investigation: Case Tracker (Intake → Collect → Analyze → Report → Close)
- Business: Research Sprint (Define → Gather → Analyze → Recommend → Present)
- Journalism: Story Pipeline (Tip → Verify → Draft → Review → Publish)
- Academic: Research Phases (Review → Design → Collect → Analyze → Write)
- Personal: Learning Path (Explore → Learn → Practice → Share → Reflect)

### Phase 2C: Analysis Tools
**Structured Analytic Techniques (SATs):**
- All: Timeline analysis, Link analysis, SWOT
- OSINT: Chronology, Geospatial mapping, Network analysis
- Investigation: Evidence matrix, Alibi checking
- Business: Porter's 5 Forces, Value chain analysis
- Journalism: Source triangulation, Fact matrix
- Academic: Literature matrix, Concept mapping
- Personal: Mind mapping, Reflection journal

### Phase 2D: Collaboration Patterns
**Team Structures:**
- Solo: Personal workspace, external sharing
- Small team: Shared workspace, real-time collaboration
- Large team: Role-based access, approval workflows
- Open research: Public collaboration, community contributions

**Communication:**
- OSINT: Secure chat, encrypted notes
- Investigation: Client portal, evidence sharing
- Business: Stakeholder updates, executive briefings
- Journalism: Editorial discussions, fact-checking threads
- Academic: Peer review, advisor feedback
- Personal: Community forums, mentor connections

---

## Database Schema

### Core Tables

```sql
-- Research Projects (already exists in research_questions table)

-- Evidence/Data Collection
CREATE TABLE evidence_items (
  id INTEGER PRIMARY KEY,
  research_question_id INTEGER,
  evidence_type TEXT, -- 'source', 'document', 'interview', 'observation', 'data'
  title TEXT,
  content TEXT,
  metadata JSON, -- context-specific fields
  credibility_score REAL, -- 0-1 for OSINT/journalism
  chain_of_custody JSON, -- for investigations
  tags JSON,
  created_at TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY(research_question_id) REFERENCES research_questions(id)
);

-- Analysis Workspace
CREATE TABLE analysis_notes (
  id INTEGER PRIMARY KEY,
  research_question_id INTEGER,
  analysis_type TEXT, -- 'timeline', 'swot', 'network', 'hypothesis'
  title TEXT,
  content TEXT,
  data JSON, -- structured data for visualizations
  linked_evidence JSON, -- array of evidence_item IDs
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY(research_question_id) REFERENCES research_questions(id)
);

-- Workflow Tasks
CREATE TABLE research_tasks (
  id INTEGER PRIMARY KEY,
  research_question_id INTEGER,
  workflow_stage TEXT, -- context-specific stage
  task_title TEXT,
  task_description TEXT,
  assigned_to TEXT,
  status TEXT, -- 'pending', 'in_progress', 'review', 'completed'
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  dependencies JSON, -- array of task IDs
  FOREIGN KEY(research_question_id) REFERENCES research_questions(id)
);

-- Collaboration
CREATE TABLE research_activity (
  id INTEGER PRIMARY KEY,
  research_question_id INTEGER,
  activity_type TEXT, -- 'comment', 'status_change', 'evidence_added', 'task_completed'
  actor TEXT,
  target_id INTEGER, -- ID of evidence, task, etc.
  content TEXT,
  timestamp TIMESTAMP,
  FOREIGN KEY(research_question_id) REFERENCES research_questions(id)
);
```

---

## UI Components Architecture

### 1. Research Dashboard (Context-Aware)
```
┌─────────────────────────────────────────┐
│ 🔍 OSINT Investigation: Dark Web Markets│
├─────────────────────────────────────────┤
│ Progress: Verify Sources (42%)          │
│                                         │
│ ┌─────┬─────┬─────┬─────┬─────┐        │
│ │Leads│Verify│Map │Anlyz│Reprt│        │
│ │  12 │   8  │  5 │  2  │  0  │        │
│ └─────┴─────┴─────┴─────┴─────┘        │
│                                         │
│ Recent Evidence: 3 new sources verified │
│ OPSEC Status: ✓ No footprint detected  │
└─────────────────────────────────────────┘
```

### 2. Evidence Collection (Context-Specific Forms)
**OSINT Source Entry:**
- URL/Reference
- Archive Link (Wayback, Archive.is)
- Credibility Assessment (CRAAP)
- OPSEC Notes
- Related Entities

**Investigation Evidence:**
- Evidence Type (photo, document, testimony)
- Collection Date/Time
- Chain of Custody
- Legal Admissibility Notes
- Storage Location

### 3. Analysis Tools (SAT Integration)
- Timeline Builder (all contexts)
- Relationship Mapper (OSINT, Investigation)
- SWOT Matrix (Business, Academic)
- Fact-Check Matrix (Journalism)
- Literature Matrix (Academic)

### 4. Collaboration Hub
- Team Chat (context-aware permissions)
- Task Board (context-specific workflows)
- Review Queue (context-specific approval flows)
- Activity Feed

---

## Implementation Priority

### NOW (Phase 2A):
1. Evidence collection system with context-specific schemas
2. Basic workflow stages (context-adaptive)
3. Simple task management
4. Activity feed

### NEXT (Phase 2B):
1. Analysis tools (Timeline, Link analysis, SWOT)
2. Enhanced collaboration (real-time, roles)
3. Template library for each context

### FUTURE (Phase 2C):
1. Advanced SATs (all 50+ techniques)
2. AI-assisted analysis
3. Export/publication tools
4. Public research sharing

---

## Key Design Principles

1. **Context First**: Show relevant tools based on research type
2. **Progressive Disclosure**: Start simple, reveal complexity as needed
3. **Interoperability**: Evidence can feed into multiple analyses
4. **Collaboration-Ready**: Built for teams from the start
5. **Privacy-Aware**: Encryption options for sensitive research
6. **Export-Friendly**: Data portability to other tools
