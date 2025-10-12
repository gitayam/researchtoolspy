# Investigation-Centric Dashboard Redesign

## Overview
Transform the dashboard from a collection of standalone tools into an investigation-centric platform where all research activities (evidence, frameworks, entities, research questions) are organized within investigations.

## Current State vs. Target State

### Current State (Tool-Centric)
- Dashboard shows quick links to frameworks and tools
- Evidence, actors, sources exist independently
- No clear relationship between research questions, evidence, and analysis
- Users jump between disconnected sections

### Target State (Investigation-Centric)
- Dashboard focuses on **starting and managing investigations**
- Each investigation can have:
  - Research question & research plan (optional)
  - Evidence collection
  - Entity tracking (actors, sources, events)
  - Framework analyses (ACH, PMESII-PT, etc.)
  - Network analysis
  - Reports
- Quick access to tools still available
- All work happens within investigation context

## Core Concepts

### Investigation Structure
```
Investigation
├── Metadata
│   ├── Title
│   ├── Description
│   ├── Status (Active, Archived, Completed)
│   ├── Created/Updated dates
│   └── Tags
├── Research Foundation (Optional)
│   ├── Research Question (imported or created)
│   └── Research Plan (methodology, timeline, etc.)
├── Evidence Collection
│   ├── Evidence items
│   ├── Claims
│   └── Sources
├── Entity Tracking
│   ├── Actors
│   ├── Events
│   └── Relationships
├── Framework Analyses
│   ├── ACH matrices
│   ├── PMESII-PT assessments
│   ├── DIME analyses
│   ├── Starbursting explorations
│   └── Other frameworks
├── Network Analysis
│   └── Entity relationship graphs
└── Outputs
    ├── Reports
    └── Exports
```

### Investigation Types
1. **Structured Research Investigation** - Has research question & plan
2. **General Topic Investigation** - Open-ended exploration
3. **Rapid Analysis** - Quick framework application

## Database Schema Changes

### New Tables

```sql
-- Core investigations table
CREATE TABLE investigations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'structured_research', 'general_topic', 'rapid_analysis'
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
  research_question_id TEXT, -- Foreign key to research_questions (optional)
  tags TEXT, -- JSON array
  metadata TEXT, -- JSON object for extensibility
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (research_question_id) REFERENCES research_questions(id)
);

-- Link evidence to investigations
CREATE TABLE investigation_evidence (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  evidence_id INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Link actors to investigations
CREATE TABLE investigation_actors (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  role TEXT, -- 'subject', 'witness', 'expert', etc.
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Link sources to investigations
CREATE TABLE investigation_sources (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Link events to investigations
CREATE TABLE investigation_events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Link framework analyses to investigations
CREATE TABLE investigation_frameworks (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  framework_type TEXT NOT NULL, -- 'ach', 'pmesii_pt', 'dime', etc.
  framework_id TEXT NOT NULL, -- ID in respective framework table
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER NOT NULL,
  title TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add investigation_id to existing tables
ALTER TABLE content_analysis ADD COLUMN investigation_id TEXT REFERENCES investigations(id);
ALTER TABLE ach_analyses ADD COLUMN investigation_id TEXT REFERENCES investigations(id);
ALTER TABLE pmesii_assessments ADD COLUMN investigation_id TEXT REFERENCES investigations(id);
ALTER TABLE dime_analyses ADD COLUMN investigation_id TEXT REFERENCES investigations(id);
-- ... and other framework tables
```

## Dashboard UX Redesign

### New Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│  Research Tools Dashboard                               │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [+ New Investigation]  [Import from Research Question]  │
│                                                           │
│  ┌─── Active Investigations ──────────────────────────┐ │
│  │                                                      │ │
│  │  📊 Social Media Impact Study        [Open]         │ │
│  │     Research Question | 12 Evidence | 5 Actors      │ │
│  │     Last updated: 2 hours ago                        │ │
│  │                                                      │ │
│  │  🔍 Climate Policy Analysis          [Open]         │ │
│  │     General Topic | 8 Evidence | ACH Matrix         │ │
│  │     Last updated: 1 day ago                          │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─── Quick Access ─────────────────────────────────────┐│
│  │  [Research Question Generator]  [Content Research]  ││
│  │  [Citations]  [ACH Matrix]  [Network Graph]         ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌─── Recent Activity ──────────────────────────────────┐│
│  │  • Evidence added to "Social Media Impact"           ││
│  │  • New actor identified in "Climate Policy"          ││
│  │  • ACH matrix completed for "Market Analysis"        ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Investigation Detail View

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Investigations                                │
│                                                           │
│  Social Media Impact Study                    [Settings] │
│  Investigating the effect of social media on mental...   │
│                                                           │
│  [Overview] [Evidence] [Entities] [Analysis] [Reports]   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Research Foundation                                      │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Research Question: "How does social media usage...  ││
│  │  [View Full Research Plan]                           ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  Evidence Collection                        [+ Add]      │
│  ┌──────────────────────────────────────────────────────┐│
│  │  12 Items | 8 Claims | 5 Verified                    ││
│  │  [View All Evidence]                                 ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  Entities                                   [+ Add]      │
│  ┌──────────────────────────────────────────────────────┐│
│  │  5 Actors | 8 Sources | 3 Events                     ││
│  │  [View Network Graph]                                ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  Framework Analyses                         [+ New]      │
│  ┌──────────────────────────────────────────────────────┐│
│  │  ACH Matrix - "Hypothesis Testing"                   ││
│  │  PMESII-PT Assessment - "Environmental Factors"      ││
│  │  [View All Analyses]                                 ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## User Workflows

### Workflow 1: Start Structured Research Investigation
1. User clicks "New Investigation"
2. Selects "Structured Research"
3. Either:
   - Creates new research question using generator
   - Imports existing research question
4. System creates investigation with research plan
5. User adds evidence, entities, frameworks as needed

### Workflow 2: General Topic Investigation
1. User clicks "New Investigation"
2. Selects "General Topic"
3. Enters topic and description
4. System creates investigation
5. User explores topic using various tools
6. Can upgrade to structured research later

### Workflow 3: Import from Research Question Generator
1. User generates research question & plan
2. Clicks "Create Investigation from This"
3. System creates investigation pre-populated with:
   - Research question
   - Research plan
   - Suggested frameworks (based on methodology)

## Implementation Phases

### Phase 1: Database Schema & Core Investigation Model (Week 1)
- [ ] Create migration scripts for new tables
- [ ] Add investigation_id to existing tables
- [ ] Create Investigation CRUD API endpoints
- [ ] Test migrations on dev environment

### Phase 2: Investigation Management UI (Week 2)
- [ ] Create InvestigationList component
- [ ] Create InvestigationDetail component
- [ ] Create NewInvestigation wizard
- [ ] Add investigation selector to existing pages

### Phase 3: Dashboard Redesign (Week 2-3)
- [ ] Redesign DashboardPage to show investigations
- [ ] Add "Active Investigations" section
- [ ] Keep "Quick Access" tools section
- [ ] Add recent activity feed

### Phase 4: Linking Existing Features (Week 3-4)
- [ ] Add investigation context to evidence pages
- [ ] Add investigation context to entity pages
- [ ] Add investigation context to framework pages
- [ ] Add investigation context to network graph

### Phase 5: Research Question Integration (Week 4)
- [ ] Add "Create Investigation" button to Research Question Generator
- [ ] Allow importing research questions into investigations
- [ ] Display research plan within investigation

### Phase 6: Polish & Migration (Week 5)
- [ ] Add bulk migration tool for existing data
- [ ] Create investigation templates
- [ ] Add investigation sharing/collaboration
- [ ] Testing and bug fixes

## API Endpoints Needed

### Investigation Management
- `POST /api/investigations` - Create new investigation
- `GET /api/investigations` - List user's investigations
- `GET /api/investigations/:id` - Get investigation details
- `PUT /api/investigations/:id` - Update investigation
- `DELETE /api/investigations/:id` - Delete investigation
- `POST /api/investigations/:id/archive` - Archive investigation

### Investigation Content
- `POST /api/investigations/:id/evidence` - Add evidence to investigation
- `POST /api/investigations/:id/actors` - Add actor to investigation
- `POST /api/investigations/:id/sources` - Add source to investigation
- `POST /api/investigations/:id/frameworks` - Link framework analysis
- `GET /api/investigations/:id/timeline` - Get investigation activity timeline

### Research Question Integration
- `POST /api/investigations/from-research-question` - Create from research question
- `POST /api/investigations/:id/research-question` - Add research question to existing

## Migration Strategy

### Backward Compatibility
- Keep existing standalone workflows available
- Add investigation context as optional
- Gradually encourage investigation-based workflows

### Data Migration
- Create migration script to:
  - Group related evidence/entities by time/tags
  - Suggest investigation groupings
  - Allow manual review and adjustment

## Benefits

### For Users
- **Organized Workflow** - All related work in one place
- **Context Preservation** - Clear why evidence/entities matter
- **Collaboration** - Share entire investigation, not scattered pieces
- **Progress Tracking** - See investigation status at a glance
- **Research Quality** - Structured research questions → better outcomes

### For Platform
- **Coherent UX** - Clear mental model
- **Better Analytics** - Track investigation lifecycle
- **Easier Onboarding** - "Start an investigation" is clear
- **Scalability** - Add new features to investigation context

## Success Metrics
- % of new work done within investigations
- Average evidence items per investigation
- Average frameworks used per investigation
- User satisfaction with organized workflow
- Time to complete investigations

## Open Questions
1. Should investigations be workspace-scoped or user-scoped?
   - **Recommendation**: Workspace-scoped for collaboration
2. Can evidence/entities belong to multiple investigations?
   - **Recommendation**: Yes, via linking tables (many-to-many)
3. Should we auto-create investigations from existing workflows?
   - **Recommendation**: Prompt user after 3+ evidence items added
4. How to handle investigation templates?
   - **Recommendation**: Phase 6 feature - predefined investigation structures

## Next Steps
1. Review and approve this design document
2. Create detailed wireframes for key screens
3. Create database migration scripts
4. Begin Phase 1 implementation
