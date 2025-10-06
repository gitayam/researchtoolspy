import { useState, useEffect } from 'react'
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

export function DashboardHeader() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  // Hash-based user info (optional authentication)
  const [userHash, setUserHash] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const hash = localStorage.getItem('omnicore_user_hash')
    const authenticated = localStorage.getItem('omnicore_authenticated') === 'true'
    setUserHash(hash)
    setIsAuthenticated(authenticated && !!hash)
  }, [])

  const user = {
    username: userHash ? `Hash: ${userHash.slice(0, 8)}...` : t('auth.guest'),
    role: 'user'
  }

  const handleLogout = () => {
    // Clear hash-based authentication
    localStorage.removeItem('omnicore_user_hash')
    localStorage.removeItem('omnicore_authenticated')
    setIsAuthenticated(false)
    setUserHash(null)
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
    <div className="sticky top-0 z-40 bg-white shadow-sm dark:bg-gray-900 dark:border-b dark:border-gray-700">
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
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <LanguageSwitcher />

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
              >
                <LogIn className="h-4 w-4" />
                <span className="text-sm">{t('auth.login')}</span>
              </Button>
            </div>
          ) : (
            // Logged in - show user menu
            <>
              {/* Notifications - Larger touch target for mobile */}
              <button
                type="button"
                className="relative rounded-full bg-white p-2 sm:p-2.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-900 dark:hover:text-gray-300 transition-colors"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                {/* Notification badge */}
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-medium">
                  3
                </span>
              </button>

              {/* User menu - Improved mobile touch target */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-x-1 sm:gap-x-2 rounded-full bg-white p-1.5 sm:p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-900">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="hidden lg:flex lg:flex-col lg:items-start">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.username}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        getRoleColor(user?.role || '')
                      )}>
                        {user?.role?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    {user?.username}
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
    </div>
  )
}