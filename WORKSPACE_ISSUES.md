# Workspace API Issues — Investigation Report (2026-03-13)

## Issues Found & Fixed

### CRITICAL

| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 1 | **CreateWorkspaceDialog sends wrong POST body** — sends `{name,type}` but backend expects `{title, investigation_type, cop_template}`, always returns 400 | `src/components/workspace/CreateWorkspaceDialog.tsx` | FIXED |
| 2 | **settings/workspaces.ts queries nonexistent `user_hash` column** — `workspaces` table has no `user_hash`, all queries fail with D1 error | `functions/api/settings/workspaces.ts`, `functions/api/settings/workspaces/[id].ts` | FIXED |
| 3 | **workspace_members INSERT missing `id` field** — TEXT PRIMARY KEY omitted, D1 constraint violation on first workspace creation | `functions/api/workspaces/index.ts:143` | FIXED |

### SECURITY

| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 4 | **Members POST uses `getUserIdOrDefault`** — guest user (id=1) can add members to any workspace they happen to own | `functions/api/workspaces/[id]/members.ts` | FIXED |
| 5 | **Invites endpoints use `getUserIdOrDefault`** — unauthenticated users could list/create/revoke invites | `functions/api/workspaces/[id]/invites/index.ts`, `[inviteId].ts` | FIXED |

### UX / FRONTEND

| # | Issue | File(s) | Status |
|---|-------|---------|--------|
| 6 | **No error state on workspace fetch failure** — page shows misleading "No Workspaces" empty state instead of error | `src/pages/CollaborationPage.tsx` | FIXED |
| 7 | **Dark mode missing on role badges** — `getRoleColor()` had no `dark:` variants | `src/pages/CollaborationPage.tsx` | FIXED |
| 8 | **Invalid Tailwind class `bg-gray-750`** — not a standard class, silently ignored | `src/pages/CollaborationPage.tsx` | FIXED |
| 9 | **Build error: `exact` property on TABS union** — TypeScript TS2339 on mobile-bottom-tabs | `src/components/layout/mobile-bottom-tabs.tsx` | FIXED |

### TECH DEBT (not fixed — lower priority)

| # | Issue | File(s) | Notes |
|---|-------|---------|-------|
| 10 | Duplicated CORS headers — middleware already sets them, handler-level are dead code | All workspace API files | Middleware overwrites; cosmetic only |
| 11 | Duplicated `canManageInvites` function | `invites/index.ts`, `[inviteId].ts` | Should extract to shared util |
| 12 | `console.log` statements in workspace handlers | `workspaces/index.ts`, members, invites | Removed in POST handler; some remain in activity/notification loggers |
| 13 | CreateWorkspaceDialog not internationalized | `CreateWorkspaceDialog.tsx` | Hardcoded English strings |
| 14 | `formatExpiry()` uses hardcoded English | `CollaborationPage.tsx` | Should use `t()` |
| 15 | Dual auth systems (`omnicore_user_hash` vs `omnicore_token`) | CollaborationPage vs WorkspaceContext | Needs architectural decision |
| 16 | `ensureUserHash()` creates hash locally but never registers in DB | CollaborationPage, CreateWorkspaceDialog | Guest users will never have workspace ownership |

## Root Cause Analysis

The 400 error on `/api/workspaces` was caused by **Bug #1**: The `CreateWorkspaceDialog` component sends `{name, type}` in the POST body, but the unified workspace creation endpoint expects `{title, investigation_type, cop_template}`. The backend validates these required fields and returns 400 when they're missing. The GET endpoint works correctly (returns empty arrays for guests).
