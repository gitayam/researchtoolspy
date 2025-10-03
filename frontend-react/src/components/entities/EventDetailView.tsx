import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Calendar, Clock, MapPin, AlertTriangle, CheckCircle, Users, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { Event } from '@/types/entities'

interface EventDetailViewProps {
  event: Event
  onEdit: () => void
  onDelete: () => void
}

export function EventDetailView({ event, onEdit, onDelete }: EventDetailViewProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const getEventTypeIcon = (type: string) => {
    const icons = {
      OPERATION: '🎯',
      INCIDENT: '⚠️',
      MEETING: '🤝',
      ACTIVITY: '📋',
      OTHER: '❓'
    }
    return icons[type as keyof typeof icons] || icons.OTHER
  }

  const getEventTypeBadge = (type: string) => {
    const colors = {
      OPERATION: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      INCIDENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      MEETING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ACTIVITY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    }
    return colors[type as keyof typeof colors] || colors.OTHER
  }

  const getSignificanceBadge = (significance: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    }
    return colors[significance as keyof typeof colors] || colors.LOW
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      CONFIRMED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      PROBABLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      POSSIBLE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      DOUBTFUL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    }
    return colors[confidence as keyof typeof colors] || colors.POSSIBLE
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'N/A'

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h ${mins}m`
    } else if (hours > 0) {
      return `${hours}h ${mins}m`
    } else {
      return `${mins}m`
    }
  }

  const calculateEventStatus = () => {
    const startDate = new Date(event.date_start)
    const endDate = event.date_end ? new Date(event.date_end) : null
    const now = new Date()

    if (endDate && now > endDate) {
      return { status: 'Completed', color: 'gray', icon: CheckCircle }
    } else if (now < startDate) {
      return { status: 'Scheduled', color: 'blue', icon: Calendar }
    } else {
      return { status: 'In Progress', color: 'green', icon: Clock }
    }
  }

  const eventStatus = calculateEventStatus()
  const StatusIcon = eventStatus.icon

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/entities/events')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{getEventTypeIcon(event.event_type)}</span>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{event.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getEventTypeBadge(event.event_type)}>{event.event_type}</Badge>
                  {event.significance && (
                    <Badge className={getSignificanceBadge(event.significance)}>
                      {event.significance}
                    </Badge>
                  )}
                  {event.confidence && (
                    <Badge className={getConfidenceBadge(event.confidence)}>
                      {event.confidence}
                    </Badge>
                  )}
                  <Badge className={`bg-${eventStatus.color}-100 text-${eventStatus.color}-800`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {eventStatus.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="actors">Linked Actors</TabsTrigger>
          <TabsTrigger value="evidence">Linked Evidence</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Information */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</h3>
                    <p className="text-gray-600 dark:text-gray-400">{event.description}</p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Start Date
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">{formatDate(event.date_start)}</p>
                  </div>

                  {event.date_end && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        End Date
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">{formatDate(event.date_end)}</p>
                    </div>
                  )}
                </div>

                {event.duration !== undefined && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Duration
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">{formatDuration(event.duration)}</p>
                  </div>
                )}

                {event.coordinates && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Coordinates
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {event.coordinates.lat.toFixed(6)}, {event.coordinates.lng.toFixed(6)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Event Type</div>
                  <div className="text-2xl font-bold">{event.event_type}</div>
                </div>

                {event.significance && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Significance</div>
                    <div className="text-2xl font-bold">{event.significance}</div>
                  </div>
                )}

                {event.confidence && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Confidence</div>
                    <div className="text-2xl font-bold">{event.confidence}</div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <Badge variant="secondary">{eventStatus.status}</Badge>
                </div>

                <Separator />

                <div className="text-xs text-gray-500 space-y-1">
                  <div>Created: {new Date(event.created_at).toLocaleDateString()}</div>
                  <div>Updated: {new Date(event.updated_at).toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Event Timeline
              </CardTitle>
              <CardDescription>Temporal analysis and duration breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                    <div className="w-0.5 h-16 bg-blue-600"></div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Event Start</div>
                    <div className="text-sm text-gray-600">{formatDate(event.date_start)}</div>
                  </div>
                </div>

                {event.date_end && (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <div className="w-0.5 h-16 bg-gray-400"></div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Duration</div>
                        <div className="text-sm text-gray-600">{formatDuration(event.duration)}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Event End</div>
                        <div className="text-sm text-gray-600">{formatDate(event.date_end)}</div>
                      </div>
                    </div>
                  </>
                )}

                {!event.date_end && (
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-yellow-600 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Ongoing</div>
                      <div className="text-sm text-gray-600">End date not specified</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linked Actors Tab */}
        <TabsContent value="actors" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Linked actors display coming soon</p>
              <p className="text-sm text-gray-400">
                View all actors involved in this event with their MOM assessments
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linked Evidence Tab */}
        <TabsContent value="evidence" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Linked evidence display coming soon</p>
              <p className="text-sm text-gray-400">
                View all evidence items related to this event
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
