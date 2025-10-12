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
  actor_user_id: string
  actor_user_hash?: string
  actor_nickname?: string
  action_type: 'CREATED' | 'UPDATED' | 'DELETED' | 'COMMENTED' | 'VOTED' | 'RATED' | 'SHARED' | 'FORKED' | 'PUBLISHED' | 'CLONED'
  entity_type: 'FRAMEWORK' | 'ENTITY' | 'COMMENT' | 'WORKSPACE' | 'MEMBER' | 'INVESTIGATION' | 'RESEARCH_QUESTION'
  entity_id: string
  entity_title?: string
  details?: string
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
  CREATED: Plus,
  UPDATED: Edit,
  DELETED: Trash2,
  COMMENTED: MessageSquare,
  VOTED: ThumbsUp,
  RATED: TrendingUp,
  FORKED: GitFork,
  PUBLISHED: Share2,
  SHARED: Share2,
  CLONED: GitFork,
}

const activityColors: Record<string, string> = {
  CREATED: 'text-green-500',
  UPDATED: 'text-blue-500',
  DELETED: 'text-red-500',
  COMMENTED: 'text-purple-500',
  VOTED: 'text-orange-500',
  RATED: 'text-yellow-500',
  FORKED: 'text-cyan-500',
  PUBLISHED: 'text-indigo-500',
  SHARED: 'text-pink-500',
  CLONED: 'text-teal-500',
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

  const getActionText = (activity: ActivityItem): string => {
    const entityTypeLabel = activity.entity_type.toLowerCase().replace('_', ' ')

    switch (activity.action_type) {
      case 'CREATED':
        return `created a ${entityTypeLabel}`
      case 'UPDATED':
        return `updated a ${entityTypeLabel}`
      case 'DELETED':
        return `deleted a ${entityTypeLabel}`
      case 'COMMENTED':
        return `commented on a ${entityTypeLabel}`
      case 'VOTED':
        return `voted on a ${entityTypeLabel}`
      case 'RATED':
        return `rated a ${entityTypeLabel}`
      case 'FORKED':
        return `forked a ${entityTypeLabel}`
      case 'PUBLISHED':
        return `published a ${entityTypeLabel}`
      case 'SHARED':
        return `shared a ${entityTypeLabel}`
      case 'CLONED':
        return `cloned a ${entityTypeLabel}`
      default:
        return `interacted with a ${entityTypeLabel}`
    }
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
                  <SelectItem value="CREATED">Created</SelectItem>
                  <SelectItem value="UPDATED">Updated</SelectItem>
                  <SelectItem value="DELETED">Deleted</SelectItem>
                  <SelectItem value="COMMENTED">Commented</SelectItem>
                  <SelectItem value="VOTED">Voted</SelectItem>
                  <SelectItem value="RATED">Rated</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityType || "all"} onValueChange={(v) => setEntityType(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t('activity:filters.allEntities')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('activity:filters.allEntities')}</SelectItem>
                  <SelectItem value="FRAMEWORK">Framework</SelectItem>
                  <SelectItem value="INVESTIGATION">Investigation</SelectItem>
                  <SelectItem value="RESEARCH_QUESTION">Research Question</SelectItem>
                  <SelectItem value="ENTITY">Entity</SelectItem>
                  <SelectItem value="COMMENT">Comment</SelectItem>
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
                          {getUserInitials(activity.actor_nickname, activity.actor_user_hash)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-medium">{activity.actor_nickname || 'Anonymous'}</span>
                              {' '}
                              <span className="text-muted-foreground">{getActionText(activity)}</span>
                            </p>
                            {activity.entity_title && (
                              <p className="text-sm font-medium mt-1 text-gray-900 dark:text-white">
                                {activity.entity_title}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTime(activity.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Icon className={cn('h-4 w-4', iconColor)} />
                            <Badge variant="outline" className="text-xs">
                              {activity.entity_type.replace('_', ' ')}
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
