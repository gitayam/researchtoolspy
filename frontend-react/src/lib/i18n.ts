import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '@/locales/en/common.json'
import esCommon from '@/locales/es/common.json'
import enCOG from '@/locales/en/cog.json'
import esCOG from '@/locales/es/cog.json'

// Initialize i18next with react-i18next and language detection
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        cog: enCOG
      },
      es: {
        common: esCommon,
        cog: esCOG
      }
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'cog'],

    interpolation: {
      escapeValue: false // React already escapes values
    },

    // Detection order and caches
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'app-language'
    },

    // React specific options
    react: {
      useSuspense: false // Disable suspense for better error handling
    }
  })

export default i18n
