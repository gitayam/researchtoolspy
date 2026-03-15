import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Network, Loader2, Maximize2 } from 'lucide-react'
import { getCopHeaders } from '@/lib/cop-auth'
import { NetworkGraphCanvas } from '@/components/network/NetworkGraphCanvas'
import type { EntityType, Relationship } from '@/types/entities'

// ── Types ────────────────────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────

interface CopMiniGraphProps {
  sessionId: string
  workspaceId?: string
  expanded: boolean
  onRelationshipCount?: (count: number) => void
  onNodeClick?: (entityId: string, entityType: EntityType) => void
}

// ── Helpers ──────────────────────────────────────────────────────

const ENTITY_TYPE_TABLES: Record<EntityType, string> = {
  ACTOR: 'actors',
  SOURCE: 'sources',
  EVENT: 'events',
  PLACE: 'places',
  BEHAVIOR: 'behaviors',
  EVIDENCE: 'evidence-items',
}

async function fetchEntityNames(
  relationships: Relationship[],
  workspaceId: string,
  authHeaders: HeadersInit
): Promise<Record<string, { name: string; type: EntityType }>> {
  const entityInfo: Record<string, { name: string; type: EntityType }> = {}

  // Group entity IDs by type
  const idsByType: Record<EntityType, Set<string>> = {
    ACTOR: new Set(),
    SOURCE: new Set(),
    EVENT: new Set(),
    PLACE: new Set(),
    BEHAVIOR: new Set(),
    EVIDENCE: new Set(),
  }

  relationships.forEach((rel) => {
    idsByType[rel.source_entity_type].add(rel.source_entity_id)
    idsByType[rel.target_entity_type].add(rel.target_entity_id)
  })

  // Fetch each entity type in parallel
  const fetches = (Object.keys(idsByType) as EntityType[])
    .filter((type) => idsByType[type].size > 0)
    .map(async (type) => {
      try {
        const endpoint = ENTITY_TYPE_TABLES[type]
        const res = await fetch(`/api/${endpoint}?workspace_id=${workspaceId}`, {
          headers: authHeaders,
        })
        if (!res.ok) return

        const data = await res.json()
        // Each endpoint wraps results under a plural key (actors, sources, etc.)
        // or may return a flat array
        const items: any[] =
          data.actors ?? data.sources ?? data.events ?? data.places ??
          data.behaviors ?? data.evidence ?? data ?? []

        const ids = idsByType[type]
        items.forEach((item: any) => {
          if (ids.has(item.id)) {
            entityInfo[item.id] = {
              name: item.name ?? item.title ?? item.id.substring(0, 8),
              type,
            }
          }
        })
      } catch {
        // Silently skip failed entity fetches
      }
    })

  await Promise.all(fetches)

  // Fallback: use truncated IDs for any unresolved entities
  relationships.forEach((rel) => {
    if (!entityInfo[rel.source_entity_id]) {
      entityInfo[rel.source_entity_id] = {
        name: `${rel.source_entity_type.substring(0, 1)}${rel.source_entity_id.substring(0, 6)}`,
        type: rel.source_entity_type,
      }
    }
    if (!entityInfo[rel.target_entity_id]) {
      entityInfo[rel.target_entity_id] = {
        name: `${rel.target_entity_type.substring(0, 1)}${rel.target_entity_id.substring(0, 6)}`,
        type: rel.target_entity_type,
      }
    }
  })

  return entityInfo
}

// ── Component ────────────────────────────────────────────────────

export default function CopMiniGraph({ sessionId, workspaceId: propWorkspaceId, expanded, onRelationshipCount, onNodeClick }: CopMiniGraphProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [entityNames, setEntityNames] = useState<Record<string, { name: string; type: EntityType }>>({})
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Responsive sizing via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        const headers = getCopHeaders()

        const workspaceId = propWorkspaceId || localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id') || ''
        const res = await fetch(`/api/relationships?workspace_id=${workspaceId}&cop_session_id=${sessionId}`, { headers, signal: controller.signal })

        if (!res.ok) throw new Error(`Failed to fetch relationships (${res.status})`)

        const data = await res.json()
        const rels: Relationship[] = data.relationships ?? data ?? []

        setRelationships(rels)
        onRelationshipCount?.(rels.length)

        if (rels.length > 0) {
          const names = await fetchEntityNames(rels, workspaceId, headers)
          if (!controller.signal.aborted) setEntityNames(names)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('[CopMiniGraph] Failed to load relationships:', e)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [sessionId, propWorkspaceId])

  // Build graph nodes and links from relationship data
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>()

    relationships.forEach((rel) => {
      // Ensure source node exists
      if (!nodeMap.has(rel.source_entity_id)) {
        const info = entityNames[rel.source_entity_id]
        nodeMap.set(rel.source_entity_id, {
          id: rel.source_entity_id,
          name: info?.name || rel.source_entity_id.substring(0, 8),
          entityType: rel.source_entity_type,
          val: 1,
        })
      } else {
        const node = nodeMap.get(rel.source_entity_id)!
        node.val = (node.val || 0) + 1
      }

      // Ensure target node exists
      if (!nodeMap.has(rel.target_entity_id)) {
        const info = entityNames[rel.target_entity_id]
        nodeMap.set(rel.target_entity_id, {
          id: rel.target_entity_id,
          name: info?.name || rel.target_entity_id.substring(0, 8),
          entityType: rel.target_entity_type,
          val: 1,
        })
      } else {
        const node = nodeMap.get(rel.target_entity_id)!
        node.val = (node.val || 0) + 1
      }
    })

    const builtLinks: NetworkLink[] = relationships.map((rel) => ({
      source: rel.source_entity_id,
      target: rel.target_entity_id,
      relationshipType: rel.relationship_type,
      weight: rel.weight,
      confidence: rel.confidence,
    }))

    return { nodes: Array.from(nodeMap.values()), links: builtLinks }
  }, [relationships, entityNames])

  const handleNodeClick = useCallback((node: NetworkNode) => {
    onNodeClick?.(node.id, node.entityType)
  }, [onNodeClick])

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center w-full h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center w-full h-full text-center px-4">
        <Network className="h-8 w-8 text-gray-600 mb-2" />
        <p className="text-sm text-gray-400 font-medium">No entity relationships yet</p>
        <p className="text-xs text-gray-500 mt-1">
          Add entities and relationships in the workspace to see the network graph.
        </p>
      </div>
    )
  }

  // ── Graph ────────────────────────────────────────────────────
  const workspaceId = propWorkspaceId || localStorage.getItem('omnicore_workspace_id') || localStorage.getItem('current_workspace_id') || ''

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {containerSize.width > 0 && containerSize.height > 0 && (
        <NetworkGraphCanvas
          nodes={nodes}
          links={links}
          width={containerSize.width}
          height={containerSize.height}
          showLegend={expanded}
          darkMode={true}
          compact={!expanded}
          onNodeClick={handleNodeClick}
        />
      )}
      {/* Open full network graph page */}
      <a
        href={`/network?workspace_id=${workspaceId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-1 right-1 p-1 rounded bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        title="Open full network graph"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
