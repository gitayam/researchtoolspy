import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '@/locales/en/common.json'
import esCommon from '@/locales/es/common.json'
import enCOG from '@/locales/en/cog.json'
import esCOG from '@/locales/es/cog.json'
import enComments from '@/locales/en/comments.json'
import esComments from '@/locales/es/comments.json'
import enActivity from '@/locales/en/activity.json'
import esActivity from '@/locales/es/activity.json'
import enLibrary from '@/locales/en/library.json'
import esLibrary from '@/locales/es/library.json'
import enNotifications from '@/locales/en/notifications.json'
import esNotifications from '@/locales/es/notifications.json'
import enEntities from '@/locales/en/entities.json'
import esEntities from '@/locales/es/entities.json'

// Initialize i18next with react-i18next and language detection
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        cog: enCOG,
        comments: enComments,
        activity: enActivity,
        library: enLibrary,
        notifications: enNotifications,
        entities: enEntities
      },
      es: {
        common: esCommon,
        cog: esCOG,
        comments: esComments,
        activity: esActivity,
        library: esLibrary,
        notifications: esNotifications,
        entities: esEntities
      }
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'cog', 'comments', 'activity', 'library', 'notifications', 'entities'],

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
