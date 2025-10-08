import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Save,
  LogIn
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuthStore } from '@/stores/auth'

export function DashboardHeader() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Use Zustand auth store for reactive authentication state
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const authUser = useAuthStore((state) => state.user)
  const logoutUser = useAuthStore((state) => state.logout)

  // Display info for header
  const displayUser = {
    username: authUser?.account_hash ? `Hash: ${authUser.account_hash.slice(0, 8)}...` : t('auth.guest'),
    role: 'user'
  }

  const handleLogout = () => {
    logoutUser()
    // Stay on current page - no redirect needed
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'analyst':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'researcher':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm dark:bg-gray-900 dark:border-b dark:border-gray-700" role="banner">
      <div className="flex h-16 sm:h-18 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs / Page title - Better mobile spacing */}
        <div className="flex items-center gap-2 sm:gap-3 pl-14 lg:pl-0">
          <img
            src="/logo.png"
            alt="Research Tools"
            className="h-8 w-8 rounded-md lg:hidden"
          />
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
            {t('app.name')}
          </h1>
        </div>

        {/* Right side - Improved mobile layout */}
        <div className="flex items-center gap-x-2 sm:gap-x-3 lg:gap-x-4">
          {/* Workspace Selector */}
          <WorkspaceSelector />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Feedback Button */}
          <FeedbackDialog />

          {/* Authentication Status - Better mobile touch targets */}
          {!isAuthenticated ? (
            // Not logged in - show login button with save benefit
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Save className="h-4 w-4" />
                <span>{t('auth.login_to_save')}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 sm:gap-2 h-10 px-3 sm:px-4"
                aria-label="Log in to save your work"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm">{t('auth.login')}</span>
              </Button>
            </div>
          ) : (
            // Logged in - show user menu
            <>
              {/* Notifications */}
              <NotificationBell />

              {/* User menu - Improved mobile touch target */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-x-1 sm:gap-x-2 rounded-full bg-white p-1.5 sm:p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-900">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="hidden lg:flex lg:flex-col lg:items-start">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {displayUser?.username}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        getRoleColor(displayUser?.role || '')
                      )}>
                        {displayUser?.role?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    {displayUser?.username}
                  </div>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    {t('navigation.settings')}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t('auth.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  )
}