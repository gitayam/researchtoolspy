# Translation System Documentation

This document describes the internationalization (i18n) system used in this application to support multiple languages.

## Overview

The application uses **react-i18next** for internationalization with the following setup:

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
    │   └── deception.json       # Deception detection framework
    └── es/                      # Spanish translations
        ├── common.json
        ├── cog.json
        ├── comments.json
        ├── activity.json
        ├── library.json
        ├── notifications.json
        ├── entities.json
        └── deception.json
```

## Configuration

The i18n configuration is in `src/lib/i18n.ts`:

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import enCommon from '@/locales/en/common.json'
import esCommon from '@/locales/es/common.json'
// ... other imports

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        // ... other namespaces
      },
      es: {
        common: esCommon,
        // ... other namespaces
      }
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'cog', 'comments', 'activity', 'library', 'notifications', 'entities', 'deception'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'app-language'
    },
    interpolation: {
      escapeValue: false // React already escapes
    }
  })

export default i18n
```

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

## Usage in Components

### Basic Usage

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation() // Uses 'common' namespace by default

  return (
    <div>
      <h1>{t('pageTitle')}</h1>
      <button>{t('buttons.save')}</button>
    </div>
  )
}
```

### Using Specific Namespace

```tsx
import { useTranslation } from 'react-i18next'

function DeceptionForm() {
  const { t } = useTranslation('deception')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('form.newAnalysis')}</p>
    </div>
  )
}
```

### Using Multiple Namespaces

```tsx
import { useTranslation } from 'react-i18next'

function MixedComponent() {
  const { t } = useTranslation(['common', 'deception'])

  return (
    <div>
      <h1>{t('common:pageTitle')}</h1>
      <p>{t('deception:title')}</p>
    </div>
  )
}
```

### Interpolation (Dynamic Values)

```tsx
// Translation file
{
  "welcome": "Welcome, {{name}}!",
  "itemCount": "You have {{count}} items"
}

// Component
function Greeting({ name, itemCount }) {
  const { t } = useTranslation()

  return (
    <div>
      <p>{t('welcome', { name })}</p>
      <p>{t('itemCount', { count: itemCount })}</p>
    </div>
  )
}
```

### Pluralization

```tsx
// Translation file
{
  "items": "{{count}} item",
  "items_plural": "{{count}} items"
}

// Component
function ItemList({ items }) {
  const { t } = useTranslation()
  return <p>{t('items', { count: items.length })}</p>
}
```

## Language Switching

### Get Current Language

```tsx
import { useTranslation } from 'react-i18next'

function LanguageDisplay() {
  const { i18n } = useTranslation()
  return <span>Current: {i18n.language}</span>
}
```

### Change Language

```tsx
import { useTranslation } from 'react-i18next'

function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div>
      <button onClick={() => changeLanguage('en')}>English</button>
      <button onClick={() => changeLanguage('es')}>Español</button>
    </div>
  )
}
```

### Language Persistence

The language preference is automatically saved to localStorage under the key `app-language`. When the user returns, their preferred language is restored.

## Adding New Translations

### 1. Add Keys to English File

Always add new keys to the English file first:

```json
// src/locales/en/common.json
{
  "newFeature": {
    "title": "My New Feature",
    "description": "This is a description",
    "buttons": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}
```

### 2. Add Corresponding Spanish Keys

```json
// src/locales/es/common.json
{
  "newFeature": {
    "title": "Mi Nueva Función",
    "description": "Esta es una descripción",
    "buttons": {
      "save": "Guardar",
      "cancel": "Cancelar"
    }
  }
}
```

### 3. Use in Component

```tsx
import { useTranslation } from 'react-i18next'

function NewFeature() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('newFeature.title')}</h1>
      <p>{t('newFeature.description')}</p>
      <button>{t('newFeature.buttons.save')}</button>
      <button>{t('newFeature.buttons.cancel')}</button>
    </div>
  )
}
```

## Adding a New Namespace

### 1. Create Translation Files

```json
// src/locales/en/myFeature.json
{
  "title": "My Feature",
  "items": { ... }
}

// src/locales/es/myFeature.json
{
  "title": "Mi Función",
  "items": { ... }
}
```

### 2. Register in i18n.ts

```typescript
// src/lib/i18n.ts
import enMyFeature from '@/locales/en/myFeature.json'
import esMyFeature from '@/locales/es/myFeature.json'

// Add to resources
resources: {
  en: {
    // ... existing
    myFeature: enMyFeature
  },
  es: {
    // ... existing
    myFeature: esMyFeature
  }
}

// Add to ns array
ns: ['common', ..., 'myFeature']
```

## Adding a New Language

### 1. Create Language Directory

```bash
mkdir -p src/locales/fr
```

### 2. Copy and Translate All Files

Copy all JSON files from `en/` to the new language directory and translate.

### 3. Register in i18n.ts

```typescript
// Import all French files
import frCommon from '@/locales/fr/common.json'
import frCog from '@/locales/fr/cog.json'
// ... etc

// Add to resources
resources: {
  en: { ... },
  es: { ... },
  fr: {
    common: frCommon,
    cog: frCog,
    // ... etc
  }
}
```

### 4. Update Language Switcher UI

Add the new language option to any language selection components.

## Translation Keys Convention

### Naming Convention

- Use **camelCase** for keys
- Group related keys under nested objects
- Use descriptive, semantic names

```json
{
  "pageTitle": "Dashboard",
  "buttons": {
    "save": "Save",
    "saveAndClose": "Save & Close",
    "cancel": "Cancel"
  },
  "form": {
    "labels": {
      "email": "Email Address",
      "password": "Password"
    },
    "placeholders": {
      "email": "Enter your email...",
      "password": "Enter password..."
    },
    "validation": {
      "required": "This field is required",
      "invalidEmail": "Please enter a valid email"
    }
  },
  "errors": {
    "generic": "Something went wrong",
    "networkError": "Network error. Please try again."
  },
  "emptyStates": {
    "noData": "No data available",
    "noResults": "No results found"
  }
}
```

### Standard Key Patterns

| Pattern | Example | Use Case |
|---------|---------|----------|
| `{feature}.title` | `dashboard.title` | Page/section titles |
| `{feature}.description` | `dashboard.description` | Subtitles, descriptions |
| `buttons.{action}` | `buttons.save` | Action buttons |
| `form.labels.{field}` | `form.labels.email` | Form field labels |
| `form.placeholders.{field}` | `form.placeholders.email` | Input placeholders |
| `form.validation.{rule}` | `form.validation.required` | Validation messages |
| `errors.{type}` | `errors.networkError` | Error messages |
| `emptyStates.{context}` | `emptyStates.noData` | Empty state messages |
| `status.{state}` | `status.active` | Status labels |

## Translation Coverage Status

### Fully Translated Pages
- Deception Detection Framework (DeceptionForm, DeceptionScoringForm, DeceptionDashboard)
- Login Page
- Content Intelligence Page (partial)

### Needs Translation (Priority Order)

#### Tier 1 - Critical
1. SettingsPage.tsx
2. AISettingsPage.tsx
3. DashboardPage.tsx (partial - needs completion)
4. InvestigationsPage.tsx
5. ReportsPage.tsx

#### Tier 2 - Important
6. NewInvestigationPage.tsx
7. RegisterPage.tsx
8. ResearchWorkspacePage.tsx
9. WebScraperPage.tsx
10. NotFoundPage.tsx

#### Tier 3 - Nice to Have
11. ActivityPage.tsx
12. Layout components (DashboardSidebar, DashboardHeader)

## Testing Translations

### Manual Testing

1. Switch language using the language selector
2. Navigate through all pages
3. Check for:
   - Missing translations (shows key instead of text)
   - Layout issues with longer text (Spanish is often 20-30% longer)
   - Truncated text in buttons or tables

### Finding Missing Keys

Look for text that appears as the raw key (e.g., `common:buttons.save` instead of "Save") - this indicates a missing translation.

## Best Practices

1. **Never hardcode user-facing text** - Always use translation keys
2. **Keep keys organized** - Use consistent naming and grouping
3. **Add both languages** - When adding English keys, add Spanish equivalents
4. **Consider text length** - Spanish text is typically 20-30% longer than English
5. **Use interpolation** - For dynamic content, use variables instead of concatenation
6. **Namespace appropriately** - Use feature-specific namespaces to keep files manageable
7. **Review context** - Translations may differ based on context (verb vs noun)

## Troubleshooting

### Translation Not Showing

1. Check the key exists in the JSON file
2. Check you're using the correct namespace
3. Check for typos in the key path
4. Verify i18n.ts imports the file correctly

### Language Not Switching

1. Check localStorage `app-language` value
2. Verify language code matches resources (e.g., `en` not `eng`)
3. Check for errors in browser console

### Type Errors

If using TypeScript, you may need to extend the type declarations:

```typescript
// src/types/i18next.d.ts
import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof import('../locales/en/common.json')
      deception: typeof import('../locales/en/deception.json')
      // ... add other namespaces
    }
  }
}
```
