/**
 * Public Frameworks Layout
 * 
 * Available to all users without authentication requirement
 */

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Brain, User, Settings, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToastProvider } from '@/components/ui/use-toast'
import { useAuthStore } from '@/stores/auth'
import { useAutoSaveActions } from '@/stores/auto-save'
import { MigrationBanner } from '@/components/auto-save/migration-prompt'
import { useState } from 'react'

export default function PublicFrameworksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const { checkForPendingMigration } = useAutoSaveActions()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  useEffect(() => {
    // Check for pending migration when layout mounts
    if (isAuthenticated) {
      checkForPendingMigration()
    }
  }, [isAuthenticated, checkForPendingMigration])
  
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Migration banner for authenticated users */}
        <MigrationBanner />
        
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
          <div className="container mx-auto px-4">
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
              
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                <Link 
                  href="/frameworks" 
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  All Frameworks
                </Link>
                <Link 
                  href="/frameworks/swot" 
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  SWOT
                </Link>
                <Link 
                  href="/frameworks/ach/create" 
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  ACH
                </Link>
                <Link 
                  href="/frameworks/cog/create" 
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  COG
                </Link>
              </nav>
              
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
                        useAuthStore.getState().logout()
                        router.push('/frameworks')
                      }}
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link href="/login">
                      <Button variant="ghost" size="sm">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Create Account
                      </Button>
                    </Link>
                  </div>
                )}
                
                {/* Mobile menu button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
                <nav className="flex flex-col space-y-3">
                  <Link 
                    href="/frameworks" 
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    All Frameworks
                  </Link>
                  <Link 
                    href="/frameworks/swot" 
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    SWOT Analysis
                  </Link>
                  <Link 
                    href="/frameworks/ach/create" 
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ACH Analysis
                  </Link>
                  <Link 
                    href="/frameworks/cog/create" 
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    COG Analysis
                  </Link>
                </nav>
              </div>
            )}
          </div>
        </header>
        
        {/* Main Content */}
        <main>
          {children}
        </main>
        
        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
          <div className="container mx-auto px-4 py-8">
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
                  {isAuthenticated ? 'Signed in' : 'Working locally'} • Auto-save enabled
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  )
}