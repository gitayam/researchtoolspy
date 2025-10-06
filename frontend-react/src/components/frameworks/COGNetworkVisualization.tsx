import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, RefreshCw, ZoomIn, ZoomOut, Maximize2, Info, Eye, EyeOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { NetworkEdge, COGAnalysis, CenterOfGravity, CriticalCapability, CriticalRequirement, CriticalVulnerability } from '@/types/cog-analysis'

interface GraphNode extends NodeObject {
  id: string
  label: string
  type: 'cog' | 'capability' | 'requirement' | 'vulnerability'
  data: CenterOfGravity | CriticalCapability | CriticalRequirement | CriticalVulnerability
  degree?: number
  color?: string
  size?: number
}

interface GraphLink extends LinkObject {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
  relationship: 'enables' | 'requires' | 'exposes'
}

interface COGNetworkVisualizationProps {
  analysis: COGAnalysis
  edges: NetworkEdge[]
  onNodeClick?: (node: GraphNode) => void
}

const NODE_COLORS = {
  cog: '#ef4444', // red
  capability: '#3b82f6', // blue
  requirement: '#f59e0b', // yellow/orange
  vulnerability: '#10b981', // green
}

const NODE_SIZES = {
  cog: 12,
  capability: 8,
  requirement: 6,
  vulnerability: 10,
}

export function COGNetworkVisualization({ analysis, edges, onNodeClick }: COGNetworkVisualizationProps) {
  const graphRef = useRef<ForceGraphMethods | undefined>()
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [simulationMode, setSimulationMode] = useState(false)
  const [removedNodes, setRemovedNodes] = useState<Set<string>>(new Set())
  const [showLabels, setShowLabels] = useState(true)
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set())

  // Build nodes from analysis data
  const allNodes = useMemo(() => {
    const nodes: GraphNode[] = []

    // Add COG nodes
    analysis.centers_of_gravity.forEach(cog => {
      if (!removedNodes.has(cog.id)) {
        nodes.push({
          id: cog.id,
          label: cog.description || 'COG',
          type: 'cog',
          data: cog,
          color: NODE_COLORS.cog,
          size: NODE_SIZES.cog,
        })
      }
    })

    // Add Capability nodes
    analysis.critical_capabilities.forEach(cap => {
      if (!removedNodes.has(cap.id) && !removedNodes.has(cap.cog_id)) {
        nodes.push({
          id: cap.id,
          label: cap.capability || 'Capability',
          type: 'capability',
          data: cap,
          color: NODE_COLORS.capability,
          size: NODE_SIZES.capability,
        })
      }
    })

    // Add Requirement nodes
    analysis.critical_requirements.forEach(req => {
      const parentCap = analysis.critical_capabilities.find(c => c.id === req.capability_id)
      if (!removedNodes.has(req.id) && !removedNodes.has(req.capability_id) && parentCap && !removedNodes.has(parentCap.cog_id)) {
        nodes.push({
          id: req.id,
          label: req.requirement || 'Requirement',
          type: 'requirement',
          data: req,
          color: NODE_COLORS.requirement,
          size: NODE_SIZES.requirement,
        })
      }
    })

    // Add Vulnerability nodes
    analysis.critical_vulnerabilities.forEach(vuln => {
      const parentReq = analysis.critical_requirements.find(r => r.id === vuln.requirement_id)
      const parentCap = parentReq ? analysis.critical_capabilities.find(c => c.id === parentReq.capability_id) : null
      if (!removedNodes.has(vuln.id) && !removedNodes.has(vuln.requirement_id) &&
          parentReq && !removedNodes.has(parentReq.capability_id) &&
          parentCap && !removedNodes.has(parentCap.cog_id)) {
        nodes.push({
          id: vuln.id,
          label: vuln.vulnerability || 'Vulnerability',
          type: 'vulnerability',
          data: vuln,
          color: NODE_COLORS.vulnerability,
          size: NODE_SIZES.vulnerability,
        })
      }
    })

    return nodes
  }, [analysis, removedNodes])

  // Build links from edges, filtering out removed nodes
  const allLinks = useMemo(() => {
    return edges
      .filter(edge =>
        !removedNodes.has(edge.source) &&
        !removedNodes.has(edge.target) &&
        allNodes.some(n => n.id === edge.source) &&
        allNodes.some(n => n.id === edge.target)
      )
      .map(edge => ({
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        relationship: edge.relationship,
      }))
  }, [edges, removedNodes, allNodes])

  // Handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)

    // Highlight connected nodes and links
    const connectedNodeIds = new Set<string>()
    const connectedLinkIds = new Set<string>()

    allLinks.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source
      const targetId = typeof link.target === 'object' ? link.target.id : link.target

      if (sourceId && targetId && (sourceId === node.id || targetId === node.id)) {
        connectedNodeIds.add(sourceId)
        connectedNodeIds.add(targetId)
        connectedLinkIds.add(`${sourceId}-${targetId}`)
      }
    })

    setHighlightNodes(connectedNodeIds)
    setHighlightLinks(connectedLinkIds)
  }, [allLinks, onNodeClick])

  // Handle background click to clear selection
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
    setHighlightNodes(new Set())
    setHighlightLinks(new Set())
  }, [])

  // Simulation mode: Remove node
  const handleRemoveNode = useCallback((nodeId: string) => {
    if (simulationMode) {
      setRemovedNodes(prev => new Set([...prev, nodeId]))
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null)
        setHighlightNodes(new Set())
        setHighlightLinks(new Set())
      }
    }
  }, [simulationMode, selectedNode])

  // Reset simulation
  const resetSimulation = useCallback(() => {
    setRemovedNodes(new Set())
    setSelectedNode(null)
    setHighlightNodes(new Set())
    setHighlightLinks(new Set())
  }, [])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(1.5, 400)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(0.67, 400)
    }
  }, [])

  const handleFitView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50)
    }
  }, [])

  // Export as PNG
  const exportAsPNG = useCallback(() => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `${analysis.title}-network.png`
      link.href = url
      link.click()
    }
  }, [analysis.title])

  // Custom node renderer
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label
    const fontSize = 12 / globalScale
    const nodeSize = (node.size || 5)

    // Draw node circle
    ctx.beginPath()
    ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI)

    // Highlight if selected or connected
    if (node.id === selectedNode?.id) {
      ctx.fillStyle = '#facc15' // yellow highlight
      ctx.strokeStyle = '#854d0e'
      ctx.lineWidth = 3 / globalScale
    } else if (highlightNodes.has(node.id!)) {
      ctx.fillStyle = node.color || '#666'
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 2 / globalScale
    } else {
      ctx.fillStyle = node.color || '#666'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1 / globalScale
    }

    ctx.fill()
    ctx.stroke()

    // Draw label if enabled
    if (showLabels) {
      ctx.font = `${fontSize}px Sans-Serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#000'
      const maxWidth = 80 / globalScale
      const truncatedLabel = label.length > 20 ? label.substring(0, 20) + '...' : label
      ctx.fillText(truncatedLabel, node.x!, node.y! + nodeSize + fontSize)
    }
  }, [selectedNode, highlightNodes, showLabels])

  // Custom link renderer
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const sourceNode = typeof link.source === 'object' ? link.source : allNodes.find(n => n.id === link.source)
    const targetNode = typeof link.target === 'object' ? link.target : allNodes.find(n => n.id === link.target)

    if (!sourceNode || !targetNode) return

    const sourceId = typeof link.source === 'object' ? link.source.id : link.source
    const targetId = typeof link.target === 'object' ? link.target.id : link.target
    const linkId = `${sourceId}-${targetId}`

    // Set link style
    if (highlightLinks.has(linkId)) {
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 3 / globalScale
    } else {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'
      ctx.lineWidth = 1 / globalScale
    }

    // Draw line
    ctx.beginPath()
    ctx.moveTo(sourceNode.x!, sourceNode.y!)
    ctx.lineTo(targetNode.x!, targetNode.y!)
    ctx.stroke()
  }, [allNodes, highlightLinks])

  // Fit to view on mount
  useEffect(() => {
    if (graphRef.current && allNodes.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50)
      }, 100)
    }
  }, [allNodes.length])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Network Controls</CardTitle>
              <CardDescription>Interact with the network graph</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleFitView}>
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportAsPNG}>
                <Download className="h-4 w-4 mr-2" />
                Export PNG
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Show Labels Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="show-labels"
                checked={showLabels}
                onCheckedChange={setShowLabels}
              />
              <Label htmlFor="show-labels" className="flex items-center gap-1">
                {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Node Labels
              </Label>
            </div>

            {/* Simulation Mode Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="simulation-mode"
                checked={simulationMode}
                onCheckedChange={setSimulationMode}
              />
              <Label htmlFor="simulation-mode" className="flex items-center gap-1">
                <Info className="h-4 w-4" />
                "What If?" Simulation
              </Label>
            </div>

            {/* Reset Button */}
            {removedNodes.size > 0 && (
              <Button variant="outline" size="sm" onClick={resetSimulation}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset ({removedNodes.size} removed)
              </Button>
            )}

            {/* Legend */}
            <div className="flex gap-3 ml-auto">
              <Badge style={{ backgroundColor: NODE_COLORS.cog }} className="text-white">COG</Badge>
              <Badge style={{ backgroundColor: NODE_COLORS.capability }} className="text-white">Capability</Badge>
              <Badge style={{ backgroundColor: NODE_COLORS.requirement }} className="text-white">Requirement</Badge>
              <Badge style={{ backgroundColor: NODE_COLORS.vulnerability }} className="text-white">Vulnerability</Badge>
            </div>
          </div>

          {simulationMode && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800 text-sm">
              <p className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Simulation Mode Active</p>
              <p className="text-yellow-800 dark:text-yellow-200">Click any node to remove it and see the cascading effects on the network. Click "Reset" to restore all nodes.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graph Visualization */}
      <Card>
        <CardContent className="p-0">
          <div className="relative" style={{ height: '600px', background: '#f9fafb' }}>
            <ForceGraph2D
              ref={graphRef as any}
              graphData={{ nodes: allNodes, links: allLinks }}
              nodeId="id"
              nodeLabel="label"
              linkSource="source"
              linkTarget="target"
              nodeCanvasObject={paintNode}
              linkCanvasObject={paintLink}
              onNodeClick={(node) => {
                if (simulationMode) {
                  handleRemoveNode(node.id!)
                } else {
                  handleNodeClick(node as GraphNode)
                }
              }}
              onBackgroundClick={handleBackgroundClick}
              linkDirectionalParticles={2}
              linkDirectionalParticleWidth={2}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              enableNodeDrag={!simulationMode}
              enableZoomInteraction={true}
              enablePanInteraction={true}
            />

            {/* Selected Node Info Overlay */}
            {selectedNode && !simulationMode && (
              <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border max-w-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-sm">{selectedNode.label}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setSelectedNode(null)}
                  >
                    ×
                  </Button>
                </div>
                <Badge className="mb-2" style={{ backgroundColor: selectedNode.color }}>
                  {selectedNode.type}
                </Badge>
                {selectedNode.type === 'vulnerability' && (
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Type:</span>{' '}
                      {(selectedNode.data as CriticalVulnerability).vulnerability_type}
                    </div>
                    <div>
                      <span className="font-medium">Score:</span>{' '}
                      {(selectedNode.data as CriticalVulnerability).composite_score}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-600">
                  Connected to {highlightNodes.size - 1} other nodes
                </div>
              </div>
            )}

            {/* Network Stats Overlay */}
            <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow border text-sm">
              <div className="space-y-1">
                <div><span className="font-medium">Nodes:</span> {allNodes.length}</div>
                <div><span className="font-medium">Edges:</span> {allLinks.length}</div>
                {removedNodes.size > 0 && (
                  <div className="text-red-600"><span className="font-medium">Removed:</span> {removedNodes.size}</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
