import { useState, useEffect } from 'react'
import { Plus, Search, Database, Shield, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Source, SourceType } from '@/types/entities'

export function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<SourceType | 'all'>('all')
  const [workspaceId, setWorkspaceId] = useState<number>(1)

  useEffect(() => {
    loadSources()
  }, [workspaceId, filterType])

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

  const filteredSources = sources.filter(source =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getSourceTypeIcon = (type: SourceType) => {
    const icons = {
      HUMINT: '👤',
      SIGINT: '📡',
      IMINT: '📸',
      OSINT: '🌐',
      GEOINT: '🗺️',
      MASINT: '⚡',
      TECHINT: '🔬',
      CYBER: '💻',
    }
    return icons[type] || '❓'
  }

  const getSourceTypeBadge = (type: SourceType) => {
    const colors = {
      HUMINT: 'bg-blue-100 text-blue-800',
      SIGINT: 'bg-purple-100 text-purple-800',
      IMINT: 'bg-green-100 text-green-800',
      OSINT: 'bg-cyan-100 text-cyan-800',
      GEOINT: 'bg-orange-100 text-orange-800',
      MASINT: 'bg-yellow-100 text-yellow-800',
      TECHINT: 'bg-pink-100 text-pink-800',
      CYBER: 'bg-red-100 text-red-800',
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
            Intelligence sources with MOSES assessment
          </p>
        </div>
        <Button onClick={() => {/* TODO: Open create modal */}}>
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
              HUMINT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sources.filter(s => s.type === 'HUMINT').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              OSINT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sources.filter(s => s.type === 'OSINT').length}
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
                <SelectItem value="HUMINT">HUMINT</SelectItem>
                <SelectItem value="SIGINT">SIGINT</SelectItem>
                <SelectItem value="IMINT">IMINT</SelectItem>
                <SelectItem value="OSINT">OSINT</SelectItem>
                <SelectItem value="GEOINT">GEOINT</SelectItem>
                <SelectItem value="MASINT">MASINT</SelectItem>
                <SelectItem value="TECHINT">TECHINT</SelectItem>
                <SelectItem value="CYBER">CYBER</SelectItem>
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
            <Button className="mt-4" onClick={() => {/* TODO: Open create modal */}}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSources.map((source) => (
            <Card key={source.id} className="hover:shadow-lg transition-shadow cursor-pointer">
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
    </div>
  )
}
