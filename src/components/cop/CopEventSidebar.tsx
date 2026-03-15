import React, { useState, useEffect } from 'react'
import { getCopHeaders } from '@/lib/cop-auth'
import {
  ClipboardList,
  Link,
  HelpCircle,
  Star,
  Layers,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import CopLayerPanel from '@/components/cop/CopLayerPanel'
import CopEventTab from '@/components/cop/CopEventTab'
import CopIntelTab from '@/components/cop/CopIntelTab'
import CopRfiTab from '@/components/cop/CopRfiTab'
import CopQuestionsTab from '@/components/cop/CopQuestionsTab'
import type { CopSession, CopSidebarTab } from '@/types/cop'

// ── Tab definitions ──────────────────────────────────────────────

interface TabDef {
  id: CopSidebarTab
  icon: typeof ClipboardList
  label: string
}

const TABS: TabDef[] = [
  { id: 'event', icon: ClipboardList, label: 'Event' },
  { id: 'intel', icon: Link, label: 'Intel' },
  { id: 'rfi', icon: HelpCircle, label: 'RFI' },
  { id: 'questions', icon: Star, label: 'Questions' },
  { id: 'layers', icon: Layers, label: 'Layers' },
]

// ── Tab Error Boundary ──────────────────────────────────────────

interface TabErrorBoundaryProps {
  children: React.ReactNode
  tabKey: string
}

interface TabErrorBoundaryState {
  hasError: boolean
}

class TabErrorBoundary extends React.Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): TabErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`COP tab error [${this.props.tabKey}]:`, error)
  }

  componentDidUpdate(prevProps: TabErrorBoundaryProps) {
    if (prevProps.tabKey !== this.props.tabKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
          <AlertCircle className="h-6 w-6 text-red-400 mb-2" />
          <p className="text-xs text-gray-400 mb-3">Something went wrong loading this tab.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Props ────────────────────────────────────────────────────────

interface CopEventSidebarProps {
  session: CopSession
  activeLayers: string[]
  onToggleLayer: (layerId: string) => void
  layerCounts: Record<string, number>
  onSessionUpdate: (updates: Partial<CopSession>) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopEventSidebar({
  session,
  activeLayers,
  onToggleLayer,
  layerCounts,
  onSessionUpdate,
  collapsed = false,
  onToggleCollapse,
}: CopEventSidebarProps) {
  const [activeTab, setActiveTab] = useState<CopSidebarTab>('event')
  const [openRfiCount, setOpenRfiCount] = useState(0)

  // Fetch open RFI count for badge
  useEffect(() => {
    const controller = new AbortController()
    async function fetchRfiCount() {
      try {
        const res = await fetch(`/api/cop/${session.id}/rfis`, { headers: getCopHeaders(), signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        const rfis = data.rfis ?? data ?? []
        const openCount = Array.isArray(rfis)
          ? rfis.filter((r: { status: string }) => r.status === 'open').length
          : 0
        setOpenRfiCount(openCount)
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('Failed to fetch RFI count:', e)
      }
    }
    fetchRfiCount()
    return () => controller.abort()
  }, [session.id])

  // ── Render tab content ──────────────────────────────────────

  function renderTabContent() {
    switch (activeTab) {
      case 'event':
        return (
          <CopEventTab
            session={session}
            onSessionUpdate={onSessionUpdate}
          />
        )
      case 'intel':
        return (
          <CopIntelTab
            session={session}
            onSessionUpdate={onSessionUpdate}
          />
        )
      case 'rfi':
        return (
          <CopRfiTab
            sessionId={session.id}
            onRfiCountChange={setOpenRfiCount}
          />
        )
      case 'questions':
        return (
          <CopQuestionsTab session={session} />
        )
      case 'layers':
        return (
          <CopLayerPanel
            activeLayers={activeLayers}
            onToggleLayer={onToggleLayer}
            layerCounts={layerCounts}
          />
        )
      default:
        return null
    }
  }

  // On mobile when collapsed, show only the icon strip as a floating bar
  if (collapsed) {
    return (
      <aside className="absolute left-0 top-0 bottom-0 z-20 flex flex-col items-center w-11 bg-gray-900 border-r border-gray-700 py-2 gap-1 md:hidden">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
                onToggleCollapse?.()
              }}
              title={tab.label}
              className={cn(
                'relative flex items-center justify-center w-9 h-9 rounded-md transition-colors',
                activeTab === tab.id
                  ? 'bg-gray-800 text-blue-400 border-l-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.id === 'rfi' && openRfiCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {openRfiCount}
                </span>
              )}
            </button>
          )
        })}
      </aside>
    )
  }

  return (
    <>
      {/* Backdrop overlay on mobile when expanded */}
      <div
        className="fixed inset-0 bg-black/40 z-30 md:hidden"
        onClick={onToggleCollapse}
      />
      <aside className={cn(
        'bg-gray-900 border-r border-gray-700 flex shrink-0 overflow-hidden',
        // Mobile: overlay on top of map
        'absolute left-0 top-0 bottom-0 z-40 w-72',
        // Desktop: static in flow
        'md:relative md:z-auto md:w-72'
      )}>
        {/* Icon strip */}
        <div className="flex flex-col items-center w-11 border-r border-gray-800 py-2 gap-1 shrink-0">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 rounded-md transition-colors',
                  isActive
                    ? 'bg-gray-800 text-blue-400 border-l-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {/* RFI badge count */}
                {tab.id === 'rfi' && openRfiCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                    {openRfiCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content area */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <TabErrorBoundary tabKey={activeTab}>
            {activeTab === 'layers' ? (
              // CopLayerPanel renders its own container
              renderTabContent()
            ) : (
              <div className="h-full">
                {renderTabContent()}
              </div>
            )}
          </TabErrorBoundary>
        </div>
      </aside>
    </>
  )
}
