import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Navbar } from '../components/layout/Navbar'
import { ToastProvider } from '../components/ui/use-toast'

export default function DashboardLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    // Handle legacy localStorage auth migration
    const userHash = localStorage.getItem('omnicore_user_hash')
    const authStatus = localStorage.getItem('omnicore_authenticated')

    // Clean up legacy auth if exists - users can now use the app anonymously
    if (userHash || authStatus) {
      console.log('🧹 Dashboard Layout: Clearing legacy auth - enabling anonymous mode')
      localStorage.removeItem('omnicore_user_hash')
      localStorage.removeItem('omnicore_authenticated')
    }

    // Anonymous users can access the dashboard
    // They'll see prompts to save their work with a hash if desired
  }, [navigate])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="lg:pl-64">
          {/* Navbar */}
          <Navbar />

          {/* Page content */}
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}