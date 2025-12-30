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
    │   ├── scraper.json         # Web scraper translations
    │   ├── aiSettings.json      # AI Settings translations
    │   ├── contentLibrary.json  # Content Library translations
    │   ├── submissionForm.json  # Submission Form translations
    │   ├── dataset.json         # Dataset translations
    │   ├── investigationPackets.json # Investigation Packets translations
    │   ├── networkGraph.json    # Network Graph translations
    │   ├── publicAch.json       # Public ACH translations
    │   ├── publicContentAnalysis.json # Public Content Analysis translations
    │   ├── publicFramework.json # Public Framework translations
    │   ├── socialMedia.json     # Social Media translations
    │   ├── submissionForms.json # Submission Forms translations
    │   ├── submissionsReview.json # Submissions Review translations
    │   ├── invite.json          # Invite translations
    │   └── placeholder.json     # Placeholder translations
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
        ├── scraper.json
        ├── aiSettings.json
        └── publicAch.json
```

---

## Translation Coverage Status (Updated: December 29, 2025)

### Summary

| Category | Translated | Needs Work | Total | Coverage |
|----------|------------|------------|-------|----------|
| Pages | 49 | 0 | 49 | 100% |
| Components | 30+ | Unknown | ~50+ | ~60% |

---

## Pages WITH Translations (49)

These pages have `useTranslation` implemented:

| Page | File Path | Status |
|------|-----------|--------|
| ACH Analysis | `src/pages/ACHAnalysisPage.tsx` | ✅ Complete |
| ACH | `src/pages/ACHPage.tsx` | ✅ Complete |
| AI Settings | `src/pages/AISettingsPage.tsx` | ✅ Complete |
| Activity | `src/pages/ActivityPage.tsx` | ✅ Complete |
| Actors | `src/pages/ActorsPage.tsx` | ✅ Complete |
| Batch Processing | `src/pages/BatchProcessingPage.tsx` | ✅ Complete |
| Citations Generator | `src/pages/CitationsGeneratorPage.tsx` | ✅ Complete |
| Claims | `src/pages/ClaimsPage.tsx` | ✅ Complete |
| Collaboration | `src/pages/CollaborationPage.tsx` | ✅ Complete |
| Content Extraction | `src/pages/ContentExtractionPage.tsx` | ✅ Complete |
| Content Intelligence | `src/pages/tools/ContentIntelligencePage.tsx` | ✅ Complete |
| Content Library | `src/pages/ContentLibraryPage.tsx` | ✅ Complete |
| Create Submission Form | `src/pages/CreateSubmissionFormPage.tsx` | ✅ Complete |
| Dashboard | `src/pages/DashboardPage.tsx` | ✅ Complete |
| Dataset | `src/pages/DatasetPage.tsx` | ✅ Complete |
| Deception Risk | `src/pages/DeceptionRiskDashboard.tsx` | ✅ Complete |
| Events | `src/pages/EventsPage.tsx` | ✅ Complete |
| Evidence | `src/pages/EvidencePage.tsx` | ✅ Complete |
| Evidence Submissions | `src/pages/EvidenceSubmissionsPage.tsx` | ✅ Complete |
| Framework Placeholder | `src/pages/frameworks/FrameworkPlaceholder.tsx` | ✅ Complete |
| Frameworks Index | `src/pages/frameworks/index.tsx` | ✅ Complete |
| Investigation Detail | `src/pages/InvestigationDetailPage.tsx` | ✅ Complete |
| Investigation Packets | `src/pages/InvestigationPacketsPage.tsx` | ✅ Complete |
| Investigations | `src/pages/InvestigationsPage.tsx` | ✅ Complete |
| Invite Accept | `src/pages/InviteAcceptPage.tsx` | ✅ Complete |
| Landing | `src/pages/LandingPage.tsx` | ✅ Complete |
| Login | `src/pages/LoginPage.tsx` | ✅ Complete |
| Network Graph | `src/pages/NetworkGraphPage.tsx` | ✅ Complete |
| New Investigation | `src/pages/NewInvestigationPage.tsx` | ✅ Complete |
| Not Found (404) | `src/pages/NotFoundPage.tsx` | ✅ Complete |
| Placeholder | `src/pages/PlaceholderPage.tsx` | ✅ Complete |
| Public ACH | `src/pages/PublicACHPage.tsx` | ✅ Complete |
| Public ACH Library | `src/pages/PublicACHLibraryPage.tsx` | ✅ Complete |
| Public Content Analysis | `src/pages/PublicContentAnalysisPage.tsx` | ✅ Complete |
| Public Framework | `src/pages/PublicFrameworkPage.tsx` | ✅ Complete |
| Public Library | `src/pages/PublicLibraryPage.tsx` | ✅ Complete |
| Register | `src/pages/RegisterPage.tsx` | ✅ Complete |
| Reports | `src/pages/ReportsPage.tsx` | ✅ Complete |
| Research Workspace | `src/pages/ResearchWorkspacePage.tsx` | ✅ Complete |
| Research Question Generator | `src/pages/ResearchQuestionGeneratorPage.tsx` | ✅ Complete |
| Settings | `src/pages/SettingsPage.tsx` | ✅ Complete |
| Social Media | `src/pages/SocialMediaPage.tsx` | ✅ Complete |
| Sources | `src/pages/SourcesPage.tsx` | ✅ Complete |
| Submission Forms | `src/pages/SubmissionFormsPage.tsx` | ✅ Complete |
| Submissions Review | `src/pages/SubmissionsReviewPage.tsx` | ✅ Complete |
| Submit Evidence | `src/pages/SubmitEvidencePage.tsx` | ✅ Complete |
| Tools | `src/pages/ToolsPage.tsx` | ✅ Complete |
| URL Processing | `src/pages/URLProcessingPage.tsx` | ✅ Complete |
| Web Scraper | `src/pages/WebScraperPage.tsx` | ✅ Complete |

---

## Pages NEEDING Translations (0)

All pages are now translated!

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
| `aiSettings` | AI Settings page | aiSettings.json |
| `contentLibrary` | Content Library page | contentLibrary.json |
| `submissionForm` | Submission Form page | submissionForm.json |
| `dataset` | Dataset management page | dataset.json |
| `investigationPackets` | Investigation Packets page | investigationPackets.json |
| `networkGraph` | Network Graph page | networkGraph.json |
| `publicAch` | Public ACH page | publicAch.json |
| `publicContentAnalysis` | Public Content Analysis page | publicContentAnalysis.json |
| `publicFramework` | Public Framework page | publicFramework.json |
| `socialMedia` | Social Media page | socialMedia.json |
| `submissionForms` | Submission Forms page | submissionForms.json |
| `submissionsReview` | Submissions Review page | submissionsReview.json |
| `submitEvidence` | Submit Evidence page | submitEvidence.json |
| `invite` | Invite Accept page | invite.json |
| `placeholder` | Placeholder pages | placeholder.json |

---

## Recent Updates

### December 29, 2025 (Latest)
- **Completed all page translations!**
- Added translations for `FrameworkPlaceholder`
- Added translations for `PlaceholderPage`
- Added translations for `InviteAcceptPage`
- Added translations for `SubmitEvidencePage`
- Added translations for `SubmissionsReviewPage`
- Added translations for `SubmissionFormsPage`
- Added translations for `SocialMediaPage`
- Added translations for `PublicFrameworkPage`
- Added translations for `PublicContentAnalysisPage`
- Added translations for `PublicACHPage` and `PublicACHLibraryPage`
- Added translations for `NetworkGraphPage`
- Added translations for `InvestigationPacketsPage`
- Added translations for `DatasetPage`
- Added translations for `CreateSubmissionFormPage`
- Added translations for `ContentLibraryPage`
- Added translations for `AISettingsPage`
- Added translations for `ACHPage` and `ACHAnalysisPage`
- Added translations for `InvestigationDetailPage`
- Added translations for `ResearchWorkspacePage`
- Added translations for `ResearchQuestionGeneratorPage`
- Added translations for `WebScraperPage`
- Created 20 new namespaces
- Registered new namespaces in `i18n.ts`
- Updated English and Spanish translation files for all new namespaces
- **Coverage**: Increased to 100% of pages (49/49)