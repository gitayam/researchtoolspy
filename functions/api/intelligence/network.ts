import { getUserFromRequest } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Simple graph algorithms (no external deps needed)
function computeDegreeCentrality(adjList: Map<string, Set<string>>): Map<string, number> {
  const result = new Map<string, number>()
  const maxDegree = Math.max(1, ...Array.from(adjList.values()).map(s => s.size))
  for (const [node, neighbors] of adjList) {
    result.set(node, neighbors.size / maxDegree)
  }
  return result
}

function computeBetweennessCentrality(adjList: Map<string, Set<string>>): Map<string, number> {
  const nodes = Array.from(adjList.keys())
  const betweenness = new Map<string, number>()
  for (const n of nodes) betweenness.set(n, 0)

  // Brandes algorithm (simplified for small graphs)
  for (const s of nodes) {
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const dist = new Map<string, number>()
    const delta = new Map<string, number>()

    for (const n of nodes) {
      pred.set(n, [])
      sigma.set(n, 0)
      dist.set(n, -1)
      delta.set(n, 0)
    }
    sigma.set(s, 1)
    dist.set(s, 0)

    const queue = [s]
    while (queue.length > 0) {
      const v = queue.shift()!
      stack.push(v)
      const neighbors = adjList.get(v) || new Set()
      for (const w of neighbors) {
        if (dist.get(w)! < 0) {
          queue.push(w)
          dist.set(w, dist.get(v)! + 1)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, (sigma.get(w) || 0) + (sigma.get(v) || 0))
          pred.get(w)!.push(v)
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!
      for (const v of pred.get(w)!) {
        const d = ((sigma.get(v) || 0) / (sigma.get(w) || 1)) * (1 + (delta.get(w) || 0))
        delta.set(v, (delta.get(v) || 0) + d)
      }
      if (w !== s) {
        betweenness.set(w, (betweenness.get(w) || 0) + (delta.get(w) || 0))
      }
    }
  }

  // Normalize
  const n = nodes.length
  const norm = n > 2 ? (n - 1) * (n - 2) : 1
  for (const [node, val] of betweenness) {
    betweenness.set(node, val / norm)
  }
  return betweenness
}

function detectCommunities(adjList: Map<string, Set<string>>): Map<string, number> {
  // Label propagation algorithm
  const labels = new Map<string, number>()
  const nodes = Array.from(adjList.keys())
  nodes.forEach((n, i) => labels.set(n, i))

  for (let iter = 0; iter < 10; iter++) {
    let changed = false
    const shuffled = [...nodes].sort(() => Math.random() - 0.5)
    for (const node of shuffled) {
      const neighbors = adjList.get(node) || new Set()
      if (neighbors.size === 0) continue

      const labelCounts = new Map<number, number>()
      for (const neighbor of neighbors) {
        const l = labels.get(neighbor)!
        labelCounts.set(l, (labelCounts.get(l) || 0) + 1)
      }

      let maxCount = 0
      let bestLabel = labels.get(node)!
      for (const [l, c] of labelCounts) {
        if (c > maxCount) { maxCount = c; bestLabel = l }
      }
      if (bestLabel !== labels.get(node)) {
        labels.set(node, bestLabel)
        changed = true
      }
    }
    if (!changed) break
  }

  // Renumber communities to be sequential
  const uniqueLabels = [...new Set(labels.values())]
  const remap = new Map<number, number>()
  uniqueLabels.forEach((l, i) => remap.set(l, i))
  for (const [node, label] of labels) {
    labels.set(node, remap.get(label)!)
  }
  return labels
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const [relationships, entities] = await Promise.all([
      env.DB.prepare(`
        SELECT source_entity_id, source_entity_type, target_entity_id, target_entity_type,
               relationship_type, confidence
        FROM relationships
        WHERE user_id = ?
      `).bind(userId).all<{
        source_entity_id: string; source_entity_type: string
        target_entity_id: string; target_entity_type: string
        relationship_type: string; confidence: string
      }>(),

      env.DB.prepare(`
        SELECT id, name, entity_type FROM (
          SELECT CAST(id AS TEXT) as id, name, 'ACTOR' as entity_type FROM actors WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'SOURCE' as entity_type FROM sources WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'EVENT' as entity_type FROM events WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'PLACE' as entity_type FROM places WHERE user_id = ? OR is_public = 1
          UNION ALL
          SELECT CAST(id AS TEXT) as id, name, 'BEHAVIOR' as entity_type FROM behaviors WHERE user_id = ? OR is_public = 1
        )
      `).bind(userId, userId, userId, userId, userId).all<{ id: string; name: string; entity_type: string }>(),
    ])

    const entityMap = new Map<string, { name: string; type: string }>()
    for (const e of entities.results || []) {
      entityMap.set(e.id, { name: e.name, type: e.entity_type })
    }

    // Build adjacency list
    const adjList = new Map<string, Set<string>>()
    const edgeList: { source: string; target: string; relationship_type: string; confidence: number }[] = []

    for (const r of relationships.results || []) {
      const src = r.source_entity_id
      const tgt = r.target_entity_id
      if (!adjList.has(src)) adjList.set(src, new Set())
      if (!adjList.has(tgt)) adjList.set(tgt, new Set())
      adjList.get(src)!.add(tgt)
      adjList.get(tgt)!.add(src)

      const confidenceMap: Record<string, number> = { CONFIRMED: 1, PROBABLE: 0.75, POSSIBLE: 0.5, SUSPECTED: 0.25 }
      edgeList.push({
        source: src,
        target: tgt,
        relationship_type: r.relationship_type,
        confidence: confidenceMap[r.confidence] ?? 0.5,
      })
    }

    // Compute metrics
    const degreeCentrality = computeDegreeCentrality(adjList)
    const betweenness = adjList.size <= 200 ? computeBetweennessCentrality(adjList) : new Map<string, number>()
    const communityLabels = detectCommunities(adjList)

    // Build nodes
    const nodes = Array.from(adjList.keys()).map(id => {
      const entity = entityMap.get(id) || { name: `Unknown (${id})`, type: 'UNKNOWN' }
      return {
        id,
        name: entity.name,
        type: entity.type,
        community_id: communityLabels.get(id) ?? 0,
        degree_centrality: Math.round((degreeCentrality.get(id) ?? 0) * 1000) / 1000,
        betweenness_centrality: Math.round((betweenness.get(id) ?? 0) * 1000) / 1000,
        frameworks_count: 0,
      }
    })

    // Communities
    const communityMembers = new Map<number, string[]>()
    for (const [id, cid] of communityLabels) {
      if (!communityMembers.has(cid)) communityMembers.set(cid, [])
      communityMembers.get(cid)!.push(id)
    }
    const communities = Array.from(communityMembers.entries()).map(([id, members]) => {
      const types = members.map(m => entityMap.get(m)?.type ?? 'UNKNOWN')
      const typeCounts: Record<string, number> = {}
      for (const t of types) typeCounts[t] = (typeCounts[t] || 0) + 1
      const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'UNKNOWN'
      return { id, members, dominant_type: dominant, size: members.length }
    })

    // Key influencers (top 5 by composite score)
    const influencers = nodes
      .map(n => ({
        entity_id: n.id,
        entity_name: n.name,
        composite_score: Math.round((n.degree_centrality * 0.4 + n.betweenness_centrality * 0.6) * 1000) / 1000,
        role: n.betweenness_centrality > n.degree_centrality ? 'Information broker' : 'Central connector',
      }))
      .sort((a, b) => b.composite_score - a.composite_score)
      .slice(0, 5)

    // Bridge nodes: high betweenness but low degree
    const bridgeNodes = nodes
      .filter(n => n.betweenness_centrality > 0.1 && n.degree_centrality < 0.5)
      .map(n => n.id)

    // Network density
    const n = nodes.length
    const possibleEdges = n > 1 ? (n * (n - 1)) / 2 : 1
    const density = Math.round((edgeList.length / possibleEdges) * 1000) / 1000

    return new Response(JSON.stringify({
      nodes,
      edges: edgeList,
      communities,
      key_influencers: influencers,
      bridge_nodes: bridgeNodes,
      metrics: {
        total_nodes: nodes.length,
        total_edges: edgeList.length,
        community_count: communities.length,
        network_density: density,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence network error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch network intelligence data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
