# Research Tools - Improvement & Fix Plan
*Generated: 2025-10-18*

## Deployment Status ✅
- **Latest Deployment**: `8546ecce` (3 hours ago)
- **Status**: Production - Live at https://77e921e8.researchtoolspy.pages.dev
- **Recent Feature**: Git Repository Detection & Analysis

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. Production Console Logs
**Severity**: High
**Impact**: Performance degradation, potential information leakage

**Found in**:
- `functions/api/content-intelligence/git-repository-extract.ts` (lines 95, 102, 140, etc.)
- 20+ frontend source files with console.log/warn/error

**Fix**:
```typescript
// Replace console.log with conditional logging
const log = (message: string, ...args: any[]) => {
  if (env.ENVIRONMENT === 'development') {
    console.log(message, ...args)
  }
}
```

**Action Items**:
- [ ] Create logging utility with environment check
- [ ] Replace all console.log/warn with utility
- [ ] Keep console.error for critical errors only
- [ ] Add Sentry or similar for production error tracking

---

## 🟡 HIGH PRIORITY ISSUES

### 2. Bundle Size Optimization
**Severity**: Medium
**Impact**: Slow initial page load, poor mobile experience

**Current State**:
```
- index-CaR3fGEd.js: 1,152.52 kB (289.58 kB gzipped)
- pptxgen.es-BB6z6m0d.js: 796.16 kB (261.72 kB gzipped)
- exceljs.min-DUXg2VrV.js: 939.89 kB (269.78 kB gzipped)
- ContentIntelligencePage-CxmiI1HP.js: 179.79 kB (37.15 kB gzipped)
```

**Fix Strategy**:
1. **Lazy load heavy libraries**:
   ```typescript
   // Only load when needed
   const exportToPPT = async () => {
     const pptxgen = await import('pptxgenjs')
     // use pptxgen
   }
   ```

2. **Code split by route**:
   ```typescript
   const ContentIntelligencePage = lazy(() => import('./pages/tools/ContentIntelligencePage'))
   ```

3. **Tree shake unused code**:
   - Review exceljs and pptxgen imports
   - Only import what's needed

**Action Items**:
- [ ] Implement lazy loading for export libraries (pptxgen, exceljs)
- [ ] Add route-based code splitting for large pages
- [ ] Enable tree shaking in vite config
- [ ] Set target bundle size: < 500 kB per chunk
- [ ] Measure impact with Lighthouse

---

### 3. Git Repository Feature Testing
**Severity**: Medium
**Impact**: New feature might have edge cases

**Test Cases Needed**:
```bash
# GitHub
- Public repo: https://github.com/facebook/react
- Private repo (should fail gracefully)
- Repo with no README
- Repo with no releases
- Archived repo
- Rate-limited scenario

# GitLab
- Public project: https://gitlab.com/gitlab-org/gitlab
- Group project
- Subgroup project

# Bitbucket
- Public repo: https://bitbucket.org/atlassian/python-bitbucket
- Team repo
```

**Action Items**:
- [ ] Test all 3 platforms with various repo types
- [ ] Verify error handling for edge cases
- [ ] Test caching behavior (1 hour TTL)
- [ ] Add loading states UX
- [ ] Document limitations in UI

---

### 4. Error Tracking & Monitoring
**Severity**: Medium
**Impact**: No visibility into production errors

**Current State**: No error tracking configured

**Recommended Setup**:
```typescript
// Add Sentry or similar
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
})
```

**Action Items**:
- [ ] Set up Sentry or CloudFlare Web Analytics
- [ ] Add error boundaries to critical components
- [ ] Track API errors separately
- [ ] Create alerting for 5xx errors
- [ ] Monitor git-repository-extract endpoint

---

## 🟢 MEDIUM PRIORITY IMPROVEMENTS

### 5. Content Intelligence UX Enhancements
**Based on screenshot analysis**

**Observations**:
- ✅ Social media detection working well
- ✅ Good visual hierarchy
- ⚠️ Need to verify git repo detection card appears

**Improvements**:
```typescript
// Add platform-specific icons
const getPlatformIcon = (platform: string) => {
  switch(platform) {
    case 'github': return <GitHubIcon />
    case 'gitlab': return <GitLabIcon />
    case 'bitbucket': return <BitbucketIcon />
  }
}

// Add copy buttons for useful data
<Button onClick={() => copyToClipboard(repo.cloneUrl)}>
  Copy Clone URL
</Button>
```

**Action Items**:
- [ ] Add platform-specific branding/icons
- [ ] Add "Copy Clone URL" button
- [ ] Add "Open in GitHub/GitLab/Bitbucket" link
- [ ] Show repo activity metrics (commits/week)
- [ ] Add star/fork buttons that link to platform

---

### 6. Social Media Integration Improvements
**Leverage existing pattern for git repos**

**Cross-Feature Learning**:
- Social media uses extraction modes (metadata, download, stream, transcript)
- Git repos should have similar flexibility

**New Features**:
```typescript
// Add extraction modes for git
- 'quick': Just stars, forks, description
- 'full': All data including commits, languages
- 'contributors': Focus on contributor data
- 'activity': Recent commits and releases only
```

**Action Items**:
- [ ] Add extraction mode selector
- [ ] Implement quick mode for faster loading
- [ ] Add "View Contributors" mode
- [ ] Cache different modes separately

---

### 7. Accessibility & Internationalization
**Current State**: English only, limited a11y

**Improvements Needed**:
```json
// Add to es/common.json
{
  "gitRepo": {
    "detected": "Repositorio Git Detectado",
    "extracting": "Extrayendo información del repositorio...",
    "stars": "Estrellas",
    "forks": "Bifurcaciones"
  }
}
```

**Action Items**:
- [ ] Add Spanish translations for git repo feature
- [ ] Add ARIA labels to extraction buttons
- [ ] Ensure keyboard navigation works
- [ ] Test with screen readers
- [ ] Add focus indicators

---

## 🔵 LOW PRIORITY / FUTURE ENHANCEMENTS

### 8. Performance Optimizations
**Opportunities**:
- Implement virtual scrolling for long commit lists
- Add pagination for commits/languages
- Optimize README rendering (markdown parsing)
- Add service worker for offline support

### 9. Advanced Git Features
**Future Features**:
```typescript
// Repository insights
- Code frequency graph
- Contributor timeline
- Issue/PR statistics
- Dependency analysis
- Security alerts
```

### 10. Integration Enhancements
**Connect with other tools**:
- Auto-create actors from contributors
- Link commits to evidence timeline
- Import issues as research questions
- Citation generator for code references

---

## 📊 METRICS TO TRACK

### Performance
- [ ] Time to First Byte (TTFB): < 200ms
- [ ] Largest Contentful Paint (LCP): < 2.5s
- [ ] First Input Delay (FID): < 100ms
- [ ] Cumulative Layout Shift (CLS): < 0.1
- [ ] Bundle size: < 500 kB per chunk

### Features
- [ ] Git repo extraction success rate: > 95%
- [ ] Cache hit rate: > 60%
- [ ] API response time: < 1s average
- [ ] Error rate: < 1%

### User Engagement
- [ ] % of git URLs analyzed
- [ ] Most popular git platforms
- [ ] Average time on results page
- [ ] Copy/share actions per analysis

---

## 🔧 STANDARD OPERATING PROCEDURES

### SOP-001: Adding New Platform Support
1. Create platform detector function
2. Implement API extraction logic
3. Add error handling for all failure modes
4. Implement caching with appropriate TTL
5. Add UI detection card
6. Add results display components
7. Write tests for edge cases
8. Update documentation
9. Deploy and monitor

### SOP-002: Console Log Cleanup
1. Search: `grep -r "console\." src/`
2. Replace with logging utility
3. Test in development mode
4. Verify no logs in production
5. Add pre-commit hook to prevent future additions

### SOP-003: Bundle Size Management
1. Run build and check sizes
2. Identify chunks > 500 kB
3. Implement lazy loading or code splitting
4. Measure before/after
5. Document in Lessons_Learned.md

---

## 📝 IMMEDIATE ACTION PLAN (Next 24 Hours)

### Phase 1: Critical Fixes (2 hours)
1. ✅ Create logging utility
2. ✅ Replace console logs in git-repository-extract.ts
3. ✅ Add error boundary to ContentIntelligencePage
4. ✅ Test git repo feature with 10+ URLs

### Phase 2: High Priority (4 hours)
1. ✅ Implement lazy loading for pptxgen/exceljs
2. ✅ Add route-based code splitting
3. ✅ Set up basic error tracking
4. ✅ Add Spanish translations for git feature

### Phase 3: Testing & Validation (2 hours)
1. ✅ Run Lighthouse audit
2. ✅ Test all git platforms
3. ✅ Verify caching works
4. ✅ Check mobile responsiveness

---

## 📚 REFERENCES

- [Web Vitals](https://web.dev/vitals/)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [GitHub API Docs](https://docs.github.com/en/rest)
- [GitLab API Docs](https://docs.gitlab.com/ee/api/)
- [Bitbucket API Docs](https://developer.atlassian.com/cloud/bitbucket/rest/)
- [Lessons_Learned.md](./Lessons_Learned.md)

---

## ✅ COMPLETED ITEMS
- [x] Git repository detection and extraction (2025-10-18)
- [x] Social media detection for Twitter/X (2025-10-17)
- [x] One-click share functionality (2025-10-17)
- [x] Citation auto-generation (2025-10-17)
- [x] Security vulnerabilities fixed (2025-10-17)
- [x] Web scraping error handling improvements (2025-10-17)
