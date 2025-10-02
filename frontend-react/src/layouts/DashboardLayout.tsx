import { Outlet } from 'react-router-dom'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { GuestModeBanner } from '@/components/GuestModeBanner'

export function DashboardLayout() {
  // No authentication required - tools and frameworks are publicly accessible
  // Users can optionally log in to save their work
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardSidebar />
      <div className="lg:pl-64">
        <DashboardHeader />
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <GuestModeBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
