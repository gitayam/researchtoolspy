# CLAUDE.md Update Analysis
*Analysis Date: September 27, 2025*

## Current Tech Stack (Muse & Co)

### ✅ What We're Actually Using
1. **Frontend**: React 18 + Vite + TypeScript
2. **Deployment**: Cloudflare Pages
3. **Functions**: Cloudflare Pages Functions (file-based routing in `/functions`)
4. **Database**: Cloudflare D1 (SQLite at edge)
5. **State**: Zustand + React Context
6. **Storage**: R2 (for assets like images)
7. **Routing**: React Router DOM v6
8. **Styling**: Tailwind CSS 3
9. **CLI Tools**: Wrangler, gh (GitHub CLI)
10. **CI/CD**: GitHub Actions (can be added)
11. **APIs**: Cloudflare Workers (MX Merchant integration, email)

### ❌ What We're NOT Using (Remove from CLAUDE.md)
1. ~~Next.js~~ - Migrated to Vite
2. ~~NextAuth.js~~ - Custom auth implementation
3. ~~Prisma~~ - Using D1 directly
4. ~~Server-side rendering~~ - Static site
5. ~~PostgreSQL~~ - Using D1 instead
6. ~~Redis~~ - Using KV (if needed)
7. ~~Docker~~ - Cloudflare edge deployment
8. ~~Conda environments~~ - Frontend doesn't need this
9. ~~Python/Backend patterns~~ - JavaScript/TypeScript only
10. ~~Alembic migrations~~ - D1 has its own migration system

## Key Cloudflare Patterns We Use

### 1. Pages Functions (File-based API Routes)
```
/functions/
  api/
    surveys.ts          → /api/surveys
    send-email.ts       → /api/send-email
    mx-test.ts          → /api/mx-test
```

**Pattern**:
```typescript
export async function onRequest(context: any) {
  const { request, env } = context
  // Access D1: env.DB or env.muse_customer_db
  // Access secrets: env.SECRET_NAME
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

### 2. D1 Database Access
```typescript
// In Pages Function
const result = await env.DB.prepare(
  'SELECT * FROM users WHERE email = ?'
).bind(email).first()
```

### 3. Secrets Management
```bash
# Set secrets for production
npx wrangler pages secret put SECRET_NAME --project-name muse-customer

# List secrets
npx wrangler pages secret list --project-name muse-customer
```

### 4. Environment Variables
**Local (.env)**:
```env
VITE_API_URL=http://localhost:8788
VITE_CHATBOT_API=https://api.example.com
```

**Cloudflare Pages**:
- Set in dashboard or via wrangler
- Access in functions: `env.VARIABLE_NAME`
- Access in frontend: `import.meta.env.VITE_VARIABLE_NAME`

### 5. Deployment Workflow
```bash
# Build
npm run build

# Deploy
npx wrangler pages deploy dist --project-name muse-customer

# Or use package.json script
npm run deploy
```

### 6. GitHub Integration
```bash
# GitHub CLI for PRs and issues
gh pr create --title "Feature" --body "Description"
gh pr list
gh issue create --title "Bug" --body "Details"
```

## Critical Lessons from Migration

### From LESSONS_LEARNED.md:
1. **NO Framer Motion in production** - Use CSS animations
2. **Import ALL used icons/components**
3. **Test production builds locally** with `npm run preview`
4. **Inspect built bundles** when debugging
5. **TypeScript doesn't catch all runtime issues**

### From CLOUDFLARE_MIGRATION_LESSONS.md:
1. **Modal Issues**:
   - React Portal problematic with Vite + Cloudflare
   - Use inline styles for modals
   - Z-index must be inline (100+)

2. **Event Handling**:
   - Use stopPropagation to prevent bubbling
   - Test all interactive elements after deployment

3. **Cloudflare Pages Specifics**:
   - Static site - no SSR
   - Client-side routing requires `_redirects` file
   - Public folder must be in git

4. **State Management**:
   - Zustand > Context for complex state
   - Bridge pattern for gradual migration
   - Cart supports multiple item types

## CLAUDE.md Sections to Remove

### Complete Removal:
1. **🔐 NextJS Authentication Mastery** (entire section)
2. **Conda Environments** (entire section)
3. **Backend/Python-Specific Rules**
4. **PostgreSQL/Alembic patterns**
5. **Docker-related content**
6. **Server-side specific patterns**

### Sections to Keep & Modify:
1. **Critical Workflow** - Keep general approach
2. **TypeScript/Frontend Rules** - Keep and expand
3. **Implementation Standards** - Adapt for Cloudflare
4. **Testing Standards** - Frontend only
5. **Communication Protocol** - Keep as-is

## New Sections Needed

### 1. Cloudflare Pages Development
- Pages Functions patterns
- D1 database access
- Secrets management
- Deployment workflow

### 2. React + Vite Patterns
- Component structure
- State management (Zustand)
- Routing patterns
- Build optimization

### 3. Cloudflare Workers
- When to use Workers vs Pages Functions
- Worker routing patterns
- KV/R2/D1 bindings

### 4. Testing Strategy
- Frontend component testing
- API endpoint testing (local wrangler)
- E2E testing considerations

### 5. GitHub Actions CI/CD
- Build and deploy workflow
- Preview deployments
- Environment management

### 6. Modal & UI Patterns
- Inline styles for modals
- Z-index management
- CSS animations over JS

### 7. Common Pitfalls
- Production vs development behavior
- Browser caching
- Missing imports
- Framer Motion issues

## Configuration Files

### Critical Files:
1. **wrangler.toml** - Cloudflare config
2. **package.json** - Dependencies and scripts
3. **.env** - Local environment variables
4. **vite.config.ts** - Build configuration
5. **tailwind.config.js** - Styling config
6. **_redirects** - Cloudflare Pages routing

### GitHub Actions Workflow (Example):
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy dist --project-name muse-customer
```

## Development Environment Setup

### Recommended Setup:
```bash
# 1. Clone repo
git clone https://github.com/your-org/muse-and-co
cd muse-and-co/muse-customer

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 4. Set up D1 database (first time)
npm run db:setup

# 5. Start dev server
npm run dev

# 6. In another terminal, start wrangler (for functions)
npx wrangler pages dev dist --compatibility-date=2025-09-21
```

## Project Structure

```
muse-customer/
├── functions/              # Cloudflare Pages Functions
│   └── api/               # API endpoints
│       ├── surveys.ts
│       ├── send-email.ts
│       └── mx-test.ts
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components
│   │   ├── global/       # Layout components
│   │   ├── cart/         # Cart-related
│   │   └── lazy/         # Lazy-loaded components
│   ├── pages/            # Page components
│   ├── contexts/         # React Context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities
│   └── stores/           # Zustand stores
├── public/               # Static assets
├── dist/                 # Build output
├── wrangler.toml         # Cloudflare config
├── vite.config.ts        # Vite config
├── tailwind.config.js    # Tailwind config
└── package.json          # Dependencies
```

## Testing Strategy

### Local Testing:
```bash
# 1. Build for production
npm run build

# 2. Preview production build
npm run preview

# 3. Test with wrangler dev
npx wrangler pages dev dist --compatibility-date=2025-09-21

# 4. Test API endpoints
curl http://localhost:8788/api/surveys
```

### Production Deployment:
```bash
# 1. Build
npm run build

# 2. Deploy
npx wrangler pages deploy dist --project-name muse-customer

# 3. Test deployment
curl https://muse-customer.pages.dev/api/surveys
```

## Key Principles for CLAUDE.md

1. **Cloudflare-First**: All patterns assume Cloudflare deployment
2. **No Backend Confusion**: No Python/backend patterns
3. **Modern React**: React 18+ with hooks and modern patterns
4. **TypeScript Strict**: Proper typing, no `any`
5. **Edge-Native**: Design for edge deployment
6. **Vite-Specific**: Build and dev patterns for Vite
7. **Practical Examples**: Real code from our project
8. **Lesson-Learned**: Include common pitfalls

## Summary of Changes

### Remove (~60% of content):
- All NextJS/NextAuth sections
- Python/Backend sections
- Conda/Docker sections
- PostgreSQL/Alembic sections
- Server-side patterns

### Add (New content):
- Cloudflare Pages patterns
- Pages Functions API routes
- D1 database patterns
- Wrangler CLI usage
- React + Vite specifics
- Modal/UI patterns from lessons learned
- GitHub Actions for CI/CD

### Modify (Existing sections):
- Testing → Frontend only
- Deployment → Cloudflare workflow
- Configuration → Vite/Wrangler
- Project Structure → Current structure
- Environment Setup → npm-based
---

# Dark Mode Implementation Analysis & Plan
*Updated: October 1, 2025*

## Current Dark Mode Issues

### 1. Missing Tailwind v4 Dark Mode Configuration ❌
**Problem:** Tailwind CSS v4 requires explicit dark mode variant configuration
**Current State:** No `@custom-variant dark` directive in `src/index.css`
**Impact:** Dark mode classes (`dark:`) are defined but not properly activated

### 2. No Dark Class Applied to HTML ❌
**Problem:** The `<html>` element never receives the `dark` class
**Current State:** `index.html` has `<html lang="en">` with no dark class toggle
**Impact:** Dark mode is never activated even though CSS variables exist

### 3. Missing Theme Toggle Component ❌
**Problem:** No UI control for users to switch between light/dark themes
**Current State:** No toggle button or mechanism exists anywhere
**Impact:** Users cannot manually enable dark mode

### 4. Low Contrast in Dark Mode Colors ❌
**Problem:** Dark mode colors don't meet WCAG AA contrast standards
**Issues:**
- Background: `hsl(222.2 84% 4.9%)` - too dark, near black
- Cards: Same color as background (no visual separation)
- Muted text: `hsl(215 20.2% 65.1%)` - insufficient contrast
- Borders: Too dark to be visible

### 5. No System Preference Detection ❌
**Problem:** App doesn't respect user's OS dark mode setting
**Current State:** No `prefers-color-scheme` detection
**Impact:** Users with OS dark mode see light mode only

## Research: 2025 Best Practices

### Tailwind v4 Dark Mode Configuration
```css
@import "tailwindcss";

/* Required for Tailwind v4 class-based dark mode */
@custom-variant dark (&:where(.dark, .dark *));
```

### WCAG AA Color Contrast Standards
- Normal text: Minimum 4.5:1 ratio
- Large text (18pt+): Minimum 3:1 ratio
- UI components: Minimum 3:1 ratio

### Recommended Dark Mode Palette (Slate)
- Background: `#0f172a` (slate-900)
- Cards: `#1e293b` (slate-800) 
- Text: `#f1f5f9` (slate-100)
- Muted: `#94a3b8` (slate-400)
- Borders: `#334155` (slate-700)

## Implementation Plan

### Phase 1: Configure Tailwind v4 Dark Mode
1. Add `@custom-variant dark` to `src/index.css`
2. Test that dark: classes activate when .dark is on <html>

### Phase 2: Improve Color Contrast
1. Update dark mode CSS variables to use slate palette
2. Ensure visible card/background separation
3. Meet WCAG AA standards for all text

### Phase 3: Create Theme Hook
```tsx
// src/hooks/useTheme.ts
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // 1. Check localStorage
    const stored = localStorage.getItem('theme')
    if (stored) {
      applyTheme(stored as 'light' | 'dark')
      return
    }

    // 2. Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const applyTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return { theme, toggleTheme }
}
```

### Phase 4: Add Theme Toggle UI
1. Create ThemeToggle component with sun/moon icons
2. Add to dashboard header (top right)
3. Implement smooth CSS transitions
4. Add ARIA labels for accessibility

### Phase 5: Test & Validate
- [ ] Color contrast meets WCAG AA
- [ ] Theme persists on reload
- [ ] System preference detected
- [ ] Toggle accessible via keyboard
- [ ] Works on all pages
- [ ] Smooth transitions

## Color Changes

### Before (Low Contrast):
```css
.dark {
  --background: 222.2 84% 4.9%;       /* Near black */
  --card: 222.2 84% 4.9%;             /* Same as bg */
  --border: 217.2 32.6% 17.5%;        /* Too dark */
  --muted-foreground: 215 20.2% 65.1%; /* Low contrast */
}
```

### After (WCAG AA Compliant):
```css
.dark {
  --background: 222.2 47.4% 11.2%;     /* Slate-900 */
  --card: 217.2 32.6% 17.5%;           /* Slate-800 */
  --border: 215.3 25% 26.7%;           /* Slate-700 */
  --muted-foreground: 215.4 16.3% 56.9%; /* Slate-400 */
  --foreground: 210 40% 98%;           /* Slate-100 */
}
```

## Files to Modify

1. `src/index.css` - Add variant config + improve colors
2. `src/hooks/useTheme.ts` - NEW: Theme management hook
3. `src/components/ThemeToggle.tsx` - NEW: Toggle UI component
4. `src/components/layout/dashboard-header.tsx` - Add toggle button

## Testing Checklist

- [ ] Dark mode activates on toggle
- [ ] Theme persists across sessions
- [ ] System preference works
- [ ] All text readable (contrast)
- [ ] Cards separated from background
- [ ] Keyboard accessible
- [ ] No console errors
- [ ] Production build works

## References

- [Tailwind CSS v4 Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Tailwind v4 Custom Variants](https://github.com/tailwindlabs/tailwindcss/discussions/13863)
