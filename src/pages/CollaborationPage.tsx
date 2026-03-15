import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Database, Radio, FlaskConical, Wrench } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { WorkspaceStatsBar } from '@/components/collaboration/WorkspaceStatsBar'
import { TeamTab } from '@/components/collaboration/TeamTab'
import { EntitiesTab } from '@/components/collaboration/EntitiesTab'
import { CopSessionsTab } from '@/components/collaboration/CopSessionsTab'
import { FrameworksTab } from '@/components/collaboration/FrameworksTab'
import { ToolsTab } from '@/components/collaboration/ToolsTab'
import { generateAccountHash } from '@/lib/hash-auth'
import { getCopHeaders } from '@/lib/cop-auth'

type TabId = 'entities' | 'cops' | 'frameworks' | 'tools' | 'team'

interface Workspace {
  id: string
  name: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
  owner_id: number
  current_user_role: string
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'entities', label: 'Entities', icon: <Database className="h-4 w-4" /> },
  { id: 'cops', label: 'COP Sessions', icon: <Radio className="h-4 w-4" /> },
  { id: 'frameworks', label: 'Frameworks', icon: <FlaskConical className="h-4 w-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="h-4 w-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="h-4 w-4" /> },
]

export function CollaborationPage() {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('entities')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureUserHash()
    const controller = new AbortController()
    fetchWorkspaces(controller.signal)
    return () => controller.abort()
  }, [])

  const ensureUserHash = () => {
    let userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash || userHash === 'guest') {
      userHash = generateAccountHash()
      localStorage.setItem('omnicore_user_hash', userHash)
      localStorage.setItem('omnicore_authenticated', 'true')
      toast({
        title: t('pages.collaboration.accountCreated'),
        description: t('pages.collaboration.accountCreatedDesc'),
      })
    }
    return userHash
  }

  const getAuthHeaders = (): HeadersInit => getCopHeaders()

  const fetchWorkspaces = async (signal?: AbortSignal) => {
    try {
      setError(null)
      const response = await fetch('/api/workspaces', { headers: getAuthHeaders(), signal })
      if (!response.ok) {
        const errData = await response.json().catch((e) => { console.error('[CollaborationPage] JSON parse error:', e); return {} })
        setError(errData.error || `Failed to load workspaces (${response.status})`)
        return
      }
      const data = await response.json()
      const allWorkspaces = [...(data.owned || []), ...(data.member || [])]
      setWorkspaces(allWorkspaces)
      // Auto-select first TEAM workspace
      const teamWorkspace = allWorkspaces.find((w: Workspace) => w.type === 'TEAM')
      if (teamWorkspace) {
        setSelectedWorkspace(teamWorkspace)
      } else if (allWorkspaces.length > 0) {
        setSelectedWorkspace(allWorkspaces[0])
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to fetch workspaces:', err)
        setError('Network error \u2014 could not reach the server')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.loading')}</p></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
        <p className="text-red-600 dark:text-red-400">{error}</p></div>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Could not load workspaces</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button onClick={() => fetchWorkspaces()} className="px-4 py-2 rounded border text-sm">Retry</button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.createWorkspace')}</p></div>
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('pages.collaboration.noWorkspaces')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('pages.collaboration.noWorkspacesDesc')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userRole = selectedWorkspace?.current_user_role || 'VIEWER'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.subtitle')}</p>
        </div>
      </div>

      {/* Workspace Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pages.collaboration.selectWorkspace')}</CardTitle>
              <CardDescription>{t('pages.collaboration.selectWorkspaceDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedWorkspace?.id || ''}
            onValueChange={(id) => setSelectedWorkspace(workspaces.find(w => w.id === id) || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('pages.collaboration.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex items-center gap-2">
                    <span>{workspace.name}</span>
                    <Badge variant="outline" className="text-xs">{workspace.type}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedWorkspace && (
        <>
          {/* Stats Bar */}
          <WorkspaceStatsBar workspaceId={selectedWorkspace.id} onTabClick={setActiveTab} />

          {/* Tab Bar */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-0 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'entities' && <EntitiesTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'cops' && <CopSessionsTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'frameworks' && <FrameworksTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'tools' && <ToolsTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'team' && <TeamTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
        </>
      )}
    </div>
  )
}
