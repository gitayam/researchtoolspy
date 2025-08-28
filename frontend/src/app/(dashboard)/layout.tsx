'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAuthenticated, useAuthLoading, useAuthStore } from '@/stores/auth'
import { AuthGuard } from '@/components/auth/auth-guard'
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
  const isAuthenticated = useIsAuthenticated()
  const isLoading = useAuthLoading()
  const { refreshUser } = useAuthStore()
  
  useEffect(() => {
    console.log('🏠 Dashboard Layout: Auth check - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading)
    
    // Handle legacy localStorage auth migration
    if (!isAuthenticated && !isLoading) {
      console.log('📝 Dashboard Layout: User not authenticated - anonymous mode enabled')
      const userHash = localStorage.getItem('omnicore_user_hash')
      const authStatus = localStorage.getItem('omnicore_authenticated')
      
      // Clean up legacy auth if exists
      if (userHash || authStatus) {
        console.log('🧹 Dashboard Layout: Clearing legacy auth')
        localStorage.removeItem('omnicore_user_hash')
        localStorage.removeItem('omnicore_authenticated')
      }
      
      // REMOVED: Forced redirect to login
      // Users can now use the app anonymously
      // They'll see prompts to save their work with a hash if desired
      return
    }

    console.log('✅ Dashboard Layout: User is authenticated, refreshing user data...')
    // Refresh user data to ensure it's current
    refreshUser()
    
    // Check for pending migration when user enters dashboard
    // checkForPendingMigration() // Temporarily disabled
  }, [isAuthenticated, router, refreshUser])

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

  // REMOVED: Auth check that prevented anonymous usage
  // Anonymous users can now access the dashboard

  return (
    <AuthGuard>
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
    </AuthGuard>
  )
}