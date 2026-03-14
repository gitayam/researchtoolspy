import { useState, useEffect } from 'react'
import { Users, Database, Radio, FlaskConical, Wrench } from 'lucide-react'
import { getCopHeaders } from '@/lib/cop-auth'

type TabId = 'entities' | 'cops' | 'frameworks' | 'tools' | 'team'

interface WorkspaceStatsBarProps {
  workspaceId: string
  onTabClick: (tab: TabId) => void
}

interface Stats {
  entities: number
  cop_sessions: number
  frameworks: number
  tools: number
  members: number
}

export function WorkspaceStatsBar({ workspaceId, onTabClick }: WorkspaceStatsBarProps) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchStats(controller.signal)
    return () => controller.abort()
  }, [workspaceId])

  const fetchStats = async (signal?: AbortSignal) => {
    setStats(null) // Reset on workspace change to avoid showing stale data
    try {
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch(`/api/workspaces/${workspaceId}/stats`, { headers, signal })
      if (response.ok) {
        setStats(await response.json())
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') console.error('Failed to fetch workspace stats:', error)
    }
  }

  if (!stats) return null

  const pills: { id: TabId; label: string; count: number; icon: React.ReactNode }[] = [
    { id: 'entities', label: 'Entities', count: stats.entities, icon: <Database className="h-3.5 w-3.5" /> },
    { id: 'cops', label: 'COPs', count: stats.cop_sessions, icon: <Radio className="h-3.5 w-3.5" /> },
    { id: 'frameworks', label: 'Frameworks', count: stats.frameworks, icon: <FlaskConical className="h-3.5 w-3.5" /> },
    { id: 'tools', label: 'Tools', count: stats.tools, icon: <Wrench className="h-3.5 w-3.5" /> },
    { id: 'team', label: 'Members', count: stats.members, icon: <Users className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <button
          key={pill.id}
          onClick={() => onTabClick(pill.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {pill.icon}
          <span>{pill.count}</span>
          <span>{pill.label}</span>
        </button>
      ))}
    </div>
  )
}
