'use client'

import Link from 'next/link'
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
import { useUser } from '@/stores/auth'
import { useRecentSessions } from '@/stores/frameworks'
import { formatRelativeTime } from '@/lib/utils'

export default function DashboardPage() {
  const user = useUser()
  const recentSessions = useRecentSessions()

  const frameworkStats = [
    { name: 'SWOT Analysis', count: 12, trend: '+2 this week', icon: Target, color: 'bg-blue-500' },
    { name: 'COG Analysis', count: 8, trend: '+1 this week', icon: Brain, color: 'bg-green-500' },
    { name: 'PMESII-PT', count: 6, trend: 'No change', icon: BarChart3, color: 'bg-purple-500' },
    { name: 'ACH Analysis', count: 4, trend: '+1 this week', icon: Search, color: 'bg-orange-500' },
  ]

  const quickActions = [
    {
      title: 'New SWOT Analysis',
      description: 'Strategic planning analysis',
      href: '/frameworks/swot/create',
      icon: Target,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'COG Analysis',
      description: 'Center of gravity assessment',
      href: '/frameworks/cog/create', 
      icon: Brain,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Research Tools',
      description: 'URL processing & citations',
      href: '/tools',
      icon: Search,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'View Reports',
      description: 'Export and share analyses',
      href: '/reports',
      icon: FileText,
      color: 'bg-orange-500 hover:bg-orange-600'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.full_name || user?.username}!
        </h1>
        <p className="text-blue-100">
          Continue your research analysis work or start a new framework.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +4 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              3 in progress, 5 draft
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">22</div>
            <p className="text-xs text-muted-foreground">
              92% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">
              With 8 team members
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
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
              Recent Activity
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
                        href={`/frameworks/${session.framework_type}/${session.id}`}
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
                <p className="text-sm text-gray-500">No recent activity</p>
                <p className="text-xs text-gray-400">Start a new analysis to see it here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Framework Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Framework Usage
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
          <h3 className="text-lg font-semibold mb-2">Start a New Analysis</h3>
          <p className="text-gray-500 text-center mb-4">
            Choose from 10 research analysis frameworks to begin your research
          </p>
          <Link href="/frameworks">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Analysis
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}