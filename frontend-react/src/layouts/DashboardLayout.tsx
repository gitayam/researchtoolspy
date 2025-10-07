import { Outlet } from 'react-router-dom'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { GuestModeBanner } from '@/components/GuestModeBanner'
import { ScrollToTop } from '@/components/ScrollToTop'
import { SkipToContent } from '@/components/accessibility/SkipToContent'

export function DashboardLayout() {
  // No authentication required - tools and frameworks are publicly accessible
  // Users can optionally log in to save their work
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SkipToContent />
      <ScrollToTop />
      <DashboardSidebar />
      <div className="lg:pl-64">
        <DashboardHeader />
        <main id="main-content" className="py-4 sm:py-6 lg:py-8" role="main" aria-label="Main content">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
            <GuestModeBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
