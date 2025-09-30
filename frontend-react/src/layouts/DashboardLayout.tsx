import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'

export function DashboardLayout() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, user } = useAuthStore()

  useEffect(() => {
    // Handle legacy localStorage auth migration
    if (!isAuthenticated) {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const authStatus = localStorage.getItem('omnicore_authenticated')

      // If user has legacy auth, clear it and redirect to login
      if (userHash || authStatus) {
        localStorage.removeItem('omnicore_user_hash')
        localStorage.removeItem('omnicore_authenticated')
      }

      navigate('/login')
      return
    }
  }, [isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <DashboardHeader />
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
