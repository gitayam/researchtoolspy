# Site Issues — Investigation Report

**Last updated:** 2026-03-14 (Sessions 34-68)

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
| 132 | **comments.ts 4x unguarded `.first()` results** — POST created comment, PATCH resolve/unresolve/edit all access `.first()` result without null check. If SELECT returns null after INSERT/UPDATE, spreading `...null` is silent but property access crashes. Fixed: null guards with fallback responses | FIXED |

### ERROR HANDLING
| # | Issue | Status |
|---|-------|--------|
| 133 | **starbursting.ts hardcoded `workspace_id: '1'`** — All starbursting results saved to workspace 1 regardless of caller. Fixed: reads `X-Workspace-ID` header with `'1'` fallback | FIXED |
| 134 | **ContentIntelligencePage.tsx 4x DIME `.map()` on undefined** — `dime_analysis.diplomatic/information/military/economic` arrays may be undefined from AI response. Fixed: fallback to `[]` on each | FIXED |

### MEMORY LEAK
| # | Issue | Status |
|---|-------|--------|
| 135 | **CopWorkspacePage.tsx useEffect fetch without AbortController** — Stats fetch on mount not cleaned up on unmount. React setState-on-unmounted warning. Fixed: AbortController with cleanup in return function | FIXED |

---

## Fixed — v0.15.7 (Session 52)

### NULL DEREFERENCE
| # | Issue | Status |
|---|-------|--------|
| 136 | **relationships.ts POST unguarded `.first()` after INSERT** — `...relationship` spread + property access on potentially null result. Fixed: null guard with `{ success: true, id }` fallback | FIXED |
| 137 | **relationships.ts PUT unguarded `.first()` after UPDATE** — Same pattern on `...updated` spread. Fixed: null guard with fallback | FIXED |

---

## Fixed — v0.15.8 (Session 53)

### NULL DEREFERENCE (13 instances across all entity CRUD files)
| # | Issue | Status |
|---|-------|--------|
| 138 | **actors.ts POST unguarded `.first()` after INSERT** — `...actor` spread + `actor.aliases`, `actor.tags`, `actor.deception_profile`, `actor.is_public` access on null crashes. Fixed: null guard | FIXED |
| 139 | **actors.ts PUT unguarded `.first()` after UPDATE** — `...updated` spread + same properties. Fixed: null guard | FIXED |
| 140 | **sources.ts POST unguarded `.first()` after INSERT** — `...source` spread + `source.moses_assessment`, `source.is_public`. Fixed: null guard | FIXED |
| 141 | **sources.ts PUT unguarded `.first()` after UPDATE** — `...updated` spread + same properties. Fixed: null guard | FIXED |
| 142 | **events.ts POST unguarded `.first()` after INSERT** — `...event` spread + `event.coordinates`, `event.is_public`. Fixed: null guard | FIXED |
| 143 | **events.ts PUT unguarded `.first()` after UPDATE** — `...updated` spread + same properties. Fixed: null guard | FIXED |
| 144 | **places.ts POST unguarded `.first()` after INSERT** — `...place` spread + `place.coordinates`, `place.is_public`. Fixed: null guard | FIXED |
| 145 | **behaviors.ts POST unguarded `.first()` after INSERT** — `...behavior` spread + `behavior.indicators`, `behavior.is_public`. Fixed: null guard | FIXED |
| 146 | **behaviors.ts PUT unguarded `.first()` after UPDATE** — `...updated` spread + same properties. Fixed: null guard | FIXED |
| 147 | **social-media.ts profiles POST/PUT unguarded `.first()`** — `...profile` spread + `profile.platform_data`, `profile.tags`, etc. Fixed: null guard | FIXED |
| 148 | **social-media.ts posts POST/PUT unguarded `.first()`** — `...post` spread + `post.media_urls`, `post.platform_data`, etc. Fixed: null guard | FIXED |
| 149 | **social-media.ts jobs POST unguarded `.first()`** — `...job` spread + `job.config`. Fixed: null guard | FIXED |
| 150 | **cop/[id]/timeline.ts PUT unguarded `.first()`** — `entry: updated` passed directly without null check. Fixed: fallback `updated \|\| { id: entryId }` | FIXED |

---

## Fixed — v0.15.9 (Session 54)

### NULL DEREFERENCE
| # | Issue | Status |
|---|-------|--------|
| 151 | **cross-table/[id].ts PUT unguarded `.first()` result** — `parseTableRow(updated)` where `updated` can be null from `.first()`. Fixed: null guard with `{ success: true, id }` fallback | FIXED |
| 152 | **settings/workspaces/[id].ts PUT unguarded `.first()` result** — `Response.json(updated)` where `updated` can be null. Fixed: null guard | FIXED |

### JSON.PARSE SAFETY
| # | Issue | Status |
|---|-------|--------|
| 153 | **research/tasks/list.ts 4x bare `JSON.parse` on D1 fields** — `depends_on`, `blocks`, `related_evidence`, `related_analysis` parsed without try-catch. Corrupted data crashes entire task list. Fixed: `safeParseJSON()` helper with `[]` fallback | FIXED |
| 154 | **research/workflow/init.ts 4x bare `JSON.parse` on template fields** — `stages`, `default_tasks`, `evidence_types`, `analysis_types` parsed without try-catch. Corrupted template data crashes workflow init. Fixed: `safeParseJSON()` helper | FIXED |
| 155 | **research/forms/[id]/index.ts bare `JSON.parse` on `form_fields`** — Corrupted form field JSON crashes form detail endpoint. Fixed: try-catch with `[]` fallback | FIXED |

### FRONTEND CRASH
| # | Issue | Status |
|---|-------|--------|
| 156 | **ClaimAnalysisDisplay.tsx 30+ unguarded `deception_analysis` accesses** — Deep property access (`claim.deception_analysis.methods.internal_consistency.score`) without optional chaining. If AI returns incomplete deception_analysis, entire page crashes. Fixed: optional chaining on all nested accesses (`?.methods?.`, `?.red_flags?.`, etc.) | FIXED |

### MEMORY LEAK
| # | Issue | Status |
|---|-------|--------|
| 157 | **CopSessionsTab.tsx useEffect fetch without AbortController** — setState on unmounted component. Fixed: AbortController with cleanup | FIXED |
| 158 | **ToolsTab.tsx useEffect fetch without AbortController** — Same pattern. Fixed | FIXED |
| 159 | **EntitiesTab.tsx useEffect fetch without AbortController** — Same pattern. Fixed | FIXED |
| 160 | **FrameworksTab.tsx useEffect fetch without AbortController** — Same pattern. Fixed | FIXED |
| 161 | **WorkspaceStatsBar.tsx useEffect fetch without AbortController** — Same pattern. Fixed | FIXED |
| 162 | **TeamTab.tsx 2x useEffect fetch without AbortController** — Members + invites fetch both unguarded. Fixed: shared controller for both | FIXED |

---

## Fixed — v0.16.0 (Session 55)

### JSON.PARSE SAFETY (systematic sweep — 14 files, 30+ instances)
| # | Issue | Status |
|---|-------|--------|
| 163 | **research/forms/list.ts 3x bare `JSON.parse` in `.map()`** — One corrupted row crashes entire form list endpoint (returns 500 instead of N-1 valid rows). Fixed: `safeJSON()` helper | FIXED |
| 164 | **research/evidence/list.ts 5x bare `JSON.parse` in `.map()`** — Same pattern: metadata, chain_of_custody, tags, linked_evidence, entities. Fixed: `safeJSON()` | FIXED |
| 165 | **research/submissions/list.ts 2x bare `JSON.parse` in `.map()`** — keywords, metadata. Fixed: `safeJSON()` | FIXED |
| 166 | **research/submissions/process.ts 3x bare `JSON.parse`** — target_research_question_ids, metadata, keywords. Fixed: `safeJSON()` | FIXED |
| 167 | **hamilton-rule.ts 5x bare `JSON.parse` in `.map()`** — actors, relationships, network_analysis, ai_analysis, tags. Fixed: `safeJSON()` | FIXED |
| 168 | **evidence.ts 11x bare `JSON.parse` on single record** — tags, source, metadata, sats_evaluation, frameworks, attachments, key_points, contradictions, corroborations, implications, previous_versions. Fixed: `safeJSON()` | FIXED |
| 169 | **relationships.ts 4x bare `JSON.parse` on evidence_ids** — GET list, GET detail, POST return, PUT return. Fixed: try-catch with `[]` fallback | FIXED |
| 170 | **comments.ts 3x bare `JSON.parse`** — mentioned_users, reactions in GET list and PATCH edit. Fixed: `safeJSON()` + try-catch | FIXED |
| 171 | **framework-datasets.ts 2x bare `JSON.parse` in `.map()`** — source, tags. Fixed: `safeJSON()` | FIXED |
| 172 | **content-library.ts bare `JSON.parse` in `.map()`** — key_entities. Fixed: `safeJSON()` | FIXED |
| 173 | **research/submit/[hashId].ts 2x bare `JSON.parse`** — enabled_fields (GET), target_research_question_ids (POST). Fixed: try-catch | FIXED |

### FRONTEND ERROR HANDLING
| # | Issue | Status |
|---|-------|--------|
| 174 | **EntityQuickCreate.tsx 4x `response.json()` on error without `.catch()`** — If API returns non-JSON error (HTML 502/503), `.json()` throws. Fixed: `.json().catch(() => ({ error: 'Unknown error' }))` per lessons learned pattern | FIXED |

### DATA ISOLATION
| # | Issue | Status |
|---|-------|--------|
| 175 | **research/evidence/add.ts hardcoded `workspaceId || '1'`** — Mutation endpoint only checked body.workspaceId, ignoring X-Workspace-ID header. Fixed: chain `body.workspaceId || header || '1'` | FIXED |

---

## Fixed — v0.16.1 (Session 56)

### FRONTEND ERROR HANDLING (systematic sweep — 13 files, 29 instances)
| # | Issue | Status |
|---|-------|--------|
| 176 | **CreateWorkspaceDialog.tsx 1x `response.json()` on error without `.catch()`** — If API returns HTML 502/503, `.json()` throws unhandled error. Fixed: `.json().catch(() => ({ error: 'Unknown error' }))` | FIXED |
| 177 | **CitationToEvidenceModal.tsx 1x unguarded error `.json()`** — Same pattern. Fixed | FIXED |
| 178 | **ClaimAnalysisDisplay.tsx 2x unguarded error `.json()`** — analyzeCredibility + analyzeClaims error paths. Fixed | FIXED |
| 179 | **GenericFrameworkView.tsx 2x unguarded error `.json()`** — save + load error paths. Fixed | FIXED |
| 180 | **COGWizard.tsx 1x unguarded error `.json()`** — AI analysis error path. Fixed | FIXED |
| 181 | **DeceptionView.tsx 2x unguarded error `.json()`** — analyze + save error paths. Fixed | FIXED |
| 182 | **MOMAssessmentModal.tsx 1x unguarded error `.json()`** — submit error path. Fixed | FIXED |
| 183 | **ContentIntelligencePage.tsx 3x unguarded error `.json()`** — DIME, starbursting, claim analysis error paths (+1 already guarded). Fixed | FIXED |
| 184 | **CollectionPage.tsx 4x unguarded error `.json()`** — CRUD operations error paths. Fixed | FIXED |
| 185 | **InviteAcceptPage.tsx 2x unguarded error `.json()`** — fetch + accept invite error paths. Fixed | FIXED |
| 186 | **SourcesPage.tsx 3x unguarded error `.json()`** — create, update, delete error paths. Fixed | FIXED |
| 187 | **EventsPage.tsx 3x unguarded error `.json()`** — create, update, delete error paths. Fixed | FIXED |
| 188 | **ActorsPage.tsx 3x unguarded error `.json()`** — create, update, delete error paths. Fixed | FIXED |

---

## Fixed — v0.16.2 (Session 57)

### FRONTEND ERROR HANDLING
| # | Issue | Status |
|---|-------|--------|
| 189 | **RelationshipForm.tsx `errorData = await response.json()` without `.catch()`** — Uses `errorData` variable name (missed in v0.16.1 sweep which only caught `error` variable). Crashes if API returns HTML. Fixed: `.json().catch()` | FIXED |
| 190 | **SwotForm.tsx `errorData = await response.json()` without `.catch()`** — Auto-populate error path. Fixed | FIXED |
| 191 | **AITimelineGenerator.tsx `errorData = await response.json()` without `.catch()`** — AI timeline generation error path. Fixed | FIXED |

### JSON.PARSE SAFETY
| # | Issue | Status |
|---|-------|--------|
| 192 | **ach/from-content-intelligence.ts 2x bare `JSON.parse` in template literal** — `analysis.topics` and `analysis.entities` parsed inside string interpolation without try-catch. Corrupted JSON crashes ACH conversion prompt. Fixed: IIFE try-catch with `'N/A'` fallback | FIXED |

---

## Fixed — v0.16.3 (Session 58)

### parseInt NaN GUARD (4 API endpoints)
| # | Issue | Status |
|---|-------|--------|
| 193 | **actors.ts `parseInt(limit)` without NaN fallback** — User-supplied `?limit=abc` produces NaN, causing SQL LIMIT NaN. Fixed: `parseInt(limit) \|\| 50` | FIXED |
| 194 | **sources.ts `parseInt(limit)` without NaN fallback** — Same pattern. Fixed | FIXED |
| 195 | **relationships.ts `parseInt(limit)` without NaN fallback** — Same pattern. Fixed | FIXED |
| 196 | **behaviors.ts `parseInt(limit)` without NaN fallback** — Same pattern. Fixed | FIXED |

### CRASH PREVENTION (.toString on undefined)
| # | Issue | Status |
|---|-------|--------|
| 197 | **COGPDFExport.tsx `vuln.composite_score.toString()`** — Crashes if composite_score is undefined (AI-generated data). Fixed: `String(vuln.composite_score ?? 0)` | FIXED |
| 198 | **COGPowerPointExport.tsx `vuln.composite_score.toString()`** — Same pattern in PPTX export. Fixed | FIXED |

### MEMORY LEAK (3 pages missing AbortController)
| # | Issue | Status |
|---|-------|--------|
| 199 | **ClaimsPage.tsx useEffect fetch without AbortController** — setState on unmounted component. Fixed: AbortController with cleanup | FIXED |
| 200 | **ACHAnalysisPage.tsx useEffect fetch without AbortController** — Same pattern. Fixed | FIXED |
| 201 | **InvestigationDetailPage.tsx 2x useEffect fetch without AbortController** — Main load + linked COP check both unguarded. Fixed: AbortController on both | FIXED |

### DATA ISOLATION
| # | Issue | Status |
|---|-------|--------|
| 202 | **comments.ts workspace_id destructured from body only** — POST fell back to header then '1', but destructuring skipped body.workspace_id. Fixed: chain `body.workspace_id \|\| header \|\| '1'` | FIXED |

---

## Fixed — v0.16.4 (Session 59)

### SECURITY (XSS)
| # | Issue | Status |
|---|-------|--------|
| 203 | **CommentThread.tsx `dangerouslySetInnerHTML` with unsanitized user content** — `comment.content_html` rendered as raw HTML without DOMPurify or sanitization. Any user-submitted HTML/JS in comments executes in other users' browsers. Fixed: replaced with safe text rendering `{comment.content}` | FIXED |

### DATA ISOLATION (cross-workspace leak)
| # | Issue | Status |
|---|-------|--------|
| 204 | **framework-datasets.ts GET missing workspace_id filter** — Query joined datasets without workspace scoping. User A could access User B's datasets by guessing framework_id. Fixed: added `AND e.workspace_id = ?` with workspace header chain | FIXED |

### MEMORY LEAK (5 useEffects across 3 detail views)
| # | Issue | Status |
|---|-------|--------|
| 205 | **ActorDetailView.tsx 2x useEffect fetch without AbortController** — MOM assessments + relationships fetch both unguarded. Fixed: AbortController on both | FIXED |
| 206 | **EventDetailView.tsx 2x useEffect fetch without AbortController** — MOM assessments (with nested actor fetches) + relationships. Fixed: AbortController on both, including inner fetch loop | FIXED |
| 207 | **SourceDetailView.tsx useEffect fetch without AbortController** — Relationships fetch unguarded. Fixed | FIXED |

---

## Fixed — v0.16.5 (Session 60)

### DATA ISOLATION (workspace_id sourcing on GET endpoints)
| # | Issue | Status |
|---|-------|--------|
| 208 | **deception/history.ts GET ignores X-Workspace-ID header** — Only read workspace_id from query params, fell back to '1'. Other users' deception history could leak. Fixed: chain `params \|\| header \|\| '1'` | FIXED |
| 209 | **deception/aggregate.ts GET ignores X-Workspace-ID header** — Same pattern. Fixed | FIXED |
| 210 | **frameworks.ts GET ignores X-Workspace-ID header** — Framework sessions list ignored header. Fixed | FIXED |
| 211 | **ach/evidence.ts POST+DELETE ignore X-Workspace-ID header** — Both mutation paths only read workspace_id from query params. Fixed: chain includes header fallback | FIXED |

### PERFORMANCE
| # | Issue | Status |
|---|-------|--------|
| 212 | **cop/sessions.ts GET returns unlimited rows** — No LIMIT clause on session listing. Could return 1000+ sessions, causing slow API response and frontend freeze. Fixed: added `LIMIT 200` | FIXED |
| 213 | **EventDetailView.tsx sequential actor name fetches** — N+1 query: loaded actor names one-by-one in for loop. 5 actors = 5 sequential requests. Fixed: `Promise.allSettled()` for parallel fetches | FIXED |

---

## Fixed — v0.16.6 (Session 61)

### DATA ISOLATION (ACH module workspace_id sourcing — 8 instances)
| # | Issue | Status |
|---|-------|--------|
| 214 | **ach/index.ts 4x workspace_id ignores X-Workspace-ID header** — GET list, GET detail, POST create, DELETE all read query params only. Fixed: chain `params \|\| header \|\| '1'` | FIXED |
| 215 | **ach/hypotheses.ts 3x workspace_id ignores X-Workspace-ID header** — POST, PUT, DELETE all read query params only. Fixed | FIXED |
| 216 | **ach/scores.ts 2x workspace_id ignores X-Workspace-ID header** — POST, GET all read query params only. Fixed | FIXED |

### PERFORMANCE (missing LIMIT on 6 list endpoints)
| # | Issue | Status |
|---|-------|--------|
| 217 | **research/tasks/list.ts no LIMIT** — Returns all tasks for a workspace. Could be hundreds. Fixed: `LIMIT 500` | FIXED |
| 218 | **research/forms/list.ts no LIMIT** — Returns all submission forms. Fixed: `LIMIT 200` | FIXED |
| 219 | **research/evidence/list.ts no LIMIT** — Returns all research evidence. Fixed: `LIMIT 500` | FIXED |
| 220 | **research/submissions/list.ts no LIMIT** — Returns all form submissions. Fixed: `LIMIT 500` | FIXED |
| 221 | **hamilton-rule.ts no LIMIT** — Returns all Hamilton Rule analyses. Fixed: `LIMIT 200` | FIXED |
| 222 | **comments.ts GET no LIMIT** — Returns all comments for an entity. Fixed: `LIMIT 500` | FIXED |

---

## Fixed — v0.16.7 (Session 62)

### DATA ISOLATION (workspace_id sourcing)
| # | Issue | Status |
|---|-------|--------|
| 223 | **ach/from-content-intelligence.ts workspace_id from body only** — Read `data.workspace_id` without header fallback. Cross-workspace ACH creation possible. Fixed: chain `body \|\| header \|\| '1'` | FIXED |
| 224 | **actors/search.ts workspace_id ignores header** — Actor search only read query params. Fixed: chain includes header | FIXED |

### PERFORMANCE (missing LIMIT on 5 more endpoints)
| # | Issue | Status |
|---|-------|--------|
| 225 | **investigations/index.ts no LIMIT** — Returns all investigations. Fixed: `LIMIT 200` | FIXED |
| 226 | **equilibrium-analysis.ts no LIMIT** — Returns all equilibrium analyses. Fixed: `LIMIT 200` | FIXED |
| 227 | **social-media.ts profiles GET no LIMIT** — Returns all social media profiles. Fixed: `LIMIT 200` | FIXED |
| 228 | **framework-evidence.ts no LIMIT** — Returns all framework-evidence links. Fixed: `LIMIT 500` | FIXED |
| 229 | **framework-entities.ts no LIMIT** — Returns all framework-entity links. Fixed: `LIMIT 500` | FIXED |

---

## Fixed — v0.16.8 (Session 63)

### PERFORMANCE (missing LIMIT on 11 COP/claims endpoints)
| # | Issue | Status |
|---|-------|--------|
| 230 | **cop/[id]/evidence.ts no LIMIT** — Returns all COP evidence items. Fixed: `LIMIT 500` | FIXED |
| 231 | **cop/[id]/tasks.ts no LIMIT** — Returns all COP tasks. Fixed: `LIMIT 500` | FIXED |
| 232 | **cop/[id]/timeline.ts no LIMIT** — Returns all timeline entries. Fixed: `LIMIT 1000` | FIXED |
| 233 | **cop/[id]/markers.ts no LIMIT** — Returns all map markers. Fixed: `LIMIT 500` | FIXED |
| 234 | **cop/[id]/assets.ts no LIMIT** — Returns all assets. Fixed: `LIMIT 500` | FIXED |
| 235 | **cop/[id]/hypotheses.ts no LIMIT** — Returns all hypotheses. Fixed: `LIMIT 200` | FIXED |
| 236 | **cop/[id]/rfis.ts no LIMIT** — Returns all RFIs. Fixed: `LIMIT 200` | FIXED |
| 237 | **cop/[id]/claims.ts no LIMIT** — Returns all COP claims. Fixed: `LIMIT 500` | FIXED |
| 238 | **cop/[id]/intake-forms.ts no LIMIT** — Returns all intake forms. Fixed: `LIMIT 200` | FIXED |
| 239 | **cop/[id]/collaborators.ts no LIMIT** — Returns all collaborators. Fixed: `LIMIT 200` | FIXED |
| 240 | **claims/index.ts no LIMIT** — Returns all saved claims. Fixed: `LIMIT 500` | FIXED |

### STABILITY (missing AbortController on 5 frontend pages)
| # | Issue | Status |
|---|-------|--------|
| 241 | **ContentLibraryPage.tsx no AbortController** — Fetch not cancelled on unmount. Fixed: AbortController + signal | FIXED |
| 242 | **EvidencePage.tsx no AbortController** — Fetch not cancelled on unmount. Fixed: AbortController + signal | FIXED |
| 243 | **DatasetPage.tsx no AbortController** — Fetch not cancelled on unmount. Fixed: AbortController + signal | FIXED |
| 244 | **NetworkGraphPage.tsx no AbortController** — 7 sequential fetches (relationships + 6 entity types) not cancelled on unmount. Fixed: AbortController + signal | FIXED |
| 245 | **EvidenceSubmissionsPage.tsx no AbortController** — 2 useEffects (forms + submissions) not cancelled on unmount. Fixed: AbortController + signal on both | FIXED |

---

## Fixed — v0.16.9 (Session 64)

### PERFORMANCE (missing LIMIT on 4 secondary queries)
| # | Issue | Status |
|---|-------|--------|
| 246 | **framework-evidence.ts secondary query no LIMIT** — GET by evidence_id returns all framework links. Fixed: `LIMIT 500` | FIXED |
| 247 | **framework-datasets.ts secondary query no LIMIT** — GET by dataset_id returns all framework links. Fixed: `LIMIT 500` | FIXED |
| 248 | **evidence-citations.ts GET by evidence_id no LIMIT** — Returns all citations for evidence. Fixed: `LIMIT 500` | FIXED |
| 249 | **evidence-citations.ts GET by dataset_id no LIMIT** — Returns all evidence citing a dataset. Fixed: `LIMIT 500` | FIXED |

### STABILITY (missing AbortController on 13 frontend files)
| # | Issue | Status |
|---|-------|--------|
| 250 | **WorkspaceContext.tsx no AbortController** — Context provider fetch not cancelled on unmount. Fixed | FIXED |
| 251 | **PublicFrameworkPage.tsx no AbortController** — Promise chain fetch without signal. Fixed | FIXED |
| 252 | **PublicContentAnalysisPage.tsx no AbortController** — Public page fetch not cancelled. Fixed | FIXED |
| 253 | **PublicACHLibraryPage.tsx no AbortController** — Library listing fetch not cancelled. Fixed | FIXED |
| 254 | **PublicACHPage.tsx no AbortController** — Public analysis page fetch not cancelled. Fixed | FIXED |
| 255 | **SocialMediaPage.tsx no AbortController** — 4 fetch functions (stats, profiles, posts, jobs) not cancelled. Fixed with 2 controllers | FIXED |
| 256 | **IntelligenceSynthesisPage.tsx no AbortController** — 7 parallel fetchSection calls not cancelled. Fixed: signal param + 7 controllers | FIXED |
| 257 | **HamiltonRulePage.tsx no AbortController** — Analysis list fetch not cancelled. Fixed | FIXED |
| 258 | **EquilibriumAnalysisPage.tsx no AbortController** — Analysis list fetch not cancelled. Fixed | FIXED |
| 259 | **DeceptionRiskDashboard.tsx no AbortController** — 2 useEffects (workspaces + aggregate data) not cancelled. Fixed | FIXED |
| 260 | **SubmissionFormsPage.tsx no AbortController** — Forms list fetch not cancelled. Fixed | FIXED |
| 261 | **CollaborationPage.tsx no AbortController** — Workspace fetch not cancelled. Fixed | FIXED |
| 262 | **ACHPage.tsx no AbortController** — Analysis list fetch not cancelled. Fixed | FIXED |
| 263 | **InvestigationPacketsPage.tsx no AbortController** — Packets list fetch not cancelled. Fixed | FIXED |
| 264 | **SubmissionsReviewPage.tsx no AbortController** — Submissions fetch (dep on formId+statusFilter) not cancelled. Fixed | FIXED |

---

## Fixed — v0.17.0 (Session 65)

### DATA ISOLATION (hardcoded workspace_id=1 in frontend)
| # | Issue | Status |
|---|-------|--------|
| 265 | **EvidenceLinker.tsx hardcoded workspace_id=1** — 3 fetch URLs (actors, sources, events) used hardcoded `workspace_id=1`. Fixed: `localStorage.getItem('current_workspace_id') \|\| '1'` | FIXED |
| 266 | **EvidenceRecommendations.tsx hardcoded workspace_id** — POST body to `/api/evidence/recommend` used `workspace_id: '1'`. Fixed: localStorage | FIXED |
| 267 | **EntityQuickCreate.tsx hardcoded workspace_id** — 3 entity creation POSTs (actor, source, event) used `workspace_id: 1`. Fixed: localStorage | FIXED |
| 268 | **StarburstingEntityLinker.tsx hardcoded workspace_id** — Actor creation POST used `workspace_id: '1'`. Fixed: localStorage | FIXED |
| 269 | **ContentIntelligencePage.tsx hardcoded workspace_id** — 4 instances: 2 actor search URLs, 1 actor creation POST, 1 auto-extract POST. Fixed: localStorage | FIXED |
| 270 | **HamiltonRulePage.tsx hardcoded workspace_id=1** — GET URL hardcoded. Fixed: localStorage | FIXED |
| 271 | **EquilibriumAnalysisPage.tsx hardcoded workspace_id=1** — 2 instances: GET URL and creation POST. Fixed: localStorage | FIXED |
| 272 | **SubmissionFormsPage.tsx hardcoded workspaceId=1** — Forms list URL hardcoded. Fixed: localStorage | FIXED |
| 273 | **EvidenceSubmissionsPage.tsx hardcoded workspaceId=1** — Forms list URL hardcoded. Fixed: localStorage | FIXED |

### PERFORMANCE (missing LIMIT on 4 secondary queries)
| # | Issue | Status |
|---|-------|--------|
| 274 | **framework-evidence.ts secondary query no LIMIT** — GET by evidence_id. Fixed: `LIMIT 500` | FIXED |
| 275 | **framework-datasets.ts secondary query no LIMIT** — GET by dataset_id. Fixed: `LIMIT 500` | FIXED |
| 276 | **evidence-citations.ts GET by evidence_id no LIMIT** — Fixed: `LIMIT 500` | FIXED |
| 277 | **evidence-citations.ts GET by dataset_id no LIMIT** — Fixed: `LIMIT 500` | FIXED |

### RESOURCE LEAK (unclosed fetch response)
| # | Issue | Status |
|---|-------|--------|
| 278 | **analyze-url.ts Wayback Machine save response not consumed** — `saveResponse` body never read, causing connection leak. Fixed: `await saveResponse.text().catch(() => {})` | FIXED |

---

## Fixed — v0.17.1 (Session 66)

### CORS (14 research API endpoints missing Access-Control-Allow-Origin)
| # | Issue | Status |
|---|-------|--------|
| 279 | **research/tasks/list.ts** — 3 response instances missing CORS header | FIXED |
| 280 | **research/forms/create.ts** — 6 response instances missing CORS header | FIXED |
| 281 | **research/forms/list.ts** — 2 response instances missing CORS header | FIXED |
| 282 | **research/forms/[id]/index.ts** — 7 response instances missing CORS header | FIXED |
| 283 | **research/forms/[id]/toggle.ts** — 5 response instances missing CORS header | FIXED |
| 284 | **research/generate-question.ts** — 4 response instances missing CORS header | FIXED |
| 285 | **research/evidence/add.ts** — 5 response instances missing CORS header | FIXED |
| 286 | **research/evidence/list.ts** — 3 response instances missing CORS header | FIXED |
| 287 | **research/submit/[hashId].ts** — 15 response instances missing CORS header | FIXED |
| 288 | **research/workflow/init.ts** — 5 response instances missing CORS header | FIXED |
| 289 | **research/recommend-questions.ts** — 3 response instances missing CORS header | FIXED |
| 290 | **research/submissions/process.ts** — 6 response instances missing CORS header | FIXED |
| 291 | **research/submissions/list.ts** — 2 response instances missing CORS header | FIXED |
| 292 | **research/generate-plan.ts** — 4 response instances missing CORS header | FIXED |

### RACE CONDITION (stale state closures in evidence linking)
| # | Issue | Status |
|---|-------|--------|
| 293 | **GenericFrameworkView.tsx** — 3 instances of `setLinkedEvidence([...linkedEvidence, ...])` using stale closure. Fixed: functional updater `prev => [...prev, ...]` | FIXED |
| 294 | **DeceptionView.tsx** — 3 instances of `setLinkedEvidence([...linkedEvidence, ...])` using stale closure. Fixed: functional updater `prev => [...prev, ...]` | FIXED |

---

## Fixed — v0.17.2 (Session 67)

### CORS (75 API endpoint files missing Access-Control-Allow-Origin on ~435 response instances)
| # | Issue | Status |
|---|-------|--------|
| 295 | **Codebase-wide CORS sweep** — 75 endpoint files across ach/, ai/, claims/, collection/, content-intelligence/, cop/, deception/, equilibrium-analysis/, frameworks/, hamilton-rule/, intelligence/, investigation-packets/, investigations/, tools/, web-scraper had `headers: { 'Content-Type': 'application/json' }` without `'Access-Control-Allow-Origin': '*'`. Applied global fix via sed. Cross-referenced with CLOUDFLARE_LESSONS_LEARNED.md lesson: "Return corsHeaders on ALL responses — including errors." | FIXED |

### PERFORMANCE (4 unbounded queries missing default LIMIT)
| # | Issue | Status |
|---|-------|--------|
| 296 | **relationships.ts** — GET query had optional LIMIT (only if param provided), no default. Users with large networks could exhaust D1 memory. Fixed: default `LIMIT 500` | FIXED |
| 297 | **actors.ts** — GET query had optional LIMIT, no default. Fixed: default `LIMIT 500` | FIXED |
| 298 | **deception/aggregate.ts** — MOM actors query (line 51) unbounded. Fixed: `LIMIT 500` | FIXED |
| 299 | **deception/aggregate.ts** — MOSES sources query (line 187) unbounded. Fixed: `LIMIT 500` | FIXED |

---

## Fixed — v0.17.3 (Session 67b)

### CRASH PREVENTION (38 null guard fixes on D1 .results.map/.forEach)
| # | Issue | Status |
|---|-------|--------|
| 300 | **Codebase-wide null guard sweep** — 38 instances of `result.results.map()` / `.forEach()` across API endpoints could crash with TypeError if D1 returns undefined results. Applied global fix: `(result.results \|\| []).map()`. Files: research/tasks/list, research/forms/list, research/evidence/list, research/submissions/list, framework-datasets, hamilton-rule, evidence, investigations/index, evidence/recommend (6), evidence-citations, equilibrium-analysis, framework-evidence, normalize-claims, extract-claim-entities, datasets, evidence-items (3), framework-entities, entity-usage (2), cop/public/[token] (2), cop/[id]/shares, cop/[id]/rfis (2), cop/[id]/hypotheses (2), cop/[id]/personas (3), cop/sessions, claims/index | FIXED |

### MEMORY LEAK (3 evidence components missing AbortController)
| # | Issue | Status |
|---|-------|--------|
| 301 | **EvidenceSelector.tsx** — useEffect fetch without AbortController. Fixed: signal + cleanup | FIXED |
| 302 | **EvidenceItemForm.tsx** — actors fetch without AbortController. Fixed: signal + cleanup | FIXED |
| 303 | **EvidenceRecommendations.tsx** — POST fetch without AbortController. Fixed: signal + cleanup | FIXED |

### PERFORMANCE (1 additional unbounded query)
| # | Issue | Status |
|---|-------|--------|
| 304 | **framework-datasets.ts** — First GET query (by framework_id) missing LIMIT. Fixed: `LIMIT 500` | FIXED |

---

## Fixed — v0.17.4 (Session 68)

### INFINITE LOOP (JSON.stringify in useEffect deps)
| # | Issue | Status |
|---|-------|--------|
| 305 | **EvidenceRecommendations.tsx** — `JSON.stringify(context)` in useEffect dependency array creates new string every render → infinite re-render loop. Fixed: extracted stable primitive keys (`context?.title`, `context?.description`, `context?.entities?.join(',')`, `context?.keywords?.join(',')`, `context?.timeframe?.start`, `context?.timeframe?.end`) | FIXED |

### MEMORY LEAK (9 components missing AbortController)
| # | Issue | Status |
|---|-------|--------|
| 306 | **CommentThread.tsx** — useEffect fetch without AbortController. Fixed: signal + cleanup | FIXED |
| 307 | **DatasetSelector.tsx** — useEffect fetch without AbortController (conditional on `open`). Fixed: signal + cleanup | FIXED |
| 308 | **ActivityFeed.tsx** — useEffect fetch without AbortController (deps: activityType, entityType, offset). Fixed: signal + cleanup | FIXED |
| 309 | **InviteAcceptPage.tsx** — useEffect fetch without AbortController (with auth redirect guard). Fixed: signal + cleanup | FIXED |
| 310 | **RelationshipForm.tsx** — useEffect search fetch without AbortController. Fixed: signal threaded through `searchEntities()` + cleanup | FIXED |
| 311 | **ACHEvidenceManager.tsx** — useEffect fetch without AbortController. Fixed: signal + cleanup | FIXED |
| 312 | **EntitySelector.tsx** — useEffect fetch without AbortController. Fixed: signal + cleanup | FIXED |
| 313 | **FrameworkUsagePanel.tsx** — useEffect fetch without AbortController. Fixed: signal + cleanup | FIXED |

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
| 36 | ~120 duplicate `corsHeaders` definitions | **NOT redundant** — CF middleware cannot reliably inject CORS into pre-set Response headers. Per-endpoint CORS is REQUIRED. Do not remove. |
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
