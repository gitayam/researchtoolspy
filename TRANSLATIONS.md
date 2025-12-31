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
    │   ├── submitEvidence.json  # Submit Evidence translations
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
        ├── publicAch.json
        ├── publicContentAnalysis.json
        ├── publicFramework.json
        ├── socialMedia.json
        ├── submissionForms.json
        ├── submissionsReview.json
        ├── invite.json
        └── placeholder.json
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

All pages have `useTranslation` implemented and are considered fully translated.

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

## AI-Generated Content Translation

The application also supports translating AI-generated analysis output to the user's selected language.

### Supported Features

| Feature | Status | Implementation |
|---------|--------|----------------|
| Deception Analysis (CIA SATS) | ✅ Full | `ai-deception-analysis.ts` |
| URL Scraper Extraction | ✅ Full | `scrape-url.ts` |
| Content Intelligence | ✅ Full | Various CI endpoints |

### How It Works

1. **Frontend** passes the current `i18n.language` to API endpoints
2. **Backend** includes explicit language instructions in AI prompts
3. **Cache keys** include language to prevent mixed-language responses
4. Language instructions are placed in both system prompts and user prompts for reinforcement

### Language Instruction Pattern

```typescript
function getLanguageInstruction(languageCode?: string): string {
  if (!languageCode || languageCode === 'en') return ''
  const languageName = LANGUAGE_NAMES[languageCode]
  return `
=== CRITICAL LANGUAGE REQUIREMENT ===
You MUST write ALL text output in ${languageName}.
This is NON-NEGOTIABLE. Every string value in your JSON response MUST be in ${languageName}.
- "scenario" field: Write in ${languageName}
- All array items: Write in ${languageName}
- All questions/answers: Write in ${languageName}
DO NOT write in English. Write EVERYTHING in ${languageName}.
=== END LANGUAGE REQUIREMENT ===
`
}
```

### Supported Languages for AI Output

| Code | Language |
|------|----------|
| en | English |
| es | Spanish (Español) |
| fr | French (Français) |
| de | German (Deutsch) |
| pt | Portuguese (Português) |
| it | Italian (Italiano) |
| zh | Chinese (中文) |
| ja | Japanese (日本語) |
| ko | Korean (한국어) |
| ar | Arabic (العربية) |
| ru | Russian (Русский) |

---

## Recent Updates

### December 31, 2025 (Latest)
- **Added AI-generated content translation support**
- URL Scraper now respects user's language preference for all AI output
- Deception Analysis outputs in user's selected language
- Cache keys include language to prevent mixed-language cached responses
- Fixed language persistence issue on browser refresh (sync from user settings)

### December 29, 2025
- **Completed all page translations!**
- This marks the end of the translation effort for all pages in the application.
- All pages listed in `TRANSLATIONS.md` are now fully translated with i18n support.
- Total of 21 new namespaces created for this effort.
- **Coverage**: Increased to 100% of pages (49/49)
