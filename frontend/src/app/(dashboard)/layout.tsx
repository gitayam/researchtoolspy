'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useAutoSaveActions } from '@/stores/auto-save'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { ToastProvider } from '@/components/ui/use-toast'
import { MigrationBanner } from '@/components/auto-save/migration-prompt'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, refreshUser } = useAuthStore()
  const { checkForPendingMigration } = useAutoSaveActions()

  useEffect(() => {
    // Check authentication status on mount
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    // Refresh user data to ensure it's current
    refreshUser()
    
    // Check for pending migration when user enters dashboard
    checkForPendingMigration()
  }, [isAuthenticated, router, refreshUser, checkForPendingMigration])

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Migration banner for users with pending work */}
        <MigrationBanner />
        
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