import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Users, AlertTriangle, Shield, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ActorFormEnhanced } from '@/components/entities/ActorFormEnhanced'
import { ActorDetailView } from '@/components/entities/ActorDetailView'
import type { Actor, ActorType } from '@/types/entities'

export function ActorsPage() {
  const { t } = useTranslation(['entities', 'common'])
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [actors, setActors] = useState<Actor[]>([])
  const [currentActor, setCurrentActor] = useState<Actor | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<ActorType | 'all'>('all')
  const [workspaceId, setWorkspaceId] = useState<number>(1) // TODO: Get from workspace selector
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingActor, setEditingActor] = useState<Actor | undefined>(undefined)

  const isDetailView = id && !location.pathname.includes('/edit')
  const isEditMode = id && location.pathname.includes('/edit')

  useEffect(() => {
    if (!isDetailView && !isEditMode) {
      loadActors()
    }
  }, [workspaceId, filterType, isDetailView, isEditMode])

  useEffect(() => {
    if (id) {
      loadActor(id)
    }
  }, [id])

  const loadActors = async () => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const params = new URLSearchParams({
        workspace_id: workspaceId.toString(),
        ...(filterType !== 'all' && { actor_type: filterType })
      })

      const response = await fetch(`/api/actors?${params}`, {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })
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

  const loadActor = async (actorId: string) => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch(`/api/actors/${actorId}`, {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })
      const data = await response.json()

      if (response.ok) {
        setCurrentActor(data)
        if (isEditMode) {
          setEditingActor(data)
        }
      }
    } catch (error) {
      console.error('Failed to load actor:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateActor = async (data: Partial<Actor>) => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    const response = await fetch('/api/actors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userHash && { 'Authorization': `Bearer ${userHash}` })
      },
      body: JSON.stringify({ ...data, workspace_id: workspaceId })
    })

    if (response.ok) {
      setIsFormOpen(false)
      setEditingActor(undefined)
      loadActors()
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create actor')
    }
  }

  const handleUpdateActor = async (data: Partial<Actor>) => {
    if (!editingActor) return

    const userHash = localStorage.getItem('omnicore_user_hash')
    const response = await fetch(`/api/actors/${editingActor.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(userHash && { 'Authorization': `Bearer ${userHash}` })
      },
      body: JSON.stringify(data)
    })

    if (response.ok) {
      setIsFormOpen(false)
      setEditingActor(undefined)
      if (id) {
        // Redirect to detail view after edit
        navigate(`/dashboard/entities/actors/${id}`)
        loadActor(id)
      } else {
        loadActors()
      }
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update actor')
    }
  }

  const handleDelete = async () => {
    if (!currentActor) return
    if (!confirm(`Are you sure you want to delete "${currentActor.name}"?`)) return

    try {
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch(`/api/actors/${currentActor.id}`, {
        method: 'DELETE',
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (response.ok) {
        navigate('/dashboard/entities/actors')
      } else {
        const error = await response.json()
        alert(`Failed to delete actor: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete actor:', error)
      alert('Failed to delete actor')
    }
  }

  const openCreateForm = () => {
    setEditingActor(undefined)
    setIsFormOpen(true)
  }

  const openEditForm = (actor: Actor) => {
    navigate(`/dashboard/entities/actors/${actor.id}/edit`)
  }

  const viewActorDetail = (actor: Actor) => {
    navigate(`/dashboard/entities/actors/${actor.id}`)
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

    if (avgScore >= 4) return <Badge className="bg-red-100 text-red-800">{t('entities:actors.risk.high')}</Badge>
    if (avgScore >= 3) return <Badge className="bg-orange-100 text-orange-800">{t('entities:actors.risk.medium')}</Badge>
    if (avgScore >= 1.5) return <Badge className="bg-yellow-100 text-yellow-800">{t('entities:actors.risk.low')}</Badge>
    return <Badge className="bg-green-100 text-green-800">{t('entities:actors.risk.minimal')}</Badge>
  }

  // Detail view mode
  if (isDetailView && currentActor) {
    return (
      <ActorDetailView
        actor={currentActor}
        onEdit={() => navigate(`/dashboard/entities/actors/${currentActor.id}/edit`)}
        onDelete={handleDelete}
      />
    )
  }

  // Edit mode
  if (isEditMode && editingActor) {
    return (
      <div className="p-6">
        <ActorFormEnhanced
          actor={editingActor}
          onSubmit={handleUpdateActor}
          onCancel={() => navigate(`/dashboard/entities/actors/${editingActor.id}`)}
        />
      </div>
    )
  }

  // Loading state
  if (loading && (isDetailView || isEditMode)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">{t('entities:actors.loadingActor')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // List view (default)
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-8 w-8" />
            {t('entities:actors.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('entities:actors.description')}
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          {t('entities:actors.addButton')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('entities:actors.stats.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{actors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('entities:actors.stats.highRisk')}
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
              {t('entities:actors.stats.organizations')}
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
              {t('entities:actors.stats.individuals')}
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
                  placeholder={t('entities:actors.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as ActorType | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('entities:actors.filterType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('entities:actors.types.all')}</SelectItem>
                <SelectItem value="PERSON">{t('entities:actors.types.person')}</SelectItem>
                <SelectItem value="ORGANIZATION">{t('entities:actors.types.organization')}</SelectItem>
                <SelectItem value="UNIT">{t('entities:actors.types.unit')}</SelectItem>
                <SelectItem value="GOVERNMENT">{t('entities:actors.types.government')}</SelectItem>
                <SelectItem value="GROUP">{t('entities:actors.types.group')}</SelectItem>
                <SelectItem value="OTHER">{t('entities:actors.types.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actors List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">{t('entities:actors.loading')}</p>
          </CardContent>
        </Card>
      ) : filteredActors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('entities:actors.empty')}</p>
            <Button className="mt-4" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              {t('entities:actors.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActors.map((actor) => (
            <Card key={actor.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => viewActorDetail(actor)}>
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
                    <strong>{t('entities:actors.aliases')}</strong> {actor.aliases.join(', ')}
                  </div>
                )}

                {actor.deception_profile && actor.deception_profile.mom && (
                  <div className="pt-2 border-t space-y-1">
                    <div className="text-xs font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <Shield className="h-3 w-3" />
                      {t('entities:actors.momProfile')}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">{t('entities:actors.mom.motive')}</div>
                        <div className="font-semibold">{actor.deception_profile.mom.motive || 0}/5</div>
                      </div>
                      <div>
                        <div className="text-gray-500">{t('entities:actors.mom.opportunity')}</div>
                        <div className="font-semibold">{actor.deception_profile.mom.opportunity || 0}/5</div>
                      </div>
                      <div>
                        <div className="text-gray-500">{t('entities:actors.mom.means')}</div>
                        <div className="font-semibold">{actor.deception_profile.mom.means || 0}/5</div>
                      </div>
                    </div>
                  </div>
                )}

                {((actor as any)._event_count || (actor as any)._evidence_count || (actor as any)._relationship_count) && (
                  <div className="pt-2 border-t flex justify-between text-xs text-gray-500">
                    {(actor as any)._event_count !== undefined && (
                      <span>{(actor as any)._event_count} {t('entities:actors.counts.events')}</span>
                    )}
                    {(actor as any)._evidence_count !== undefined && (
                      <span>{(actor as any)._evidence_count} {t('entities:actors.counts.evidence')}</span>
                    )}
                    {(actor as any)._relationship_count !== undefined && (
                      <span>{(actor as any)._relationship_count} {t('entities:actors.counts.links')}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open)
        if (!open) setEditingActor(undefined)
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingActor ? t('entities:actors.dialog.edit') : t('entities:actors.dialog.create')}
            </DialogTitle>
          </DialogHeader>
          <ActorFormEnhanced
            actor={editingActor}
            onSubmit={editingActor ? handleUpdateActor : handleCreateActor}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingActor(undefined)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
