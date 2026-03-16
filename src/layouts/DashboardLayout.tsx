import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { MobileBottomTabs } from '@/components/layout/mobile-bottom-tabs'
import { GuestModeBanner } from '@/components/GuestModeBanner'
import { ScrollToTop } from '@/components/ScrollToTop'
import { SkipToContent } from '@/components/accessibility/SkipToContent'

export function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Responsive layout classes defined in index.css */}
      <SkipToContent />
      <ScrollToTop />
      <DashboardSidebar mobileMenuOpen={mobileMenuOpen} onMobileMenuChange={setMobileMenuOpen} />
      <div className="desktop-sidebar-offset">
        <DashboardHeader />
        <main id="main-content" className="py-3 sm:py-4 md:py-6 lg:py-8 mobile-bottom-spacer" role="main" aria-label="Main content">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
            <GuestModeBanner />
            <Outlet />
          </div>
        </main>
      </div>
      <div className="mobile-bottom-tabs">
        <MobileBottomTabs onMoreClick={() => setMobileMenuOpen(true)} />
      </div>
    </div>
  )
}

export function DashboardFullBleedLayout() {
  // COP workspace has its own sidebar + header — no dashboard chrome needed
  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />
      <ScrollToTop />
      <Outlet />
    </div>
  )
}
