import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Users, Shield, TrendingUp, AlertTriangle, Link as LinkIcon, Calendar, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import type { Actor } from '@/types/entities'

interface ActorDetailViewProps {
  actor: Actor
  onEdit: () => void
  onDelete: () => void
}

export function ActorDetailView({ actor, onEdit, onDelete }: ActorDetailViewProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  const getActorTypeIcon = (type: string) => {
    const icons = {
      PERSON: '👤',
      ORGANIZATION: '🏢',
      UNIT: '⚔️',
      GOVERNMENT: '🏛️',
      GROUP: '👥',
      OTHER: '❓'
    }
    return icons[type as keyof typeof icons] || icons.OTHER
  }

  const getActorTypeBadge = (type: string) => {
    const colors = {
      PERSON: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ORGANIZATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      UNIT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      GOVERNMENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      GROUP: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    }
    return colors[type as keyof typeof colors] || colors.OTHER
  }

  const calculateDeceptionRisk = () => {
    if (!actor.deception_profile || !actor.deception_profile.mom) {
      return { level: 'unknown', score: 0, color: 'gray' }
    }

    const { motive, opportunity, means } = actor.deception_profile.mom
    const avgScore = ((motive || 0) + (opportunity || 0) + (means || 0)) / 3
    const percentage = (avgScore / 5) * 100

    if (avgScore >= 4) return { level: 'Critical', score: percentage, color: 'red' }
    if (avgScore >= 3) return { level: 'High', score: percentage, color: 'orange' }
    if (avgScore >= 1.5) return { level: 'Medium', score: percentage, color: 'yellow' }
    return { level: 'Low', score: percentage, color: 'green' }
  }

  const risk = calculateDeceptionRisk()

  const getRiskColorClasses = (color: string) => {
    const colors = {
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const getProgressColor = (color: string) => {
    const colors = {
      red: 'bg-red-600',
      orange: 'bg-orange-600',
      yellow: 'bg-yellow-600',
      green: 'bg-green-600',
      gray: 'bg-gray-600'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard/entities/actors')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Actors
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">{getActorTypeIcon(actor.type)}</span>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{actor.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getActorTypeBadge(actor.type)}>{actor.type}</Badge>
                  {risk.level !== 'unknown' && (
                    <Badge className={getRiskColorClasses(risk.color)}>
                      {risk.level} Deception Risk
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {actor.aliases && actor.aliases.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Also known as:</strong> {actor.aliases.join(', ')}
              </p>
            )}
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
          <TabsTrigger value="deception">Deception Profile</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Information */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {actor.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.description}</p>
                  </div>
                )}

                {actor.affiliation && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Affiliation</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.affiliation}</p>
                  </div>
                )}

                {actor.role && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.role}</p>
                  </div>
                )}

                {actor.category && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</h3>
                    <p className="text-gray-600 dark:text-gray-400">{actor.category}</p>
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Linked Events</span>
                  <Badge variant="secondary">{(actor as any)._event_count || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Evidence Items</span>
                  <Badge variant="secondary">{(actor as any)._evidence_count || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Relationships</span>
                  <Badge variant="secondary">{(actor as any)._relationship_count || 0}</Badge>
                </div>
                <Separator />
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Created: {new Date(actor.created_at).toLocaleDateString()}</div>
                  <div>Updated: {new Date(actor.updated_at).toLocaleDateString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deception Profile Tab */}
        <TabsContent value="deception" className="space-y-6">
          {actor.deception_profile && actor.deception_profile.mom ? (
            <>
              {/* Overall Risk Card */}
              <Card className="border-l-4" style={{ borderLeftColor: risk.color === 'red' ? '#dc2626' : risk.color === 'orange' ? '#ea580c' : risk.color === 'yellow' ? '#ca8a04' : '#16a34a' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Overall Deception Risk: {risk.level}
                  </CardTitle>
                  <CardDescription>
                    Based on MOM-POP assessment (Motive, Opportunity, Means + Patterns of Practice)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Risk Score</span>
                      <span className="font-semibold">{risk.score.toFixed(1)}%</span>
                    </div>
                    <Progress value={risk.score} className={`h-3 ${getProgressColor(risk.color)}`} />
                  </div>
                </CardContent>
              </Card>

              {/* MOM Scores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Motive</CardTitle>
                    <CardDescription>Reason to deceive</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-3xl font-bold">{actor.deception_profile.mom.motive || 0}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={((actor.deception_profile.mom.motive || 0) / 5) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Opportunity</CardTitle>
                    <CardDescription>Ability to deceive</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-3xl font-bold">{actor.deception_profile.mom.opportunity || 0}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={((actor.deception_profile.mom.opportunity || 0) / 5) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Means</CardTitle>
                    <CardDescription>Capability to deceive</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-3xl font-bold">{actor.deception_profile.mom.means || 0}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      <Progress value={((actor.deception_profile.mom.means || 0) / 5) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* POP - Patterns of Practice */}
              {actor.deception_profile.pop && (
                <Card>
                  <CardHeader>
                    <CardTitle>Patterns of Practice (POP)</CardTitle>
                    <CardDescription>Historical deception behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Historical Pattern</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{actor.deception_profile.pop.historical_pattern}</span>
                          <span className="text-gray-500">/5</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sophistication</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{actor.deception_profile.pop.sophistication_level}</span>
                          <span className="text-gray-500">/5</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Success Rate</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{actor.deception_profile.pop.success_rate}</span>
                          <span className="text-gray-500">/5</span>
                        </div>
                      </div>
                    </div>
                    {actor.deception_profile.pop.notes && (
                      <div className="pt-4 border-t">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {actor.deception_profile.pop.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* MOM Assessment Notes */}
              {actor.deception_profile.mom && actor.deception_profile.mom.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>MOM Assessment Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {actor.deception_profile.mom.notes}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No deception profile available</p>
                <Button onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Add Deception Profile
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Relationships Tab */}
        <TabsContent value="relationships" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Relationship visualization coming soon</p>
              <p className="text-sm text-gray-400 mt-2">
                Network graph showing connections to other actors, events, and evidence
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Activity timeline coming soon</p>
              <p className="text-sm text-gray-400 mt-2">
                Chronological view of events, evidence updates, and relationship changes
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
