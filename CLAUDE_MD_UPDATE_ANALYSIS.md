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