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

// Selector hooks for convenience
export const useLanguage = () => useI18nStore((state) => state.language)
export const useSetLanguage = () => useI18nStore((state) => state.setLanguage)
