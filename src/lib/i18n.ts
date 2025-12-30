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
import enDeception from '@/locales/en/deception.json'
import esDeception from '@/locales/es/deception.json'
import enACH from '@/locales/en/ach.json'
import esACH from '@/locales/es/ach.json'
import enInvestigation from '@/locales/en/investigation.json'
import esInvestigation from '@/locales/es/investigation.json'
import enWorkspace from '@/locales/en/workspace.json'
import esWorkspace from '@/locales/es/workspace.json'
import enResearchQuestion from '@/locales/en/researchQuestion.json'
import esResearchQuestion from '@/locales/es/researchQuestion.json'
import enScraper from '@/locales/en/scraper.json'
import esScraper from '@/locales/es/scraper.json'

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
        entities: enEntities,
        deception: enDeception,
        ach: enACH,
        investigation: enInvestigation,
        workspace: enWorkspace,
        researchQuestion: enResearchQuestion,
        scraper: enScraper
      },
      es: {
        common: esCommon,
        cog: esCOG,
        comments: esComments,
        activity: esActivity,
        library: esLibrary,
        notifications: esNotifications,
        entities: esEntities,
        deception: esDeception,
        ach: esACH,
        investigation: esInvestigation,
        workspace: esWorkspace,
        researchQuestion: esResearchQuestion,
        scraper: esScraper
      }
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'cog', 'comments', 'activity', 'library', 'notifications', 'entities', 'deception', 'ach', 'investigation', 'workspace', 'researchQuestion', 'scraper'],

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
