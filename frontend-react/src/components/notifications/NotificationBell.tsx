import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  notification_type: string
  title: string
  message: string
  action_url?: string
  is_read: boolean
  created_at: string
  actor_name?: string
}

export function NotificationBell() {
  const { t } = useTranslation(['notifications', 'common'])
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetchNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash || userHash === 'guest') return

    try {
      const response = await fetch('/api/notifications?limit=10', {
        headers: { 'X-User-Hash': userHash },
      })
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('[NotificationBell] Fetch error:', error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) return

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          notification_ids: [notificationId],
          is_read: true,
        }),
      })
      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('[NotificationBell] Mark read error:', error)
    }
  }

  const markAllAsRead = async () => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) return

    setLoading(true)
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({ mark_all_read: true }),
      })
      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('[NotificationBell] Mark all read error:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) return

    try {
      const response = await fetch(`/api/notifications?ids=${notificationId}`, {
        method: 'DELETE',
        headers: { 'X-User-Hash': userHash },
      })
      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('[NotificationBell] Delete error:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    if (notification.action_url) {
      setOpen(false)
      navigate(notification.action_url)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return t('notifications:time.justNow')
    if (minutes < 60) return t('notifications:time.minutesAgo', { count: minutes })
    if (hours < 24) return t('notifications:time.hoursAgo', { count: hours })
    return t('notifications:time.daysAgo', { count: days })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-2">
          <h3 className="font-semibold">{t('notifications:title')}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
              className="h-8"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              {t('notifications:markAllRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('notifications:empty')}
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'px-2 py-3 hover:bg-accent cursor-pointer border-b last:border-0',
                  !notification.is_read && 'bg-accent/50'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatTime(notification.created_at)}</span>
                      {notification.action_url && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />
                            {t('notifications:view')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification.id)
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
