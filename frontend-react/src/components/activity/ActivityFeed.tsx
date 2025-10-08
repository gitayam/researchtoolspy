import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  FileText,
  MessageSquare,
  ThumbsUp,
  GitFork,
  Share2,
  UserPlus,
  Trash2,
  Edit,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ActivityItem {
  id: string
  user_hash: string
  user_name?: string
  activity_type: string
  entity_type: string
  entity_id?: string
  entity_title?: string
  action_summary: string
  metadata?: string
  created_at: string
}

interface ActivitySummary {
  total_activities: number
  active_users: number
  creates: number
  updates: number
  comments: number
}

const activityIcons: Record<string, React.ElementType> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  comment: MessageSquare,
  vote: ThumbsUp,
  fork: GitFork,
  publish: Share2,
  share: Share2,
  invite: UserPlus,
}

const activityColors: Record<string, string> = {
  create: 'text-green-500',
  update: 'text-blue-500',
  delete: 'text-red-500',
  comment: 'text-purple-500',
  vote: 'text-orange-500',
  fork: 'text-cyan-500',
  publish: 'text-indigo-500',
  share: 'text-pink-500',
  invite: 'text-yellow-500',
}

export function ActivityFeed() {
  const { t } = useTranslation(['activity', 'common'])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [summary, setSummary] = useState<ActivitySummary>({
    total_activities: 0,
    active_users: 0,
    creates: 0,
    updates: 0,
    comments: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activityType, setActivityType] = useState('')
  const [entityType, setEntityType] = useState('')
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    fetchActivities()
  }, [activityType, entityType, offset])

  const fetchActivities = async () => {
    const workspaceId = localStorage.getItem('omnicore_workspace_id')
    if (!workspaceId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })

      if (activityType) params.append('type', activityType)
      if (entityType) params.append('entity_type', entityType)

      const response = await fetch(`/api/activity?${params}`, {
        headers: { 'X-Workspace-ID': workspaceId },
      })

      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
        setSummary(data.summary || {
          total_activities: 0,
          active_users: 0,
          creates: 0,
          updates: 0,
          comments: 0,
        })
      }
    } catch (error) {
      console.error('[ActivityFeed] Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('activity:time.justNow')
    if (minutes < 60) return t('activity:time.minutesAgo', { count: minutes })
    if (hours < 24) return t('activity:time.hoursAgo', { count: hours })
    if (days < 7) return t('activity:time.daysAgo', { count: days })
    return date.toLocaleDateString()
  }

  const getUserInitials = (name?: string, hash?: string) => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (hash) {
      return hash.substring(0, 2).toUpperCase()
    }
    return '??'
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>{t('activity:summary.totalActivities')}</CardDescription>
            <CardTitle className="text-3xl">{summary.total_activities}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('activity:summary.activeUsers')}
            </CardDescription>
            <CardTitle className="text-3xl">{summary.active_users}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t('activity:summary.created')}
            </CardDescription>
            <CardTitle className="text-3xl">{summary.creates}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('activity:summary.comments')}
            </CardDescription>
            <CardTitle className="text-3xl">{summary.comments}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('activity:feed.title')}
              </CardTitle>
              <CardDescription>{t('activity:feed.description')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={activityType || "all"} onValueChange={(v) => setActivityType(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('activity:filters.allTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('activity:filters.allTypes')}</SelectItem>
                  <SelectItem value="create">{t('activity:types.create')}</SelectItem>
                  <SelectItem value="update">{t('activity:types.update')}</SelectItem>
                  <SelectItem value="comment">{t('activity:types.comment')}</SelectItem>
                  <SelectItem value="vote">{t('activity:types.vote')}</SelectItem>
                  <SelectItem value="fork">{t('activity:types.fork')}</SelectItem>
                  <SelectItem value="publish">{t('activity:types.publish')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityType || "all"} onValueChange={(v) => setEntityType(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('activity:filters.allEntities')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('activity:filters.allEntities')}</SelectItem>
                  <SelectItem value="framework">{t('activity:entities.framework')}</SelectItem>
                  <SelectItem value="library_item">{t('activity:entities.library_item')}</SelectItem>
                  <SelectItem value="comment">{t('activity:entities.comment')}</SelectItem>
                  <SelectItem value="evidence">{t('activity:entities.evidence')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('activity:feed.empty')}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {activities.map((activity) => {
                  const Icon = activityIcons[activity.activity_type] || FileText
                  const iconColor = activityColors[activity.activity_type] || 'text-gray-500'

                  return (
                    <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs">
                          {getUserInitials(activity.user_name, activity.user_hash)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-medium">{activity.user_name || 'Anonymous'}</span>
                              {' '}
                              <span className="text-muted-foreground">{activity.action_summary}</span>
                            </p>
                            {activity.entity_title && (
                              <p className="text-sm font-medium mt-1">{activity.entity_title}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTime(activity.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Icon className={cn('h-4 w-4', iconColor)} />
                            <Badge variant="outline" className="text-xs">
                              {activity.entity_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
