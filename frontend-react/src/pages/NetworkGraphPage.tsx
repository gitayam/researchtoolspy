import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { NetworkGraphCanvas } from '@/components/network/NetworkGraphCanvas'
import { NetworkControls, type NetworkFilters } from '@/components/network/NetworkControls'
import { NetworkExportDialog } from '@/components/network/NetworkExportDialog'
import { NetworkMetricsPanel } from '@/components/network/NetworkMetricsPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, RefreshCw, BarChart3 } from 'lucide-react'
import type { Relationship, EntityType } from '@/types/entities'

interface NetworkNode {
  id: string
  name: string
  entityType: EntityType
  val?: number
}

interface NetworkLink {
  source: string
  target: string
  relationshipType: string
  weight: number
  confidence?: string
}

const CONFIDENCE_ORDER: Record<string, number> = {
  'CONFIRMED': 3,
  'PROBABLE': 2,
  'POSSIBLE': 1,
  'SUSPECTED': 0
}

export function NetworkGraphPage() {
  const navigate = useNavigate()
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [entityNames, setEntityNames] = useState<Record<string, { name: string; type: EntityType }>>({})
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [showMetrics, setShowMetrics] = useState(true)

  const [filters, setFilters] = useState<NetworkFilters>({
    entityTypes: new Set(['ACTOR', 'SOURCE', 'EVENT', 'PLACE', 'BEHAVIOR', 'EVIDENCE']),
    minConfidence: 0,
    searchQuery: '',
    showLabels: true
  })

  // Load all relationships
  useEffect(() => {
    const loadRelationships = async () => {
      setLoading(true)
      try {
        // Get workspace ID from localStorage or use default
        const workspaceId = localStorage.getItem('currentWorkspaceId') || 'default'

        const response = await fetch(`/api/relationships?workspace_id=${workspaceId}`)
        if (response.ok) {
          const data = await response.json()
          setRelationships(data.relationships || [])

          // Collect all unique entity IDs
          const entityIds = new Set<string>()
          const entityInfo: Record<string, { name: string; type: EntityType }> = {}

          data.relationships.forEach((rel: Relationship) => {
            entityIds.add(rel.source_entity_id)
            entityIds.add(rel.target_entity_id)

            // Store entity type info
            if (!entityInfo[rel.source_entity_id]) {
              entityInfo[rel.source_entity_id] = {
                name: `${rel.source_entity_type.substring(0, 1)}${rel.source_entity_id.substring(0, 6)}`,
                type: rel.source_entity_type
              }
            }
            if (!entityInfo[rel.target_entity_id]) {
              entityInfo[rel.target_entity_id] = {
                name: `${rel.target_entity_type.substring(0, 1)}${rel.target_entity_id.substring(0, 6)}`,
                type: rel.target_entity_type
              }
            }
          })

          // TODO: Fetch actual entity names from API
          // For now, use generated names
          setEntityNames(entityInfo)
        }
      } catch (error) {
        console.error('Failed to load relationships:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRelationships()
  }, [])

  // Update container size on mount and window resize
  useEffect(() => {
    const updateSize = () => {
      const container = document.getElementById('graph-container')
      if (container) {
        setContainerSize({
          width: container.clientWidth,
          height: container.clientHeight
        })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Convert relationships to graph data with filters applied
  const graphData = useMemo(() => {
    // Filter relationships
    const filteredRelationships = relationships.filter(rel => {
      // Entity type filter
      if (!filters.entityTypes.has(rel.source_entity_type) ||
          !filters.entityTypes.has(rel.target_entity_type)) {
        return false
      }

      // Confidence filter
      const relConfidence = CONFIDENCE_ORDER[rel.confidence || 'SUSPECTED']
      if (relConfidence < filters.minConfidence) {
        return false
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const sourceName = entityNames[rel.source_entity_id]?.name.toLowerCase() || ''
        const targetName = entityNames[rel.target_entity_id]?.name.toLowerCase() || ''
        if (!sourceName.includes(query) && !targetName.includes(query)) {
          return false
        }
      }

      return true
    })

    // Build nodes from filtered relationships
    const nodeMap = new Map<string, NetworkNode>()
    filteredRelationships.forEach(rel => {
      if (!nodeMap.has(rel.source_entity_id)) {
        const info = entityNames[rel.source_entity_id]
        nodeMap.set(rel.source_entity_id, {
          id: rel.source_entity_id,
          name: info?.name || rel.source_entity_id.substring(0, 8),
          entityType: rel.source_entity_type,
          val: 1
        })
      }
      if (!nodeMap.has(rel.target_entity_id)) {
        const info = entityNames[rel.target_entity_id]
        nodeMap.set(rel.target_entity_id, {
          id: rel.target_entity_id,
          name: info?.name || rel.target_entity_id.substring(0, 8),
          entityType: rel.target_entity_type,
          val: 1
        })
      }
    })

    // Calculate node importance (degree centrality)
    filteredRelationships.forEach(rel => {
      const sourceNode = nodeMap.get(rel.source_entity_id)
      const targetNode = nodeMap.get(rel.target_entity_id)
      if (sourceNode) sourceNode.val = (sourceNode.val || 0) + 1
      if (targetNode) targetNode.val = (targetNode.val || 0) + 1
    })

    // Build links
    const links: NetworkLink[] = filteredRelationships.map(rel => ({
      source: rel.source_entity_id,
      target: rel.target_entity_id,
      relationshipType: rel.relationship_type,
      weight: rel.weight,
      confidence: rel.confidence
    }))

    return {
      nodes: Array.from(nodeMap.values()),
      links
    }
  }, [relationships, entityNames, filters])

  const handleNodeClick = (node: NetworkNode) => {
    setSelectedNode(node)
  }

  const handleBackgroundClick = () => {
    setSelectedNode(null)
  }

  const handleNavigateToEntity = () => {
    if (!selectedNode) return

    const paths: Record<EntityType, string> = {
      ACTOR: `/dashboard/entities/actors/${selectedNode.id}`,
      SOURCE: `/dashboard/entities/sources/${selectedNode.id}`,
      EVENT: `/dashboard/entities/events/${selectedNode.id}`,
      PLACE: `/dashboard/entities/places/${selectedNode.id}`,
      BEHAVIOR: `/dashboard/entities/behaviors/${selectedNode.id}`,
      EVIDENCE: `/dashboard/entities/evidence/${selectedNode.id}`
    }

    navigate(paths[selectedNode.entityType] || '/dashboard')
  }

  const handleNodeClickFromMetrics = (nodeId: string) => {
    const node = graphData.nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading network graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Network Graph</h1>
              <p className="text-sm text-gray-500">
                Interactive entity relationship visualization
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showMetrics ? "default" : "outline"}
              onClick={() => setShowMetrics(!showMetrics)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showMetrics ? "Hide" : "Show"} Metrics
            </Button>
            <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Controls panel */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <NetworkControls
            filters={filters}
            onFiltersChange={setFilters}
            totalNodes={graphData.nodes.length}
            totalEdges={graphData.links.length}
          />
        </div>

        {/* Graph canvas */}
        <div className="flex-1 relative" id="graph-container">
          <NetworkGraphCanvas
            nodes={graphData.nodes}
            links={graphData.links}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            width={containerSize.width}
            height={containerSize.height}
          />
        </div>

        {/* Metrics panel */}
        {showMetrics && !selectedNode && (
          <div className="w-80 bg-white border-l overflow-y-auto">
            <NetworkMetricsPanel
              nodes={graphData.nodes}
              links={graphData.links}
              onNodeClick={handleNodeClickFromMetrics}
            />
          </div>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div className="w-80 bg-white border-l overflow-y-auto">
            <Card className="h-full rounded-none border-0">
              <CardHeader>
                <CardTitle>Selected Node</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Name</div>
                  <div className="font-semibold">{selectedNode.name}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Type</div>
                  <Badge>{selectedNode.entityType}</Badge>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">ID</div>
                  <div className="text-xs font-mono text-gray-600">{selectedNode.id}</div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-1">Connections</div>
                  <div className="font-semibold">{selectedNode.val || 0}</div>
                </div>

                <Button onClick={handleNavigateToEntity} className="w-full">
                  View Details
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setSelectedNode(null)}
                  className="w-full"
                >
                  Close
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Export Dialog */}
      <NetworkExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        nodes={graphData.nodes}
        links={graphData.links}
        filters={{
          entity_types: Array.from(filters.entityTypes),
          min_confidence: filters.minConfidence,
          search_query: filters.searchQuery
        }}
      />
    </div>
  )
}
