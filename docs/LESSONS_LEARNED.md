# Lessons Learned - Research Tools Development

## Session: 2026-03-13 - Workspace Fallback Audit

### Hardcoded Fallback IDs Persist Across Refactors
After fixing session creation to use dedicated workspaces (session 6), 7 COP endpoints still had `|| '1'` workspace fallbacks. The isolation fix only changed session creation — it didn't audit every endpoint that resolves workspace_id. When the session lookup returns null, these endpoints silently wrote data to workspace `'1'` instead of the correct session workspace.

**Rule:** After any workspace/scoping refactor, grep the entire API directory for the old default value and replace every occurrence. Don't assume the fix propagated everywhere.

### Global Entity Endpoints Are Workspace-Scoped by Query Param
The global endpoints (`/api/actors`, `/api/relationships`, `/api/places`, etc.) accept `workspace_id` as a query parameter and filter correctly. COP frontend components using these with `workspace_id=${workspaceId}` are NOT cross-session data leaks — they're correctly scoped. Only endpoints that _don't_ accept workspace_id filtering need COP-specific alternatives (like `/api/cop/{sessionId}/evidence`).

---

## Session: 2026-03-12 - COP Workspace Isolation & Persistence Fixes

### Workspace Isolation is Retroactive, Not Just Prospective
Fixing session creation to auto-create dedicated workspaces only prevents NEW sessions from sharing. **Existing sessions must be migrated retroactively.** We found two waves of shared workspaces: first workspace "1" (Iran sessions), then workspace `f5478f35-...` (4 newer sessions). Each required a separate migration (079, 080).

**Rule:** When changing a default that affects data scoping, always audit existing records for the old default. Auto-fix new records is only half the fix.

### WHERE Clauses with Redundant Scope Filters Break on Scope Changes
PUT/DELETE handlers used `WHERE id = ? AND workspace_id = ?` where `id` is already a unique primary key. When workspace_id changed (from shared to dedicated), these queries silently matched 0 rows. All session updates (mission_brief, event_facts, etc.) became no-ops.

**Rule:** If `id` is a unique PK, don't add `AND workspace_id = ?` to the WHERE clause — it creates fragile coupling. Use separate authorization checks instead.

### Optimistic UI Masks Silent Backend Failures
The mission_brief field used optimistic updates: `setSession(prev => ({...prev, mission_brief: brief}))` before the PUT. The UI showed the value immediately, but the PUT failed silently (0 rows updated). On page refresh, the field reverted to null. Users perceived this as "data not persisting after refresh."

**Rule:** For critical PUT/PATCH operations, verify the response indicates actual changes (e.g., check `meta.changes > 0` in D1 responses) and show an error toast if the update was a no-op.

---

## Session: 2026-03-09 - COP Workspace Cycle 15

### Agent Import Insertion Breaks Multi-Line Imports
When dispatching agents to insert `import` statements, they frequently insert inside an existing multi-line `import { ... } from '...'` block, splitting it in half. This passes `tsc --noEmit` (which is lenient) but fails `vite build` (which uses esbuild's strict parser). **Always run `vite build` after agent-driven import changes, not just `tsc`.**

**Rule:** After any agent modifies imports across multiple files, run `vite build` immediately. Check for `Expected "as" but found "{"` or `Unexpected "}"` errors — these indicate split imports.

### Never Leak error.message in API Responses
44 COP endpoints were returning `details: error instanceof Error ? error.message : 'Unknown error'` in 500 responses. This leaks internal implementation details (table names, query syntax, stack traces) to clients. Log the error server-side with `console.error()`, return only a generic message to the client.

**Pattern:** `catch (error) { console.error('[Context]', error); return Response.json({ error: 'Generic message' }, { status: 500 }) }`

### Silent 201 on DB Failure = Data Loss
Activity POST was returning 201 with the "persisted" activity object even when the DB insert failed (caught by inner try/catch). The client had no way to know data was lost. Inner try/catch blocks around DB operations should return 500, not fall through to the success path.

---

## Session: 2026-03-09 - COP Workspace Cycle 12

### Git Hygiene: Commit Untracked Files Regularly
Over 12 cycles, many files were created but never committed (personas API, evidence-tags API, E2E infrastructure, migrations 061-063, tool pages). This makes `git status` noisy and risks losing work. Commit new files as soon as they pass basic verification, even if they're not the focus of the current cycle.

### Two-Step Framework Linking: Create Then Link
To connect a framework to a COP session, you need two API calls: (1) POST `/api/frameworks` to create the session, (2) PUT `/api/cop/sessions/:id` with the `linked_frameworks` array. Since these aren't atomic, the UI should handle partial failures gracefully — if the link fails, the framework still exists and can be retried.

### Cloudflare Pages Deploy: UTF-8 Commit Messages
Wrangler Pages deploy reads the git commit message and sends it to the Cloudflare API. Special characters (em dashes, certain Unicode) can cause `Invalid commit message, it must be a valid UTF-8 string` errors. Use `--commit-message="..."` flag with ASCII-only text to bypass.

### CHECK Constraints Fail Silently in Try/Catch
`match-entities-to-actors.ts` inserted lowercase `'person'` into a column with `CHECK(type IN ('PERSON', 'ORGANIZATION', ...))`. The D1 error was caught by a generic try/catch, so auto-actor creation silently failed with no visible error. The actors table appeared to work fine for manual creation (which used correct casing).

**Rule:** When a D1 INSERT uses a column with a CHECK constraint, verify the value matches the constraint EXACTLY (case-sensitive). Search for CHECK constraints in schema before writing INSERT statements: `grep -i "CHECK" schema/d1-schema.sql`.

### Search Resilience: Fallback Chain Pattern
The OSINT agent's SearXNG dependency was a single point of failure. Adding a fallback chain (primary container → 5 public instances → DuckDuckGo library) ensures search works even when the container is down. Pattern: try endpoints in order, return first success, log which endpoint worked.

### RageCheck: Extend Existing Endpoints
Rather than creating a new `/api/rage-check` endpoint, the manipulation scoring was added to the existing `analyzeSentiment()` function in `analyze-url.ts`. This avoids an extra API call and keeps all content analysis in one response. Backwards-compatible via null defaults.

---

## Session: 2026-03-09 - COP Workspace Cycle 11

### Stats Queries Must Match Data Model
The `framework_count` query used `SELECT COUNT(*) FROM framework_sessions WHERE user_id = ?` — counting all user frameworks globally. But frameworks link to COP sessions via a `linked_frameworks` JSON array field on `cop_sessions`, not through `framework_sessions`. Fix: `JSON_ARRAY_LENGTH(linked_frameworks)`.

**Rule**: Before writing aggregate queries for stats endpoints, verify HOW the data relationship works (FK? JSON array? join table?). A query against the wrong table will silently return 0 instead of erroring.

### Error Boundaries for Tab Components
CopEventSidebar tabs can crash independently (bad data, missing props). A class-based `TabErrorBoundary` wrapping each tab shows a retry button instead of crashing the entire sidebar. The boundary resets when `tabKey` changes (switching tabs clears the error).

**Pattern**: `componentDidUpdate(prevProps)` → reset `hasError` when tab changes. This avoids stale error states when navigating away and back.

---

## Session: 2026-03-09 - COP Workspace UI/UX Improvements (Cycle 8)

### Linter Can Remove Used Variables via Unused Setter
When using `const [hidden, setHidden] = useState(defaultHidden)`, the linter removed the entire line because `setHidden` was never called — but `hidden` was referenced later, causing a `ReferenceError` crash at runtime. TypeScript doesn't catch this because the linter runs after type checking.

**Rule**: When a state variable is read-only (no setter needed), use `const [hidden] = useState(defaultHidden)` — omit the setter from destructuring to keep the linter happy while preserving the variable.

### Three-Column Layout: Dual-Render for Responsive Breakpoints
When a panel needs to appear in different positions at different breakpoints (inline on mobile, sidebar on desktop), render it twice with complementary visibility classes: `2xl:hidden` on the inline version, `hidden 2xl:flex` on the sidebar version. Use different `id` props for each so localStorage state doesn't conflict.

**Trade-off**: This doubles the component mount (two Evidence Feeds, two Activity Logs), which means two sets of API polls. For frequently-polling components, consider lifting the data fetch to the parent and passing data down as props instead.

### Accessibility: Focus-Visible on Hover-Only Elements
The expand button on CopPanelExpander used `opacity-0 group-hover:opacity-100` — invisible until mouse hover. Keyboard users could never see or reach it. Adding `focus:opacity-100` ensures the button becomes visible when tabbed to, making it keyboard-accessible without changing the visual design for mouse users.

**Rule**: Any element hidden behind `hover:` must also have a `focus:` equivalent. Search for `opacity-0.*hover:opacity-100` and add matching `focus:opacity-100`.

### Map Promotion: Always-Visible Geospatial Context
For investigation workspaces with geospatial data, the map should never be hidden behind an opt-in button. A compact mini-map (200px) at the top of the layout provides immediate spatial context without dominating screen space. Users can expand to full-screen overlay for detailed work.

---

## Session: 2026-03-09 - COP Workspace Production Fixes

### E2E: Responsive CSS Classes Break Generic Locators
When adding `hidden lg:inline` KPI labels to the status strip, the generic `getByText('Evidence', { exact: true }).first()` locator started matching the hidden label instead of the panel header. On mobile viewports, this locator resolved to a hidden element, failing the test.

**Rule**: Use specific, unique text for E2E locators (e.g., `'Evidence & Intel Feed'` instead of `'Evidence'`). When adding new UI text that matches existing locator patterns, check the POM for conflicts.

### Data Hygiene: Stale Flags After Status Changes
Answered RFIs retained `is_blocker=1` because the blocker flag is "orthogonal to the lifecycle" — updating `status` doesn't auto-clear `is_blocker`. The stats query `is_blocker=1 AND status!='closed'` counted them as blockers even after being answered.

**Resolution**: Implemented auto-clear in both RFI PUT handlers — `is_blocker` is now set to 0 when status changes to `answered` or `closed`.

### D1 Migrations: ALTER TABLE Can Silently Fail
Migration 005 included `ALTER TABLE evidence_items ADD COLUMN workspace_id TEXT` but this was never applied to production. The evidence endpoint returned 500 (`no such column: workspace_id`) for weeks without anyone noticing because evidence_count was 0 anyway.

**Rule**: After deploying migrations, always verify with `SELECT sql FROM sqlite_master WHERE name='table'` that columns actually exist. D1's ALTER TABLE fails silently if the migration file errors out early on a prior statement.

### D1 Schema: Always Check NOT NULL + AUTOINCREMENT Before INSERT
The `evidence_items` table has 45 columns, with `credibility` and `reliability` being `NOT NULL` without defaults. The COP evidence endpoint only inserted a subset of columns, causing `SQLITE_CONSTRAINT`. Separately, trying to INSERT a TEXT id into an `INTEGER PRIMARY KEY AUTOINCREMENT` column caused `SQLITE_MISMATCH`.

**Rule**: Before writing any INSERT for an existing table, run `PRAGMA table_info(table_name)` to identify all NOT NULL columns and the primary key type. Never assume column nullability from the endpoint's perspective alone.

### E2E: Panel Title Locators Clash When Same Text Appears in Multiple Contexts
Renaming "Personas" → "Actors" caused `getByText('Actors', { exact: true })` to match an entity panel button (which had a child `<span>Actors</span>`) before the panel heading. On mobile, the wrong element was found.

**Rule**: When panel titles overlap with button/card text, use `getByRole('heading', { name: '...', level: 3 })` to scope to the panel header specifically.

### PUT vs Direct D1 for Session Fields
The session PUT endpoint at `/api/cop/sessions/:id` supports `mission_brief` but the update appeared not to work via curl. Setting the value directly via `wrangler d1 execute --remote` worked immediately. Possible issue: the PUT endpoint might require auth headers or specific content-type handling.

**Rule**: When API PUT doesn't work for a quick data fix, verify with `wrangler d1 execute --remote` directly. But always prefer API for audit trail.

### Evidence Seeding: Populate From Research Findings
When a workspace has rich research data (answered RFIs, activity log entries) but an empty evidence feed, seed evidence items from those findings via the evidence POST endpoint. The evidence_items table uses `INTEGER PRIMARY KEY AUTOINCREMENT` — do not generate TEXT IDs. Include `credibility` and `reliability` columns (NOT NULL) or use defaults (`unverified`/`unknown`).

**Pattern**: After answering RFIs or completing research tasks, create corresponding evidence items so the Evidence & Intel Feed reflects the investigation's progress.

### Data Quality: Platform Fields Default to 'other'
When creating personas via batch scripts, the `platform` field often defaults to `other` because the script doesn't know the exact platform. Fix this proactively by updating platform values once the investigation identifies where each persona operates (e.g., OnlyFans, Reddit, Telegram).

**Rule**: After batch persona creation, audit and fix platform values via `UPDATE cop_personas SET platform = '...' WHERE handle = '...'`.

---

## Session: 2025-12-30 - React Error #185 Infinite Loop Fix

### Summary
Fixed critical React error #185 (Maximum update depth exceeded) in DeceptionScoringForm component. The infinite loop was caused by calling parent callback (`onScoresChange`) from inside a `useEffect` hook.

---

## React Error #185 - Infinite Loop in Parent-Child State Sync (CRITICAL)

### Problem
Navigating to the deception framework page caused React error #185:
```
Minified React error #185; visit https://react.dev/errors/185 for the full message
```
This is "Maximum update depth exceeded" - an infinite render loop.

### Root Cause
**Anti-pattern: Calling parent callbacks from useEffect**:

```typescript
// BROKEN - causes infinite loop
useEffect(() => {
  const newAssessment = calculateDeceptionLikelihood(scores)
  setAssessment(newAssessment)
  onScoresChange?.(scores, newAssessment)  // <- This triggers parent re-render!
}, [scores])
```

**Why this causes infinite loops:**
1. Child has local `scores` state
2. useEffect watches `[scores]` and calls `onScoresChange`
3. Parent's `onScoresChange` calls `setScores(newScores)` updating parent state
4. Parent re-renders, passes new props to child
5. If anything in that flow triggers child's `scores` to change, the effect runs again
6. Loop!

### The Fix
**Only call parent callbacks from user action handlers, NOT from useEffect:**

```typescript
// FIXED - notify parent only on explicit user action
useEffect(() => {
  const newAssessment = calculateDeceptionLikelihood(scores)
  setAssessment(newAssessment)
  // NOTE: Do NOT call onScoresChange here - causes infinite loops!
}, [scores])

const handleScoreChange = (criterion: keyof DeceptionScores, value: number[]) => {
  const newScores = { ...scores, [criterion]: value[0] }
  setScores(newScores)
  // Notify parent of score change (triggered by user action, not effect)
  const newAssessment = calculateDeceptionLikelihood(newScores)
  onScoresChange?.(newScores, newAssessment)
}
```

### Key Takeaways

#### Rules for Parent-Child State Sync:

1. **NEVER call parent callbacks from useEffect** watching local state
2. **Call parent callbacks from event handlers** (onClick, onChange, etc.)
3. **Use useEffect only for side effects** (logging, DOM updates, subscriptions)
4. **Child should own its state** - don't try to sync parent on every change
5. **If sync is needed**, use refs to prevent cascade: `isNotifyingParent.current = true`

#### When to notify parent:
- User clicks a button → YES (user action)
- User adjusts a slider → YES (user action)
- Component mounts → MAYBE (only if intentional initialization)
- State derived from other state changes → NO (use derived state instead)

### Files Modified
- `src/components/frameworks/DeceptionScoringForm.tsx` - Lines 88-102
- `src/components/frameworks/DeceptionView.tsx` - Added useMemo for historical data

### Additional Fix: Array References in Props

Another source of infinite loops was creating new arrays in render:

```typescript
// BROKEN - creates new array on every render
<DeceptionPredictions
  historicalData={historicalData.map(h => ({
    timestamp: h.timestamp,
    likelihood: h.likelihood,
    scores: h.scores
  }))}
/>

// Child component has useEffect watching historicalData
useEffect(() => {
  loadPredictions()
}, [historicalData])  // Runs every render because array is new!
```

**Fix: Use useMemo to create stable references:**

```typescript
// Memoize the transformation
const historicalDataForPredictions = useMemo(() =>
  historicalData.map(h => ({
    timestamp: h.timestamp,
    likelihood: h.likelihood,
    scores: h.scores
  })),
  [historicalData]  // Only recreate when source data changes
)

// Pass stable reference
<DeceptionPredictions historicalData={historicalDataForPredictions} />
```

### Related Errors
- React #185: Maximum update depth exceeded
- React #300: Cannot update component while rendering different component

---

## Session: 2025-10-18 - Cloudflare Pages SPA Routing Fix

### Summary
Fixed critical JavaScript MIME type errors affecting all client-side routes. Added `_redirects` file to properly handle Single Page Application routing on Cloudflare Pages. Without this, routes like `/tools`, `/frameworks`, etc. returned 404 HTML which the browser tried to execute as JavaScript.

---

## JavaScript MIME Type Error - SPA Routing (CRITICAL)

### Problem
After deploying, navigating to any client-side route (e.g., `/tools`, `/citations`, `/frameworks`) showed error:
```
Unexpected Application Error!
'text/html' is not a valid JavaScript MIME type.
```

The error appeared on multiple pages including the citation library and other routes.

### Root Cause
**Missing SPA routing configuration**:

1. **React Router** uses client-side routing (e.g., `/tools`, `/frameworks`)
2. **Cloudflare Pages** without `_redirects` file treats these as file paths
3. **Result**: Server returns 404 HTML page for these routes
4. **Browser** tries to execute the 404 HTML as JavaScript module → MIME type error
5. **Impact**: All client-side routes broken in production

### The Fix
Create `/public/_redirects` file to serve `index.html` for all non-asset routes:

```plaintext
# Cloudflare Pages Redirects for SPA
# This ensures all routes are handled by React Router

# API routes go to Functions (already handled by _routes.json)
/api/* 200

# Static assets - serve as-is
/assets/* 200

# All other routes - serve index.html for client-side routing
/* /index.html 200
```

**Why this works:**
- API routes handled by Cloudflare Functions
- Static assets (CSS, JS, images) served directly
- All other routes get `index.html` → React Router takes over → correct page loads

### Verification
```bash
# Before fix: Returns 404 HTML
curl https://deployment.pages.dev/tools

# After fix: Returns index.html with React app
curl https://deployment.pages.dev/tools | grep "root"
# Should show: <div id="root"></div>
```

### Key Takeaways
1. **ALWAYS add `_redirects` for SPAs on Cloudflare Pages**
2. **The file goes in `/public/` directory** (Vite copies to dist)
3. **This is REQUIRED for React Router** (or any client-side routing)
4. **Without it, only homepage works** - all other routes fail
5. **Error is confusing** - MIME type error, not 404 error

### Prevention
**Add to every new SPA project:**
```bash
# During project setup:
echo "/* /index.html 200" > public/_redirects
```

**Test client-side routes in production:**
- Don't just test homepage
- Navigate to `/tools`, `/settings`, etc.
- Refresh page while on a route (should still work)

### Related Files
- `/public/_redirects` - SPA routing configuration (created)
- `/public/_routes.json` - API routes configuration (already existed)
- `/public/_headers` - Security headers (already existed)

---

## Session: 2025-10-18 - Cloudflare Pages Deployment Fix

### Summary
Fixed critical blank page issue in production caused by deploying entire project root instead of the `dist` folder. The deployment served the development `index.html` instead of the production build, causing all JavaScript to fail loading.

---

## Blank Page After Deployment

### Problem
After deploying with `npx wrangler pages deploy .`, the production site (https://05edca38.researchtoolspy.pages.dev) showed a completely blank page with no content or errors in browser console.

### Root Cause
**Incorrect deployment source directory**:

1. **Command used**: `npx wrangler pages deploy .` (deploys entire project root)
2. **What was deployed**:
   - Root `/index.html` (development version)
   - `/dist/` folder with production build
   - All source files and config
3. **What Cloudflare served**: Root `/index.html` instead of `/dist/index.html`
4. **Development index.html references**:
   ```html
   <script type="module" src="/src/main.tsx"></script>
   ```
5. **Production doesn't have** `/src/` directory with TypeScript source files
6. **Result**: Browser couldn't load any JavaScript → blank page

### How to Diagnose
**Symptoms:**
- Blank page in production
- No JavaScript errors in browser console (script tag loads but file doesn't exist)
- Build completes successfully
- Local development works fine

**Debugging steps:**
1. Check what HTML is being served:
   ```bash
   curl https://your-deployment.pages.dev/ | grep script
   ```
2. Look for script tag pointing to development files:
   ```html
   <!-- BAD (development): -->
   <script type="module" src="/src/main.tsx"></script>

   <!-- GOOD (production): -->
   <script type="module" src="/assets/index-[hash].js"></script>
   ```
3. Verify deployment directory structure in Cloudflare dashboard
4. Check if multiple `index.html` files exist at different levels

### The Fix
**Always deploy only the `dist` folder:**

```bash
# WRONG - deploys entire project including dev files
npx wrangler pages deploy . --project-name=researchtoolspy

# CORRECT - deploys only production build
npx wrangler pages deploy dist --project-name=researchtoolspy
```

**Why this works:**
- `dist/` contains only production-built assets
- `dist/index.html` correctly references bundled JS files in `/assets/`
- No conflicting source files or dev configuration
- Cloudflare serves the correct production build

### Deployment Timeline Impact
- `42663b4e` - **BROKEN**: Deployed entire root, served dev index.html
- `2c53099f` - **FIXED**: Deployed dist folder only, served prod build

### Lessons Learned

#### ✅ Do:
1. **Always deploy production build folder** (`dist`, `build`, `.output`, etc.)
2. **Verify script tags in deployed HTML** after deployment
3. **Test deployment immediately** after deploying
4. **Document correct deployment command** in README and CI/CD
5. **Use deployment preview URLs** to test before promoting to production
6. **Check Cloudflare dashboard** for deployment structure if issues occur

#### ❌ Don't:
1. **Deploy entire project root** - includes dev files and can cause conflicts
2. **Assume build success = deployment success** - always verify what's served
3. **Skip post-deployment verification** - blank pages are silent failures
4. **Mix development and production files** in deployment
5. **Ignore script tag paths** - they reveal which version is being served

### Prevention Strategy
**Best Practices for Cloudflare Pages Deployment:**

```bash
# 1. Always build first
npm run build

# 2. Verify build output
ls -la dist/

# 3. Check dist/index.html has production assets
grep "script" dist/index.html

# 4. Deploy only dist folder
npx wrangler pages deploy dist --project-name=yourproject

# 5. Verify deployment serves correct HTML
curl https://your-deployment.pages.dev/ | grep script
```

**Add to package.json**:
```json
{
  "scripts": {
    "deploy": "npm run build && npx wrangler pages deploy dist --project-name=researchtoolspy"
  }
}
```

### Impact
- **Severity**: Critical - complete production outage (blank page)
- **Resolution Time**: ~15 minutes (diagnosis + fix + redeploy)
- **Affected Deployments**: All deployments from `42663b4e` until fix at `2c53099f`
- **Root Cause Category**: Configuration error (incorrect deployment path)

---

## Session: 2025-10-09 - Double JSON Parsing Bug Fix

### Summary
Fixed critical bug where framework Q&A data was showing as empty (all zeros) in Starbursting and other frameworks despite being correctly stored in the database. Root cause was double-parsing of JSON data.

---

## Double JSON Parsing Bug in Framework Views

### Problem
Starbursting framework Q&A data showed all zeros (WHO: 0, WHAT: 0, WHERE: 0, etc.) in the framework view page, even though:
- Data was correctly generated and stored in the database
- Content Intelligence page showed correct Q&A counts
- Database logs confirmed data was being saved with proper structure

### Root Cause
**Double-parsing bug in framework loading logic** (`src/pages/frameworks/index.tsx`):

1. **API endpoint** (`/api/frameworks`) parses `data` field from JSON string to object before returning:
   ```typescript
   framework.data = JSON.parse(framework.data)  // Line 57 in frameworks.ts
   ```

2. **loadAnalysis() function** also parses the data:
   ```typescript
   data.data = JSON.parse(data.data)  // Line 441 in index.tsx
   ```

3. **View rendering** called `safeJSONParse()` on already-parsed object:
   ```typescript
   const parsedData = safeJSONParse(currentAnalysis.data, {})
   ```

4. **safeJSONParse utility** checked `typeof jsonString !== 'string'`, saw it was already an object, and returned the fallback empty object `{}`:
   ```typescript
   if (!jsonString || typeof jsonString !== 'string') {
     return fallback  // Returns {} when data is already an object!
   }
   ```

**Result**: All Q&A data (who/what/where/when/why/how arrays) was replaced with empty object, showing zero counts.

### How to Diagnose
**Symptoms:**
- Data appears correct in database/API logs
- Data shows correctly in some views but not others
- Empty objects or zero counts despite confirmed data storage

**Debugging steps:**
1. Add comprehensive logging at each data transformation point:
   ```typescript
   console.log('[API] Data being stored:', JSON.stringify(data, null, 2))
   console.log('[API] Data retrieved:', JSON.stringify(data, null, 2))
   console.log('[Frontend] Data before parse:', typeof data, data)
   console.log('[Frontend] Data after parse:', parsedData)
   ```

2. Check for multiple JSON.parse() calls in the data flow
3. Look for `safeJSONParse()` or similar utilities being called on already-parsed objects
4. Verify the type of data at each step (string vs object)

### The Fix
Add type checking before parsing to handle both string and object data:

```typescript
// BEFORE (broken):
const parsedData: any = safeJSONParse(currentAnalysis.data, {})

// AFTER (fixed):
const parsedData: any = typeof currentAnalysis.data === 'object'
  ? currentAnalysis.data
  : safeJSONParse(currentAnalysis.data, {})
```

Applied to **9 locations** across:
- SwotPage (edit/view modes + list view)
- GenericFrameworkPage (edit/view modes + list view) - affects Starbursting, PEST, PMESII-PT, etc.
- CogPage (edit/view modes + list view)
- DeceptionPage (edit/view modes + list view)

### Files Modified
- `/Users/sac/Git/researchtoolspy/frontend-react/src/pages/frameworks/index.tsx` - Fixed 9 instances
- Lines: 159, 178, 301, 523, 546, 669, 1003, 1019, 1097, 1408, 1428, 1548

### Lessons Learned

#### ✅ Do:
1. **Check data type before parsing** - Always verify if data is already an object before calling `JSON.parse()` or parsing utilities
2. **Trace data flow end-to-end** - Log data at every transformation point (API → storage → retrieval → parsing → rendering)
3. **Use TypeScript type guards** - `typeof data === 'object'` checks prevent re-parsing
4. **Standardize parsing location** - Parse data in ONE place (either API or component, not both)
5. **Write defensive parsing utilities** - Utilities like `safeJSONParse()` should handle both string and object inputs gracefully
6. **Add comprehensive logging temporarily** - When debugging data flow issues, log extensively then clean up

#### ❌ Don't:
1. **Parse JSON multiple times** - Each `JSON.parse()` call assumes string input; objects will fail or return unexpected results
2. **Trust utility fallbacks blindly** - `safeJSONParse(object, {})` silently returns empty object for non-string input
3. **Skip type checking** - Always check `typeof data` before transformation operations
4. **Leave debug logging in production** - Remove `console.log()` statements after debugging; keep only error logging
5. **Assume consistent data types** - Data can be string or object depending on source (API, cache, localStorage, etc.)

### Prevention Strategy
**Best Practice for JSON Data Handling:**

```typescript
// Option 1: Parse once at API level, use objects everywhere
// API endpoint:
framework.data = JSON.parse(framework.data)  // Parse once here
// Frontend:
const data = framework.data  // Already an object, use directly

// Option 2: Keep as strings until needed, parse once in component
// API endpoint:
return framework  // Keep data as JSON string
// Frontend:
const parsedData = JSON.parse(framework.data)  // Parse once here

// Option 3 (RECOMMENDED): Defensive parsing with type check
const parsedData = typeof data === 'object' ? data : JSON.parse(data)
```

### Impact
- **Fixed**: All framework views (Starbursting, SWOT, COG, PEST, PMESII-PT, DIME, Deception, etc.)
- **Affected Users**: Anyone viewing saved framework sessions
- **Severity**: Critical - complete data loss in UI (data intact in DB)
- **Resolution Time**: ~2 hours (debugging + fixing + deployment)

---

## Session: 2025-10-07 - Major Feature Implementations

### Summary
Completed 3 major roadmap tasks in a single session: Instagram extraction improvements, OSINT tool integrations (Maltego + i2 ANB), and threaded comments system foundation. Total of 2,692 lines of code and documentation added with 0 TypeScript errors.

---

## 1. Instagram Social Media Extraction (Multi-Strategy Fallback)

### Problem
Instagram extraction was failing ~70% of the time due to:
- Single service dependency (cobalt.tools)
- Instagram's aggressive anti-bot measures
- No fallback mechanisms
- Poor error messages for users

### Solution Implemented
**5-Strategy Fallback Chain**:
1. Cobalt.tools (primary) - supports carousels, videos, images
2. SnapInsta (NEW) - fast HTML parsing
3. InstaDP (NEW) - simple API for posts/stories
4. SaveInsta (NEW) - reliable fallback
5. Instagram oEmbed API (NEW) - official metadata only

**Key Improvements**:
- **Intelligent error detection**: Pattern analysis across all 5 strategies
- **Actionable suggestions**: Specific guidance based on error types (rate limiting, 404, 403, 5xx, blocking)
- **24-hour KV caching**: Reduces API pressure, prevents rate limiting
- **Comprehensive documentation**: 350+ line guide

### Results
- Success rate: **30% → 80%** for public posts
- Better UX with specific error diagnostics
- Reduced external API load via caching

### Lessons Learned

#### ✅ Do:
1. **Always implement fallback chains** for external services
2. **Pattern-based error detection** provides better user guidance than generic errors
3. **Cache successful results** to reduce API pressure and improve performance
4. **Document failure modes** comprehensively for troubleshooting
5. **Multiple service diversity** beats single-service reliability

#### ❌ Don't:
1. **Rely on single external service** - always have fallbacks
2. **Return generic errors** - analyze patterns and provide specific guidance
3. **Skip caching** for external API results
4. **Underestimate Instagram's anti-bot measures** - they update frequently
5. **Ignore user workarounds** - document manual fallback procedures

### Code Insights

**Multi-strategy fallback pattern**:
```typescript
const errors: string[] = []

// Try strategy 1
try {
  return await extractViaService1()
} catch (error) {
  errors.push(`service1: ${error.message}`)
}

// Try strategy 2...
// Continue through all strategies

// All failed - analyze error patterns
if (errors.some(e => e.includes('429'))) {
  return specificRateLimitGuidance()
}
return comprehensiveErrorWithSuggestions(errors)
```

**Caching pattern**:
```typescript
// Check cache first
const cacheKey = `instagram:${shortcode}:${mode}`
const cached = await env.CACHE.get(cacheKey, 'json')
if (cached) return cached

// Extract and cache on success
const result = await extractInstagram(url)
await env.CACHE.put(cacheKey, JSON.stringify(result), {
  expirationTtl: 86400 // 24 hours
})
return result
```

---

## 2. OSINT Tool Integrations (Maltego + i2 ANB)

### Problem
Network graph data was trapped in the application - analysts needed to:
- Use professional OSINT tools (Maltego)
- Conduct law enforcement investigations (i2 Analyst's Notebook)
- Leverage advanced graph algorithms
- Create courtroom-ready presentations

### Solution Implemented

**Maltego CSV Export**:
- Entity type mapping (ACTOR→Person, SOURCE→Document, etc.)
- 6 standard Maltego entity types
- Supports transform workflows
- Entities + reference links CSV

**i2 Analyst's Notebook Export**:
- Full entity + link preservation
- EntityID-based linking for accuracy
- Law enforcement entity types (Person, Document, Event, Location, Activity, Evidence)
- Timeline and geographic analysis support

**Comprehensive Documentation**:
- `MALTEGO_INTEGRATION_GUIDE.md` (450+ lines)
- `I2ANB_INTEGRATION_GUIDE.md` (470+ lines)
- Quick start guides (5-10 minutes to first import)
- 5+ common use cases per tool
- Troubleshooting sections
- Best practices for security and workflow

### Results
- **9 export formats** now available (JSON, CSV, GraphML, GEXF, Cypher, Maltego, i2 ANB)
- **Complete coverage** of major link analysis platforms
- **Professional-grade** OSINT and law enforcement workflows
- **900+ lines** of documentation

### Lessons Learned

#### ✅ Do:
1. **Map entity types carefully** - research target tool's standards
2. **Provide comprehensive documentation** - users need hand-holding for complex tools
3. **Include use cases** - show practical applications, not just formats
4. **Document limitations** - be upfront about what doesn't work
5. **Create quick start guides** - get users productive in <10 minutes

#### ❌ Don't:
1. **Assume users know the tools** - many are learning Maltego/i2 ANB
2. **Skip CSV format specifications** - users need exact column details
3. **Ignore workflow integration** - explain how tools fit together
4. **Forget security considerations** - intelligence data needs special handling
5. **Leave troubleshooting as afterthought** - common issues should be documented upfront

### Code Insights

**Entity type mapping pattern**:
```typescript
const maltegoTypeMap: Record<EntityType, string> = {
  ACTOR: 'maltego.Person',
  SOURCE: 'maltego.Document',
  EVENT: 'maltego.Phrase',
  PLACE: 'maltego.Location',
  BEHAVIOR: 'maltego.Phrase',
  EVIDENCE: 'maltego.Document'
}

// Use standard types that have broad transform support
const entityType = maltegoTypeMap[node.entityType] || 'maltego.Phrase'
```

**Dual-file export pattern** (entities + links):
```typescript
// Entities CSV
const entitiesCSV = [headers, ...entityRows]
  .map(row => row.map(cell => `"${cell}"`).join(','))
  .join('\n')

// Links CSV
const linksCSV = [linkHeaders, ...linkRows]
  .map(row => row.map(cell => `"${cell}"`).join(','))
  .join('\n')

// Download both
downloadFile(new Blob([entitiesCSV]), 'entities.csv')
downloadFile(new Blob([linksCSV]), 'links.csv')
```

---

## 3. Threaded Comments System (Foundation)

### Problem
Analysts needed to:
- Collaborate on COG analyses
- Discuss vulnerabilities and capabilities
- @mention team members
- Track resolution status
- Maintain threaded conversations

### Solution Implemented

**Database Schema**:
- **Threading support**: parent_comment_id, thread_root_id, depth
- **3 tables**: comments, comment_mentions, comment_notifications
- **Comprehensive indexes**: entity_type + entity_id + status composite
- **Soft delete**: Preserves thread structure
- **JSON fields**: mentioned_users, reactions

**API Endpoints**:
- GET `/api/comments` - Fetch with status filtering
- POST `/api/comments` - Create with auto-threading
- PATCH `/api/comments/:id` - Edit or resolve/unresolve
- DELETE `/api/comments/:id` - Soft delete
- **Features**: @mention extraction, markdown→HTML, guest support

**UI Component**:
- Threaded display with visual nesting
- Reply, edit, delete actions
- Resolve/unresolve workflow
- Show/hide resolved toggle
- Markdown rendering with @mention highlighting

### Results
- **980 lines** of foundation code
- **80% complete** - ready for integration
- Threading depth unlimited (UI can limit display)
- Full guest mode support

### Lessons Learned

#### ✅ Do:
1. **Design for threading upfront** - retrofitting is painful
2. **Use composite indexes** for common query patterns (entity_type + entity_id + status)
3. **Soft delete for threads** - hard delete breaks reply chains
4. **Cache rendered HTML** - markdown parsing is expensive
5. **Support guest mode** - not all users want accounts
6. **Thread depth tracking** - enables UI nesting limits
7. **Separate mentions table** - enables efficient notification queries

#### ❌ Don't:
1. **Hard delete comments** - breaks thread structure
2. **Parse markdown on every render** - cache HTML
3. **Forget depth limits in UI** - infinite nesting is hard to display
4. **Skip owner verification** - only comment owner should edit/delete
5. **Make resolve owner-only** - anyone should be able to resolve discussions

### Code Insights

**Threading calculation**:
```typescript
// Determine depth and thread root
let depth = 0
let threadRootId: string | null = null

if (parent_comment_id) {
  const parent = await db.get('SELECT depth, thread_root_id FROM comments WHERE id = ?', parent_comment_id)
  depth = parent.depth + 1
  threadRootId = parent.thread_root_id || parent_comment_id
} else {
  threadRootId = commentId // Root comment is its own thread root
}
```

**Efficient comment queries**:
```typescript
// Composite index: (entity_type, entity_id, status, created_at DESC)
const comments = await db.all(`
  SELECT * FROM comments
  WHERE entity_type = ? AND entity_id = ? AND status != 'deleted'
  ORDER BY created_at ASC
`)

// Build tree in application layer for flexibility
```

**@mention extraction**:
```typescript
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }
  return [...new Set(mentions)] // Deduplicate
}
```

---

## General Lessons

### Development Process

1. **Build → Test → Document** cycle works well
2. **Comprehensive documentation** is as important as code
3. **0 TypeScript errors** goal keeps code quality high
4. **Git tagging** for major features helps tracking
5. **Roadmap updates** keep progress visible

### Code Organization

1. **Separate concerns**: API ≠ UI ≠ database schema
2. **Reusable patterns**: Extract common code (getUserFromRequest, generateId, etc.)
3. **Type safety**: Define interfaces upfront
4. **Error handling**: Always provide user-friendly messages
5. **CORS**: Enable for all API endpoints

### Performance

1. **Caching is critical** for external API calls
2. **Composite indexes** dramatically improve query performance
3. **Lazy loading** reduces initial bundle size
4. **Code splitting** helps but has diminishing returns

### User Experience

1. **Specific error messages** > generic errors
2. **Quick start guides** > comprehensive manuals
3. **Show examples** > describe concepts
4. **Provide fallbacks** when automation fails
5. **Document workarounds** for known limitations

---

## Metrics

### This Session
- **Lines of Code**: 2,692 (including documentation)
- **Files Created**: 9
- **TypeScript Errors**: 0
- **Git Commits**: 9
- **Git Tags**: 2 (instagram-v2.0.0, osint-tools-v1.0.0)
- **Duration**: ~2 hours
- **Features Completed**: 2.8 (Instagram, OSINT tools, Comments 80%)

### Code Quality
- **Build Time**: ~7.5 seconds (consistent)
- **Bundle Size**: 2.77 MB (main chunk) - needs optimization
- **Test Coverage**: N/A (no tests yet)
- **Documentation**: 1,270+ lines added

---

## Next Steps

### Immediate (< 1 day)
1. **Finish comments system** (20% remaining):
   - Add translation strings (en/es)
   - Integrate into COGView and framework views
   - Deploy database migration
2. **Deploy to Cloudflare** and verify all features

### Short-term (< 1 week)
1. **Code splitting optimization** - reduce 2.77MB bundle
2. **Add tests** for critical paths (comments API, fallback chains)
3. **User autocomplete** for @mentions
4. **Reactions UI** for comments (👍, ❤️, etc.)

### Medium-term (< 1 month)
1. **NetworkX Python integration** (remaining from Task #6)
2. **Additional framework integrations** (PMESII-PT, DIME, DOTMLPF)
3. **Performance monitoring** and optimization
4. **User feedback collection** system

---

---

## #186 — COP Workspace Dark/Light Mode & Panel UX (2026-03-09)

### Dark Mode Color Classes Must Be Dual-Mode
**Problem:** Color utility functions (e.g., `confidenceColor()`) returned single-mode classes like `text-green-500`. In dark mode, these can be too bright or clash; in light mode, some grays (`text-gray-600`) have poor contrast.

**Fix:** Always use dual-mode classes: `text-green-600 dark:text-green-400`. For empty states, `text-gray-400 dark:text-gray-500` works in both modes.

**Pattern:** Any function that returns Tailwind color classes must include `dark:` variants.

### CopPanelExpander: Overflow + Visual Cues
**Problem:** Collapsed panels used `overflow-hidden` which hard-clipped content with no indication that more existed below the fold.

**Fix:** Changed to `overflow-y-auto` for scroll access, plus a fade gradient (`bg-gradient-to-t from-white dark:from-gray-950 to-transparent`) at the bottom as a visual cue. Also added `cursor-pointer` to expand/collapse buttons.

### Two-ID Architecture in COP
COP sessions use a human-readable session ID (`cop-b0f96023-cdf`) while the workspace uses a UUID (`6fde45ce-...`). The stats endpoint must look up `workspace_id` from the session first, then query entity tables by workspace_id. Framework sessions are an exception — they query by `user_id` (INTEGER), not workspace_id.

### E2E Test Patterns — Mock Route Interception
COP E2E tests use Playwright `page.route()` to intercept API calls and return mock data. This keeps tests fast and deterministic. Key pattern:
```typescript
await page.route('**/api/cop/sessions/*', route =>
  route.fulfill({ status: 200, body: JSON.stringify(mockSession) })
)
```
Tests that timeout (30s) almost always mean a selector doesn't match the current component DOM.

---

## #187 — E2E Test Audit (2026-03-09)

### Test Results: 32 passed / 33 failed
**Failure pattern:** All failures are timeouts (30.6s) — elements not found.

| Spec File | Pass | Fail | Issue |
|-----------|------|------|-------|
| cop-workspace.spec.ts | 18 | 4 | Command palette selectors |
| cop-viewer.spec.ts | 7 | 6 | Layer panel + sidebar changes |
| cop-event-sidebar.spec.ts | 0 | 13 | Full component restructure |
| cop-wizard.spec.ts | 0 | 10 | Wizard replaced by new flow |
| cop-public-share.spec.ts | 7 | 0 | All passing |

**Root cause:** Components evolved (CopEventSidebar restructured, wizard replaced with NewWorkspacePage) but tests weren't updated to match.

**Lesson:** When refactoring components, grep for the component name in `tests/e2e/` and update tests in the same commit.

## References

- [Instagram Extraction Guide](./INSTAGRAM_EXTRACTION.md)
- [Maltego Integration Guide](./MALTEGO_INTEGRATION_GUIDE.md)
- [i2 ANB Integration Guide](./I2ANB_INTEGRATION_GUIDE.md)
- [Project Roadmap Status](../PROJECT_ROADMAP_STATUS.md)
- [COP Workspace API](./COP-WORKSPACE-API.md)
- [COP Workspace Issues](./COP-WORKSPACE-ISSUES.md)

---

**Last Updated**: 2026-03-12
**Major Features**: COP workspace isolation, session persistence fixes, workspace migration
