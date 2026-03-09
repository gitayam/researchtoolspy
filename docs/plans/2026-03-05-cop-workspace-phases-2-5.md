# COP Workspace Phases 2-5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the COP workspace transformation: collaboration, investigation merge, enhanced panels, and live monitoring.

**Prerequisites:** Phase 1 complete — CopWorkspacePage with 6 expandable panels deployed.

---

## Phase 2: Collaboration Foundation

### Task A: DB Migration — Collaborators + Activity Tables

Create `schema/migrations/060-cop-collaboration.sql`:

```sql
CREATE TABLE IF NOT EXISTS cop_collaborators (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  user_id INTEGER,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  invite_token TEXT UNIQUE,
  invited_by INTEGER,
  invited_at TEXT DEFAULT (datetime('now')),
  accepted_at TEXT,
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_collaborators_session ON cop_collaborators(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_user ON cop_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_cop_collaborators_token ON cop_collaborators(invite_token);

CREATE TABLE IF NOT EXISTS cop_activity (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_activity_session ON cop_activity(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_activity_time ON cop_activity(created_at);
```

### Task B: Collaborators API

Create `functions/api/cop/[id]/collaborators.ts`:
- GET: List collaborators for session
- POST: Invite collaborator (generates invite_token, returns invite link)
- DELETE: Remove collaborator

### Task C: Activity API

Create `functions/api/cop/[id]/activity.ts`:
- GET: List recent activity for session (paginated, default 50)
- POST: Log activity (called internally by other endpoints)

### Task D: CopInviteDialog Component

Create `src/components/cop/CopInviteDialog.tsx`:
- Dialog triggered by UserPlus button in workspace header
- Input for email/username
- Role selector (viewer/editor)
- Generate share link option
- List current collaborators with remove option

### Task E: CopActivityPanel Component

Create `src/components/cop/CopActivityPanel.tsx`:
- Chronological list of workspace activity
- Shows who did what and when
- Auto-refreshes every 30s
- Wire into CopWorkspacePage as a new expandable panel

---

## Phase 3: Investigation ↔ COP Merge

### Task F: API — Auto-Create COP from Investigation

Modify `functions/api/investigations/index.ts` POST handler:
- After creating investigation, auto-create a linked COP session
- Set `investigation_id` on the COP session
- Copy investigation title/description to COP name/description
- Set template_type based on investigation type:
  - structured_research → area_study
  - general_topic → custom
  - rapid_analysis → quick_brief

### Task G: API — Link Existing Investigations to COPs

Create `functions/api/cop/[id]/link-investigation.ts`:
- POST: Link an existing investigation to a COP session
- Updates cop_sessions.investigation_id

### Task H: Investigation Detail → COP Redirect

Modify `src/pages/InvestigationDetailPage.tsx`:
- On load, check if investigation has a linked COP
- If yes, redirect to `/dashboard/cop/{copId}`
- If no, show a "Create Workspace" button that creates one and redirects

### Task I: Dashboard Quick Actions Update

Modify `src/pages/DashboardPage.tsx`:
- Investigation cards link to `/dashboard/cop/{copId}` when COP exists
- Remove separate "Operating Picture" quick action (merged into investigations)
- "New Investigation" creates both investigation + COP

### Task J: Navigation Updates

Modify `src/components/layout/dashboard-sidebar.tsx`:
- Rename "Operating Pictures" to "Workspaces"
- Keep same route `/dashboard/cop`

---

## Phase 4: Enhanced Deep-Dives

### Task K: Evidence Linking in Feed

Modify `src/components/cop/CopEvidenceFeed.tsx`:
- Add button to link existing evidence to investigation
- Show entity tags extracted from evidence
- Filter by type (evidence/analysis/entity/framework)

### Task L: Gap Analysis Panel

Create `src/components/cop/CopGapAnalysis.tsx`:
- Identifies missing information based on framework coverage
- Shows unanswered key questions
- Suggests next analysis steps
- Wire into CopWorkspacePage as section within Questions panel expanded view

---

## Phase 5: Live Monitor Enhancements

### Task M: Polling-Based Live Feed

Modify `src/components/cop/CopEvidenceFeed.tsx`:
- Add 30-second polling when in monitor mode
- Show "new items" indicator when new data arrives
- Auto-scroll option

### Task N: Monitor Mode Layout Polish

Modify `src/pages/CopWorkspacePage.tsx`:
- Monitor mode: full-height feed with sidebar for questions
- Add notification badge on mode toggle when new activity in monitor mode
