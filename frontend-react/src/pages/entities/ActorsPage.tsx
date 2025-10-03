import { useState, useEffect } from 'react'
import { Plus, Search, Users, AlertTriangle, Shield, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Actor, ActorType } from '@/types/entities'

export function ActorsPage() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<ActorType | 'all'>('all')
  const [workspaceId, setWorkspaceId] = useState<number>(1) // TODO: Get from workspace selector

  useEffect(() => {
    loadActors()
  }, [workspaceId, filterType])

  const loadActors = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId.toString(),
        ...(filterType !== 'all' && { actor_type: filterType })
      })

      const response = await fetch(`/api/actors?${params}`)
      const data = await response.json()

      if (response.ok) {
        setActors(data.actors || [])
      }
    } catch (error) {
      console.error('Failed to load actors:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredActors = actors.filter(actor =>
    actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    actor.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getActorTypeIcon = (type: ActorType) => {
    switch (type) {
      case 'PERSON': return '👤'
      case 'ORGANIZATION': return '🏢'
      case 'UNIT': return '⚔️'
      case 'GOVERNMENT': return '🏛️'
      case 'GROUP': return '👥'
      default: return '❓'
    }
  }

  const getActorTypeBadge = (type: ActorType) => {
    const colors = {
      PERSON: 'bg-blue-100 text-blue-800',
      ORGANIZATION: 'bg-purple-100 text-purple-800',
      UNIT: 'bg-green-100 text-green-800',
      GOVERNMENT: 'bg-red-100 text-red-800',
      GROUP: 'bg-orange-100 text-orange-800',
      OTHER: 'bg-gray-100 text-gray-800',
    }
    return colors[type] || colors.OTHER
  }

  const getDeceptionRiskBadge = (profile: any) => {
    if (!profile || !profile.mom) return null

    // Calculate simple risk from MOM-POP scores (0-5 each)
    const motive = profile.mom.motive || 0
    const opportunity = profile.mom.opportunity || 0
    const means = profile.mom.means || 0
    const avgScore = (motive + opportunity + means) / 3

    if (avgScore >= 4) return <Badge className="bg-red-100 text-red-800">High Risk</Badge>
    if (avgScore >= 3) return <Badge className="bg-orange-100 text-orange-800">Medium Risk</Badge>
    if (avgScore >= 1.5) return <Badge className="bg-yellow-100 text-yellow-800">Low Risk</Badge>
    return <Badge className="bg-green-100 text-green-800">Minimal Risk</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-8 w-8" />
            Actors
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            People, organizations, and entities with MOM-POP deception profiles
          </p>
        </div>
        <Button onClick={() => {/* TODO: Open create modal */}}>
          <Plus className="h-4 w-4 mr-2" />
          Add Actor
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Actors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{actors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {actors.filter(a => {
                const profile = a.deception_profile
                if (!profile || !profile.mom) return false
                const avg = ((profile.mom.motive || 0) + (profile.mom.opportunity || 0) + (profile.mom.means || 0)) / 3
                return avg >= 4
              }).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {actors.filter(a => a.type === 'ORGANIZATION').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Individuals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {actors.filter(a => a.type === 'PERSON').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search actors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as ActorType | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PERSON">Person</SelectItem>
                <SelectItem value="ORGANIZATION">Organization</SelectItem>
                <SelectItem value="UNIT">Unit</SelectItem>
                <SelectItem value="GOVERNMENT">Government</SelectItem>
                <SelectItem value="GROUP">Group</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actors List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Loading actors...</p>
          </CardContent>
        </Card>
      ) : filteredActors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No actors found</p>
            <Button className="mt-4" onClick={() => {/* TODO: Open create modal */}}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Actor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActors.map((actor) => (
            <Card key={actor.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getActorTypeIcon(actor.type)}</span>
                    <div>
                      <CardTitle className="text-lg">{actor.name}</CardTitle>
                      <Badge className={`mt-1 ${getActorTypeBadge(actor.type)}`}>
                        {actor.type}
                      </Badge>
                    </div>
                  </div>
                  {getDeceptionRiskBadge(actor.deception_profile)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {actor.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {actor.description}
                  </p>
                )}

                {actor.aliases && actor.aliases.length > 0 && (
                  <div className="text-xs text-gray-500">
                    <strong>Aliases:</strong> {actor.aliases.join(', ')}
                  </div>
                )}

                {actor.deception_profile && actor.deception_profile.mom && (
                  <div className="pt-2 border-t space-y-1">
                    <div className="text-xs font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <Shield className="h-3 w-3" />
                      MOM-POP Profile
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">Motive</div>
                        <div className="font-semibold">{actor.deception_profile.mom.motive || 0}/5</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Opportunity</div>
                        <div className="font-semibold">{actor.deception_profile.mom.opportunity || 0}/5</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Means</div>
                        <div className="font-semibold">{actor.deception_profile.mom.means || 0}/5</div>
                      </div>
                    </div>
                  </div>
                )}

                {((actor as any)._event_count || (actor as any)._evidence_count || (actor as any)._relationship_count) && (
                  <div className="pt-2 border-t flex justify-between text-xs text-gray-500">
                    {(actor as any)._event_count !== undefined && (
                      <span>{(actor as any)._event_count} events</span>
                    )}
                    {(actor as any)._evidence_count !== undefined && (
                      <span>{(actor as any)._evidence_count} evidence</span>
                    )}
                    {(actor as any)._relationship_count !== undefined && (
                      <span>{(actor as any)._relationship_count} links</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
