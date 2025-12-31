import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GuestModeProvider } from '@/contexts/GuestModeContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { useAuthStore } from '@/stores/auth'
import { router } from '@/routes'
import i18n from '@/lib/i18n'

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth)

  // Check authentication state on app load
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Sync language from user settings on app load
  useEffect(() => {
    const syncLanguageFromSettings = () => {
      try {
        const userHash = localStorage.getItem('omnicore_user_hash')
        if (!userHash) return

        // Check if user has stored settings with a language preference
        const settingsKey = `settings_${userHash}`
        const storedSettings = localStorage.getItem(settingsKey)

        if (storedSettings) {
          const settings = JSON.parse(storedSettings)
          const storedLanguage = settings?.display?.language

          if (storedLanguage && storedLanguage !== i18n.language) {
            // Sync the language from user settings to i18n
            i18n.changeLanguage(storedLanguage)
            localStorage.setItem('app-language', storedLanguage)
            document.documentElement.lang = storedLanguage
          }
        }
      } catch (error) {
        console.error('Failed to sync language from settings:', error)
      }
    }

    syncLanguageFromSettings()
  }, [])

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <GuestModeProvider>
          <WorkspaceProvider>
            <QueryProvider>
              <RouterProvider router={router} />
            </QueryProvider>
          </WorkspaceProvider>
        </GuestModeProvider>
      </I18nextProvider>
    </ErrorBoundary>
  )
}

export default App
