# COP Event Analysis Mode — Design

**Date:** 2026-03-05
**Status:** Approved

## Summary

Extend the COP (Common Operating Picture) system with an `event_analysis` template type that transforms the COP from a map-only view into an event-driven analytical workspace. An event (mass shooting, election, natural disaster, etc.) becomes the hub that ties together content intelligence, entity extraction, claims, starbursting questions, RFIs, and the geospatial map — all within the existing COP layout.

## Architecture Decision

**Approach:** New COP template type (not a new Investigation type or standalone concept)

- `event_analysis` joins existing templates: `quick_brief`, `event_monitor`, `area_study`, `crisis_response`, `custom`
- The COP sidebar transforms from a single layer panel into a tabbed interface
- Non-event-analysis templates are unaffected (no tabs, just layers)

## 1. Wizard Extension

When user selects "Event Analysis" template, a new **Step 0.5** appears between Purpose and Location:

### Event Details Step
- **Event Type** dropdown: Natural Disaster, Mass Casualty, Election/Political, Protest/Civil Unrest, Military/Conflict, Sports Event, Cyber Incident, Public Health, Other (free text)
- **Event Description** textarea (2-3 sentences)
- **Initial URLs** (optional, multi-line, up to 5)

### On Session Creation
- Session saved with `template_type: 'event_analysis'`
- New fields: `event_type`, `event_description` stored in session
- If URLs provided, queued for content intelligence processing (async)
- Starbursting framework session auto-created and linked via `linked_frameworks`
- Default layers: all entity layers + ACLED + GDELT + cop-markers

## 2. Tabbed Sidebar

When `template_type === 'event_analysis'`, the sidebar (widened to `w-72` / 288px) shows icon tabs:

| Tab | Icon | Purpose |
|-----|------|---------|
| Event | ClipboardList | Event type, description, key facts timeline, claims count, entities count |
| Intel | Link | Drop URLs, processing status, extracted entities/claims per URL, promote to COP |
| RFI | HelpCircle | Threaded Q&A board, create/answer/accept RFIs |
| Questions | Star | Linked starbursting session, 5W1H completion %, expand categories |
| Layers | Layers | Existing layer panel, unchanged |

For non-event-analysis templates: no tabs, just layers (current behavior preserved).

## 3. Event Tab

Displays:
- Event type badge (color-coded by category)
- Event description
- Key Facts timeline (manually added timestamped entries)
- Claims count with link to claims list
- Entities count with "View network" button (opens NetworkGraph as modal overlay)

Key facts stored as JSON in session: `[{time: string, text: string, source_url?: string}]`

## 4. Intel Tab (Content Intelligence)

- URL input field + "Analyze" button
- Calls existing `/api/content-intelligence/analyze-url` endpoint
- Shows list of analyzed content with per-URL stats (entity count, claims count)
- "Promote" button to create extracted entities in the entities table (appear on map)
- Claims auto-linked to session
- Processing status indicator per URL

Content analysis IDs stored in session field `content_analyses` (JSON array).

## 5. RFI Tab (NEW backend required)

### `cop_rfis` table

```sql
CREATE TABLE cop_rfis (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id),
  question TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  created_by INTEGER NOT NULL DEFAULT 1,
  assigned_to INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cop_rfis_session ON cop_rfis(cop_session_id);
CREATE INDEX idx_cop_rfis_status ON cop_rfis(status);
```

### `cop_rfi_answers` table

```sql
CREATE TABLE cop_rfi_answers (
  id TEXT PRIMARY KEY,
  rfi_id TEXT NOT NULL REFERENCES cop_rfis(id),
  answer_text TEXT NOT NULL,
  source_url TEXT,
  source_description TEXT,
  is_accepted INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL DEFAULT 1,
  responder_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cop_rfi_answers_rfi ON cop_rfi_answers(rfi_id);
```

### RFI Statuses
- `open` — question posted, no answers yet
- `answered` — has at least one answer
- `accepted` — analyst accepted an answer
- `closed` — no longer relevant

### RFI Priorities
- `critical`, `high`, `medium`, `low`

### UI
- Threaded Q&A: question at top, answers nested below
- Each answer shows: text, source link, author, timestamp, accept button
- Analyst can accept one answer per RFI (marks status as `accepted`)
- Badge count of open RFIs on tab icon

## 6. Questions Tab (Starbursting Integration)

- On session creation, auto-create a starbursting framework session linked to the COP
- Questions tab shows 5W1H categories (Who, What, When, Where, Why, How)
- Each category shows completion percentage
- Click category to expand and see individual questions
- Unanswered high-priority questions highlighted
- "Open full starbursting view" link to framework page

## 7. Configurable Sharing

### `cop_shares` table

```sql
CREATE TABLE cop_shares (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id),
  share_token TEXT NOT NULL UNIQUE,
  visible_panels TEXT NOT NULL DEFAULT '["map","event"]',
  allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  view_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_cop_shares_token ON cop_shares(share_token);
```

### Share Dialog
When analyst clicks "Share", a dialog appears with checkboxes:
- [x] Map + Layers (always on)
- [x] Event Briefing
- [ ] Claims
- [x] RFI Portal (allow answers toggle)
- [ ] Starbursting Questions
- [ ] Network Graph

Generates a link: `/public/cop/:token`

### Public View
- Read-only COP with only the panels specified in `visible_panels`
- If `allow_rfi_answers` is true, anonymous viewers can submit answers (with name input)
- Auto-refreshes on interval
- View count tracked

**Public route:** `/public/cop/:token` — new page component

## 8. Schema Changes to `cop_sessions`

Add columns via migration:

```sql
ALTER TABLE cop_sessions ADD COLUMN event_type TEXT;
ALTER TABLE cop_sessions ADD COLUMN event_description TEXT;
ALTER TABLE cop_sessions ADD COLUMN event_facts TEXT DEFAULT '[]';
ALTER TABLE cop_sessions ADD COLUMN content_analyses TEXT DEFAULT '[]';
```

## 9. API Endpoints (New)

### RFI Endpoints
- `GET /api/cop/:id/rfis` — list RFIs for session
- `POST /api/cop/:id/rfis` — create RFI
- `PUT /api/cop/:id/rfis/:rfiId` — update RFI (status, priority)
- `POST /api/cop/:id/rfis/:rfiId/answers` — submit answer
- `PUT /api/cop/:id/rfis/:rfiId/answers/:answerId` — accept/reject answer

### Share Endpoints
- `POST /api/cop/:id/shares` — create share link
- `GET /api/cop/public/:token` — get shared session data (filtered by visible_panels)
- `POST /api/cop/public/:token/rfis/:rfiId/answers` — submit answer on shared view

### Session Updates
- `PUT /api/cop/sessions/:id` — extended to handle event_facts, content_analyses

## 10. Event Types & Layer Mapping

| Event Type | Recommended Layers | GDELT Query |
|-----------|-------------------|-------------|
| Natural Disaster | places, events, acled, gdelt, cop-markers | "earthquake OR flood OR hurricane OR disaster" |
| Mass Casualty | places, events, actors, acled, gdelt, cop-markers | "shooting OR attack OR casualties" |
| Election/Political | places, actors, events, gdelt, cop-markers | "election OR vote OR political" |
| Protest/Civil Unrest | places, events, actors, acled, gdelt, cop-markers | "protest OR demonstration OR riot" |
| Military/Conflict | places, events, actors, relationships, acled, gdelt, cop-markers | "military OR conflict OR troops" |
| Sports Event | places, actors, events, cop-markers | event-specific |
| Cyber Incident | actors, events, cop-markers | "cyber OR hack OR breach" |
| Public Health | places, events, gdelt, cop-markers | "outbreak OR pandemic OR health" |

## 11. Component Breakdown

### New Components
- `CopEventSidebar.tsx` — tabbed sidebar container (replaces CopLayerPanel when event_analysis)
- `CopEventTab.tsx` — event details, facts timeline, summary counts
- `CopIntelTab.tsx` — URL input, content analysis list, entity promotion
- `CopRfiTab.tsx` — RFI list, create form, answer threads
- `CopQuestionsTab.tsx` — starbursting integration, 5W1H view
- `CopShareDialog.tsx` — configurable share panel with checkboxes
- `PublicCopPage.tsx` — public read-only COP view

### Modified Components
- `CopWizard.tsx` — add Event Details step for event_analysis template
- `CopPage.tsx` — conditional sidebar rendering based on template type
- `CopLayerPanel.tsx` — unchanged, used as tab content

### Modified Types
- `src/types/cop.ts` — add event_analysis to CopTemplateType, add event fields to CopSession
