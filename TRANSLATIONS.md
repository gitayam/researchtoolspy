# Translation System Documentation

This document describes the internationalization (i18n) system used in this application to support multiple languages.

## Overview

- **Framework**: react-i18next v15+
- **Language Detection**: i18next-browser-languagedetector
- **Supported Languages**: English (en), Spanish (es)
- **Default Language**: English
- **Fallback Language**: English

## File Structure

```
src/
├── lib/
│   └── i18n.ts                  # i18n configuration
└── locales/
    ├── en/                      # English translations
    │   ├── common.json          # Shared/common translations
    │   ├── cog.json             # Cognitive bias translations
    │   ├── comments.json        # Comments feature translations
    │   ├── activity.json        # Activity log translations
    │   ├── library.json         # Library feature translations
    │   ├── notifications.json   # Notification translations
    │   ├── entities.json        # Entity-related translations
    │   ├── deception.json       # Deception detection framework
    │   ├── ach.json             # ACH framework translations
    │   ├── investigation.json   # Investigation detail translations
    │   ├── workspace.json       # Research workspace translations
    │   ├── researchQuestion.json # Research question generator translations
    │   └── scraper.json         # Web scraper translations
    └── es/                      # Spanish translations
        ├── common.json
        ├── cog.json
        ├── comments.json
        ├── activity.json
        ├── library.json
        ├── notifications.json
        ├── entities.json
        ├── deception.json
        ├── ach.json
        ├── investigation.json
        ├── workspace.json
        ├── researchQuestion.json
        └── scraper.json
```

---

## Translation Coverage Status (Updated: December 29, 2025)

### Summary

| Category | Translated | Needs Work | Total | Coverage |
|----------|------------|------------|-------|----------|
| Pages | 32 | 17 | 49 | 65% |
| Components | 30+ | Unknown | ~50+ | ~60% |

---

## Pages WITH Translations (32)

These pages have `useTranslation` implemented:

| Page | File Path | Status |
|------|-----------|--------|
| ACH Analysis | `src/pages/ACHAnalysisPage.tsx` | ✅ Complete |
| ACH | `src/pages/ACHPage.tsx` | ✅ Complete |
| Activity | `src/pages/ActivityPage.tsx` | ✅ Complete |
| Actors | `src/pages/ActorsPage.tsx` | ✅ Complete |
| Batch Processing | `src/pages/BatchProcessingPage.tsx` | ✅ Complete |
| Citations Generator | `src/pages/CitationsGeneratorPage.tsx` | ✅ Complete |
| Claims | `src/pages/ClaimsPage.tsx` | ✅ Complete |
| Collaboration | `src/pages/CollaborationPage.tsx` | ✅ Complete |
| Content Extraction | `src/pages/ContentExtractionPage.tsx` | ✅ Complete |
| Content Intelligence | `src/pages/tools/ContentIntelligencePage.tsx` | ✅ Complete |
| Dashboard | `src/pages/DashboardPage.tsx` | ✅ Complete |
| Deception Risk | `src/pages/DeceptionRiskDashboard.tsx` | ✅ Complete |
| Events | `src/pages/EventsPage.tsx` | ✅ Complete |
| Evidence | `src/pages/EvidencePage.tsx` | ✅ Complete |
| Evidence Submissions | `src/pages/EvidenceSubmissionsPage.tsx` | ✅ Complete |
| Frameworks Index | `src/pages/frameworks/index.tsx` | ✅ Complete |
| Investigation Detail | `src/pages/InvestigationDetailPage.tsx` | ✅ Complete |
| Investigations | `src/pages/InvestigationsPage.tsx` | ✅ Complete |
| Landing | `src/pages/LandingPage.tsx` | ✅ Complete |
| Login | `src/pages/LoginPage.tsx` | ✅ Complete |
| New Investigation | `src/pages/NewInvestigationPage.tsx` | ✅ Complete |
| Not Found (404) | `src/pages/NotFoundPage.tsx` | ✅ Complete |
| Public Library | `src/pages/PublicLibraryPage.tsx` | ✅ Complete |
| Register | `src/pages/RegisterPage.tsx` | ✅ Complete |
| Reports | `src/pages/ReportsPage.tsx` | ✅ Complete |
| Research Workspace | `src/pages/ResearchWorkspacePage.tsx` | ✅ Complete |
| Research Question Generator | `src/pages/ResearchQuestionGeneratorPage.tsx` | ✅ Complete |
| Settings | `src/pages/SettingsPage.tsx` | ✅ Complete |
| Sources | `src/pages/SourcesPage.tsx` | ✅ Complete |
| Tools | `src/pages/ToolsPage.tsx` | ✅ Complete |
| URL Processing | `src/pages/URLProcessingPage.tsx` | ✅ Complete |
| Web Scraper | `src/pages/WebScraperPage.tsx` | ✅ Complete |

---

## Pages NEEDING Translations (17)

These pages do NOT have `useTranslation` and need i18n implementation:

### Medium Priority (Important but less frequent)

| Page | File Path | Description |
|------|-----------|-------------|
| AI Settings | `src/pages/AISettingsPage.tsx` | AI configuration settings |
| Content Library | `src/pages/ContentLibraryPage.tsx` | Content management |
| Create Submission Form | `src/pages/CreateSubmissionFormPage.tsx` | Form builder |
| Dataset | `src/pages/DatasetPage.tsx` | Dataset management |
| Investigation Packets | `src/pages/InvestigationPacketsPage.tsx` | Investigation bundles |
| Network Graph | `src/pages/NetworkGraphPage.tsx` | Network visualization |
| Public ACH Library | `src/pages/PublicACHLibraryPage.tsx` | Public ACH repository |
| Public ACH | `src/pages/PublicACHPage.tsx` | Public ACH viewer |
| Public Content Analysis | `src/pages/PublicContentAnalysisPage.tsx` | Public content viewer |
| Public Framework | `src/pages/PublicFrameworkPage.tsx` | Public framework viewer |
| Social Media | `src/pages/SocialMediaPage.tsx` | Social media analysis |
| Submission Forms | `src/pages/SubmissionFormsPage.tsx` | Form management |
| Submissions Review | `src/pages/SubmissionsReviewPage.tsx` | Review submissions |
| Submit Evidence | `src/pages/SubmitEvidencePage.tsx` | Evidence submission |

### Low Priority (Admin/Edge cases)

| Page | File Path | Description |
|------|-----------|-------------|
| Invite Accept | `src/pages/InviteAcceptPage.tsx` | Invitation acceptance |
| Placeholder | `src/pages/PlaceholderPage.tsx` | Placeholder page |
| Framework Placeholder | `src/pages/frameworks/FrameworkPlaceholder.tsx` | Framework placeholder |

---

## Components WITH Translations (30+)

These components have `useTranslation` implemented:

| Component | File Path |
|-----------|-----------|
| ACH Analysis Form | `src/components/ach/ACHAnalysisForm.tsx` |
| ACH Matrix | `src/components/ach/ACHMatrix.tsx` |
| App Sidebar | `src/components/layout/AppSidebar.tsx` |
| Claim Actions | `src/components/claims/ClaimActions.tsx` |
| Claim Card | `src/components/claims/ClaimCard.tsx` |
| Collaboration Team | `src/components/collaboration/CollaborationTeam.tsx` |
| Deception Profile Panel | `src/components/actors/DeceptionProfilePanel.tsx` |
| Entity Links Panel | `src/components/actors/EntityLinksPanel.tsx` |
| Evidence Item Form | `src/components/evidence/EvidenceItemForm.tsx` |
| Feedback Dialog | `src/components/feedback/FeedbackDialog.tsx` |
| Framework Usage Panel | `src/components/frameworks/FrameworkUsagePanel.tsx` |
| Investigation Create Dialog | `src/components/investigations/InvestigationCreateDialog.tsx` |
| Language Switcher | `src/components/LanguageSwitcher.tsx` |
| MOM Assessment | `src/components/actors/MOMAssessment.tsx` |
| MOM Assessment List | `src/components/actors/MOMAssessmentList.tsx` |
| MOSES Assessment | `src/components/sources/MOSESAssessment.tsx` |
| Mode Selector | `src/components/tools/ModeSelector.tsx` |
| Navbar | `src/components/layout/Navbar.tsx` |
| POP Assessment | `src/components/actors/POPAssessment.tsx` |
| Report Generator | `src/components/reports/ReportGenerator.tsx` |
| Report Type Cards | `src/components/reports/ReportTypeCards.tsx` |
| Theme Provider | `src/components/ThemeProvider.tsx` |
| Tool Card | `src/components/tools/ToolCard.tsx` |
| User Menu | `src/components/layout/UserMenu.tsx` |
| Workspace Selector | `src/components/workspace/WorkspaceSelector.tsx` |
| ACH Wizard | `src/components/ach/ACHWizard.tsx` |
| Research Plan Display | `src/components/research/ResearchPlanDisplay.tsx` |

---

## Namespaces

| Namespace | Description | Files |
|-----------|-------------|-------|
| `common` | Shared UI elements, buttons, navigation, errors | common.json |
| `cog` | Cognitive bias analysis framework | cog.json |
| `comments` | Comment/discussion features | comments.json |
| `activity` | Activity logging and tracking | activity.json |
| `library` | Public library features | library.json |
| `notifications` | User notifications | notifications.json |
| `entities` | Actors, sources, events, places | entities.json |
| `deception` | CIA SATS MOM-POP-MOSES-EVE framework | deception.json |
| `ach` | Analysis of Competing Hypotheses | ach.json |
| `investigation` | Investigation detail view | investigation.json |
| `workspace` | Research workspace | workspace.json |
| `researchQuestion` | Research question generator | researchQuestion.json |
| `scraper` | Web scraper and extractor | scraper.json |

---

## Recent Updates

### December 29, 2025 (Latest)
- Added translations for `ACHPage` and `ACHAnalysisPage`
- Added translations for `InvestigationDetailPage`
- Added translations for `ResearchWorkspacePage`
- Added translations for `ResearchQuestionGeneratorPage`
- Added translations for `WebScraperPage`
- Created 5 new namespaces: `ach`, `investigation`, `workspace`, `researchQuestion`, `scraper`
- Registered new namespaces in `i18n.ts`
- Updated English and Spanish translation files for all new namespaces
- **Coverage**: Increased to 65% of pages (32/49)