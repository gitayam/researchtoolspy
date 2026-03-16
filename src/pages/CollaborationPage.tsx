import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { Users, Database, Radio, FlaskConical, Wrench, UserPlus, ArrowRight, Plus, Layers, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { isUserAuthenticated } from '@/lib/auth-utils'

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
  const navigate = useNavigate()
  const { toast } = useToast()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('entities')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [joinToken, setJoinToken] = useState('')
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateTeam = async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: getCopHeaders(),
        body: JSON.stringify({ title: createName.trim(), description: createDesc.trim() || null }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create team')
      }
      setShowCreateDialog(false)
      setCreateName('')
      setCreateDesc('')
      toast({ title: 'Team created', description: `"${createName.trim()}" is ready for collaboration.` })
      fetchWorkspaces()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    ensureUserHash()
    const controller = new AbortController()
    fetchWorkspaces(controller.signal)
    return () => controller.abort()
  }, [])

  const ensureUserHash = () => {
    // If already authenticated via OIDC/JWT, skip hash generation
    if (isUserAuthenticated()) return

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage team members, shared entities, frameworks, and COP sessions</p>
        </div>

        {/* What a team workspace includes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { icon: <Users className="h-5 w-5" />, label: 'Team Members', desc: 'Invite & manage roles' },
            { icon: <Database className="h-5 w-5" />, label: 'Shared Entities', desc: 'Actors, sources, events' },
            { icon: <FlaskConical className="h-5 w-5" />, label: 'Frameworks', desc: 'ACH, SWOT, PMESII' },
            { icon: <Radio className="h-5 w-5" />, label: 'COP Sessions', desc: 'Live operational maps' },
            { icon: <Wrench className="h-5 w-5" />, label: 'Tools', desc: 'Playbooks & templates' },
          ].map((item) => (
            <Card key={item.label} className="border-gray-200 dark:border-gray-700">
              <CardContent className="flex flex-col items-center gap-1.5 py-4 text-center">
                <div className="text-gray-400 dark:text-gray-500">{item.icon}</div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Getting started */}
        <Card>
          <CardContent className="py-10 space-y-6">
            <div className="text-center">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Get Started with Team Collaboration</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-lg mx-auto">
                A workspace groups your team, entities, frameworks, and COP sessions together. Create one to start, or join an existing team.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2 flex-1" size="lg">
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
              <Button variant="outline" size="lg" className="gap-2 flex-1" onClick={() => { setJoinToken(''); setShowJoinDialog(true) }}>
                <UserPlus className="h-4 w-4" />
                Join a Team
              </Button>
            </div>

            <div className="text-center">
              <Link to="/dashboard/cop" className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                Browse existing COP sessions
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Create Team Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Team Workspace</DialogTitle>
              <DialogDescription>
                A team workspace lets you collaborate on shared entities, frameworks, COP sessions, and tools.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="e.g. OSINT Task Force Alpha"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-desc">Description (optional)</Label>
                <Input
                  id="team-desc"
                  placeholder="What is this team working on?"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateTeam} disabled={!createName.trim() || creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creating ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Join Team Dialog */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Team</DialogTitle>
              <DialogDescription>
                Paste your invite link or token to join an existing team workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-token">Invite Link or Token</Label>
                <Input
                  id="invite-token"
                  placeholder="https://researchtools.net/invite/inv_xxxx or inv_xxxx"
                  value={joinToken}
                  onChange={(e) => setJoinToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinToken.trim()) {
                      const match = joinToken.match(/invite\/([^\s?#]+)/)
                      if (match) {
                        navigate(`/invite/${match[1]}`)
                      } else if (joinToken.trim().startsWith('inv_')) {
                        navigate(`/invite/${joinToken.trim()}`)
                      } else {
                        toast({ title: 'Invalid invite', description: 'Expected format: https://researchtools.net/invite/inv_xxxx', variant: 'destructive' })
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
              <Button disabled={!joinToken.trim()} onClick={() => {
                const match = joinToken.match(/invite\/([^\s?#]+)/)
                if (match) {
                  navigate(`/invite/${match[1]}`)
                } else if (joinToken.trim().startsWith('inv_')) {
                  navigate(`/invite/${joinToken.trim()}`)
                } else {
                  toast({ title: 'Invalid invite', description: 'Expected format: https://researchtools.net/invite/inv_xxxx', variant: 'destructive' })
                }
              }} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Join Team
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
          <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <nav className="flex gap-0 -mb-px min-w-max">
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
