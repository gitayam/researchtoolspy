# Site Issues — Investigation Report

**Last updated:** 2026-03-13 (Session 34-35)

## Fixed — v0.13.0 (Session 34)

### CRITICAL
| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 1 | **CreateWorkspaceDialog sends wrong POST body** — sends `{name,type}` but backend expects `{title, investigation_type, cop_template}`, always returns 400 | `src/components/workspace/CreateWorkspaceDialog.tsx` | FIXED |
| 2 | **settings/workspaces.ts queries nonexistent `user_hash` column** — `workspaces` table has no `user_hash`, all queries fail with D1 error | `functions/api/settings/workspaces.ts`, `settings/workspaces/[id].ts` | FIXED |
| 3 | **workspace_members INSERT missing `id` field** — TEXT PRIMARY KEY omitted, D1 constraint violation on first workspace creation | `functions/api/workspaces/index.ts` | FIXED |

### SECURITY
| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 4 | **Workspace members/invites used `getUserIdOrDefault`** — guest user could mutate workspace data | members.ts, invites/*.ts | FIXED |
| 5 | **No error state on workspace fetch failure** — misleading "No Workspaces" empty state | `CollaborationPage.tsx` | FIXED |

### UX
| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 6 | Dark mode missing on role badges | `CollaborationPage.tsx` | FIXED |
| 7 | Invalid Tailwind class `bg-gray-750` | `CollaborationPage.tsx` | FIXED |
| 8 | Build error: `exact` on TABS union (TS2339) | `mobile-bottom-tabs.tsx` | FIXED |

---

## Fixed — v0.13.1 (Session 35)

### SECURITY (OWASP A01 — Information Disclosure)
| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 9 | **error.message leaked to clients** in 7 endpoints — exposes internal stack traces | collection/start, research/generate-question, research/recommend-questions, ach/share, content-intelligence/analyze-url, ai/generate-timeline, ai/generate-questions | FIXED |
| 10 | **`getUserIdOrDefault` on mutation endpoints** — unauthenticated users could create relationships, run hamilton-rule, start collections | relationships.ts, hamilton-rule.ts, collection/start.ts | FIXED |

### CLEANUP
| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 11 | **391 `console.log` statements removed** across 58 API files — production code should not leak debug info to Worker logs | All `functions/api/` | FIXED |

---

## Remaining Tech Debt (lower priority)

### Architecture
| # | Issue | Notes | Priority |
|---|-------|-------|----------|
| 12 | Dual auth systems (`omnicore_user_hash` vs `omnicore_token`) | CollaborationPage vs WorkspaceContext use different auth mechanisms | MEDIUM |
| 13 | `ensureUserHash()` creates hash locally but never registers in DB | Guest users will never have workspace ownership | MEDIUM |
| 14 | 30+ mutation endpoints have NO auth at all | Many are intentionally public (tools, research forms) — needs per-endpoint audit to determine which should require auth | MEDIUM |
| 15 | 11 hardcoded `user_id = 1` / `created_by || 1` fallbacks | evidence.ts, datasets.ts, evidence-items.ts, framework-*.ts, etc. | MEDIUM |

### Code Quality
| # | Issue | Notes | Priority |
|---|-------|-------|----------|
| 16 | Duplicated CORS headers — middleware already sets them | Handler-level corsHeaders are dead code | LOW |
| 17 | Duplicated `canManageInvites` in invites/*.ts | Should extract to shared util | LOW |
| 18 | CreateWorkspaceDialog not internationalized | Hardcoded English strings | LOW |
| 19 | `formatExpiry()` uses hardcoded English | Should use `t()` | LOW |
| 20 | 112 `as any` casts in frontend (GenericFrameworkForm: 35) | Hide type bugs | LOW |

### Performance
| # | Issue | Notes | Priority |
|---|-------|-------|----------|
| 21 | CopMap chunk 1.0MB (Mapbox GL) | Legitimate dependency, consider lazy loading | LOW |
| 22 | 5 chunks > 300KB (exceljs, jspdf, pptxgen, viz-libs, index) | Export libraries — could lazy-load on demand | LOW |
