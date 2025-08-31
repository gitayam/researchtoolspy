/**
 * Public Frameworks Layout
 * 
 * Available to all users without authentication requirement
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brain, User, Settings, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToastProvider } from '@/components/ui/use-toast'
import { useAuthStore, useIsAuthenticated, useUser } from '@/stores/auth'
import { AuthGuard } from '@/components/auth/auth-guard'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
// import { useAutoSaveActions } from '@/stores/auto-save' // Temporarily disabled
// import { MigrationBanner } from '@/components/auto-save/migration-prompt' // Temporarily disabled

export default function PublicFrameworksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const isAuthenticated = useIsAuthenticated()
  const user = useUser()
  const { logout } = useAuthStore()
  // const { checkForPendingMigration } = useAutoSaveActions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  console.log('🖼️ Frameworks Layout: isAuthenticated =', isAuthenticated, ', user =', user?.username)
  
  // useEffect(() => {
  //   // Check for pending migration when layout mounts
  //   if (isAuthenticated) {
  //     checkForPendingMigration()
  //   }
  // }, [isAuthenticated, checkForPendingMigration])
  
  return (
    <AuthGuard>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Migration banner temporarily disabled */}
          
          {/* Sidebar */}
          <DashboardSidebar />
          
          {/* Main content with sidebar offset */}
          <div className="lg:pl-64">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                  {/* Logo */}
                  <Link href="/frameworks" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Analysis Frameworks
                    </span>
                  </Link>
                  
                  {/* User Menu */}
                  <div className="flex items-center gap-3">
                    {isAuthenticated ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {user?.username || 'User'}
                        </span>
                        <Link href="/dashboard">
                          <Button variant="outline" size="sm">
                            Dashboard
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            logout()
                            router.push('/frameworks')
                          }}
                        >
                          Logout
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link href="/login">
                          <Button variant="ghost" size="sm">
                            Access Work
                          </Button>
                        </Link>
                        <Link href="/register">
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                            Get Bookmark
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>
            
            {/* Main Content */}
            <main className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
            
            {/* Footer */}
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
              <div className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                      <Brain className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">
                      Professional Analysis Frameworks
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {isAuthenticated ? 'Work saved' : 'Working locally'} • Auto-save enabled
                    </span>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </ToastProvider>
    </AuthGuard>
  )
}