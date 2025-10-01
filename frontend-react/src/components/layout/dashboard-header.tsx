import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Moon,
  Sun
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

export function DashboardHeader() {
  const navigate = useNavigate()
  // Hash-based user info
  const [userHash, setUserHash] = useState<string | null>(null)

  useEffect(() => {
    const hash = localStorage.getItem('omnicore_user_hash')
    setUserHash(hash)
  }, [])

  const user = {
    username: userHash ? `Hash: ${userHash.slice(0, 8)}...` : 'User',
    role: 'user'
  }
  // const { logout } = useAuthStore()

  const handleLogout = () => {
    // Clear hash-based authentication
    localStorage.removeItem('omnicore_user_hash')
    localStorage.removeItem('omnicore_authenticated')
    navigate('/login')
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
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs / Page title */}
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Research Analysis Platform
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-x-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <button
            type="button"
            className="relative rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-900 dark:hover:text-gray-300"
          >
            <Bell className="h-6 w-6" />
            {/* Notification badge */}
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              3
            </span>
          </button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-x-2 rounded-full bg-white p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-900">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
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

              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="h-4 w-4 mr-2" />
                Your Profile
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}