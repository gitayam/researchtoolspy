import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  Clock
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/utils'

export function DashboardPage() {
  const { t } = useTranslation()
  // Mock data for now - will integrate with real store later
  const isLoading = false
  const recentSessions: any[] = []
  const allSessions: any[] = []

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
      href: '/analysis-frameworks/swot-dashboard',
      icon: Target,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: t('dashboard.cogAnalysis'),
      description: t('dashboard.centerOfGravity'),
      href: '/analysis-frameworks/cog',
      icon: Brain,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: t('dashboard.researchTools'),
      description: t('dashboard.urlAndCitations'),
      href: '/tools',
      icon: Search,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: t('dashboard.viewReports'),
      description: t('dashboard.exportShare'),
      href: '/reports',
      icon: FileText,
      color: 'bg-orange-500 hover:bg-orange-600'
    },
  ], [t])

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          {t('dashboard.welcome')}
        </h1>
        <p className="text-blue-100">
          {t('dashboard.welcomeSubtext')}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <CardTitle className="text-sm font-medium">{t('dashboard.activeSessions')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : activeSessions}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeSessions === 0 ? t('dashboard.noActiveSessions') : t('dashboard.inProgressAnalyses')}
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
          <Link to="/analysis-frameworks/swot-dashboard">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.createAnalysis')}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}