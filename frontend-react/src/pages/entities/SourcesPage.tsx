import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search, Database, Shield, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SourceForm } from '@/components/entities/SourceForm'
import { SourceDetailView } from '@/components/entities/SourceDetailView'
import type { Source, SourceType } from '@/types/entities'

export function SourcesPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [sources, setSources] = useState<Source[]>([])
  const [currentSource, setCurrentSource] = useState<Source | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<SourceType | 'all'>('all')
  const [workspaceId, setWorkspaceId] = useState<number>(1)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<Source | undefined>(undefined)

  const isDetailView = id && !location.pathname.includes('/edit')
  const isEditMode = id && location.pathname.includes('/edit')

  useEffect(() => {
    if (!isDetailView && !isEditMode) {
      loadSources()
    }
  }, [workspaceId, filterType, isDetailView, isEditMode])

  useEffect(() => {
    if (id) {
      loadSource(id)
    }
  }, [id])

  const loadSources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId.toString(),
        ...(filterType !== 'all' && { source_type: filterType })
      })

      const response = await fetch(`/api/sources?${params}`)
      const data = await response.json()

      if (response.ok) {
        setSources(data.sources || [])
      }
    } catch (error) {
      console.error('Failed to load sources:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSource = async (sourceId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sources/${sourceId}`)
      const data = await response.json()

      if (response.ok) {
        setCurrentSource(data.source)
        if (isEditMode) {
          setEditingSource(data.source)
        }
      }
    } catch (error) {
      console.error('Failed to load source:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSource = async (data: Partial<Source>) => {
    const response = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, workspace_id: workspaceId })
    })

    if (response.ok) {
      setIsFormOpen(false)
      setEditingSource(undefined)
      loadSources()
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create source')
    }
  }

  const handleUpdateSource = async (data: Partial<Source>) => {
    if (!editingSource) return

    const response = await fetch(`/api/sources/${editingSource.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (response.ok) {
      setIsFormOpen(false)
      setEditingSource(undefined)
      if (id) {
        navigate(`/dashboard/entities/sources/${id}`)
        loadSource(id)
      } else {
        loadSources()
      }
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update source')
    }
  }

  const handleDelete = async () => {
    if (!currentSource) return
    if (!confirm(`Are you sure you want to delete "${currentSource.name}"?`)) return

    try {
      const response = await fetch(`/api/sources/${currentSource.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        navigate('/dashboard/entities/sources')
      } else {
        const error = await response.json()
        alert(`Failed to delete source: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete source:', error)
      alert('Failed to delete source')
    }
  }

  const viewSourceDetail = (source: Source) => {
    navigate(`/dashboard/entities/sources/${source.id}`)
  }

  const openCreateForm = () => {
    setEditingSource(undefined)
    setIsFormOpen(true)
  }

  const openEditForm = (source: Source) => {
    setEditingSource(source)
    setIsFormOpen(true)
  }

  const filteredSources = sources.filter(source =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getSourceTypeIcon = (type: SourceType) => {
    const icons = {
      PERSON: '👤',
      DOCUMENT: '📄',
      WEBSITE: '🌐',
      DATABASE: '🗄️',
      MEDIA: '📸',
      SYSTEM: '⚙️',
      ORGANIZATION: '🏢',
      OTHER: '❓',
    }
    return icons[type] || '❓'
  }

  const getSourceTypeBadge = (type: SourceType) => {
    const colors = {
      PERSON: 'bg-blue-100 text-blue-800',
      DOCUMENT: 'bg-purple-100 text-purple-800',
      WEBSITE: 'bg-cyan-100 text-cyan-800',
      DATABASE: 'bg-green-100 text-green-800',
      MEDIA: 'bg-orange-100 text-orange-800',
      SYSTEM: 'bg-yellow-100 text-yellow-800',
      ORGANIZATION: 'bg-pink-100 text-pink-800',
      OTHER: 'bg-gray-100 text-gray-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getReliabilityBadge = (reliability: string) => {
    const colors = {
      A: 'bg-green-100 text-green-800',
      B: 'bg-blue-100 text-blue-800',
      C: 'bg-yellow-100 text-yellow-800',
      D: 'bg-orange-100 text-orange-800',
      E: 'bg-red-100 text-red-800',
      F: 'bg-gray-100 text-gray-800',
    }
    return colors[reliability] || colors.F
  }

  const getMOSESBadge = (assessment: any) => {
    if (!assessment) return null

    // Calculate risk from MOSES scores (source_vulnerability and manipulation_evidence)
    const scores = [
      assessment.source_vulnerability,
      assessment.manipulation_evidence
    ].filter(s => s !== undefined)

    if (scores.length === 0) return null

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length

    // Lower scores = higher reliability (inverted)
    if (avg <= 1) return <Badge className="bg-green-100 text-green-800">High Reliability</Badge>
    if (avg <= 2) return <Badge className="bg-blue-100 text-blue-800">Medium Reliability</Badge>
    if (avg <= 3.5) return <Badge className="bg-yellow-100 text-yellow-800">Low Reliability</Badge>
    return <Badge className="bg-red-100 text-red-800">Unreliable</Badge>
  }

  // Detail view mode
  if (isDetailView && currentSource) {
    return (
      <SourceDetailView
        source={currentSource}
        onEdit={() => navigate(`/dashboard/entities/sources/${currentSource.id}/edit`)}
        onDelete={handleDelete}
      />
    )
  }

  // Edit mode
  if (isEditMode && editingSource) {
    return (
      <div className="p-6">
        <SourceForm
          source={editingSource}
          onSubmit={handleUpdateSource}
          onCancel={() => navigate(`/dashboard/entities/sources/${editingSource.id}`)}
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
            <p className="text-gray-500">Loading source...</p>
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
            <Database className="h-8 w-8" />
            Sources
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Information sources with MOSES reliability assessment
          </p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Source
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sources.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              People
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sources.filter(s => s.type === 'PERSON').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sources.filter(s => s.type === 'DOCUMENT').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              High Reliability (A-B)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {sources.filter(s => s.moses_assessment?.reliability === 'A' || s.moses_assessment?.reliability === 'B').length}
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
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as SourceType | 'all')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PERSON">Person</SelectItem>
                <SelectItem value="DOCUMENT">Document</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
                <SelectItem value="DATABASE">Database</SelectItem>
                <SelectItem value="MEDIA">Media</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="ORGANIZATION">Organization</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sources List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Loading sources...</p>
          </CardContent>
        </Card>
      ) : filteredSources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No sources found</p>
            <Button className="mt-4" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSources.map((source) => (
            <Card key={source.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => openEditForm(source)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getSourceTypeIcon(source.type)}</span>
                    <div>
                      <CardTitle className="text-lg">{source.name}</CardTitle>
                      <Badge className={`mt-1 ${getSourceTypeBadge(source.type)}`}>
                        {source.type}
                      </Badge>
                    </div>
                  </div>
                  {source.moses_assessment?.reliability && (
                    <Badge className={getReliabilityBadge(source.moses_assessment.reliability)}>
                      {source.moses_assessment.reliability}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {source.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {source.description}
                  </p>
                )}

                {source.moses_assessment?.access_level && (
                  <div className="flex items-center gap-2 text-xs">
                    <Eye className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Access: {source.moses_assessment.access_level}
                    </span>
                  </div>
                )}

                {source.moses_assessment && (
                  <div className="pt-2 border-t space-y-1">
                    <div className="text-xs font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-300 justify-between">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        MOSES Assessment
                      </span>
                      {getMOSESBadge(source.moses_assessment)}
                    </div>
                  </div>
                )}

                {(source as any)._evidence_count !== undefined && (
                  <div className="pt-2 border-t text-xs text-gray-500">
                    <span>{(source as any)._evidence_count} evidence items</span>
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
        if (!open) setEditingSource(undefined)
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSource ? 'Edit Source' : 'Create New Source'}
            </DialogTitle>
          </DialogHeader>
          <SourceForm
            source={editingSource}
            onSubmit={editingSource ? handleUpdateSource : handleCreateSource}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingSource(undefined)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
