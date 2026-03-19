# Translation Review Report
**Date:** 2025-10-13
**Issue:** Missing i18n namespace imports and hardcoded strings

---

## ✅ Fixed Issues

### 1. Missing Namespace Imports in i18n.ts (COMPLETED)
**Problem:** Three namespaces existed but weren't loaded:
- `activity.json` (47 lines, EN + ES)
- `library.json` (122 lines, EN + ES)
- `notifications.json` (29 lines, EN + ES)

**Components affected:**
- `src/components/activity/ActivityFeed.tsx:72` - `useTranslation(['activity', 'common'])`
- `src/pages/PublicLibraryPage.tsx:35` - `useTranslation(['library', 'common'])`
- `src/components/notifications/NotificationBell.tsx:29` - `useTranslation(['notifications', 'common'])`

**Fix Applied:** ✅ Added all missing imports to `src/lib/i18n.ts`
```typescript
import enActivity from '@/locales/en/activity.json'
import esActivity from '@/locales/es/activity.json'
import enLibrary from '@/locales/en/library.json'
import esLibrary from '@/locales/es/library.json'
import enNotifications from '@/locales/en/notifications.json'
import esNotifications from '@/locales/es/notifications.json'
```

**Status:** ✅ Built and deployed successfully

---

### 2. Created entities.json Namespace (COMPLETED)
**Created files:**
- `src/locales/en/entities.json` (157 lines)
- `src/locales/es/entities.json` (157 lines)

**Namespace sections:**
- `actors.*` - Complete translation keys for actors page
- `claims.*` - Translation keys for claims page
- `events.*` - Translation keys for events page
- `sources.*` - Translation keys for sources page

**Added to i18n.ts:**
```typescript
import enEntities from '@/locales/en/entities.json'
import esEntities from '@/locales/es/entities.json'
// ... added to resources and ns array
```

**Status:** ✅ Created and loaded successfully

---

### 3. Translated ActorsPage.tsx (COMPLETED)
**File:** `src/pages/entities/ActorsPage.tsx`

**Changes:**
- Added `useTranslation(['entities', 'common'])` hook
- Replaced all 40+ hardcoded strings with translation keys
- Fully translated:
  - Page title and description
  - All stat cards (Total Actors, High Risk, Organizations, Individuals)
  - Search placeholder and filter options
  - Actor type labels (Person, Organization, Unit, Government, Group, Other)
  - Risk badges (High, Medium, Low, Minimal)
  - MOM-POP profile labels (Motive, Opportunity, Means)
  - Count labels (events, evidence, links)
  - Loading and empty states
  - Dialog titles (Create/Edit Actor)
  - Aliases label

**Status:** ✅ Fully translated and deployed

---

## ⚠️ Remaining Issues: Hardcoded Strings

### Entity Pages (High Priority)

#### ActorsPage.tsx
**File:** `src/pages/entities/ActorsPage.tsx`

**Hardcoded strings:**
- Line 268: `"Actors"` (page title)
- Line 271: `"People, organizations, and entities with MOM-POP deception profiles"` (description)
- Line 276: `"Add Actor"` (button)
- Line 286: `"Total Actors"` (stat card)
- Line 296: `"High Risk"` (stat card)
- Line 313: `"Organizations"` (stat card)
- Line 323: `"Individuals"` (stat card)
- Line 344: `"Search actors..."` (input placeholder)
- Line 353: `"Filter by type"` (select placeholder)
- Line 355: `"All Types"`, `"Person"`, `"Organization"`, `"Unit"`, `"Government"`, `"Group"`, `"Other"` (select options)
- Line 373: `"Loading actors..."` (loading message)
- Line 380: `"No actors found"` (empty state)
- Line 382: `"Add Your First Actor"` (button)
- Line 417: `"High Risk"`, `"Medium Risk"`, `"Low Risk"`, `"Minimal Risk"` (risk badges)
- Line 422: `"Aliases:"` (label)
- Line 427: `"MOM-POP Profile"` (section title)
- Line 431: `"Motive"`, `"Opportunity"`, `"Means"` (MOM labels)
- Line 447: `"events"`, `"evidence"`, `"links"` (count labels)
- Line 468: `"Edit Actor"`, `"Create New Actor"` (dialog titles)

**Recommendation:** Create `entities.json` namespace:
```json
{
  "actors": {
    "title": "Actors",
    "description": "People, organizations, and entities with MOM-POP deception profiles",
    "addButton": "Add Actor",
    "stats": {
      "total": "Total Actors",
      "highRisk": "High Risk",
      "organizations": "Organizations",
      "individuals": "Individuals"
    },
    "search": "Search actors...",
    "filterType": "Filter by type",
    "types": {
      "all": "All Types",
      "person": "Person",
      "organization": "Organization",
      "unit": "Unit",
      "government": "Government",
      "group": "Group",
      "other": "Other"
    },
    "loading": "Loading actors...",
    "empty": "No actors found",
    "addFirst": "Add Your First Actor",
    "risk": {
      "high": "High Risk",
      "medium": "Medium Risk",
      "low": "Low Risk",
      "minimal": "Minimal Risk"
    },
    "aliases": "Aliases:",
    "momProfile": "MOM-POP Profile",
    "mom": {
      "motive": "Motive",
      "opportunity": "Opportunity",
      "means": "Means"
    },
    "counts": {
      "events": "events",
      "evidence": "evidence",
      "links": "links"
    },
    "dialog": {
      "edit": "Edit Actor",
      "create": "Create New Actor"
    }
  }
}
```

#### ClaimsPage.tsx
**File:** `src/pages/entities/ClaimsPage.tsx`

**Hardcoded strings:**
- Line 116: `"Claims"` (page title)
- Multiple stat card titles and empty states

**Recommendation:** Add `claims` section to `entities.json`

#### EventsPage.tsx, SourcesPage.tsx
**Files:** `src/pages/entities/EventsPage.tsx`, `src/pages/entities/SourcesPage.tsx`

**Status:** Similar pattern to ActorsPage - need translation keys for:
- Page titles
- Search placeholders
- Filter options
- Empty states
- Dialog titles

---

### Dashboard Pages (Medium Priority)

#### DashboardPage.tsx
**File:** `src/pages/DashboardPage.tsx`

**Partially translated:** Already uses some `t()` calls but has hardcoded strings:
- Line 234: `"Active Investigations"` (stat card - not using t())
- Line 295: Various section titles
- Line 467: Section headers

**Recommendation:** Migrate remaining strings to existing `common.dashboard.*` keys

#### ResearchWorkspacePage.tsx
**File:** `src/pages/ResearchWorkspacePage.tsx`

**Hardcoded strings:**
- Line 168: `"Error"` (error card)
- Line 256: `"Total Tasks"`, `"Evidence Items"`, `"Research Type"` (stat cards)
- Line 294: `"Get Started"` (card title)
- Line 354: `"Evidence Collection"` (section title)
- Line 401: `"No evidence yet"` (empty state)
- Line 420: `"Analysis Tools"` (section title)

**Recommendation:** Create `workspace.json` namespace

---

### Tools Pages (Medium Priority)

#### ToolsPage.tsx
**File:** `src/pages/ToolsPage.tsx`

**Status:** ✅ Already fully translated - uses `t('toolsPage.*')` throughout

#### ContentExtractionPage.tsx, URLProcessingPage.tsx, BatchProcessingPage.tsx, CitationsGeneratorPage.tsx
**Files:** `src/pages/tools/*.tsx`

**Status:** Needs review - likely have hardcoded form labels and button text

**Recommendation:** Create `tools.json` namespace for tool-specific strings

---

### Evidence Pages (Medium Priority)

#### EvidencePage.tsx
**File:** `src/pages/EvidencePage.tsx`

**Partially translated:** Uses `t('evidence.title')` but has hardcoded:
- Line 278: Empty state message
- Line 307: Card titles and descriptions

**Recommendation:** Expand existing `common.evidence.*` keys

#### EvidenceSubmissionsPage.tsx
**File:** `src/pages/EvidenceSubmissionsPage.tsx`

**Status:** Uses `useTranslation()` but needs key review

---

### Landing & Auth Pages (Low Priority)

#### LandingPage.tsx
**File:** `src/pages/LandingPage.tsx`

**Hardcoded strings:**
- Line 239: Hero headline
- Line 331: Section titles
- Line 345: Feature descriptions
- Line 403: Call-to-action text

**Recommendation:** Create `landing.json` namespace (low priority - English-only site for now?)

#### LoginPage.tsx, RegisterPage.tsx
**Files:** `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`

**Status:** Uses `useTranslation()` - needs verification of completeness

---

## 📋 Action Items Summary

### Completed ✅
1. ✅ Added missing namespace imports (activity, library, notifications) to i18n.ts
2. ✅ Created entities.json namespace (EN + ES)
3. ✅ Fully translated ActorsPage.tsx
4. ✅ Built and deployed all changes

### Recommended Next Steps

#### High Priority
1. **Update remaining entity pages** to use entities namespace:
   - ClaimsPage (use `entities:claims.*` keys)
   - EventsPage (use `entities:events.*` keys)
   - SourcesPage (use `entities:sources.*` keys)

#### Medium Priority
3. **Create workspace.json namespace** for ResearchWorkspacePage
4. **Create tools.json namespace** for tool pages
5. **Expand evidence keys** in common.json
6. **Audit dashboard** for remaining hardcoded strings

#### Low Priority
7. **Create landing.json namespace** (if multilingual landing needed)
8. **Review auth pages** for completeness

---

## 📁 Namespace Structure Recommendation

```
src/locales/
├── en/
│   ├── common.json          ✅ Exists (932 lines)
│   ├── cog.json             ✅ Exists
│   ├── comments.json        ✅ Exists
│   ├── activity.json        ✅ Exists (now loaded)
│   ├── library.json         ✅ Exists (now loaded)
│   ├── notifications.json   ✅ Exists (now loaded)
│   ├── entities.json        ❌ Create (actors, claims, events, sources)
│   ├── workspace.json       ❌ Create (research workspace strings)
│   ├── tools.json           ❌ Create (tool-specific strings)
│   └── landing.json         ❌ Optional (landing page)
└── es/
    └── [mirror EN structure]
```

---

## 🔧 Implementation Pattern

For each page needing translation:

1. **Import hook:**
```typescript
import { useTranslation } from 'react-i18next'
const { t } = useTranslation(['entities', 'common'])
```

2. **Replace hardcoded strings:**
```typescript
// Before:
<h1>Actors</h1>

// After:
<h1>{t('entities:actors.title')}</h1>
```

3. **Create JSON keys:**
```json
{
  "actors": {
    "title": "Actors",
    "description": "People, organizations, and entities with MOM-POP deception profiles"
  }
}
```

4. **Spanish translations:**
```json
{
  "actors": {
    "title": "Actores",
    "description": "Personas, organizaciones y entidades con perfiles de engaño MOM-POP"
  }
}
```

---

## 📊 Translation Coverage

| Namespace | EN | ES | Loaded | Used |
|-----------|----|----|--------|------|
| common | ✅ | ✅ | ✅ | ✅ |
| cog | ✅ | ✅ | ✅ | ✅ |
| comments | ✅ | ✅ | ✅ | ✅ |
| activity | ✅ | ✅ | ✅ | ✅ |
| library | ✅ | ✅ | ✅ | ✅ |
| notifications | ✅ | ✅ | ✅ | ✅ |
| entities | ✅ | ✅ | ✅ | ✅ (ActorsPage) |
| workspace | ❌ | ❌ | ❌ | ❌ |
| tools | ❌ | ❌ | ❌ | ❌ |

**Current Coverage:** 7/9 namespaces (78%)
**Target Coverage:** 9/9 namespaces (100%)

**Pages Translated:**
- ✅ ActorsPage (100% - all 40+ strings)
- ⏳ ClaimsPage (0% - namespace exists, needs implementation)
- ⏳ EventsPage (0% - namespace exists, needs implementation)
- ⏳ SourcesPage (0% - namespace exists, needs implementation)

---

## 🎯 Estimated Effort

- ~~**Create entities.json:** 2-3 hours (4 entity pages)~~ ✅ COMPLETED (1 hour)
- ~~**Update ActorsPage:** 1 hour~~ ✅ COMPLETED (45 minutes)
- **Update ClaimsPage:** 1 hour
- **Update EventsPage:** 1 hour
- **Update SourcesPage:** 1 hour
- **Create workspace.json:** 1 hour
- **Create tools.json:** 2 hours (5 tool pages)
- **Update remaining components:** 2-3 hours
- **Testing:** 1-2 hours
- **Total Remaining:** ~8-10 hours
- **Completed:** ~2 hours

---

## Notes

- All pages using `useTranslation()` were identified via grep search
- Entity pages (actors, claims, events, sources) have the most hardcoded strings
- Dashboard and tools pages are partially translated
- Landing page may not need translation if targeting English-only audience
- Spanish translations exist for all currently loaded namespaces
