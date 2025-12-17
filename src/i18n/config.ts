import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import commonEN from '@/locales/en/common.json'
import commonES from '@/locales/es/common.json'
import commentsEN from '@/locales/en/comments.json'
import commentsES from '@/locales/es/comments.json'
import libraryEN from '@/locales/en/library.json'
import libraryES from '@/locales/es/library.json'

i18n
  .use(LanguageDetector) // Detect browser language
  .use(initReactI18next) // React integration
  .init({
    resources: {
      en: {
        common: commonEN,
        comments: commentsEN,
        library: libraryEN,
      },
      es: {
        common: commonES,
        comments: commentsES,
        library: libraryES,
      },
    },
    lng: 'en', // Force English as default
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Avoid suspense boundaries for simplicity
    },
    detection: {
      order: ['localStorage'], // Only use localStorage, not browser language
      caches: ['localStorage'],
      lookupLocalStorage: 'app-language',
    },
  })

export default i18n
