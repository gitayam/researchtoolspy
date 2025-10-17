import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Menu, X } from 'lucide-react'
import { AnalysisSidebar, type AnalysisTab } from './AnalysisSidebar'

interface Section {
  id: AnalysisTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  status?: 'idle' | 'processing' | 'complete' | 'error' | 'ready'
  description?: string
  isAutomatic?: boolean
}

interface AnalysisLayoutProps {
  activeTab: AnalysisTab
  onTabChange: (tab: AnalysisTab) => void
  sections: Section[]
  onRunFramework?: (framework: AnalysisTab) => void
  children: React.ReactNode
}

export const AnalysisLayout: React.FC<AnalysisLayoutProps> = ({
  activeTab,
  onTabChange,
  sections,
  onRunFramework,
  children,
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const activeSection = sections.find((s) => s.id === activeTab)

  const handleTabChange = (tab: AnalysisTab) => {
    onTabChange(tab)
    setMobileNavOpen(false) // Close mobile nav when tab changes
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-0">
      {/* Mobile Header with Drawer Toggle */}
      <div className="lg:hidden border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{activeSection?.label || 'Analysis'}</h2>
            {activeSection?.description && (
              <p className="text-sm text-muted-foreground">{activeSection.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Dialog */}
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="w-[90vw] max-w-sm h-[80vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Analysis Sections</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto">
            <AnalysisSidebar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              sections={sections}
              onRunFramework={onRunFramework}
              className="border-none"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-64 xl:w-72 shrink-0">
        <AnalysisSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          sections={sections}
          onRunFramework={onRunFramework}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 lg:overflow-auto">{children}</div>
    </div>
  )
}
