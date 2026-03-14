# Site Issues — Investigation Report

**Last updated:** 2026-03-14 (Sessions 34-40)

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

---

## Remaining Tech Debt

### Architecture (MEDIUM)
| # | Issue | Notes |
|---|-------|-------|
| 15 | Dual auth systems (`omnicore_user_hash` vs `omnicore_token`) | Consolidated to `getCopHeaders()` per F34 lesson, but two localStorage keys remain |
| 16 | `ensureUserHash()` creates hash locally but never registers in DB | Guest users can't own workspaces |
| 17 | ~22 COP mutation endpoints still use `getUserIdOrDefault` | All DELETE/session/share handlers hardened (S40). Remaining: markers, RFIs, hypotheses, claims, personas, intake-forms, evidence, sessions-list — lower risk (POST/PUT only, no destructive ops) |

### Code Quality (LOW)
| # | Issue | Notes |
|---|-------|-------|
| 20 | CreateWorkspaceDialog not internationalized | Hardcoded English strings |
| 22 | 112 `as any` casts in frontend | GenericFrameworkForm: 35 instances |
| 35 | ~129 dead `onRequestOptions` handlers across API files | Middleware handles CORS. LOW priority, risky to batch-remove (console.log incident) |
| 36 | ~120 duplicate `corsHeaders` definitions | Redundant with middleware. Same batch-removal risk |
| 37 | ~22 instances of internal `url.pathname.match()` routing | Dead code per Cloudflare Pages routing model |
| 40 | Dark mode gaps in COP components | CopPersonaLinkDialog, CopAssetDetailDrawer, CopEventSidebar, CopArtifactLightbox, CopStatusStrip — mostly hover states |
| 41 | Dark mode gaps in CopAnalysisSummary | ~14 color classes missing `dark:` variants — icons, badges, section headings, empty state text |

### Performance (LOW)
| # | Issue | Notes |
|---|-------|-------|
| 23 | CopMap chunk 1.0MB (Mapbox GL) | Consider lazy loading |
| 24 | 5 chunks > 300KB (exceljs, jspdf, pptxgen, viz-libs) | Lazy-load export libraries on demand |

### Dependencies (LOW — dev only)
| # | Issue | Notes |
|---|-------|-------|
| 25 | undici vulnerabilities via wrangler/miniflare | Dev-only, not in production bundle. Awaiting upstream fix. |
