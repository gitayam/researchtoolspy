import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  FileText,
  BarChart3,
  SmileIcon,
  Users,
  Link2,
  Shield,
  MessageSquare,
  Grid3x3,
  Star,
  Loader2,
  Check,
  Play,
  Sparkles,
} from 'lucide-react'

export type AnalysisTab =
  | 'overview'
  | 'word-analysis'
  | 'sentiment'
  | 'entities'
  | 'links'
  | 'claims'
  | 'qa'
  | 'dime'
  | 'starbursting'

export type SectionStatus = 'idle' | 'processing' | 'complete' | 'error' | 'ready'

interface Section {
  id: AnalysisTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  status?: SectionStatus
  description?: string
  isAutomatic?: boolean
}

interface AnalysisSidebarProps {
  activeTab: AnalysisTab
  onTabChange: (tab: AnalysisTab) => void
  sections: Section[]
  onRunFramework?: (framework: AnalysisTab) => void
  className?: string
}

const StatusBadge: React.FC<{ status?: SectionStatus }> = ({ status }) => {
  if (!status || status === 'ready') return null

  switch (status) {
    case 'processing':
      return (
        <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          <Loader2 className="h-3 w-3 animate-spin" />
        </Badge>
      )
    case 'complete':
      return (
        <Badge variant="default" className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          <Check className="h-3 w-3" />
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive" className="ml-auto">
          Error
        </Badge>
      )
    case 'idle':
      return (
        <Badge variant="outline" className="ml-auto text-xs">
          Not Run
        </Badge>
      )
    default:
      return null
  }
}

export const AnalysisSidebar: React.FC<AnalysisSidebarProps> = ({
  activeTab,
  onTabChange,
  sections,
  onRunFramework,
  className,
}) => {
  const automaticSections = sections.filter((s) => s.isAutomatic)
  const frameworkSections = sections.filter((s) => !s.isAutomatic)

  const renderSection = (section: Section) => {
    const Icon = section.icon
    const isActive = activeTab === section.id
    const canRun = section.status === 'idle' && onRunFramework && !section.isAutomatic

    return (
      <div key={section.id} className="relative">
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          className={cn(
            'w-full justify-start text-left h-auto py-3 px-3 group',
            isActive && 'bg-accent font-medium'
          )}
          onClick={() => onTabChange(section.id)}
        >
          <div className="flex items-start gap-3 w-full">
            <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', isActive && 'text-primary')} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm truncate">{section.label}</span>
                <StatusBadge status={section.status} />
              </div>
              {section.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{section.description}</p>
              )}
            </div>
          </div>
        </Button>

        {canRun && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onRunFramework(section.id)
            }}
            title={`Run ${section.label} Analysis`}
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full border-r bg-muted/30', className)}>
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Analysis Sections</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Automatic Sections */}
          <div className="mb-4">
            <div className="px-3 py-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Automatic</span>
            </div>
            <div className="space-y-0.5">{automaticSections.map(renderSection)}</div>
          </div>

          {/* Framework Sections */}
          {frameworkSections.length > 0 && (
            <>
              <Separator className="my-2" />
              <div>
                <div className="px-3 py-2 flex items-center gap-2">
                  <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Frameworks
                  </span>
                </div>
                <div className="space-y-0.5">{frameworkSections.map(renderSection)}</div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
