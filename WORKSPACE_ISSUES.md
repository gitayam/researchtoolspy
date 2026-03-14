# Site Issues — Investigation Report

**Last updated:** 2026-03-14 (Sessions 34-52)

## Fixed — v0.13.0 (Session 34)

### CRITICAL
| # | Issue | Status |
|---|-------|--------|
| 1 | **CreateWorkspaceDialog sends wrong POST body** — always returns 400 | FIXED |
| 2 | **settings/workspaces.ts queries nonexistent `user_hash` column** | FIXED |
| 3 | **workspace_members INSERT missing `id` field** — D1 constraint violation | FIXED |

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 4 | **Workspace members/invites used `getUserIdOrDefault`** on mutations | FIXED |
| 5 | **No error state on workspace fetch failure** | FIXED |

### UX
| # | Issue | Status |
|---|-------|--------|
| 6 | Dark mode missing on role badges | FIXED |
| 7 | Invalid Tailwind class `bg-gray-750` | FIXED |
| 8 | Build error: `exact` on TABS union (TS2339) | FIXED |

---

## Fixed — v0.13.1 (Session 35)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 9 | **error.message leaked to clients** in 7 endpoints (OWASP A01) | FIXED |
| 10 | **`getUserIdOrDefault` on 3 mutation endpoints** (relationships, hamilton-rule, collection/start) | FIXED |
| 11 | **391 `console.log` statements removed** across 58 API files | FIXED |

---

## Fixed — v0.13.2 (Session 36)

### DATA ISOLATION
| # | Issue | Status |
|---|-------|--------|
| 12 | **13 endpoints with hardcoded user_id=1 fallbacks** — all guest data attributed to user 1 instead of actual user. Fixed: saved-links (7), answer-question, social-extract, auto-extract-entities, research/forms/create, migrate-session-content, evidence, datasets, evidence-items, framework-datasets, framework-evidence, framework-entities, evidence-citations | FIXED |

### FRONTEND CRASH PREVENTION
| # | Issue | Status |
|---|-------|--------|
| 13 | **Null guard on API response arrays** — 5 files with unsafe `.map()` on potentially undefined data. Fixed: EvidenceItemForm (actors), ACHWizard (hypotheses), SwotForm (4 arrays), IntelligenceSynthesisPage (14 guards), DeceptionRiskDashboard (5 guards) | FIXED |

### DEPENDENCY SECURITY
| # | Issue | Status |
|---|-------|--------|
| 14 | **9 high/moderate npm vulnerabilities fixed** — flatted, minimatch (x3), preact, rollup, tar, ajv, js-yaml, lodash-es, vite. Updated browserslist DB. | FIXED |

---

## Fixed — v0.13.3 (Session 37)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 26 | **COP submissions PUT uses `getUserIdOrDefault`** — guest users could triage submissions. Fixed: `cop/[id]/submissions.ts` now uses `getUserFromRequest` + 401 check | FIXED |

### CODE QUALITY
| # | Issue | Status |
|---|-------|--------|
| 18 | **Duplicated CORS headers in workspace files** — removed dead `corsHeaders` and `onRequestOptions` from 5 workspace API files (middleware handles CORS centrally) | FIXED |
| 19 | **Duplicated `canManageInvites`** — extracted to shared `workspace-helpers.ts` as `canManageWorkspace()`, used by invites, members, and workspace update handlers | FIXED |
| 21 | **`formatExpiry()` hardcoded English** — CollaborationPage now uses `t()` with fallback defaults, matches InviteAcceptPage's relative-time pattern | FIXED |
| 27 | **Empty catch blocks in evidence-items.ts** — added logging to silent auto-link error handler | FIXED |
| 28 | **Cache write failure swallowed** in `cop/[id]/cot.ts` — added error logging to `.catch()` | FIXED |

---

## Fixed — v0.13.4 (Session 38)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 30 | **COP export POST uses `getUserIdOrDefault`** — guest users could trigger exports. Fixed: `cop/[id]/export.ts` now uses `getUserFromRequest` + 401 check | FIXED |
| 31 | **Evidence DELETE unscoped to owner** — any authenticated user could delete any evidence by ID. Fixed: added `AND created_by = ?` to DELETE query + 404 on no match | FIXED |
| 32 | **COP alerts POST uses `getUserIdOrDefault`** — new alerts feature hardened before merge. Fixed: `cop/[id]/alerts.ts` uses `getUserFromRequest` + 401 | FIXED |

### FEATURE
| # | Issue | Status |
|---|-------|--------|
| 33 | **COP Global Alerts feature** — REDSIGHT BDA integration with alert feed, severity filtering, dismiss/action/analysis workflows, RFI linking, timeline entries, auto-refresh. New: API (`cop/[id]/alerts.ts`), component (`CopGlobalAlertPanel.tsx`), migration (`090-cop-global-alerts.sql`), sidebar nav item, session fields | MERGED |

### CODE QUALITY
| # | Issue | Status |
|---|-------|--------|
| 34 | **Dead OPTIONS handler removed from alerts.ts** — cleaned before merge (middleware handles CORS) | FIXED |

---

## Fixed — v0.13.5 (Session 39)

### UX
| # | Issue | Status |
|---|-------|--------|
| 38 | **ResearchPlanDisplay missing dark mode** — 15 instances of unreadable text in dark mode across overview cards, timeline, literature, and ethics tabs. Fixed: added `dark:` variants for `text-purple-600`, `text-blue-600`, `text-green-600`, `text-gray-500`, and `border-l-purple-600` | FIXED |

### CODE QUALITY
| # | Issue | Status |
|---|-------|--------|
| 29 | **Empty catch blocks in playbook-engine** — 4 silent JSON parse failures in `engine.ts` now log `console.warn` with rule/event IDs for debugging | FIXED |
| 39 | **Dead import in CopGlobalAlertPanel** — unused `AlertTriangle` import from lucide-react removed | FIXED |

---

## Fixed — v0.14.0 (Session 40)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 42 | **COP session PUT/DELETE uses `getUserIdOrDefault`** — guest users could update/archive any session owned by user 1. Fixed: `cop/sessions/[id].ts` now uses `getUserFromRequest` + 401 on all mutation handlers. Removed redundant inner `getUserIdOrDefault` in event_facts sync. | FIXED |
| 43 | **COP tasks POST/PUT/DELETE uses `getUserIdOrDefault`** — guest users could create, modify, and delete tasks in any session. Fixed: all 3 handlers in `cop/[id]/tasks.ts` use `getUserFromRequest` + 401 | FIXED |
| 44 | **COP assets POST/PUT/DELETE uses `getUserIdOrDefault`** — guest users could create, modify, and hard-delete assets. Fixed: all 3 handlers in `cop/[id]/assets.ts` use `getUserFromRequest` + 401 | FIXED |
| 45 | **COP shares POST uses `getUserIdOrDefault`** — guest users could create public share links for any session. Fixed: `cop/[id]/shares.ts` uses `getUserFromRequest` + 401 | FIXED |
| 46 | **COP playbooks PUT/DELETE uses `getUserIdOrDefault`** — guest users could modify/delete automation playbooks. Fixed: `cop/[id]/playbooks/[pbId].ts` uses `getUserFromRequest` + 401 | FIXED |
| 47 | **COP evidence-tags POST/DELETE uses `getUserIdOrDefault`** — Fixed: `cop/[id]/evidence-tags.ts` uses `getUserFromRequest` + 401 | FIXED |
| 48 | **COP task-dependencies POST/DELETE uses `getUserIdOrDefault`** — Fixed: `cop/[id]/task-dependencies.ts` uses `getUserFromRequest` + 401 | FIXED |
| 49 | **COP timeline POST/PUT/DELETE uses `getUserIdOrDefault`** — Fixed: all 3 handlers in `cop/[id]/timeline.ts` use `getUserFromRequest` + 401 | FIXED |
| 50 | **COP task-templates POST/PUT/DELETE uses `getUserIdOrDefault`** — Fixed: all 3 handlers in `cop/[id]/task-templates.ts` use `getUserFromRequest` + 401 | FIXED |
| 51 | **evidence-items DELETE unscoped to owner** — any user could delete any evidence item by ID. Fixed: added `AND created_by = ?` + 404 on no match. Citations DELETE also scoped. | FIXED |
| 52 | **evidence-items error response leaks `url` and `method`** — internal routing info exposed to clients. Fixed: removed from error response body | FIXED |
| 53 | **DeceptionView `.toString()` crash** — `data.id?.toString()` throws if `data` is null. Fixed: `data?.id ? String(data.id) : undefined` | FIXED |
| 54 | **ContentIntelligencePage `.toString()` crash** — `analysisData.id?.toString()` throws on null. Fixed: `analysisData?.id ? String(analysisData.id) : 'temp'` | FIXED |
| 55 | **Dead `getUserIdOrDefault` imports** in export.ts and submissions.ts — removed unused imports left from previous auth fixes | FIXED |

---

## Fixed — v0.14.2 (Session 41)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 56 | **COP RFIs POST/PUT uses `getUserIdOrDefault`** — guest users could create/update RFIs. Fixed: `cop/[id]/rfis.ts` and `cop/[id]/rfis/[rfiId].ts` use `getUserFromRequest` + 401. Removed redundant inner auth call in PUT event emission. | FIXED |
| 57 | **COP hypotheses POST/PUT uses `getUserIdOrDefault`** — Fixed: `cop/[id]/hypotheses.ts` uses `getUserFromRequest` + 401 | FIXED |
| 58 | **COP claims POST/PUT uses `getUserIdOrDefault`** — Fixed: `cop/[id]/claims.ts` uses `getUserFromRequest` + 401 | FIXED |
| 59 | **COP markers POST/PUT uses `getUserIdOrDefault`** — Fixed: `cop/[id]/markers.ts` uses `getUserFromRequest` + 401 | FIXED |
| 60 | **COP personas POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/personas.ts` uses `getUserFromRequest` + 401 | FIXED |
| 61 | **COP intake-forms POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/intake-forms.ts` uses `getUserFromRequest` + 401 | FIXED |
| 62 | **COP intake-forms PUT uses `getUserIdOrDefault`** — PUT handler had import but no auth check at all. Fixed: `cop/[id]/intake-forms/[formId].ts` uses `getUserFromRequest` + 401 | FIXED |
| 63 | **COP playbooks POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/playbooks.ts` uses `getUserFromRequest` + 401 | FIXED |
| 64 | **COP marker-changelog POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/marker-changelog.ts` uses `getUserFromRequest` + 401 | FIXED |
| 65 | **COP evidence POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/evidence.ts` uses `getUserFromRequest` + 401 | FIXED |
| 66 | **COP evidence batch POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/evidence/batch.ts` uses `getUserFromRequest` + 401 | FIXED |
| 67 | **COP asset check-in POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/assets/[assetId]/check-in.ts` uses `getUserFromRequest` + 401 | FIXED |
| 68 | **COP task reassign POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/tasks/[taskId]/reassign.ts` uses `getUserFromRequest` + 401 | FIXED |
| 69 | **COP deploy-template POST uses `getUserIdOrDefault`** — Fixed: `cop/[id]/tasks/deploy-template.ts` uses `getUserFromRequest` + 401 | FIXED |
| 70 | **COP RFI answers POST/PUT uses `getUserIdOrDefault`** — Fixed: `cop/[id]/rfis/[rfiId]/answers.ts` uses `getUserFromRequest` + 401 on both handlers | FIXED |
| 71 | **COP sessions POST uses `getUserIdOrDefault`** — guest users could create new COP sessions. Fixed: `cop/sessions.ts` POST uses `getUserFromRequest` + 401 (GET intentionally kept for guest listing) | FIXED |
| 72 | **5 error.message leaks in AI/tools endpoints** — `geoconfirmed.ts`, `ai/summarize.ts`, `ai/questions.ts`, `ai/generate.ts`, `ai/scrape-url.ts` exposed internal error details to clients. Fixed: generic error messages returned | FIXED |

### CODE QUALITY
| # | Issue | Status |
|---|-------|--------|
| 73 | **Dead `getUserIdOrDefault` imports** in sessions/[id].ts, assets.ts, tasks.ts — removed unused imports left from v0.14.0 auth fixes | FIXED |
| 74 | **ACH index POST/PUT/DELETE uses `getUserIdOrDefault`** — guest users could CRUD ACH analyses. Fixed: `ach/index.ts` mutations use `getUserFromRequest` + 401 (GET kept for guest browsing) | FIXED |
| 75 | **ACH hypotheses POST/PUT/DELETE uses `getUserIdOrDefault`** — Fixed: `ach/hypotheses.ts` all handlers use `getUserFromRequest` + 401 | FIXED |
| 76 | **ACH evidence POST/DELETE uses `getUserIdOrDefault`** — Fixed: `ach/evidence.ts` all handlers use `getUserFromRequest` + 401 | FIXED |
| 77 | **ACH scores POST/DELETE uses `getUserIdOrDefault`** — Fixed: `ach/scores.ts` all handlers use `getUserFromRequest` + 401 | FIXED |
| 78 | **evidence-items.ts user impersonation** — POST accepted `body.created_by` and PUT accepted `body.updated_by` from request body, allowing any user to attribute records to others. Fixed: server always uses authenticated userId | FIXED |
| 79 | **evidence-items.ts POST/PUT/DELETE uses `getUserIdOrDefault`** — Fixed: all mutation blocks use `getUserFromRequest` + 401 (GET kept for guest browsing) | FIXED |
| 80 | **Core entity mutations (5 files) use `getUserIdOrDefault`** — actors.ts, sources.ts, events.ts, places.ts, behaviors.ts POST/PUT/DELETE all used guest-fallback auth. Fixed: all mutation blocks use `getUserFromRequest` + 401. GET kept for guest browsing. | FIXED |
| 81 | **Cross-table mutations (4 files) use `getUserIdOrDefault`** — index.ts POST, [id].ts PUT/DELETE, scores.ts PUT, share.ts POST. Fixed: all use `getUserFromRequest` + 401 | FIXED |
| 82 | **Framework/evidence mutations (5 files) use `getUserIdOrDefault`** — frameworks/index.ts POST, evidence.ts, evidence-citations.ts, framework-datasets.ts, framework-evidence.ts, framework-entities.ts POST/DELETE. Fixed: all use `getUserFromRequest` + 401 | FIXED |
| 83 | **datasets.ts, equilibrium-analysis.ts mutations** — POST/PUT/DELETE used guest-fallback auth. Fixed: all use `getUserFromRequest` + 401 | FIXED |
| 84 | **Verbose emoji debug logging** — `ach/evidence.ts` and `evidence-items.ts` had 10+ line error banners with emojis. Consolidated to single `console.error()` per block | FIXED |
| 85 | **Content-intelligence mutations (10 files) use `getUserIdOrDefault`** — saved-links (POST/PUT/DELETE), auto-extract, share, dime-analyze, social-media-extract, analyze-url, starbursting/link-entity, starbursting/generate-questions, social-extract, answer-question. Fixed: all use `getUserFromRequest` + 401 | FIXED |
| 86 | **ACH share/clone/from-CI endpoints** — `ach/[id]/share.ts`, `ach/from-content-intelligence.ts`, `ach/public/[token]/clone.ts` POST handlers. Fixed: all use `getUserFromRequest` + 401 | FIXED |
| 87 | **Claims mutation endpoints** — `claims/retry-analysis.ts`, `claims/analyze/[id].ts`, `claims/share/[id].ts` POST handlers. Fixed: all use `getUserFromRequest` + 401 | FIXED |
| 88 | **Misc mutation endpoints** — activity.ts POST, social-media.ts POST/PUT/DELETE, invites/accept POST, evidence-eve.ts PUT/DELETE, frameworks/generate-entities POST, workspaces/index.ts POST. Fixed: all use `getUserFromRequest` + 401 | FIXED |

---

## Fixed — v0.14.6 (Session 44)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 89 | **COP collaborators POST/PUT/DELETE used custom `getUserId()` bypassing shared auth** — private `getUserId()` function (not from auth-helpers) fell back to user 1, allowing guest users to invite/update/remove collaborators. Fixed: replaced with `getUserFromRequest` + 401. Removed dead `corsHeaders` and `onRequestOptions`. | FIXED |
| 90 | **COP activity POST used custom `getUserId()` bypassing shared auth** — same private `getUserId()` pattern. Guest users could log activity events as user 1. Fixed: replaced with `getUserFromRequest` + 401. Removed dead `corsHeaders` and `onRequestOptions`. | FIXED |
| 91 | **COP playbook rules POST/PUT/DELETE missing auth** — no auth imports, no checks. Only verified playbook exists, not that user owns session. Fixed: `cop/[id]/playbooks/[pbId]/rules.ts` uses `getUserFromRequest` + 401. Removed dead `corsHeaders` and `onRequestOptions`. | FIXED |
| 92 | **COP playbook test POST missing auth** — dry-run endpoint had no auth. Fixed: `cop/[id]/playbooks/[pbId]/test.ts` uses `getUserFromRequest` + 401. Removed dead `corsHeaders` and `onRequestOptions`. | FIXED |

---

## Fixed — v0.14.8 (Session 45)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 93 | **equilibrium-analysis/[id].ts PUT/DELETE with zero auth** — anyone could update or delete any equilibrium analysis by ID. Fixed: both handlers use `getUserFromRequest` + 401 | FIXED |
| 94 | **hamilton-rule/[id].ts PUT/DELETE with zero auth** — anyone could update or delete any Hamilton Rule analysis by ID. Fixed: both handlers use `getUserFromRequest` + 401 | FIXED |
| 95 | **collection/[jobId]/approve.ts POST/DELETE with no auth** — anyone could approve/reject collection results. Fixed: both handlers use `getUserFromRequest` + 401 | FIXED |
| 96 | **ai/config.ts PUT/POST had TODO "Add authentication check" but never implemented** — anyone could change AI model settings, rate limits, and reset cost tracking. Fixed: both handlers use `getUserFromRequest` + 401 | FIXED |

---

## Fixed — v0.14.10 (Session 46)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 99 | **research/forms/create.ts POST with zero auth** — anyone could create anonymous evidence submission forms. Fixed: `getUserFromRequest` + 401 | FIXED |
| 100 | **research/evidence/add.ts POST with zero auth** — anyone could add evidence items to any research question. Fixed: `getUserFromRequest` + 401 | FIXED |
| 101 | **research/workflow/init.ts POST with zero auth** — anyone could initialize research workflows. Fixed: `getUserFromRequest` + 401 | FIXED |
| 102 | **research/generate-plan.ts POST with zero auth** — anyone could trigger AI-powered research plan generation (costs money). Fixed: `getUserFromRequest` + 401 | FIXED |
| 103 | **research/submissions/process.ts POST with zero auth** — anyone could convert submissions into evidence entries. Fixed: `getUserFromRequest` + 401 | FIXED |
| 104 | **content-intelligence/cleanup.ts POST+GET with zero auth** — anyone could DELETE all expired content analyses. GET delegated to POST (violating HTTP safety). Fixed: POST uses `getUserFromRequest` + 401, GET now returns status info only | FIXED |
| 105 | **research/workflow/init.ts hardcoded workspace_id='1'** — all research tasks/activity written to default workspace. Fixed: reads `X-Workspace-ID` header | FIXED |
| 106 | **research/submissions/process.ts hardcoded workspace_id='1'** — processed evidence always stored in default workspace. Fixed: reads `X-Workspace-ID` header | FIXED |

---

## Fixed — v0.15.0 (Session 47)

### SECURITY
| # | Issue | Status |
|---|-------|--------|
| 108 | **research/forms/[id]/index.ts DELETE allows unauthenticated deletion** — `requireAuth` wrapped in try/catch that swallowed auth failures. Anyone could delete any form by hash_id. Fixed: auth failure now returns 401 | FIXED |
| 109 | **research/forms/[id]/toggle.ts PATCH allows unauthenticated toggling** — same swallowed-auth pattern. Anyone could enable/disable any form. Fixed: auth failure now returns 401 | FIXED |
| 110 | **investigations/index.ts POST creates "Guest Workspace" without auth** — unauthenticated users could create orphaned workspaces and investigations, polluting DB. Fixed: requires auth, removed guest workspace creation | FIXED |

### CRITICAL BUG
| # | Issue | Status |
|---|-------|--------|
| 111 | **investigations/index.ts workspace_members INSERT missing `id` field** — `id TEXT PRIMARY KEY` is NOT NULL without default. Authenticated users hitting the "create personal workspace" path would crash with D1 constraint violation. Fixed: added `crypto.randomUUID()` for member id | FIXED |

### DATA ISOLATION
| # | Issue | Status |
|---|-------|--------|
| 112 | **content-intelligence/auto-extract-entities.ts hardcoded workspace_id='1' fallback** — body.workspace_id fell back to '1' ignoring X-Workspace-ID header. Fixed: falls back to header then '1' | FIXED |
| 113 | **investigations/from-research-question.ts broken auth call** — `requireAuth(context)` instead of `requireAuth(context.request, context.env)`. Runtime TypeError: `context.headers` is undefined. Endpoint always crashed with 500, never reached auth check. Fixed: correct two-arg call + replaced `auth.user.id` with `userId` | FIXED |
| 114 | **comments.ts POST hardcoded workspace_id=1** — all comments created in default workspace regardless of actual context. Fixed: reads `X-Workspace-ID` header | FIXED |
| 115 | **evidence/recommend.ts hardcoded workspace_id='1'** — evidence recommendations scoped to default workspace. Fixed: reads `X-Workspace-ID` header | FIXED |

### OWNERSHIP (defense-in-depth)
| # | Issue | Status |
|---|-------|--------|
| 116 | **equilibrium-analysis/[id].ts PUT/DELETE no ownership check** — any authenticated user could update/delete any analysis by ID. Fixed: added `AND created_by = ?` to both queries + check `result.meta.changes` | FIXED |
| 117 | **hamilton-rule/[id].ts PUT/DELETE no ownership check** — same issue. Fixed: `AND created_by = ?` on both queries | FIXED |
| 118 | **collection/[jobId]/approve.ts POST/DELETE no workspace scoping** — job lookup `WHERE id = ?` without workspace check. Any authenticated user could approve/reject any job by ID. Fixed: adds `AND workspace_id = ?` when X-Workspace-ID header present | FIXED |

---

## Fixed — v0.15.3 (Session 49)

### FRONTEND CRASH
| # | Issue | Status |
|---|-------|--------|
| 119 | **ResearchPlanDisplay.tsx 25+ unguarded .map() calls on AI-generated nested data** — `plan.methodology.dataCollection.map()`, `plan.timeline.milestones.map()`, etc. If AI omits any nested field, component crashes with TypeError. Fixed: added `normalizePlan()` function that ensures all nested arrays/objects have safe defaults before rendering | FIXED |

---

## Fixed — v0.15.4 (Session 49 cont.)

### AI RESPONSE SAFETY
| # | Issue | Status |
|---|-------|--------|
| 120 | **generate-question.ts JSON.parse on raw AI response** — AI may wrap JSON in markdown code fences (```json ... ```), causing parse failure and 500. Fixed: strip markdown fences + try-catch with descriptive error | FIXED |
| 121 | **generate-plan.ts JSON.parse on raw AI response** — same markdown fence issue. Fixed: strip fences + try-catch | FIXED |
| 122 | **extract-claim-entities.ts JSON.parse on raw AI response** — same issue, but function returns entities directly (not HTTP response). Fixed: strip fences + try-catch with graceful degradation returning `{ entities: [], error }` | FIXED |

### NULL DEREFERENCE
| # | Issue | Status |
|---|-------|--------|
| 123 | **comments.ts POST null dereference on user lookup** — `userResult.user_hash` accessed without null check after `.first()` query. If user record missing (e.g. deleted account), crashes with TypeError. Fixed: added null check returning 404 | FIXED |

---

## Fixed — v0.15.5 (Session 50)

### SECURITY (privilege escalation)
| # | Issue | Status |
|---|-------|--------|
| 124 | **frameworks/[id].ts PUT/DELETE no auth + no ownership check** — Custom `resolveUserId()` bypassed shared auth helpers, fell back to user 1 silently. Any user (even unauthenticated) could update/delete ANY framework session by ID. Fixed: replaced with `getUserFromRequest` + 401, added `AND user_id = ?` defense-in-depth, workspace-level access as secondary check | FIXED |
| 125 | **frameworks/[id].ts custom `resolveUserId()` auth bypass** — Private function parsed JWT/hash manually with `|| 1` fallback, never validated token. Exact same pattern as COP Session 44 (`getUserId()` bypass). Removed entirely, using shared auth helpers | FIXED |
| 126 | **frameworks/index.ts POST redundant `getUserIdOrDefault` after auth** — Line 27 called `getUserIdOrDefault` after `getUserFromRequest` already validated auth on line 19, creating confusion about which userId was authoritative. Fixed: single `getUserFromRequest` call | FIXED |

### FRONTEND CRASH
| # | Issue | Status |
|---|-------|--------|
| 127 | **PublicCopPage.tsx `visible_panels.some()` without null guard** — `visible_panels` destructured from API response with no default. If backend returns null/undefined, page crashes with TypeError. Fixed: default to `[]` + optional chaining | FIXED |
| 128 | **AnalysisSummaryExport.tsx `claim.deception_analysis.red_flags.length` without guard** — Direct property access on AI-generated nested data. If `deception_analysis` or `red_flags` missing, export crashes. Fixed: added optional chaining `?.` on all nested accesses | FIXED |

### ERROR HANDLING
| # | Issue | Status |
|---|-------|--------|
| 129 | **cross-table/index.ts `JSON.parse(row.config)` without try-catch** — `parseTableRow()` crashes on corrupted config JSON in D1. Fixed: wrapped in try-catch with `{}` fallback | FIXED |
| 130 | **frameworks/index.tsx 4x `JSON.parse(localStorage...)` without try-catch** — Corrupted localStorage crashes framework page load. Fixed: wrapped all 4 instances in try-catch with `[]` fallback | FIXED |
| 131 | **frameworks/[id].ts GET `JSON.parse(result.data)` without try-catch** — Corrupted framework data JSON crashes GET endpoint. Fixed: wrapped in try-catch with `{}` fallback | FIXED |

---

## Fixed — v0.15.6 (Session 51)

### NULL DEREFERENCE
| # | Issue | Status |
|---|-------|--------|
| 132 | **comments.ts 4x unguarded `.first()` after INSERT/UPDATE** — POST fetches created comment then spreads `...created` without null check. PATCH resolve/unresolve/edit same pattern. If D1 returns null (race condition, constraint failure), crashes with TypeError. Fixed: null guard on POST (return 500), fallback objects on resolve/unresolve, null guard on edit | FIXED |

### DATA ISOLATION
| # | Issue | Status |
|---|-------|--------|
| 133 | **starbursting.ts hardcoded `workspace_id: '1'`** — POST mutation creates starbursting sessions always in workspace 1 regardless of user's actual workspace. Fixed: reads `X-Workspace-ID` header with `'1'` fallback | FIXED |

### FRONTEND STABILITY
| # | Issue | Status |
|---|-------|--------|
| 134 | **CopWorkspacePage.tsx useEffect fetch without cleanup** — Stats fetch had no AbortController. If component unmounts mid-fetch, `setWorkspaceStats` called on unmounted component (React warning + memory leak). Fixed: added AbortController with cleanup return | FIXED |
| 135 | **ContentIntelligencePage.tsx fragile DIME `.map()` pattern** — 4 DIME analysis sections used `(a || b).map()` where both `a` and `b` could be falsy despite truthiness check (JS short-circuit edge case). Fixed: added `|| []` fallback on all 4 `.map()` calls | FIXED |

---

## Fixed — v0.15.7 (Session 52)

### NULL DEREFERENCE
| # | Issue | Status |
|---|-------|--------|
| 136 | **relationships.ts POST unguarded `.first()` spread** — After INSERT, fetches created relationship then spreads `...relationship` and accesses `.evidence_ids` without null check. If `.first()` returns null, crashes with TypeError on line 232. Fixed: added null guard with graceful fallback | FIXED |
| 137 | **relationships.ts PUT unguarded `.first()` spread** — After UPDATE, fetches updated relationship then spreads `...updated` and accesses `.evidence_ids` without null check. Same crash pattern as #136. Fixed: added null guard with graceful fallback | FIXED |

---

## Remaining Tech Debt

### Architecture (MEDIUM)
| # | Issue | Notes |
|---|-------|-------|
| 15 | Dual auth systems (`omnicore_user_hash` vs `omnicore_token`) | Consolidated to `getCopHeaders()` per F34 lesson, but two localStorage keys remain |
| 16 | `ensureUserHash()` creates hash locally but never registers in DB | Guest users can't own workspaces |
| 17 | ~~All mutation endpoints use `getUserIdOrDefault`~~ | **RESOLVED (S41-43)** — Every mutation endpoint across the entire API surface now uses `getUserFromRequest` + 401. Only GET handlers intentionally keep `getUserIdOrDefault` for guest browsing. |

### Code Quality (LOW)
| # | Issue | Notes |
|---|-------|-------|
| 20 | CreateWorkspaceDialog not internationalized | Hardcoded English strings |
| 22 | 112 `as any` casts in frontend | GenericFrameworkForm: 35 instances |
| 35 | ~129 dead `onRequestOptions` handlers across API files | Middleware handles CORS. LOW priority, risky to batch-remove (console.log incident) |
| 36 | ~120 duplicate `corsHeaders` definitions | Redundant with middleware. Same batch-removal risk |
| 37 | ~22 instances of internal `url.pathname.match()` routing | Dead code per Cloudflare Pages routing model |
| 40 | Dark mode gaps in COP components | CopPersonaLinkDialog, CopAssetDetailDrawer, CopEventSidebar, CopArtifactLightbox, CopStatusStrip, CopRfiTab, CopTagSelector — 60+ instances of `text-gray-500/600` without `dark:` variants |
| 41 | Dark mode gaps in CopAnalysisSummary | ~14 color classes missing `dark:` variants — icons, badges, section headings, empty state text |

### Data Isolation (MEDIUM)
| # | Issue | Notes |
|---|-------|-------|
| 107 | `feedback/submit.ts` POST has no auth | Intentionally public (contact form pattern). Consider rate limiting by IP to prevent spam. R2 screenshot uploads also unprotected. |

### Feature Gaps (LOW)
| # | Issue | Notes |
|---|-------|-------|
| 97 | pdf-extractor.ts has placeholder `YOUR_PDF_CO_API_KEY` | PDF extraction non-functional. Needs env var `PDF_CO_API_KEY` in wrangler.toml |
| 98 | AI endpoints (ai/*, tools/*) lack auth | Stateless AI processing — don't modify data but cost money. Adding auth would break guest access to core features. Monitor usage. |

### Performance (LOW)
| # | Issue | Notes |
|---|-------|-------|
| 23 | CopMap chunk 1.0MB (Mapbox GL) | Consider lazy loading |
| 24 | 5 chunks > 300KB (exceljs, jspdf, pptxgen, viz-libs) | Lazy-load export libraries on demand |

### Dependencies (LOW — dev only)
| # | Issue | Notes |
|---|-------|-------|
| 25 | undici vulnerabilities via wrangler/miniflare | Dev-only, not in production bundle. Awaiting upstream fix. |
