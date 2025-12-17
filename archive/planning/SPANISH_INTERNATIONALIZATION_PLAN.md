# Spanish Language Internationalization Plan

## Executive Summary

Comprehensive plan to add Spanish language support across the application including UI labels, instructions, and AI-generated content using modern React i18n best practices.

## Current State Analysis

### What We Have
- **No i18n library** - No existing internationalization infrastructure
- **Hardcoded English text** - All labels, instructions, and prompts are in English
- **AI Prompts** - Located in both frontend components and Cloudflare Functions
- **Zustand for state** - Using Zustand for global state management
- **Multiple AI endpoints** - Distributed across `/functions/api/ai/` directory
- **React 19** - Latest React with modern patterns

### Key Challenges Identified
1. **AI prompt localization** - Need to translate system prompts AND request Spanish responses
2. **Distributed AI calls** - AI prompts in both frontend and backend functions
3. **Dynamic content** - Framework configs, prompt questions, descriptions all hardcoded
4. **Type safety** - Must maintain TypeScript type safety across translations
5. **Bundle size** - Must minimize impact on bundle size

## Recommended Solution: react-i18next

### Why react-i18next?
✅ **Industry standard** - Most popular React i18n solution (11k+ stars)
✅ **TypeScript support** - Full type safety for translation keys
✅ **Lightweight** - Tree-shakeable, minimal bundle impact
✅ **React 19 compatible** - Supports latest React features
✅ **Lazy loading** - Load translations on demand
✅ **Namespace support** - Split translations by domain (UI, AI prompts, etc.)
✅ **Interpolation** - Dynamic values in translations
✅ **Pluralization** - Spanish plural rules support

### Alternative Considered
- **next-intl** - Too Next.js focused, overkill for Vite/React
- **react-intl (Format.js)** - Heavier, more complex API
- **Custom solution** - Reinventing the wheel, not recommended

## Implementation Architecture

### 1. Translation Storage Structure

```
/frontend-react/src/locales/
├── en/
│   ├── common.json          # Common UI labels (buttons, navigation, etc.)
│   ├── frameworks.json       # Framework names, sections, descriptions
│   ├── ai-prompts.json       # AI system prompts and instructions
│   ├── forms.json            # Form labels, validations, placeholders
│   ├── evidence.json         # Evidence types, badges, labels
│   └── errors.json           # Error messages
└── es/
    ├── common.json
    ├── frameworks.json
    ├── ai-prompts.json
    ├── forms.json
    ├── evidence.json
    └── errors.json
```

### 2. Language State Management

**New Zustand Store**: `src/stores/i18n.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SupportedLanguage = 'en' | 'es'

interface I18nState {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'app-language', // localStorage key
    }
  )
)
```

### 3. i18next Configuration

**New file**: `src/i18n/config.ts`

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import commonEN from '@/locales/en/common.json'
import commonES from '@/locales/es/common.json'
import frameworksEN from '@/locales/en/frameworks.json'
import frameworksES from '@/locales/es/frameworks.json'
// ... import other namespaces

i18n
  .use(LanguageDetector) // Detect browser language
  .use(initReactI18next) // React integration
  .init({
    resources: {
      en: {
        common: commonEN,
        frameworks: frameworksEN,
        // ... other namespaces
      },
      es: {
        common: commonES,
        frameworks: frameworksES,
        // ... other namespaces
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Avoid suspense boundaries for simplicity
    },
  })

export default i18n
```

### 4. Language Switcher Component

**New file**: `src/components/ui/LanguageSwitcher.tsx`

```typescript
import { useI18nStore } from '@/stores/i18n'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18nStore()
  const { i18n } = useTranslation()

  const handleLanguageChange = (lang: 'en' | 'es') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Globe className="h-4 w-4 mr-2" />
          {language === 'en' ? 'English' : 'Español'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleLanguageChange('en')}>
          🇺🇸 English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange('es')}>
          🇪🇸 Español
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### 5. Using Translations in Components

**Before (Hardcoded)**:
```typescript
<Button>Save Analysis</Button>
<Label>Linked Evidence</Label>
```

**After (Translated)**:
```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation('common')

  return (
    <>
      <Button>{t('buttons.save')}</Button>
      <Label>{t('evidence.linked')}</Label>
    </>
  )
}
```

### 6. AI Prompt Localization Strategy

#### Frontend AI Calls (AIGenerateDialog, AITimelineGenerator, etc.)

**Current**:
```typescript
const prompt = `You are an expert analyst. Generate recommendations...`
```

**New Approach**:
```typescript
import { useTranslation } from 'react-i18next'
import { useI18nStore } from '@/stores/i18n'

function AIComponent() {
  const { t } = useTranslation('ai-prompts')
  const { language } = useI18nStore()

  const systemPrompt = t('timeline.system')
  const userPrompt = t('timeline.user', { context: formData })

  // Add language instruction to ensure response language
  const languageInstruction = language === 'es'
    ? '\n\nIMPORTANTE: Responde COMPLETAMENTE en español.'
    : '\n\nIMPORTANT: Respond COMPLETELY in English.'

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({
      systemPrompt: systemPrompt + languageInstruction,
      userPrompt,
      language, // Pass to backend
    })
  })
}
```

#### Backend AI Calls (Cloudflare Functions)

**Update all `/functions/api/ai/*.ts` files**:

```typescript
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { language = 'en', ...otherParams } = await context.request.json()

  // Load appropriate prompts based on language
  const prompts = language === 'es' ? PROMPTS_ES : PROMPTS_EN

  // Add language enforcement to system message
  const systemMessage = language === 'es'
    ? prompts.system + '\n\nDebe responder COMPLETAMENTE en español.'
    : prompts.system + '\n\nYou must respond COMPLETELY in English.'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompts.user }
      ],
      // ... other params
    })
  })
}
```

#### Translation Files for AI Prompts

**`/locales/en/ai-prompts.json`**:
```json
{
  "timeline": {
    "system": "You are a behavior analysis expert creating a detailed timeline...",
    "user": "Create a timeline for: {{context}}\n\nREQUIREMENTS:\n1. Main sequence...",
    "enforce": "You must respond COMPLETELY in English."
  },
  "questions": {
    "system": "You are an expert intelligence analyst...",
    "followup": "Generate follow-up questions based on...",
    "enforce": "You must respond COMPLETELY in English."
  }
}
```

**`/locales/es/ai-prompts.json`**:
```json
{
  "timeline": {
    "system": "Eres un experto en análisis de comportamiento creando una línea de tiempo detallada...",
    "user": "Crea una línea de tiempo para: {{context}}\n\nREQUISITOS:\n1. Secuencia principal...",
    "enforce": "Debes responder COMPLETAMENTE en español."
  },
  "questions": {
    "system": "Eres un analista de inteligencia experto...",
    "followup": "Genera preguntas de seguimiento basadas en...",
    "enforce": "Debes responder COMPLETAMENTE en español."
  }
}
```

### 7. Framework Configs Localization

**Current `framework-configs.ts`**:
```typescript
export const frameworkConfigs = {
  behavior: {
    title: 'Behavior Analysis',
    description: 'Objective documentation...',
    sections: [
      {
        label: 'Environmental Factors',
        description: 'Physical and environmental context...',
        promptQuestions: [
          'What physical infrastructure exists?',
          // ...
        ]
      }
    ]
  }
}
```

**New Approach - Use Translation Keys**:
```typescript
// framework-configs.ts becomes a structure with translation keys
export const frameworkConfigs = {
  behavior: {
    titleKey: 'frameworks:behavior.title',
    descriptionKey: 'frameworks:behavior.description',
    sections: [
      {
        labelKey: 'frameworks:behavior.sections.environmental.label',
        descriptionKey: 'frameworks:behavior.sections.environmental.description',
        promptQuestionsKey: 'frameworks:behavior.sections.environmental.questions',
      }
    ]
  }
}

// In components, use:
const { t } = useTranslation('frameworks')
const config = frameworkConfigs['behavior']
return <h1>{t(config.titleKey)}</h1>
```

### 8. Type Safety for Translations

**Create typed translation helper**:

```typescript
// src/i18n/typed-translations.ts
import { useTranslation as useTranslationBase } from 'react-i18next'
import type { TFunction } from 'i18next'

// Generate types from translation files
type TranslationKeys =
  | 'common.buttons.save'
  | 'common.buttons.cancel'
  | 'frameworks.behavior.title'
  // ... (can be auto-generated from JSON files)

export function useTranslation(namespace?: string) {
  const translation = useTranslationBase(namespace)
  return {
    ...translation,
    t: translation.t as TFunction<TranslationKeys>
  }
}
```

## Implementation Phases

### Phase 1: Infrastructure Setup (Day 1-2)
- [ ] Install dependencies: `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- [ ] Create i18n configuration
- [ ] Create Zustand language store
- [ ] Create translation file structure
- [ ] Add LanguageSwitcher component to navigation
- [ ] Test basic language switching

### Phase 2: UI Translation (Day 3-5)
- [ ] Translate common UI elements (buttons, labels, navigation)
- [ ] Translate form fields and validations
- [ ] Translate framework configs and sections
- [ ] Translate evidence types and badges
- [ ] Translate error messages
- [ ] Update all components to use `useTranslation`

### Phase 3: AI Prompt Localization (Day 6-8)
- [ ] Create AI prompt translation files (en/es)
- [ ] Update frontend AI components to use translated prompts
- [ ] Update all Cloudflare Functions to accept language parameter
- [ ] Implement language enforcement in AI responses
- [ ] Test AI responses in both languages
- [ ] Add language instruction to all AI system prompts

### Phase 4: Dynamic Content (Day 9-10)
- [ ] Translate framework-specific content
- [ ] Translate guided questions
- [ ] Translate BCW/COM-B content
- [ ] Translate report templates
- [ ] Translate export formats

### Phase 5: Testing & Refinement (Day 11-12)
- [ ] End-to-end testing in Spanish
- [ ] AI quality testing (ensure Spanish responses are coherent)
- [ ] Performance testing (bundle size impact)
- [ ] User acceptance testing
- [ ] Fix translation issues

### Phase 6: Documentation & Launch (Day 13-14)
- [ ] Translation contribution guide
- [ ] Update README with language support info
- [ ] Create translation maintenance workflow
- [ ] Prepare for additional languages (framework is ready)
- [ ] Production deployment

## File Changes Required

### New Files to Create
```
src/i18n/
  ├── config.ts                    # i18next configuration
  └── typed-translations.ts        # Type-safe translation helpers

src/locales/
  ├── en/
  │   ├── common.json
  │   ├── frameworks.json
  │   ├── ai-prompts.json
  │   ├── forms.json
  │   ├── evidence.json
  │   └── errors.json
  └── es/
      ├── common.json
      ├── frameworks.json
      ├── ai-prompts.json
      ├── forms.json
      ├── evidence.json
      └── errors.json

src/stores/
  └── i18n.ts                      # Language state store

src/components/ui/
  └── LanguageSwitcher.tsx         # Language picker
```

### Files to Modify (100+ files)
- All component files using hardcoded text
- All AI-related components
- All Cloudflare Functions in `/functions/api/ai/`
- `framework-configs.ts`
- Navigation components
- Form components
- Error handling components

### Files to Update Minimally
- `main.tsx` - Import and initialize i18n
- `App.tsx` - Wrap with i18n provider (if needed)
- `package.json` - Add i18n dependencies

## Dependencies to Add

```json
{
  "dependencies": {
    "i18next": "^23.15.0",
    "react-i18next": "^15.1.0",
    "i18next-browser-languagedetector": "^8.0.0"
  },
  "devDependencies": {
    "@types/i18next": "^13.0.0"
  }
}
```

**Bundle Size Impact**: ~50KB gzipped (acceptable for the value provided)

## AI Response Language Enforcement

### Critical: Ensuring Spanish Responses

**Problem**: Even with Spanish prompts, AI might respond in English if not explicitly instructed.

**Solution - Triple enforcement**:

1. **System message suffix** (in AI API calls):
```typescript
const systemMessage = baseSystemMessage + (language === 'es'
  ? '\n\nIMPERATIVO: Debes responder COMPLETAMENTE en español. Todas las palabras, frases y oraciones deben estar en español.'
  : '\n\nIMPERATIVE: You must respond COMPLETELY in English. All words, phrases, and sentences must be in English.')
```

2. **User prompt prefix** (in AI API calls):
```typescript
const userPrompt = language === 'es'
  ? 'RESPONDE EN ESPAÑOL:\n\n' + basePrompt
  : 'RESPOND IN ENGLISH:\n\n' + basePrompt
```

3. **Response validation** (frontend):
```typescript
const response = await generateAI(...)
const containsEnglish = /[a-z]{4,}/i.test(response) // Basic check
const containsSpanish = /[áéíóúñ¿¡]/i.test(response)

if (language === 'es' && !containsSpanish) {
  console.warn('AI responded in wrong language, retrying...')
  // Optionally retry with stronger enforcement
}
```

## Data Persistence Considerations

### User Preference Storage
- **LocalStorage**: Language preference via Zustand persist
- **Database**: Optionally store in user profile for cross-device sync
- **Priority**: LocalStorage > User DB > Browser locale > Default (English)

### Multilingual Content Storage

**Analysis/Framework Data** - Store in original language entered:
```typescript
interface BehaviorAnalysis {
  // ... existing fields
  created_language?: 'en' | 'es'  // Track creation language
}
```

**Benefits**:
- Preserves original intent
- Allows language switching without data loss
- Enables future translation features

## SEO & Accessibility

### URL Structure (Future consideration)
```
/en/behavior/create
/es/comportamiento/crear
```

### HTML Lang Attribute
```typescript
// In main.tsx or App.tsx
useEffect(() => {
  document.documentElement.lang = language
}, [language])
```

### Accessibility
- ARIA labels must be translated
- Screen reader text must be localized
- RTL support (not needed for Spanish, but framework ready)

## Testing Strategy

### Unit Tests
```typescript
import { renderWithI18n } from '@/test-utils'

describe('MyComponent', () => {
  it('renders in English', () => {
    const { getByText } = renderWithI18n(<MyComponent />, 'en')
    expect(getByText('Save Analysis')).toBeInTheDocument()
  })

  it('renders in Spanish', () => {
    const { getByText } = renderWithI18n(<MyComponent />, 'es')
    expect(getByText('Guardar Análisis')).toBeInTheDocument()
  })
})
```

### AI Quality Tests
- Automated checks for language consistency
- Sample prompts in both languages
- Regression tests for AI responses

## Translation Workflow

### Initial Translation
1. Extract all English text to JSON files
2. Professional translation service or bilingual team member
3. Review and approve translations
4. Commit to repository

### Ongoing Maintenance
1. Developer adds new feature with English text
2. Add translation key to en/*.json
3. Mark as `[NEEDS_TRANSLATION]` in es/*.json
4. Translation service updates Spanish files
5. CI/CD checks for missing translations

### Tools
- **i18n-tasks**: Manage translation keys, find missing translations
- **Google Translate API**: Initial draft (review required)
- **Crowdin/Lokalise**: Professional translation management (optional)

## Performance Optimization

### Lazy Loading Translations
```typescript
// Load translations on demand
i18n.use(Backend).init({
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
  ns: ['common'], // Load common immediately
  defaultNS: 'common',
})

// Load other namespaces when needed
const { t } = useTranslation(['common', 'frameworks'])
```

### Code Splitting
```typescript
// Dynamic import for large translation files
const loadTranslations = async (lang: string) => {
  const translations = await import(`@/locales/${lang}/frameworks.json`)
  i18n.addResourceBundle(lang, 'frameworks', translations)
}
```

## Risks & Mitigation

### Risk 1: AI Mixing Languages
**Mitigation**: Triple enforcement + response validation + retry logic

### Risk 2: Translation Quality Issues
**Mitigation**: Professional translation + native speaker review + user feedback

### Risk 3: Increased Bundle Size
**Mitigation**: Lazy loading + code splitting + namespace separation

### Risk 4: Development Overhead
**Mitigation**: Good tooling + automated checks + clear workflow

### Risk 5: Missing Translations
**Mitigation**: Fallback to English + CI/CD checks + i18n-tasks

## Success Metrics

### Technical
- [ ] 100% UI coverage (all text translatable)
- [ ] <100ms language switch time
- [ ] <60KB bundle size increase
- [ ] AI responds correctly in target language >95% of time

### User Experience
- [ ] Users can complete full workflow in Spanish
- [ ] No English "leakage" in Spanish mode
- [ ] Consistent terminology across app
- [ ] Professional translation quality

## Future Enhancements

### Additional Languages (Framework Ready)
- Portuguese (Brazil) - `pt-BR`
- French - `fr`
- German - `de`
- Chinese - `zh` (requires RTL considerations)

### Advanced Features
- User-contributed translations
- In-context translation editing (for admins)
- Translation memory for consistency
- Automated translation suggestions
- Language-specific formatting (dates, numbers, currency)

## Estimated Effort

**Total Time**: ~10-14 days (2 weeks)

**Team Requirements**:
- 1 Frontend Developer (React/TypeScript expert)
- 1 Spanish Translator (native speaker)
- 1 QA Tester (bilingual)

**Breakdown**:
- Setup & Infrastructure: 2 days
- UI Translation: 3 days
- AI Localization: 3 days
- Testing: 3 days
- Documentation: 1 day
- Contingency: 2 days

## Conclusion

This plan provides a **modern, scalable, and maintainable** approach to Spanish internationalization using industry-standard tools (react-i18next). The architecture supports:

✅ **Complete UI translation** with type safety
✅ **AI prompt & response localization** with enforcement
✅ **Minimal bundle size impact** through lazy loading
✅ **Easy addition of future languages** (framework is language-agnostic)
✅ **Developer-friendly workflow** with clear patterns
✅ **High-quality translations** with proper tooling

**Next Steps**: Approve plan → Install dependencies → Begin Phase 1

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Author**: Development Team
**Status**: Awaiting Approval
