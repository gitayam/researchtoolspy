import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Brain,
  FileText,
  Plus,
  Search,
  Target,
  TrendingUp,
  Users,
  Activity,
  Clock,
  ChevronDown,
  Folder,
  Zap,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatRelativeTime } from '@/lib/utils'

interface Investigation {
  id: string
  title: string
  description?: string
  type: 'structured_research' | 'general_topic' | 'rapid_analysis'
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  evidence_count: number
  actor_count: number
  source_count: number
  framework_count: number
  tags: string[]
}

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [isLoadingInvestigations, setIsLoadingInvestigations] = useState(true)

  // Mock data for now - will integrate with real store later
  const isLoading = false
  const recentSessions: any[] = []
  const allSessions: any[] = []

  useEffect(() => {
    loadInvestigations()
  }, [])

  const loadInvestigations = async () => {
    try {
      setIsLoadingInvestigations(true)
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/investigations?status=active', {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (response.ok) {
        const data = await response.json()
        setInvestigations(data.investigations || [])
      }
    } catch (error) {
      console.error('Error loading investigations:', error)
    } finally {
      setIsLoadingInvestigations(false)
    }
  }

  // Available frameworks for quick creation
  const availableFrameworks = useMemo(() => [
    { name: 'SWOT', route: '/dashboard/analysis-frameworks/swot-dashboard', icon: Target, description: 'Strengths, Weaknesses, Opportunities, Threats' },
    { name: 'ACH', route: '/dashboard/analysis-frameworks/ach-dashboard', icon: Search, description: 'Analysis of Competing Hypotheses' },
    { name: 'COG', route: '/dashboard/analysis-frameworks/cog', icon: Brain, description: 'Center of Gravity Analysis' },
    { name: 'PMESII-PT', route: '/dashboard/analysis-frameworks/pmesii-pt', icon: BarChart3, description: 'Multi-dimensional Operational Environment' },
    { name: 'DOTMLPF', route: '/dashboard/analysis-frameworks/dotmlpf', icon: FileText, description: 'Capability Analysis Framework' },
    { name: 'DIME', route: '/dashboard/analysis-frameworks/dime', icon: Target, description: 'Diplomatic, Information, Military, Economic' },
    { name: 'PEST', route: '/dashboard/analysis-frameworks/pest', icon: TrendingUp, description: 'Political, Economic, Social, Technological' },
    { name: 'Deception', route: '/dashboard/analysis-frameworks/deception', icon: Search, description: 'Deception Detection & Analysis' },
    { name: 'Behavior', route: '/dashboard/analysis-frameworks/behavior', icon: Users, description: 'Behavioral Analysis' },
    { name: 'COM-B', route: '/dashboard/analysis-frameworks/comb-analysis', icon: Brain, description: 'Capability, Opportunity, Motivation' },
    { name: 'Starbursting', route: '/dashboard/analysis-frameworks/starbursting', icon: Target, description: 'Question Generation Framework' },
    { name: 'Causeway', route: '/dashboard/analysis-frameworks/causeway', icon: BarChart3, description: 'Critical Infrastructure Analysis' },
    { name: 'Stakeholder', route: '/dashboard/analysis-frameworks/stakeholder', icon: Users, description: 'Stakeholder Analysis' },
    { name: 'Surveillance', route: '/dashboard/analysis-frameworks/surveillance', icon: Search, description: 'ISR Planning Framework' },
    { name: 'Fundamental Flow', route: '/dashboard/analysis-frameworks/fundamental-flow', icon: Activity, description: 'Surveillance Detection Framework' },
  ], [])

  // Calculate framework stats from real data
  const frameworkStats = useMemo(() => {
    const swotCount = allSessions.filter(s => s.framework_type === 'swot').length
    const cogCount = allSessions.filter(s => s.framework_type === 'cog').length
    const pmesiiCount = allSessions.filter(s => s.framework_type === 'pmesii-pt').length
    const achCount = allSessions.filter(s => s.framework_type === 'ach').length

    return [
      {
        name: t('frameworks.swot'),
        count: swotCount,
        trend: swotCount > 0 ? `${swotCount} ${t('dashboard.analyses')}` : t('dashboard.noAnalysesYet'),
        icon: Target,
        color: 'bg-blue-500'
      },
      {
        name: t('frameworks.cog'),
        count: cogCount,
        trend: cogCount > 0 ? `${cogCount} ${t('dashboard.analyses')}` : t('dashboard.noAnalysesYet'),
        icon: Brain,
        color: 'bg-green-500'
      },
      {
        name: t('frameworks.pmesiipt'),
        count: pmesiiCount,
        trend: pmesiiCount > 0 ? `${pmesiiCount} ${t('dashboard.analyses')}` : t('dashboard.noAnalysesYet'),
        icon: BarChart3,
        color: 'bg-purple-500'
      },
      {
        name: t('frameworks.ach'),
        count: achCount,
        trend: achCount > 0 ? `${achCount} ${t('dashboard.analyses')}` : t('dashboard.noAnalysesYet'),
        icon: Search,
        color: 'bg-orange-500'
      },
    ]
  }, [allSessions, t])

  // Calculate overall stats
  const totalAnalyses = allSessions.length
  const activeSessions = allSessions.filter(s => s.status === 'in_progress').length
  const completedAnalyses = allSessions.filter(s => s.status === 'completed').length

  const quickActions = useMemo(() => [
    {
      title: t('dashboard.newSwot'),
      description: t('dashboard.strategicPlanning'),
      href: '/dashboard/analysis-frameworks/swot-dashboard',
      icon: Target,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: t('dashboard.cogAnalysis'),
      description: t('dashboard.centerOfGravity'),
      href: '/dashboard/analysis-frameworks/cog',
      icon: Brain,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: t('dashboard.researchTools'),
      description: t('dashboard.urlAndCitations'),
      href: '/dashboard/tools',
      icon: Search,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: t('dashboard.viewReports'),
      description: t('dashboard.exportShare'),
      href: '/dashboard/reports',
      icon: FileText,
      color: 'bg-orange-500 hover:bg-orange-600'
    },
  ], [t])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'structured_research': return <FileText className="h-4 w-4" />
      case 'rapid_analysis': return <Zap className="h-4 w-4" />
      default: return <Folder className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'structured_research': return 'Structured'
      case 'rapid_analysis': return 'Rapid'
      default: return 'General'
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section with Investigation CTA */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">
              {t('dashboard.welcome')}
            </h1>
            <p className="text-purple-100 mb-4">
              Start a new investigation or continue working on existing research
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate('/dashboard/investigations/new')}
                className="bg-white text-purple-700 hover:bg-purple-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Investigation
              </Button>
              <Button
                onClick={() => navigate('/dashboard/investigations')}
                variant="outline"
                className="border-white text-white hover:bg-purple-700"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
          <Folder className="h-20 w-20 text-purple-400 opacity-50" />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Investigations</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingInvestigations ? '...' : investigations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {investigations.length === 0 ? 'Start your first investigation' : 'Currently active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalAnalyses')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : totalAnalyses}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalAnalyses === 0 ? t('dashboard.startCreating') : t('dashboard.totalCreated')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.completed')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : completedAnalyses}
            </div>
            <p className="text-xs text-muted-foreground">
              {completedAnalyses === 0 ? t('dashboard.noCompleted') : t('dashboard.completedAnalyses')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.shared')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.comingSoon')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Investigations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Active Investigations
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/investigations')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <CardDescription>
            Your ongoing research investigations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInvestigations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : investigations.length > 0 ? (
            <div className="space-y-3">
              {investigations.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/dashboard/investigations/${inv.id}`)}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getTypeIcon(inv.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {inv.title}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(inv.type)}
                      </Badge>
                    </div>
                    {inv.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {inv.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{inv.evidence_count} evidence</span>
                      <span>{inv.actor_count} actors</span>
                      <span>{inv.framework_count} analyses</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatRelativeTime(inv.updated_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Folder className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No active investigations</p>
              <p className="text-xs text-gray-500 mb-4">Create your first investigation to organize your research</p>
              <Button onClick={() => navigate('/dashboard/investigations/new')} size="sm" className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Investigation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.title} to={action.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-2`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-sm">{action.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {action.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('dashboard.recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Brain className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/analysis-frameworks/${session.framework_type}/${session.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600"
                      >
                        {session.title}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {session.framework_type.toUpperCase()} • {formatRelativeTime(session.updated_at)}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      session.status === 'completed' ? 'bg-green-100 text-green-800' :
                      session.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {session.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{t('dashboard.noRecentActivity')}</p>
                <p className="text-xs text-gray-400">{t('dashboard.startNewAnalysis')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Framework Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('dashboard.frameworkUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {frameworkStats.map((framework) => (
                <div key={framework.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${framework.color} rounded-full flex items-center justify-center`}>
                    <framework.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{framework.name}</span>
                      <span className="text-sm font-semibold">{framework.count}</span>
                    </div>
                    <p className="text-xs text-gray-500">{framework.trend}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Plus className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('dashboard.startNewAnalysisTitle')}</h3>
          <p className="text-gray-500 text-center mb-4">
            {t('dashboard.chooseFramework')}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('dashboard.createAnalysis')}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-80">
              <DropdownMenuLabel>Select Analysis Framework</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-96 overflow-y-auto">
                {availableFrameworks.map((framework) => (
                  <DropdownMenuItem
                    key={framework.name}
                    onClick={() => navigate(framework.route)}
                    className="cursor-pointer flex items-start gap-3 py-3"
                  >
                    <framework.icon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{framework.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{framework.description}</div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  )
}
