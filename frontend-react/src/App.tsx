import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { router } from '@/routes'

function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </ErrorBoundary>
  )
}

export default App