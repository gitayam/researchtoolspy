import { useRef, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { EntityType, Relationship } from '@/types/entities'

interface NetworkNode {
  id: string
  name: string
  entityType: EntityType
  val?: number // Node size
}

interface NetworkLink {
  source: string
  target: string
  relationshipType: string
  weight: number
  confidence?: string
}

interface NetworkGraphCanvasProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
  onNodeClick?: (node: NetworkNode) => void
  onBackgroundClick?: () => void
  width?: number
  height?: number
}

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  ACTOR: '#3b82f6',      // blue
  SOURCE: '#8b5cf6',     // purple
  EVENT: '#ef4444',      // red
  PLACE: '#10b981',      // green
  BEHAVIOR: '#f59e0b',   // orange
  EVIDENCE: '#6366f1'    // indigo
}

const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
  ACTOR: '👤',
  SOURCE: '📄',
  EVENT: '🎯',
  PLACE: '📍',
  BEHAVIOR: '🔄',
  EVIDENCE: '🔍'
}

export function NetworkGraphCanvas({
  nodes,
  links,
  onNodeClick,
  onBackgroundClick,
  width = 800,
  height = 600
}: NetworkGraphCanvasProps) {
  const graphRef = useRef<any>(null)

  // Convert data to force-graph format
  const graphData = useMemo(() => {
    return {
      nodes: nodes.map(node => ({
        ...node,
        id: node.id,
        name: node.name,
        entityType: node.entityType,
        color: ENTITY_TYPE_COLORS[node.entityType],
        val: node.val || 1
      })),
      links: links.map(link => ({
        ...link,
        source: link.source,
        target: link.target,
        color: link.confidence === 'CONFIRMED' ? '#000000' :
               link.confidence === 'PROBABLE' ? '#666666' :
               link.confidence === 'POSSIBLE' ? '#999999' : '#cccccc',
        width: link.weight * 3, // Scale by weight
        type: link.relationshipType
      }))
    }
  }, [nodes, links])

  const handleNodeClick = useCallback((node: any) => {
    if (onNodeClick) {
      onNodeClick(node as NetworkNode)
    }
  }, [onNodeClick])

  const handleBackgroundClick = useCallback(() => {
    if (onBackgroundClick) {
      onBackgroundClick()
    }
  }, [onBackgroundClick])

  // Custom node canvas rendering
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name
    const fontSize = 12 / globalScale
    const nodeRadius = Math.sqrt(node.val || 1) * 4

    // Draw node circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || '#999999'
    ctx.fill()

    // Draw white border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5 / globalScale
    ctx.stroke()

    // Draw label
    ctx.font = `${fontSize}px Sans-Serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#333333'
    ctx.fillText(label, node.x, node.y + nodeRadius + fontSize)
  }, [])

  // Custom link canvas rendering
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source
    const end = link.target

    if (typeof start !== 'object' || typeof end !== 'object') return

    const lineWidth = (link.width || 1) / globalScale

    ctx.strokeStyle = link.color || '#cccccc'
    ctx.lineWidth = lineWidth

    // Draw dashed line for lower confidence
    if (link.confidence === 'POSSIBLE' || link.confidence === 'SUSPECTED') {
      ctx.setLineDash([5 / globalScale, 5 / globalScale])
    } else {
      ctx.setLineDash([])
    }

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()

    // Draw arrow
    const arrowLength = 10 / globalScale
    const arrowWidth = 6 / globalScale
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const nodeRadius = Math.sqrt(end.val || 1) * 4

    const arrowX = end.x - Math.cos(angle) * nodeRadius
    const arrowY = end.y - Math.sin(angle) * nodeRadius

    ctx.save()
    ctx.translate(arrowX, arrowY)
    ctx.rotate(angle)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-arrowLength, -arrowWidth / 2)
    ctx.lineTo(-arrowLength, arrowWidth / 2)
    ctx.closePath()

    ctx.fillStyle = link.color || '#cccccc'
    ctx.fill()
    ctx.restore()

    ctx.setLineDash([])
  }, [])

  return (
    <div className="relative" style={{ width, height }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="#f9fafb"
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-sm font-semibold mb-2">Entity Types</h3>
        <div className="space-y-1">
          {Object.entries(ENTITY_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span>{ENTITY_TYPE_ICONS[type as EntityType]} {type}</span>
            </div>
          ))}
        </div>
        <h3 className="text-sm font-semibold mt-3 mb-2">Confidence</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5 bg-black" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5 bg-gray-600" />
            <span>Probable</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5 bg-gray-400" style={{ borderBottom: '2px dashed #9ca3af' }} />
            <span>Possible</span>
          </div>
        </div>
      </div>
    </div>
  )
}
