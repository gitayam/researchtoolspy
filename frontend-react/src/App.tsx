import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GuestModeProvider } from '@/contexts/GuestModeContext'
import { router } from '@/routes'

function App() {
  return (
    <ErrorBoundary>
      <GuestModeProvider>
        <QueryProvider>
          <RouterProvider router={router} />
        </QueryProvider>
      </GuestModeProvider>
    </ErrorBoundary>
  )
}

export default App