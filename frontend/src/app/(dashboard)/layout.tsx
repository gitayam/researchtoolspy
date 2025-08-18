'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
// import { useAuthStore } from '@/stores/auth' // Temporarily disabled
// import { useAutoSaveActions } from '@/stores/auto-save' // Temporarily disabled
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { ToastProvider } from '@/components/ui/use-toast'
// import { MigrationBanner } from '@/components/auto-save/migration-prompt' // Temporarily disabled

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  // Hash-based authentication check
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Check if user has a valid hash
    const userHash = localStorage.getItem('omnicore_user_hash')
    const authStatus = localStorage.getItem('omnicore_authenticated')
    
    if (userHash && authStatus === 'true') {
      setIsAuthenticated(true)
    } else {
      // Redirect to login if not authenticated
      router.push('/login')
    }
    setIsLoading(false)
  }, [router])

  // useEffect(() => {
  //   // Check authentication status on mount
  //   if (!isAuthenticated) {
  //     router.push('/login')
  //     return
  //   }

  //   // Refresh user data to ensure it's current
  //   refreshUser()
    
  //   // Check for pending migration when user enters dashboard
  //   checkForPendingMigration()
  // }, [isAuthenticated, router, refreshUser, checkForPendingMigration])

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
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Migration banner temporarily disabled */}
        
        <DashboardSidebar />
        <div className="lg:pl-64">
          <DashboardHeader />
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}