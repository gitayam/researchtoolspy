import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import commonEN from '@/locales/en/common.json'
import commonES from '@/locales/es/common.json'

i18n
  .use(LanguageDetector) // Detect browser language
  .use(initReactI18next) // React integration
  .init({
    resources: {
      en: {
        common: commonEN,
      },
      es: {
        common: commonES,
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
