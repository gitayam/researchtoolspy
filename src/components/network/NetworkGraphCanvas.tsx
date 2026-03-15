import { useRef, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  highlightedPath?: string[] // Array of node IDs in the path
  highlightedNodes?: Set<string> // Set of node IDs to highlight (from framework)
  showLegend?: boolean // Hide legend in mini view
  darkMode?: boolean // Adapt colors for dark backgrounds
  compact?: boolean // Faster stabilization + zoom controls for mini view
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
  height = 600,
  highlightedPath = [],
  highlightedNodes = new Set(),
  showLegend = true,
  darkMode = false,
  compact = false,
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
        color: darkMode
          ? (link.confidence === 'CONFIRMED' ? '#e2e8f0' :
             link.confidence === 'PROBABLE' ? '#94a3b8' :
             link.confidence === 'POSSIBLE' ? '#64748b' : '#475569')
          : (link.confidence === 'CONFIRMED' ? '#000000' :
             link.confidence === 'PROBABLE' ? '#666666' :
             link.confidence === 'POSSIBLE' ? '#999999' : '#cccccc'),
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

  const handleZoomIn = useCallback(() => {
    const g = graphRef.current
    if (g) {
      const currentZoom = g.zoom()
      g.zoom(currentZoom * 1.5, 300)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    const g = graphRef.current
    if (g) {
      const currentZoom = g.zoom()
      g.zoom(currentZoom / 1.5, 300)
    }
  }, [])

  const handleZoomReset = useCallback(() => {
    graphRef.current?.zoomToFit(400, 20)
  }, [])

  // Custom node canvas rendering
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name
    const fontSize = 12 / globalScale
    const nodeRadius = Math.sqrt(node.val || 1) * 5
    const isInPath = highlightedPath.includes(node.id)
    const isInHighlightSet = highlightedNodes.has(node.id)
    const isHighlighted = isInPath || isInHighlightSet

    // Draw node circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || '#999999'
    ctx.fill()

    // Draw border (golden if highlighted, subtle otherwise)
    ctx.strokeStyle = isHighlighted ? '#fbbf24' : (darkMode ? 'rgba(255,255,255,0.3)' : '#ffffff')
    ctx.lineWidth = isHighlighted ? 3 / globalScale : 1.5 / globalScale
    ctx.stroke()

    // Draw outer glow for highlighted nodes
    if (isHighlighted) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, nodeRadius + 2 / globalScale, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)'
      ctx.lineWidth = 4 / globalScale
      ctx.stroke()
    }

    // Always show truncated labels — with background pill for readability
    const truncatedLabel = label.length > 12 ? label.substring(0, 11) + '…' : label
    ctx.font = `${fontSize}px Sans-Serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const textY = node.y + nodeRadius + fontSize
    const textWidth = ctx.measureText(truncatedLabel).width
    const padding = 2 / globalScale

    // Background pill behind label
    ctx.fillStyle = darkMode ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)'
    ctx.beginPath()
    ctx.roundRect(
      node.x - textWidth / 2 - padding,
      textY - fontSize / 2 - padding,
      textWidth + padding * 2,
      fontSize + padding * 2,
      3 / globalScale
    )
    ctx.fill()

    // Label text
    ctx.fillStyle = isHighlighted
      ? '#fbbf24'
      : (darkMode ? '#e2e8f0' : '#333333')
    ctx.fillText(truncatedLabel, node.x, textY)
  }, [highlightedPath, highlightedNodes, darkMode])

  // Custom link canvas rendering
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source
    const end = link.target

    if (typeof start !== 'object' || typeof end !== 'object') return

    // Check if this link is part of the highlighted path
    const isHighlighted = highlightedPath.length > 1 && (
      (highlightedPath.indexOf(start.id) !== -1 &&
       highlightedPath.indexOf(end.id) === highlightedPath.indexOf(start.id) + 1) ||
      (highlightedPath.indexOf(end.id) !== -1 &&
       highlightedPath.indexOf(start.id) === highlightedPath.indexOf(end.id) + 1)
    )

    const lineWidth = isHighlighted ? 4 / globalScale : (link.width || 1) / globalScale

    ctx.strokeStyle = isHighlighted ? '#fbbf24' : (link.color || (darkMode ? '#475569' : '#cccccc'))
    ctx.lineWidth = lineWidth

    // Draw dashed line for lower confidence (unless highlighted)
    if (!isHighlighted && (link.confidence === 'POSSIBLE' || link.confidence === 'SUSPECTED')) {
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

    ctx.fillStyle = isHighlighted ? '#fbbf24' : (link.color || (darkMode ? '#475569' : '#cccccc'))
    ctx.fill()
    ctx.restore()

    ctx.setLineDash([])
  }, [highlightedPath, darkMode])

  return (
    <div className="relative" style={{ width, height }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObjectMode={() => 'replace'}
        nodeLabel={(node: any) => `${node.name} (${node.entityType.toLowerCase()})`}
        linkLabel={(link: any) => `${link.type?.replace(/_/g, ' ')?.toLowerCase() ?? 'related'}`}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        cooldownTicks={compact ? 50 : 100}
        d3AlphaDecay={compact ? 0.05 : 0.02}
        d3VelocityDecay={compact ? 0.4 : 0.3}
      />

      {/* Legend — hidden in mini view */}
      {showLegend && (
        <div className={cn(
          "absolute top-4 right-4 p-4 rounded-lg shadow-lg border",
          darkMode
            ? "bg-slate-900/90 border-slate-700 text-slate-200"
            : "bg-white border-gray-200 text-gray-900"
        )}>
          <h3 className="text-sm font-semibold mb-2">Entity Types</h3>
          <div className="space-y-1">
            {Object.entries(ENTITY_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize">{type.toLowerCase()}</span>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold mt-3 mb-2">Confidence</h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className={cn("w-6 h-0.5", darkMode ? "bg-slate-200" : "bg-black")} />
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={cn("w-6 h-0.5", darkMode ? "bg-slate-400" : "bg-gray-600")} />
              <span>Probable</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={cn("w-6 h-0.5", darkMode ? "bg-slate-500" : "bg-gray-400")} style={{ borderBottom: `2px dashed ${darkMode ? '#64748b' : '#9ca3af'}` }} />
              <span>Possible</span>
            </div>
          </div>
        </div>
      )}

      {/* Inline mini legend when full legend is hidden */}
      {!showLegend && (
        <div className="absolute bottom-1 left-2 flex items-center gap-2 opacity-60">
          {Object.entries(ENTITY_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1" title={type.toLowerCase()}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-slate-400 capitalize">{type.substring(0, 3).toLowerCase()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Zoom controls */}
      {compact && (
        <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
          {[
            { icon: ZoomIn, handler: handleZoomIn, label: 'Zoom in' },
            { icon: ZoomOut, handler: handleZoomOut, label: 'Zoom out' },
            { icon: RotateCcw, handler: handleZoomReset, label: 'Fit to view' },
          ].map(({ icon: Icon, handler, label }) => (
            <button
              key={label}
              onClick={handler}
              className="p-1 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title={label}
            >
              <Icon className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
