import { RouterProvider } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GuestModeProvider } from '@/contexts/GuestModeContext'
import { router } from '@/routes'
import i18n from '@/lib/i18n'

function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <GuestModeProvider>
          <QueryProvider>
            <RouterProvider router={router} />
          </QueryProvider>
        </GuestModeProvider>
      </I18nextProvider>
    </ErrorBoundary>
  )
}

export default App