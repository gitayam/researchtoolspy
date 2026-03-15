# ResearchTools.net - Claude Code Integration Guide

## Quick Start

```bash
source scripts/cop-api.sh   # loads 50+ functions, reads .env automatically
cop_help                     # full function reference with types
```

## Shell Functions (scripts/cop-api.sh)

All functions read auth from `.env` (`RESEARCHTOOLS_USER_HASH`). Pass session ID as first arg.

### Sessions
```bash
cop_sessions                                    # list all
cop_session cop-xxx                             # get one
cop_create_session "Name" "desc" "custom"       # create
cop_update_session cop-xxx '{"field":"value"}'  # update (raw JSON)
cop_set_brief cop-xxx "mission brief text"      # set mission brief
cop_set_questions cop-xxx "Q1?" "Q2?"           # set key questions
cop_set_facts cop-xxx "fact1" "fact2"           # set event facts
cop_link_frameworks cop-xxx starbursting mom-pop
cop_delete_session cop-xxx                      # archive
```

### RFIs
```bash
cop_rfis cop-xxx                                # list
cop_add_rfi cop-xxx "question" critical true    # priority + blocker
cop_answer_rfi cop-xxx rfi-yyy "answer text" "source description"
cop_update_rfi cop-xxx rfi-yyy '{"priority":"high","assigned_to":"Alice"}'
cop_close_rfi cop-xxx rfi-yyy
```

### Entities (need workspace_id — auto-resolved from session)
```bash
cop_entities cop-xxx actors                     # list actors|events|sources|places|behaviors
cop_add_actor cop-xxx "Name" PERSON "desc"      # PERSON|ORGANIZATION|UNIT|GOVERNMENT (uppercase!)
cop_add_event cop-xxx "Name" INCIDENT "desc" "2026-03-14"
cop_add_source cop-xxx "Name" OSINT "desc"      # HUMINT|SIGINT|IMINT|OSINT|TECHINT|MASINT
cop_add_place cop-xxx "Name" CITY 35.67 139.65 "desc"  # requires lat lng
cop_add_behavior cop-xxx "Name" TTP "desc"
```

### Hypotheses (ACH)
```bash
cop_hypotheses cop-xxx
cop_add_hypothesis cop-xxx "The event is authentic" 70    # confidence 0-100
cop_update_hypothesis cop-xxx hyp-yyy '{"status":"proven","confidence":95}'
```

### Tasks
```bash
cop_tasks cop-xxx
cop_add_task cop-xxx "title" high osint "Alice"  # priority, task_type, assigned
cop_update_task cop-xxx tsk-yyy '{"status":"done"}'
cop_delete_task cop-xxx tsk-yyy
```

### Evidence
```bash
cop_evidence cop-xxx
cop_add_evidence cop-xxx "title" "content" "https://url" observation unverified
# source_type: observation|document|image|video|testimony|signal
# credibility: confirmed|probable|possible|doubtful|unverified
```

### Timeline
```bash
cop_timeline cop-xxx
cop_add_timeline cop-xxx "title" "2026-03-14" "desc" military high
# category: event|meeting|communication|financial|legal|travel|publication|military|political
# importance: normal|high|critical
cop_update_timeline cop-xxx tle-yyy '{"title":"updated"}'
cop_delete_timeline cop-xxx tle-yyy
```

### Markers (map pins)
```bash
cop_markers cop-xxx
cop_add_marker cop-xxx 33.8 -118.2 "Label" a-u-G CONFIRMED "desc"
# cot_type: CoT MIL-STD-2525 code (a-u-G = unknown ground)
# confidence: CONFIRMED|PROBABLE|POSSIBLE|SUSPECTED|DOUBTFUL
cop_update_marker cop-xxx mkr-yyy '{"confidence":"CONFIRMED","label":"Updated"}'
cop_delete_marker cop-xxx mkr-yyy
```

### Claims
```bash
cop_claims cop-xxx
cop_add_claims cop-xxx '{"claims":[{"claim":"text","confidence":70}],"url":"...","title":"..."}'
cop_verify_claim cop-xxx claim-yyy verified true  # status + promote_to_evidence
```

### Personas
```bash
cop_personas cop-xxx
cop_add_persona cop-xxx "DisplayName" telegram "@handle" "https://url" "notes"
# platform: twitter|telegram|reddit|onlyfans|instagram|tiktok|other
cop_link_personas cop-xxx per-aaa per-bbb alias 80  # link_type + confidence
```

### Shares (public links)
```bash
cop_shares cop-xxx
cop_add_share cop-xxx true map event rfi  # allow_rfi_answers + visible panels
cop_delete_share cop-xxx <token>
```

### Scrapers (Apify integration)
```bash
cop_scrape_twitter cop-xxx "search query" 20     # scrape Twitter/X → evidence
cop_scrape_twitter_urls cop-xxx https://x.com/... # scrape specific tweets
cop_scrape_tiktok cop-xxx "search query" 20       # scrape TikTok → evidence
cop_scrape_tiktok_urls cop-xxx https://tiktok.com/... # scrape specific TikTok videos
cop_scrape_status cop-xxx <run_id>               # check async run status
cop_scrape_status cop-xxx <run_id> false          # preview without ingesting
```

### Stats & Activity
```bash
cop_stats cop-xxx
cop_activity cop-xxx
```

## API Field Reference

### Session updatable fields
`name`, `description`, `status`, `mission_brief`, `event_type`, `event_description`,
`active_layers` (array), `layer_config` (object), `linked_frameworks` (array),
`key_questions` (array), `event_facts` (array), `content_analyses` (array),
`is_public` (bool), `global_alerts_enabled` (bool), `global_alerts_region` (string),
bbox/center/zoom fields

### RFI statuses
`open` → `answered` → `closed` | `blocked`

### Task statuses
`todo` → `in_progress` → `done` | `blocked`

### Task types
`general`, `pimeyes`, `geoguessr`, `forensic`, `osint`, `reverse_image`, `social_media`

## Auth

- `X-User-Hash` header with min 16 chars (auto-creates guest user)
- `.env` has `RESEARCHTOOLS_USER_HASH` for CLI ops
- COP GET endpoints (layers, stats, activity) don't require auth
- All mutations (POST/PUT/DELETE) require auth

## Workspace ID

COP sessions have `workspace_id` (usually `cop-SESSION_ID`). Entity endpoints (`/api/actors`, etc.) need this, not the session ID. Shell functions auto-resolve it.

## Deploy

```bash
npx vite build && npx wrangler pages deploy dist/ --project-name=researchtoolspy
```

## Dev

```bash
npx wrangler pages dev --port 8788   # API
npx vite                              # Frontend on 5173, proxies /api to 8788
```

## Database

- D1 (SQLite) on Cloudflare
- Schema: `schema/d1-schema.sql` + `schema/migrations/*.sql`
- Remote: `npx wrangler d1 execute researchtoolspy-db --remote --command "SQL"`
- Entity tables use `created_by` (not `user_id`), `workspace_id`, TEXT IDs
- Actor/place types MUST be uppercase (D1 CHECK constraints)
