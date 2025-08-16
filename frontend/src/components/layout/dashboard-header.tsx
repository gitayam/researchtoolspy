'use client'

import { Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Transition } from '@headlessui/react'
import { 
  Bell, 
  ChevronDown, 
  LogOut, 
  Settings, 
  User,
  Moon,
  Sun
} from 'lucide-react'
import { useAuthStore, useUser } from '@/stores/auth'
import { cn } from '@/lib/utils'

export function DashboardHeader() {
  const router = useRouter()
  const user = useUser()
  const { logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
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
            Intelligence Analysis Platform
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-x-4">
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
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-x-2 rounded-full bg-white p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-900">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="hidden lg:flex lg:flex-col lg:items-start">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.full_name || user?.username}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    getRoleColor(user?.role || '')
                  )}>
                    {user?.role?.toUpperCase()}
                  </span>
                  {user?.organization && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {user.organization}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-700">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {user?.full_name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>

                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => router.push('/profile')}
                      className={cn(
                        active ? 'bg-gray-50 dark:bg-gray-700' : '',
                        'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                      )}
                    >
                      <User className="h-4 w-4" />
                      Your Profile
                    </button>
                  )}
                </Menu.Item>

                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={() => router.push('/settings')}
                      className={cn(
                        active ? 'bg-gray-50 dark:bg-gray-700' : '',
                        'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                  )}
                </Menu.Item>

                <div className="border-t border-gray-100 dark:border-gray-700">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        className={cn(
                          active ? 'bg-gray-50 dark:bg-gray-700' : '',
                          'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300'
                        )}
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  )
}