import { useState, useEffect } from 'react'
import {
  ClipboardList,
  Link,
  HelpCircle,
  Star,
  Layers,
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

// ── Props ────────────────────────────────────────────────────────

interface CopEventSidebarProps {
  session: CopSession
  activeLayers: string[]
  onToggleLayer: (layerId: string) => void
  layerCounts: Record<string, number>
  onSessionUpdate: (updates: Partial<CopSession>) => void
}

// ── Component ────────────────────────────────────────────────────

export default function CopEventSidebar({
  session,
  activeLayers,
  onToggleLayer,
  layerCounts,
  onSessionUpdate,
}: CopEventSidebarProps) {
  const [activeTab, setActiveTab] = useState<CopSidebarTab>('event')
  const [openRfiCount, setOpenRfiCount] = useState(0)

  // Fetch open RFI count for badge
  useEffect(() => {
    let cancelled = false
    async function fetchRfiCount() {
      try {
        const res = await fetch(`/api/cop/${session.id}/rfis`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const rfis = data.rfis ?? data ?? []
        const openCount = Array.isArray(rfis)
          ? rfis.filter((r: { status: string }) => r.status === 'open').length
          : 0
        setOpenRfiCount(openCount)
      } catch {
        // ignore
      }
    }
    fetchRfiCount()
    return () => { cancelled = true }
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

  return (
    <aside className="w-72 bg-gray-900 border-r border-gray-700 flex shrink-0 overflow-hidden">
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
        {activeTab === 'layers' ? (
          // CopLayerPanel renders its own container
          renderTabContent()
        ) : (
          <div className="h-full">
            {renderTabContent()}
          </div>
        )}
      </div>
    </aside>
  )
}
