# Cloudflare React Migration Plan
## Next.js to React + Vite + Cloudflare Pages

**Branch:** `cloudflare/react-nextjs-to-vite`
**Date:** 2025-09-30
**Goal:** Migrate from Next.js to React + Vite + Cloudflare Pages while preserving all UI, features, and functionality

---

## Current State Analysis

### Frontend Stack (Current)
- **Framework:** Next.js 15.4.6 with App Router
- **UI Components:** 139 TypeScript/TSX files
- **Styling:** Tailwind CSS 4.1.12
- **State Management:** Zustand 5.0.7
- **Data Fetching:** TanStack Query 5.85.3
- **UI Library:** Radix UI components
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation
- **Build:** Next.js standalone output

### Backend/API (Current)
- **Framework:** FastAPI (Python)
- **Database:** SQLite with SQLAlchemy
- **Location:** `/api` directory
- **Authentication:** Hash-based auth system
- **Storage:** File uploads in `/uploads`

### Key Features to Preserve
1. **10 Analysis Frameworks:** SWOT, COG, PMESII-PT, ACH, DOTMLPF, Deception, Behavioral, Starbursting, Causeway, DIME
2. **Research Tools:** URL processing, web scraping, social media analysis, citations, document extraction
3. **Authentication:** Hash-based bookmark system
4. **Export Functions:** PDF, Word, PowerPoint, Excel
5. **PWA Features:** Service worker, offline support
6. **Collaboration:** Team features and sharing
7. **Auto-save:** Automatic session persistence
8. **AI Integration:** GPT-5 powered analysis

---

## Migration Strategy Overview

### Phase 1: Setup & Infrastructure (Steps 1-5)
- Create Vite + React project structure
- Configure Tailwind CSS
- Setup Cloudflare Pages Functions for API
- Configure Wrangler for local development

### Phase 2: Component Migration (Steps 6-10)
- Migrate UI components (Radix UI compatible)
- Convert layouts and routing to React Router
- Migrate state management (Zustand)
- Setup data fetching (TanStack Query)

### Phase 3: Feature Migration (Steps 11-20)
- Migrate all 10 analysis frameworks
- Migrate research tools
- Migrate authentication system
- Migrate export functionality

### Phase 4: API Integration (Steps 21-25)
- Setup Cloudflare Pages Functions
- Migrate API routes to Cloudflare Workers
- Configure D1 database (optional migration from SQLite)
- Setup environment variables and secrets

### Phase 5: Testing & Deployment (Steps 26-30)
- Local testing with Wrangler
- Fix any compatibility issues
- Deploy to Cloudflare Pages
- Setup CI/CD pipeline

---

## Detailed Step-by-Step Migration Plan

### **PHASE 1: Setup & Infrastructure**

#### **Step 1: Create Vite Project Structure**
```bash
# Create new directory for React app
mkdir -p frontend-react
cd frontend-react

# Initialize Vite with React + TypeScript
npm create vite@latest . -- --template react-ts

# Install core dependencies
npm install
```

**Files to create:**
- `frontend-react/package.json`
- `frontend-react/vite.config.ts`
- `frontend-react/tsconfig.json`
- `frontend-react/index.html`

**Testing:** `npm run dev` - Verify Vite dev server starts

---

#### **Step 2: Configure Tailwind CSS**
```bash
# Install Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Files to create/modify:**
- `frontend-react/tailwind.config.js` - Copy from `frontend/tailwind.config.js`
- `frontend-react/postcss.config.js`
- `frontend-react/src/index.css` - Copy from `frontend/src/app/globals.css`

**Testing:** Add Tailwind classes to App.tsx and verify styling works

---

#### **Step 3: Install UI Dependencies**
```bash
npm install @radix-ui/react-accordion @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-dropdown-menu \
  @radix-ui/react-label @radix-ui/react-popover \
  @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-select @radix-ui/react-separator \
  @radix-ui/react-slider @radix-ui/react-slot \
  @radix-ui/react-switch @radix-ui/react-tabs \
  @radix-ui/react-tooltip lucide-react class-variance-authority \
  clsx tailwind-merge zustand @tanstack/react-query \
  @tanstack/react-query-devtools axios react-hook-form \
  @hookform/resolvers zod react-router-dom
```

**Files to verify:** `frontend-react/package.json`

**Testing:** Import a Radix component and verify it works

---

#### **Step 4: Setup React Router**
```bash
npm install react-router-dom
```

**Files to create:**
- `frontend-react/src/App.tsx` - Main router setup
- `frontend-react/src/routes/` - Route definitions
- `frontend-react/src/pages/` - Page components

**Structure:**
```
src/
├── App.tsx          # Router configuration
├── routes/
│   └── index.tsx    # Route definitions
└── pages/
    ├── landing.tsx
    ├── login.tsx
    ├── register.tsx
    └── dashboard.tsx
```

**Testing:** Navigate between routes, verify routing works

---

#### **Step 5: Setup Cloudflare Pages Functions**
```bash
# Install Wrangler
npm install -D wrangler

# Create functions directory
mkdir -p functions/api
```

**Files to create:**
- `wrangler.toml` - Cloudflare configuration
- `functions/api/_middleware.ts` - CORS and auth middleware
- `functions/api/health.ts` - Health check endpoint

**wrangler.toml example:**
```toml
name = "researchtoolspy"
compatibility_date = "2025-09-30"
pages_build_output_dir = "dist"

[env.production]
vars = { ENVIRONMENT = "production" }

[[d1_databases]]
binding = "DB"
database_name = "researchtoolspy-db"
database_id = "your-database-id"
```

**Testing:** `npm run build && npx wrangler pages dev dist`

---

### **PHASE 2: Component Migration**

#### **Step 6: Migrate UI Components**
Copy and adapt UI components from `frontend/src/components/ui/` to `frontend-react/src/components/ui/`

**Components to migrate:**
- accordion.tsx
- alert.tsx
- avatar.tsx
- badge.tsx
- button.tsx
- card.tsx
- checkbox.tsx
- dropdown-menu.tsx
- error-state.tsx
- input.tsx
- label.tsx
- popover.tsx
- progress.tsx
- radio-group.tsx
- select.tsx
- separator.tsx
- skeleton.tsx
- slider.tsx
- switch.tsx
- tabs.tsx
- textarea.tsx
- tooltip.tsx

**Changes needed:**
- Remove `'use client'` directives (React, not Next.js)
- Keep all Radix UI imports as-is
- Verify all imports use `@/` path alias

**Testing:** Import each component in a test page and verify rendering

---

#### **Step 7: Migrate Layout Components**
**Files to migrate:**
- `frontend/src/components/layout/dashboard-header.tsx`
- Create `frontend-react/src/layouts/DashboardLayout.tsx`
- Create `frontend-react/src/layouts/AuthLayout.tsx`

**Changes:**
- Replace Next.js `Link` with React Router `Link`
- Replace `useRouter()` from Next.js with `useNavigate()` from React Router
- Remove `'use client'` directives

**Testing:** Render layout with children, verify header, footer work

---

#### **Step 8: Migrate State Management (Zustand)**
**Files to migrate:**
- `frontend/src/stores/auth.ts` → `frontend-react/src/stores/auth.ts`
- Any other Zustand stores in `frontend/src/stores/`

**Changes:**
- Minimal (Zustand is framework-agnostic)
- Update any Next.js-specific imports

**Testing:** Create a component that uses the store, verify state updates

---

#### **Step 9: Setup TanStack Query**
**Files to create:**
- `frontend-react/src/lib/query-client.ts` - Query client configuration
- `frontend-react/src/components/providers/QueryProvider.tsx`

**Code:**
```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

// components/providers/QueryProvider.tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

**Testing:** Wrap App in QueryProvider, verify devtools appear

---

#### **Step 10: Migrate Error Boundary**
**Files to migrate:**
- `frontend/src/components/error-boundary.tsx` → `frontend-react/src/components/ErrorBoundary.tsx`

**Changes:**
- Remove Next.js-specific error handling
- Use standard React error boundary pattern

**Testing:** Throw an error in a component, verify error boundary catches it

---

### **PHASE 3: Page Migration**

#### **Step 11: Migrate Landing Page**
**File:** `frontend/src/app/page.tsx` → `frontend-react/src/pages/LandingPage.tsx`

**Changes:**
- Remove `'use client'`
- Replace Next.js `Link` with React Router `Link`
- Replace `useRouter()` with `useNavigate()`
- Keep all UI components and styling

**Testing:** Visit `/`, verify all buttons, links, and styling work

---

#### **Step 12: Migrate Auth Pages**
**Files to migrate:**
- `frontend/src/app/(auth)/login/page.tsx` → `frontend-react/src/pages/LoginPage.tsx`
- `frontend/src/app/(auth)/register/page.tsx` → `frontend-react/src/pages/RegisterPage.tsx`

**Changes:**
- Remove `'use client'`
- Update routing imports
- Update API calls to use environment variables for base URL

**Testing:** Login/register flow, verify auth works end-to-end

---

#### **Step 13: Migrate Dashboard Page**
**File:** `frontend/src/app/(dashboard)/page.tsx` → `frontend-react/src/pages/DashboardPage.tsx`

**Changes:**
- Remove `'use client'`
- Update routing
- Verify dashboard layout and cards render

**Testing:** Navigate to dashboard, verify all sections display

---

#### **Step 14-23: Migrate Analysis Framework Pages**
For each framework, migrate from `frontend/src/app/(dashboard)/analysis-frameworks/[framework]/` to `frontend-react/src/pages/frameworks/[framework]/`

**Frameworks:**
1. ACH Dashboard
2. Behavior Analysis
3. Causeway
4. COG
5. Deception
6. DIME
7. DOTMLPF
8. Fundamental Flow
9. PEST
10. PMESII-PT
11. Stakeholder
12. Starbursting
13. Surveillance
14. SWOT
15. Trend Analysis
16. VRIO

**Changes for each:**
- Remove `'use client'`
- Update routing (replace Next.js dynamic routes with React Router params)
- Update navigation imports
- Preserve all business logic, UI, and functionality

**Testing for each:**
- Create new framework session
- Edit framework data
- Save framework
- Export framework
- Delete framework

---

#### **Step 24: Migrate Research Tools Pages**
**Files to migrate:**
- `frontend/src/app/(dashboard)/tools/page.tsx`
- `frontend/src/app/(dashboard)/tools/url/page.tsx`
- `frontend/src/app/(dashboard)/tools/documents/page.tsx`
- `frontend/src/app/(dashboard)/tools/social-media/page.tsx`
- `frontend/src/app/(dashboard)/tools/content-extraction/page.tsx`
- `frontend/src/app/(dashboard)/tools/citations/page.tsx`
- `frontend/src/app/(dashboard)/tools/scraping/page.tsx`

**Changes:** Same pattern as framework pages

**Testing:** Test each tool's functionality

---

#### **Step 25: Migrate Collaboration & Reports**
**Files:**
- `frontend/src/app/(dashboard)/collaboration/page.tsx`
- `frontend/src/app/(dashboard)/reports/page.tsx`

**Testing:** Verify collaboration features and report generation

---

### **PHASE 4: API Integration with Cloudflare**

#### **Step 26: Setup Cloudflare Pages Functions**
**Directory structure:**
```
functions/
├── api/
│   ├── _middleware.ts        # CORS, auth
│   ├── auth/
│   │   ├── login.ts
│   │   ├── register.ts
│   │   └── verify.ts
│   ├── frameworks/
│   │   ├── ach.ts
│   │   ├── behavior.ts
│   │   └── ...
│   ├── tools/
│   │   ├── url.ts
│   │   ├── scraping.ts
│   │   └── ...
│   └── export/
│       ├── pdf.ts
│       ├── docx.ts
│       └── pptx.ts
```

**Key files:**
```typescript
// functions/api/_middleware.ts
export async function onRequest(context: any) {
  const { request, next } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const response = await next()
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}
```

**Testing:** Create a test endpoint, call from frontend

---

#### **Step 27: Migrate Authentication API**
**Approach:** Use Cloudflare Workers to proxy requests to existing FastAPI backend OR migrate to D1

**Option A - Proxy to FastAPI (Faster):**
```typescript
// functions/api/auth/login.ts
export async function onRequest(context: any) {
  const { request, env } = context
  const body = await request.json()

  // Proxy to FastAPI backend
  const response = await fetch(`${env.API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  return response
}
```

**Option B - Migrate to D1 (Better long-term):**
```typescript
// functions/api/auth/login.ts
export async function onRequest(context: any) {
  const { request, env } = context
  const { hash } = await request.json()

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE hash = ?'
  ).bind(hash).first()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid hash' }), {
      status: 401
    })
  }

  return new Response(JSON.stringify({ user }), { status: 200 })
}
```

**Testing:** Login from frontend, verify authentication works

---

#### **Step 28: Configure Environment Variables**
**Files:**
- `.env.local` - Local development
- `wrangler.toml` - Cloudflare configuration

**Variables:**
```env
VITE_API_URL=http://localhost:8788
VITE_APP_URL=http://localhost:5173
VITE_ENVIRONMENT=development
```

**Cloudflare secrets:**
```bash
npx wrangler pages secret put API_URL --project-name researchtoolspy
npx wrangler pages secret put OPENAI_API_KEY --project-name researchtoolspy
```

**Testing:** Verify environment variables accessible in both frontend and functions

---

#### **Step 29: Setup Database (D1)**
```bash
# Create D1 database
npx wrangler d1 create researchtoolspy-db

# Update wrangler.toml with database ID
# Run migrations
npx wrangler d1 execute researchtoolspy-db --file=./schema.sql
```

**schema.sql:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  framework_type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Testing:** Create user, save session, retrieve session from D1

---

#### **Step 30: Migrate Export Functions**
**Libraries to handle:**
- jsPDF (PDF generation)
- docx (Word generation)
- pptxgenjs (PowerPoint generation)
- exceljs (Excel generation)

**Approach:** Keep export generation in frontend (client-side) OR use Cloudflare Workers

**Testing:** Generate PDF, Word, PowerPoint exports for each framework

---

### **PHASE 5: Testing & Deployment**

#### **Step 31: Local Testing with Wrangler**
```bash
# Build frontend
npm run build

# Test with Wrangler
npx wrangler pages dev dist --compatibility-date=2025-09-30

# Run through all features:
# - Login/Register
# - Create framework session
# - Edit and save
# - Export in all formats
# - Research tools
# - Collaboration features
```

**Testing checklist:**
- [ ] All pages load without errors
- [ ] Authentication works
- [ ] All 10 frameworks functional
- [ ] All research tools work
- [ ] Export functions generate files
- [ ] No console errors
- [ ] Mobile responsive
- [ ] PWA features work

**Commit:** `git commit -m "feat: Complete local testing - all features working"`

---

#### **Step 32: Fix Build Issues**
```bash
# Run build
npm run build

# Run lint
npm run lint

# Fix any TypeScript errors
# Fix any ESLint violations
```

**Testing:** Build succeeds with no errors or warnings

**Commit:** `git commit -m "fix: Resolve all build and lint issues"`

---

#### **Step 33: Deploy to Cloudflare Pages**
```bash
# Login to Cloudflare
npx wrangler login

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=researchtoolspy

# Set up custom domain (optional)
# Configure DNS settings
```

**Testing:**
- Visit production URL
- Test all features in production
- Check Cloudflare Pages logs

**Commit & Tag:**
```bash
git commit -m "feat: Initial Cloudflare Pages deployment"
git tag v1.0.0-cloudflare
git push origin cloudflare/react-nextjs-to-vite
git push --tags
```

---

#### **Step 34: Setup CI/CD Pipeline**
**File:** `.github/workflows/deploy-cloudflare.yml`

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [cloudflare/react-nextjs-to-vite]
  pull_request:
    branches: [cloudflare/react-nextjs-to-vite]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend-react/package-lock.json

      - name: Install dependencies
        working-directory: frontend-react
        run: npm ci

      - name: Lint
        working-directory: frontend-react
        run: npm run lint

      - name: Build
        working-directory: frontend-react
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy frontend-react/dist --project-name=researchtoolspy
```

**Testing:** Push commit, verify GitHub Actions workflow runs and deploys

**Commit:** `git commit -m "feat: Add CI/CD pipeline for Cloudflare Pages"`

---

#### **Step 35: Performance Optimization**
**Tasks:**
1. Enable Cloudflare CDN caching
2. Optimize bundle size (code splitting)
3. Add lazy loading for routes
4. Enable Brotli compression
5. Configure service worker for offline

**vite.config.ts optimizations:**
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@radix-ui/react-accordion', '@radix-ui/react-avatar'],
          'query': ['@tanstack/react-query'],
        }
      }
    }
  }
})
```

**Testing:** Run Lighthouse audit, aim for 90+ score

**Commit:** `git commit -m "perf: Optimize bundle size and performance"`

---

## Migration Execution Commands

```bash
# 1. Create and switch to migration branch
git checkout -b cloudflare/react-nextjs-to-vite main

# 2. Create React app directory
mkdir frontend-react && cd frontend-react
npm create vite@latest . -- --template react-ts

# 3. Install all dependencies
npm install [dependencies from Step 3]

# 4. Copy and adapt components (Steps 6-10)
# Use rsync to preserve structure
rsync -av --exclude='node_modules' ../frontend/src/components/ ./src/components/

# 5. Migrate pages (Steps 11-25)
# Manual migration with find and replace

# 6. Setup Cloudflare Functions (Steps 26-30)
mkdir -p functions/api
# Create function files

# 7. Test locally (Step 31)
npm run build
npx wrangler pages dev dist

# 8. Deploy (Step 33)
npx wrangler pages deploy dist --project-name=researchtoolspy

# 9. Tag and commit
git commit -m "feat: Complete Next.js to React migration for Cloudflare Pages"
git tag v1.0.0-cloudflare-react
git push origin cloudflare/react-nextjs-to-vite --tags
```

---

## Testing Strategy

### Local Testing
```bash
# Terminal 1 - Frontend dev server
cd frontend-react
npm run dev

# Terminal 2 - Backend (if proxying)
cd ../api
uvicorn app.main:app --reload --port 8000

# Terminal 3 - Wrangler dev (for functions)
cd ../frontend-react
npm run build && npx wrangler pages dev dist
```

### Testing Checklist Per Step
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Dev server starts: `npm run dev`
- [ ] Wrangler dev works: `npx wrangler pages dev dist`
- [ ] No console errors in browser
- [ ] Feature works as expected
- [ ] Git commit with descriptive message
- [ ] Tag commit if milestone reached

---

## Rollback Plan

If migration fails or issues arise:

```bash
# Rollback to main branch
git checkout main

# Keep migration branch for future attempts
git branch -D cloudflare/react-nextjs-to-vite  # Only if abandoning

# Or fix issues on migration branch
git checkout cloudflare/react-nextjs-to-vite
# Make fixes
git commit -m "fix: Resolve migration issue"
```

---

## Success Criteria

### Must Have (Blocking)
- [ ] All 10 frameworks fully functional
- [ ] All research tools working
- [ ] Authentication working
- [ ] Export functions generating files correctly
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Build and deployment successful

### Nice to Have (Non-blocking)
- [ ] PWA features (offline mode)
- [ ] Performance score 90+
- [ ] CI/CD pipeline functional
- [ ] D1 database migration complete
- [ ] All Cloudflare features utilized (Workers, KV, R2)

---

## Timeline Estimate

- **Phase 1 (Setup):** 2-3 hours
- **Phase 2 (Components):** 3-4 hours
- **Phase 3 (Pages):** 8-10 hours
- **Phase 4 (API Integration):** 4-6 hours
- **Phase 5 (Testing & Deployment):** 3-4 hours

**Total:** ~20-27 hours of focused development

---

## Notes & Considerations

1. **No Framer Motion:** Per Cloudflare guide, avoid Framer Motion - use CSS animations
2. **No React Portal:** Use inline modals with high z-index
3. **Environment Variables:** Must start with `VITE_` prefix for frontend access
4. **API Strategy:** Start with proxying to FastAPI, migrate to D1 later if needed
5. **Incremental Testing:** Test after every major step, commit frequently
6. **Error Handling:** Add proper error boundaries and fallback UI
7. **Accessibility:** Maintain ARIA labels and keyboard navigation

---

## Next Steps After Completion

1. **Monitor:** Check Cloudflare analytics and logs
2. **Optimize:** Analyze bundle size and performance
3. **Migrate Database:** Move from SQLite to D1 if desired
4. **Add Features:** Leverage Cloudflare Workers for serverless functions
5. **Scale:** Configure caching, CDN, and edge optimization

---

**Document Version:** 1.0
**Last Updated:** 2025-09-30
**Maintainer:** Claude Code Assistant