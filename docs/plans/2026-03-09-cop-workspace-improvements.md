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

## Wave 3 — Remaining Features

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 6 | Chat import / bulk ingest | Parse chat exports into evidence + personas | TODO |
| 7 | Persona-to-persona network view | Visual graph of persona aliases | TODO |

## Investigation Data Status

| Data | Count | Notes |
|------|-------|-------|
| Personas | 13 | +3 new (Lannah escort alias, @lanameys Telegram, sofiaisyours3 link) |
| RFIs | 10 | 5 answered (bus, skyline, purse, bus co, IKEA), 5 open |
| Hypotheses | 5 | Bariloche 85%, Multi-location 70%, Buenos Aires 60%, DACH 20%, E.Europe 15% |
| Evidence links | 16 | Supporting + contradicting evidence linked to all 5 hypotheses |
| Tasks | 14 | 4 done, 2 in_progress, 8 todo |
| Map markers | 9 | 2 CONFIRMED (Bariloche, Cerro Catedral), 2 PROBABLE (BA, airport) |
| Activity entries | 27 | All with actor names and details |
| Event facts | 29 | +1 IKEA Argentina (no stores/resellers) |

## Key Breakthroughs This Session

1. **TIP Bus Identified** — Turismo Integral Patagonico bus at ski resort CONFIRMS Bariloche, NOT Chile
2. **Jackie Smith Confirmed** — Argentine leather brand on @ufqsoo bag strap, answers RFI
3. **PimEyes @lanaraae** — 20 matches, alias "Lannah" on escort sites across 8 countries (stolen images)
4. **Buenos Aires Skyline** — ChatGPT 5.4 geoguessed @lanaraae balcony as Buenos Aires
5. **Prompt Injection Confirmed** — Telegram bot responded to aardvark, proving AI operation
6. **Coastal Photos** — @ufqsoo on Argentine Atlantic coast with Mercosur license plate
7. **IKEA Not In Argentina** — No stores, pop-ups, or resellers. IKEA furniture = imported or photos taken elsewhere

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

## Schema Changes

| Migration | Table | Change |
|-----------|-------|--------|
| 064 | cop_hypotheses, cop_hypothesis_evidence | NEW tables |
| 065 | cop_sessions | ADD mission_brief TEXT |
| 066 | cop_tasks | NEW table |
| 067 | cop_markers, cop_marker_changelog | ADD confidence/rationale, NEW changelog table |
| 068 | cop_rfis | ADD requester_name TEXT |
| 069 | cop_activity | ADD actor_name TEXT, ADD details TEXT |
