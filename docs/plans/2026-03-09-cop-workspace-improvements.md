# COP Workspace Improvements — DEF CON Case Study

> **Context**: Live investigation of a Reddit → Telegram → OnlyFans persona farm. Session: `cop-b0f96023-cdf`

## Completed Features

| # | Feature | Status | Commit |
|---|---------|--------|--------|
| - | Entity Drawer (5 types, CRUD, relationships) | DONE | `7742b1fe3` |
| - | Entities Quick-Access Panel (counts, type cards) | DONE | `f6ca2aa35` |
| - | Hypotheses CRUD endpoint + migration 064 | DONE | `78872acf5` |
| - | Mission Brief persistence (migration 065) | DONE | `78872acf5` |
| - | COP-scoped evidence endpoint | DONE | `78872acf5` |
| - | Evidence-to-Hypothesis linking + confidence slider | DONE | `bc1461575` |
| - | Task Board (Kanban + API + migration 066) | DONE | `acfbecac1` |
| - | Geolocation Changelog (API + migration 067) | DONE | `acfbecac1` |
| - | Marker Confidence + Rationale | DONE | `acfbecac1` |
| - | Evidence thumbnails + domain badges | DONE | `0d12868dd` |
| - | Collaborator attribution (RFI requester_name) | DONE | `0d12868dd` |
| - | Activity log actor_name + details columns | DONE | migration 069 |
| - | Fix workspace_id in entity endpoints (403 bug) | DONE | `b216f9a5d` |
| - | Marker confidence upgrades (Bariloche CONFIRMED) | DONE | D1 direct |
| - | Marker PUT endpoint (update confidence/rationale) | DONE | pending commit |
| - | RFI PUT endpoint (update status/priority/answer) | DONE | pending commit |
| - | IKEA Argentina research + RFI answered | DONE | web research |
| - | Close 5 answered RFIs (bus, skyline, purse, bus co, IKEA) | DONE | D1 direct |
| - | HackYourMom.com research (Telegram bot army TTPs) | DONE | web research |
| - | Outlet type research (Argentina = Type I) | DONE | web research |
| - | Fix panels: hypotheses/RFIs always visible | DONE | `b00c1931b` |
| - | Fix RFI answer insert (answer_text column) | DONE | `b00c1931b` |
| - | Populate 10 Actors from personas + Unknown Operator | DONE | API calls |
| - | Create 14 relationships (9 CONTROLS, 1 ASSOCIATED, 4 LOCATED_AT) | DONE | API calls |
| - | Create 3 Places (Bariloche, Cerro Catedral, Buenos Aires) | DONE | API calls |
| - | Create 4 Sources (Instagram, Twitter, PimEyes, HackYourMom) | DONE | API calls |
| - | Add user 1 as ADMIN of workspace | DONE | D1 direct |

## Phase Status (from high-velocity-workflow plan)

| Phase | Feature | Status |
|-------|---------|--------|
| 1A | Quick Capture (Cmd+K + sticky bar) | DONE |
| 1B | Blocker Alert Strip | DONE |
| 2A | Persona Panel (CRUD + card grid) | DONE |
| 2B | Auto-Extract Pipeline (handle regex → toast) | DONE |
| 3A | Artifact Tagging (taxonomy + API + CopTagSelector) | DONE |
| 3B | Gallery View Toggle + Lightbox | DONE |
| 4A | Pin to Map (1-click from feed/hypothesis) | DONE |
| 4B | Auto-Geocoding Prompt (from analyze-url) | NOT STARTED |
| 4C | Map Marker Backlinks (popup → evidence card) | DONE |

## Wave 3 — Remaining Features

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 6 | Chat import / bulk ingest | Parse chat exports into evidence + personas | TODO |
| 7 | Persona-to-persona network view | Visual graph of persona aliases | TODO |
| 8 | Auto-geocode prompt (4B) | Show location prompt when analyze-url finds locations | TODO |
| 9 | Marker backlinks (4C) | Map popup shows linked evidence/hypothesis | DONE (2026-03-09) |
| 10 | Auto-clear blocker on answered RFIs | Auto `is_blocker=0` when status→answered/closed | DONE (2026-03-09) |
| 11 | Evidence feed header locator fix (E2E) | POM uses unique panel title text | DONE (2026-03-09) |
| 12 | Hypothesis count in stats + KPI strip | API returns hypothesis_count, status strip shows it | DONE (2026-03-09) |

## Investigation Data Status (2026-03-09 cycle 3)

| Data | Count | Notes |
|------|-------|-------|
| Entities | 46 | Was 14 — added 32 events from event_facts |
| Actors | 10 | 9 personas + 1 Unknown Operator (mirrored from personas) |
| Events | 32 | Migrated from session event_facts JSON array — was 0 |
| Relationships | 14 | 9 CONTROLS, 1 ASSOCIATED_WITH, 4 LOCATED_AT |
| Places | 3 | Bariloche CONFIRMED, Cerro Catedral CONFIRMED, Buenos Aires PROBABLE |
| Sources | 4 | Instagram @ufqsoo, Twitter @lanaraae, PimEyes, HackYourMom |
| Personas | 13 | +3 new (Lannah escort alias, @lanameys Telegram, sofiaisyours3 link) |
| RFIs | 10 | 7 answered, 3 open, 1 blocker (AI authenticity) |
| Hypotheses | 5 | Bariloche 85%, Multi-location 70%, Buenos Aires 60%, DACH 28%, E.Europe 15% |
| Evidence items | 1 | Capture bar fix deployed (F11) — first user-created evidence flowing |
| Tasks | 14 | 6 done, 4 in_progress, 4 todo |
| Map markers | 9 | 2 CONFIRMED (Bariloche, Cerro Catedral), 2 PROBABLE (BA, airport) |
| Activity entries | 31 | +4 research findings (coastal, Lannah, hackyourmom, outlet) |
| Mission brief | SET | "Geolocate and map the distributed persona farm..." |
| Blocker count | 1 | Down from 4 — auto-clear implemented for answered/closed RFIs |

## Key Breakthroughs This Session

1. **TIP Bus Identified** — Turismo Integral Patagonico bus at ski resort CONFIRMS Bariloche, NOT Chile
2. **Jackie Smith Confirmed** — Argentine leather brand on @ufqsoo bag strap, answers RFI
3. **PimEyes @lanaraae** — 20 matches, alias "Lannah" on escort sites across 8 countries (stolen images)
4. **Buenos Aires Skyline** — ChatGPT 5.4 geoguessed @lanaraae balcony as Buenos Aires
5. **Prompt Injection Confirmed** — Telegram bot responded to aardvark, proving AI operation
6. **Coastal Photos** — @ufqsoo on Argentine Atlantic coast with Mercosur license plate
7. **IKEA Not In Argentina** — No stores, pop-ups, or resellers. IKEA furniture = imported or photos taken elsewhere
8. **HackYourMom TTP Match** — Ukrainian cyber army documented identical bot pattern: AI comments in 60s, $0.05/account, stolen images, deception funnels
9. **Outlet Type I = Argentina** — National standard is Type I (3 flat V-pins). Type C in older buildings. Strong geolocation indicator

## Bug Fixes Applied

| Issue | Fix |
|-------|-----|
| Tasks not persisting from setup script | Migration 066 deploy timing — repopulated 12 tasks |
| Entity drawer trigger too hidden | Added prominent Entities panel + labeled button |
| Dark/light mode inconsistencies | Fixed missing `dark:` variants across 3 component files |
| Session metadata lost (0 event_facts) | Setup script missing X-Workspace-ID header — re-pushed with correct header |
| Activity entries missing names | Table lacked actor_name/details columns — migration 069 + repopulate |
| Entities panel 403 errors | Entity endpoints received COP session ID instead of workspace UUID — fixed workspace_id propagation |
| Workspace access denied (403) | Workspace `6fde45ce` had `is_public=0` and `owner_id=5` — set `is_public=1` for COP viewer access |
| Entity counts all 0 | Personas existed but not mirrored as Actors — populated 10 actors, 14 relationships, 3 places, 4 sources |
| "No location data" warning | Missing LOCATED_AT relationships between actors and places — created 4 |
| Evidence POST 500 (SQLITE_MISMATCH) | Removed TEXT id from INSERT, let AUTOINCREMENT handle it |
| Evidence POST 500 (NOT NULL credibility) | Added `credibility`/`reliability` columns to INSERT with defaults |

## Schema Changes

| Migration | Table | Change |
|-----------|-------|--------|
| 064 | cop_hypotheses, cop_hypothesis_evidence | NEW tables |
| 065 | cop_sessions | ADD mission_brief TEXT |
| 066 | cop_tasks | NEW table |
| 067 | cop_markers, cop_marker_changelog | ADD confidence/rationale, NEW changelog table |
| 068 | cop_rfis | ADD requester_name TEXT |
| 069 | cop_activity | ADD actor_name TEXT, ADD details TEXT |
