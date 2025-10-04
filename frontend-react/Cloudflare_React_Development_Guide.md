# Cloudflare React Development Guide

Complete guide for developing and deploying React applications on Cloudflare Pages with Workers integration.

## Table of Contents
1. [Critical SPA Routing Setup](#critical-spa-routing-setup)
2. [Authentication Model](#authentication-model)
3. [Project Structure](#project-structure)
4. [Dark Mode Implementation](#dark-mode-implementation)
5. [Cloudflare Pages Functions](#cloudflare-pages-functions)
6. [Local Development](#local-development)
7. [Deployment](#deployment)
8. [Common Issues](#common-issues)

## Critical SPA Routing Setup

**⚠️ IMPORTANT:** Cloudflare Pages needs a `_redirects` file for client-side routing (SPA). Without it, all routes except the root will return 404 errors when accessed directly.

### Setup from Start

1. **Create `public/_redirects` file:**
```
# Cloudflare Pages SPA routing
# Redirect all requests to index.html for client-side routing
/* /index.html 200
```

2. **Verify build copies it to dist:**
```bash
npm run build
ls dist/_redirects  # Should exist
```

3. **Test locally with Wrangler:**
```bash
npx wrangler pages dev dist --compatibility-date=2025-09-30
```

4. **Deploy to production:**
```bash
npx wrangler pages deploy dist --project-name=researchtoolspy
```

### Why This is Critical

- **Without `_redirects`:** Direct navigation to `/dashboard/evidence` returns 404
- **With `_redirects`:** Server serves `index.html`, React Router handles the route
- **File location:** Must be in `public/` directory (Vite copies it to `dist/`)
- **Syntax:** `/* /index.html 200` means "all paths serve index.html with 200 status"

### Testing Routes

```bash
# Test production deployment
BASE_URL="https://your-deployment.pages.dev"

# Framework pages
curl -I "$BASE_URL/dashboard/analysis-frameworks/swot-dashboard"  # Should be 200
curl -I "$BASE_URL/dashboard/evidence"  # Should be 200

# API endpoints
curl "$BASE_URL/api/frameworks"  # Should return JSON
```

## Authentication Model

This application uses **optional hash-based authentication** - all tools and frameworks are publicly accessible without login.

### Design Philosophy

**Public Access First:**
- All analysis frameworks are accessible without authentication
- All research tools work without login
- Users can explore and use features immediately
- No account required to get started

**Optional Login Benefits:**
- Save work for later
- Collaborate with teams
- Access saved sessions across devices
- Track analysis history

### Implementation

**Header UI:**
```typescript
// When NOT logged in - show login prompt
{!isAuthenticated ? (
  <div className="flex items-center gap-3">
    <div className="text-sm text-gray-500">
      <Save className="h-4 w-4" />
      <span>Login to save your work</span>
    </div>
    <Button onClick={() => navigate('/login')}>
      <LogIn className="h-4 w-4" />
      Login
    </Button>
  </div>
) : (
  // When logged in - show user menu with notifications
  <DropdownMenu>
    {/* User profile, settings, logout */}
  </DropdownMenu>
)}
```

**Authentication Flow:**
1. User visits any framework/tool page → Works immediately (no auth required)
2. User sees "Login to save your work" in header
3. User clicks Login → Enters 16-digit hash
4. Hash validated against database
5. User can now save work and collaborate

**Hash Storage:**
```typescript
// Check authentication status
const hash = localStorage.getItem('omnicore_user_hash')
const authenticated = localStorage.getItem('omnicore_authenticated') === 'true'
const isAuthenticated = authenticated && !!hash

// On logout - clear hash but stay on page
localStorage.removeItem('omnicore_user_hash')
localStorage.removeItem('omnicore_authenticated')
// No redirect needed - tools still work
```

**Route Configuration:**
```typescript
// All routes are public - no ProtectedRoute wrapper needed
{
  path: '/dashboard',
  element: <DashboardLayout />,  // No auth guard
  children: [
    { path: 'analysis-frameworks/swot-dashboard', element: <SwotPage /> },
    { path: 'evidence', element: <EvidencePage /> },
    { path: 'tools', element: <ToolsPage /> },
    // All routes accessible without login
  ]
}
```

**Benefits of This Model:**
- Lower barrier to entry (try before you sign up)
- Better user experience (no forced registration)
- Increased adoption (explore features immediately)
- Optional value-add (login only when needed)

## Project Structure

```
frontend-react/
├── public/
│   └── _redirects              # ⭐ CRITICAL: SPA routing config
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Layout components
│   │   └── ThemeToggle.tsx     # Dark mode toggle
│   ├── hooks/
│   │   └── useTheme.ts         # Theme management hook
│   ├── pages/
│   │   ├── frameworks/         # Framework-specific pages
│   │   ├── DashboardPage.tsx
│   │   ├── EvidencePage.tsx
│   │   ├── ToolsPage.tsx
│   │   └── PlaceholderPage.tsx # Reusable placeholder
│   ├── routes/
│   │   └── index.tsx           # React Router v7 config
│   ├── layouts/
│   │   └── DashboardLayout.tsx # Main dashboard layout
│   └── index.css               # Tailwind + dark mode config
├── functions/
│   └── api/
│       └── frameworks.ts       # Cloudflare Pages Function
├── wrangler.toml              # Cloudflare configuration
└── vite.config.ts             # Vite configuration
```

## Dark Mode Implementation

### Tailwind CSS v4 Configuration

**⚠️ Important:** Tailwind v4 requires CSS-based dark mode configuration (not `tailwind.config.js`).

**src/index.css:**
```css
@import "tailwindcss";

/* Enable dark mode with class strategy (Tailwind v4) */
@custom-variant dark (&:where(.dark, .dark *));

.dark {
  /* WCAG AA compliant colors (slate palette) */
  --background: 222.2 47.4% 11.2%;     /* slate-900: #0f172a */
  --foreground: 210 40% 98%;           /* slate-100: #f1f5f9 */
  --card: 217.2 32.6% 17.5%;           /* slate-800: #1e293b */
  --card-foreground: 210 40% 98%;      /* slate-100: #f1f5f9 */
  --muted-foreground: 215.4 16.3% 56.9%; /* slate-400: #94a3b8 */
  --border: 215.3 25% 26.7%;           /* slate-700: #334155 */
}
```

### Theme Management Hook

**src/hooks/useTheme.ts:**
```typescript
import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // 1. Check localStorage first (user preference)
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark') {
      applyTheme(stored)
      return
    }

    // 2. Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }, [])

  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light'
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return { theme, toggleTheme, isDark: theme === 'dark' }
}
```

### Theme Toggle Component

**src/components/ThemeToggle.tsx:**
```typescript
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-gray-300" />
      ) : (
        <Moon className="h-5 w-5 text-gray-600" />
      )}
    </Button>
  )
}
```

## React Router v7 Configuration

**⚠️ Important:** Use **relative paths** in nested routes (not absolute).

**src/routes/index.tsx:**
```typescript
import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <DashboardPage /> },

      // ✅ Correct: relative paths
      { path: 'analysis-frameworks/swot-dashboard', element: <SwotPage /> },
      { path: 'evidence', element: <EvidencePage /> },

      // ❌ Wrong: absolute paths
      // { path: '/dashboard/analysis-frameworks/swot', element: <SwotPage /> },
    ],
  },
])
```

## Cloudflare Pages Functions

Functions are serverless API endpoints deployed alongside your static site.

### File Structure
```
functions/
└── api/
    └── frameworks.ts    # Accessible at /api/frameworks
```

### Example Function with D1

**functions/api/frameworks.ts:**
```typescript
export async function onRequest(context: any) {
  const { request, env } = context

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // GET - List frameworks
    if (request.method === 'GET') {
      const frameworks = await env.DB.prepare(
        'SELECT * FROM framework_sessions ORDER BY created_at DESC LIMIT 50'
      ).all()

      return new Response(JSON.stringify({ frameworks: frameworks.results }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    // POST - Create framework
    if (request.method === 'POST') {
      const body = await request.json()

      const result = await env.DB.prepare(
        `INSERT INTO framework_sessions (user_id, title, framework_type, data)
         VALUES (?, ?, ?, ?)`
      ).bind(
        body.user_id || 1,
        body.title,
        body.framework_type,
        JSON.stringify(body.data || {})
      ).run()

      return new Response(JSON.stringify({
        id: result.meta.last_row_id
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
```

### wrangler.toml Configuration

```toml
name = "researchtoolspy"
compatibility_date = "2025-09-30"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "researchtoolspy-dev"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-id"

[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "researchtoolspy-uploads"
```

## Local Development

### Start Development Server

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start Wrangler dev server (with bindings)
npx wrangler pages dev dist --compatibility-date=2025-09-30 --port=8788
```

### Test Routes Locally

```bash
# Test framework pages
curl http://localhost:8788/dashboard/analysis-frameworks/swot-dashboard

# Test new pages
curl http://localhost:8788/dashboard/evidence
curl http://localhost:8788/dashboard/tools

# Test API
curl http://localhost:8788/api/frameworks
```

### Hot Reload Workflow

1. Make changes to source files
2. Build: `npm run build`
3. Wrangler auto-reloads
4. Test in browser: `http://localhost:8788`

## Deployment

### Deploy to Production

```bash
# Build first
npm run build

# Verify _redirects file exists
ls dist/_redirects

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=researchtoolspy
```

### Test Production Deployment

```bash
BASE_URL="https://your-deployment.pages.dev"

# Framework pages
curl -I "$BASE_URL/dashboard/analysis-frameworks/swot-dashboard"
curl -I "$BASE_URL/dashboard/analysis-frameworks/ach-dashboard"

# New pages
curl -I "$BASE_URL/dashboard/evidence"
curl -I "$BASE_URL/dashboard/tools"
curl -I "$BASE_URL/dashboard/reports"

# API
curl "$BASE_URL/api/frameworks"
```

All routes should return `200 OK`.

## Common Issues

### Issue 1: All routes return 404

**Symptom:** Direct navigation to `/dashboard/evidence` returns 404

**Cause:** Missing `public/_redirects` file

**Solution:**
```bash
# Create the file
echo "/* /index.html 200" > public/_redirects

# Rebuild
npm run build

# Verify
ls dist/_redirects

# Redeploy
npx wrangler pages deploy dist --project-name=researchtoolspy
```

### Issue 2: Dark mode not working

**Symptom:** Dark mode classes defined but not activating

**Cause:** Missing Tailwind v4 dark mode config

**Solution:** Add to `src/index.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Issue 3: Nested routes 404 in React Router v7

**Symptom:** Child routes under `/dashboard` not working

**Cause:** Using absolute paths in nested routes

**Solution:** Use relative paths:
```typescript
// ❌ Wrong
{ path: '/dashboard/evidence', element: <EvidencePage /> }

// ✅ Correct
{ path: 'evidence', element: <EvidencePage /> }
```

### Issue 4: API returns "env is undefined"

**Symptom:** `TypeError: Cannot read property 'DB' of undefined`

**Cause:** Missing bindings in wrangler.toml or local development

**Solution:**
1. Check `wrangler.toml` has correct bindings
2. Use `npx wrangler pages dev` (not `npm run dev`)
3. Ensure D1 database is created

### Issue 5: CORS errors in production

**Symptom:** Browser console shows CORS errors

**Cause:** Missing CORS headers in Functions

**Solution:** Add headers to all responses:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
```

### Issue 6: API Integration - Data Not Loading on Component Mount

**Symptom:** API data not displayed when component first loads

**Cause:** Missing useEffect hook for data loading

**Solution:**
```typescript
// Load data from API on component mount
useEffect(() => {
  const loadData = async () => {
    if (!id) return

    try {
      const response = await fetch(`/api/resource?id=${id}`)
      if (response.ok) {
        const result = await response.json()
        // Transform API response to component format
        const transformedData = result.items.map(item => ({
          // ... transformation logic
        }))
        setData(transformedData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  loadData()
}, [id]) // Dependency: re-run when ID changes
```

### Issue 7: DELETE Requests with Query Parameters

**Symptom:** DELETE requests not working with query parameters

**Cause:** Incorrect URL construction or missing parameters

**Solution:**
```typescript
// Correct: Use query parameters for DELETE
const response = await fetch(
  `/api/resource?id=${id}&item_id=${itemId}`,
  { method: 'DELETE' }
)

// Update local state after successful deletion
if (response.ok) {
  setItems(items.filter(item => item.id !== itemId))
}
```

### Issue 8: Batch API Operations

**Symptom:** Multiple sequential API calls causing performance issues

**Cause:** Not batching operations

**Solution:**
```typescript
// ✅ Correct: Batch operation
const itemIds = selectedItems.map(item => item.id)
const response = await fetch('/api/resource/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: itemIds })
})

// ❌ Wrong: Sequential calls
for (const item of selectedItems) {
  await fetch(`/api/resource/${item.id}`, { method: 'POST' })
}
```

## Best Practices

1. **Always create `public/_redirects` for SPAs**
2. **Use relative paths in nested routes**
3. **Test locally with Wrangler before deploying**
4. **Implement WCAG AA color contrast (4.5:1 for text)**
5. **Use system preference detection for dark mode**
6. **Add CORS headers to all API responses**
7. **Use TypeScript for type safety**
8. **Test all routes after deployment**
9. **Use shadcn/ui for consistent components**
10. **Keep wrangler.toml in sync with production bindings**
11. **Always load data in useEffect with proper dependencies**
12. **Batch API operations when possible to reduce network calls**
13. **Transform API responses to match component interfaces**
14. **Handle errors gracefully with user-friendly messages**
15. **Update local state immediately after successful API operations**

## Lessons Learned from Evidence Linking Implementation (Oct 4, 2025)

### Key Insights

1. **API Integration Pattern**
   - Load data on mount with `useEffect(() => { loadData() }, [id])`
   - Always check for required IDs before making API calls
   - Transform API responses to match component interface immediately
   - Update local state only after successful API response

2. **State Management for Linked Data**
   - Use `LinkedEvidence[]` type for consistent state structure
   - Keep local state in sync with server state
   - Filter state immediately on delete for instant UI feedback
   - Append to existing state on link for optimistic updates

3. **Error Handling Best Practices**
   ```typescript
   try {
     const response = await fetch('/api/endpoint')
     if (response.ok) {
       // Success path
     } else {
       const error = await response.json()
       console.error('API error:', error)
       alert('User-friendly message')
     }
   } catch (error) {
     console.error('Network error:', error)
     alert('Generic error message')
   }
   ```

4. **Batch Operations Performance**
   - Linking: Send array of IDs `{ evidence_ids: [1, 2, 3] }` instead of 3 separate calls
   - Reduces API calls from O(n) to O(1)
   - Reduces network latency and server load
   - Implement on both client and server for maximum benefit

5. **API Response Transformation**
   ```typescript
   // API returns: { links: [{evidence_id, title, description, ...}] }
   // Component needs: LinkedEvidence[]
   const transformed = result.links.map(link => ({
     entity_type: 'data',
     entity_id: link.evidence_id,
     entity_data: { id: link.evidence_id, title: link.title, ... },
     linked_at: link.created_at
   }))
   ```

6. **DELETE with Query Parameters**
   - Use query params for resource identification: `/api/resource?id=123&item_id=456`
   - Cleaner than path params for multiple identifiers
   - Easier to construct URLs dynamically
   - Works well with REST conventions

7. **Foundation for Future Features**
   - Built COG/Causeway relationship extraction without full implementation
   - Logged extracted data for verification before auto-generation
   - Deferred entity linking until infrastructure complete
   - Left clear TODOs for future implementation

### Deployment Verification Checklist

✅ Build successful (`npm run build`)
✅ Deployment successful (`npx wrangler pages deploy dist`)
✅ Health endpoint responsive (`/api/health`)
✅ API endpoints functional (test with curl)
✅ UI components render correctly
✅ Local state updates immediately
✅ API state persists across refreshes

### Performance Metrics

- **TODO Reduction:** 18 → 10 items (44% decrease)
- **Build Time:** 3.51s (2,698KB main bundle)
- **Deployment Time:** <1 minute
- **API Integration:** 3 endpoints (GET, POST, DELETE)
- **Code Modified:** 111 lines across 2 files
- **TODOs Resolved:** 8 HIGH priority items

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [React Router v7](https://reactrouter.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
