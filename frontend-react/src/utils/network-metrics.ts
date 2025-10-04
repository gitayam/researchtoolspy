/**
 * Network Analysis Metrics
 *
 * Calculations for network centrality, clustering, and other graph metrics
 */

interface GraphNode {
  id: string
  [key: string]: any
}

interface GraphEdge {
  source: string
  target: string
  [key: string]: any
}

export interface NetworkMetrics {
  // Overall metrics
  nodeCount: number
  edgeCount: number
  density: number
  avgDegree: number

  // Centrality metrics (top nodes)
  topByDegree: Array<{ id: string; value: number }>
  topByBetweenness: Array<{ id: string; value: number }>
  topByCloseness: Array<{ id: string; value: number }>

  // Clustering
  avgClusteringCoefficient: number

  // Components
  componentCount: number
  largestComponentSize: number
}

export interface NodeMetrics {
  degree: number
  inDegree: number
  outDegree: number
  betweenness: number
  closeness: number
  clusteringCoefficient: number
}

/**
 * Calculate all network metrics
 */
export function calculateNetworkMetrics(
  nodes: GraphNode[],
  edges: GraphEdge[]
): NetworkMetrics {
  const adjacencyList = buildAdjacencyList(nodes, edges)
  const nodeIds = nodes.map(n => n.id)

  // Calculate degrees
  const degrees = nodeIds.map(id => ({
    id,
    value: (adjacencyList.get(id)?.out.length || 0) + (adjacencyList.get(id)?.in.length || 0)
  }))
  const avgDegree = degrees.reduce((sum, d) => sum + d.value, 0) / nodeIds.length

  // Calculate density
  const maxEdges = nodeIds.length * (nodeIds.length - 1)
  const density = maxEdges > 0 ? edges.length / maxEdges : 0

  // Calculate betweenness centrality
  const betweenness = calculateBetweennessCentrality(nodeIds, adjacencyList)
  const topByBetweenness = Object.entries(betweenness)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Calculate closeness centrality
  const closeness = calculateClosenessCentrality(nodeIds, adjacencyList)
  const topByCloseness = Object.entries(closeness)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Calculate clustering coefficient
  const clusteringCoefficients = nodeIds.map(id =>
    calculateNodeClusteringCoefficient(id, adjacencyList)
  )
  const avgClusteringCoefficient =
    clusteringCoefficients.reduce((sum, c) => sum + c, 0) / nodeIds.length

  // Find connected components
  const components = findConnectedComponents(nodeIds, adjacencyList)

  return {
    nodeCount: nodeIds.length,
    edgeCount: edges.length,
    density,
    avgDegree,
    topByDegree: degrees.sort((a, b) => b.value - a.value).slice(0, 10),
    topByBetweenness,
    topByCloseness,
    avgClusteringCoefficient,
    componentCount: components.length,
    largestComponentSize: Math.max(...components.map(c => c.length), 0)
  }
}

/**
 * Calculate metrics for a single node
 */
export function calculateNodeMetrics(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): NodeMetrics {
  const adjacencyList = buildAdjacencyList(nodes, edges)
  const nodeIds = nodes.map(n => n.id)

  const adj = adjacencyList.get(nodeId)
  const inDegree = adj?.in.length || 0
  const outDegree = adj?.out.length || 0
  const degree = inDegree + outDegree

  const betweenness = calculateBetweennessCentrality(nodeIds, adjacencyList)[nodeId] || 0
  const closeness = calculateClosenessCentrality(nodeIds, adjacencyList)[nodeId] || 0
  const clusteringCoefficient = calculateNodeClusteringCoefficient(nodeId, adjacencyList)

  return {
    degree,
    inDegree,
    outDegree,
    betweenness,
    closeness,
    clusteringCoefficient
  }
}

/**
 * Build adjacency list from edges
 */
function buildAdjacencyList(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, { in: string[]; out: string[] }> {
  const adjacencyList = new Map<string, { in: string[]; out: string[] }>()

  // Initialize all nodes
  nodes.forEach(node => {
    adjacencyList.set(node.id, { in: [], out: [] })
  })

  // Add edges
  edges.forEach(edge => {
    const source = edge.source
    const target = edge.target

    if (adjacencyList.has(source)) {
      adjacencyList.get(source)!.out.push(target)
    }
    if (adjacencyList.has(target)) {
      adjacencyList.get(target)!.in.push(source)
    }
  })

  return adjacencyList
}

/**
 * Calculate betweenness centrality using Brandes' algorithm (simplified)
 */
function calculateBetweennessCentrality(
  nodeIds: string[],
  adjacencyList: Map<string, { in: string[]; out: string[] }>
): Record<string, number> {
  const betweenness: Record<string, number> = {}
  nodeIds.forEach(id => { betweenness[id] = 0 })

  // For each node as source
  nodeIds.forEach(source => {
    const stack: string[] = []
    const predecessors: Record<string, string[]> = {}
    const sigma: Record<string, number> = {}
    const distance: Record<string, number> = {}
    const delta: Record<string, number> = {}

    nodeIds.forEach(id => {
      predecessors[id] = []
      sigma[id] = 0
      distance[id] = -1
      delta[id] = 0
    })

    sigma[source] = 1
    distance[source] = 0

    const queue: string[] = [source]

    // BFS
    while (queue.length > 0) {
      const v = queue.shift()!
      stack.push(v)

      const neighbors = [
        ...(adjacencyList.get(v)?.out || []),
        ...(adjacencyList.get(v)?.in || [])
      ]

      neighbors.forEach(w => {
        // First time visiting w
        if (distance[w] < 0) {
          queue.push(w)
          distance[w] = distance[v] + 1
        }

        // Shortest path to w via v
        if (distance[w] === distance[v] + 1) {
          sigma[w] += sigma[v]
          predecessors[w].push(v)
        }
      })
    }

    // Accumulation
    while (stack.length > 0) {
      const w = stack.pop()!
      predecessors[w].forEach(v => {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
      })
      if (w !== source) {
        betweenness[w] += delta[w]
      }
    }
  })

  // Normalize
  const n = nodeIds.length
  if (n > 2) {
    const normFactor = 2 / ((n - 1) * (n - 2))
    Object.keys(betweenness).forEach(id => {
      betweenness[id] *= normFactor
    })
  }

  return betweenness
}

/**
 * Calculate closeness centrality
 */
function calculateClosenessCentrality(
  nodeIds: string[],
  adjacencyList: Map<string, { in: string[]; out: string[] }>
): Record<string, number> {
  const closeness: Record<string, number> = {}

  nodeIds.forEach(source => {
    const distances = bfs(source, adjacencyList)
    const reachableNodes = Object.values(distances).filter(d => d > 0 && d < Infinity)

    if (reachableNodes.length > 0) {
      const sumDistances = reachableNodes.reduce((sum, d) => sum + d, 0)
      closeness[source] = reachableNodes.length / sumDistances
    } else {
      closeness[source] = 0
    }
  })

  return closeness
}

/**
 * BFS to find shortest distances from source
 */
function bfs(
  source: string,
  adjacencyList: Map<string, { in: string[]; out: string[] }>
): Record<string, number> {
  const distances: Record<string, number> = {}
  const visited = new Set<string>()
  const queue: Array<{ node: string; distance: number }> = [{ node: source, distance: 0 }]

  visited.add(source)
  distances[source] = 0

  while (queue.length > 0) {
    const { node, distance } = queue.shift()!

    const neighbors = [
      ...(adjacencyList.get(node)?.out || []),
      ...(adjacencyList.get(node)?.in || [])
    ]

    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        distances[neighbor] = distance + 1
        queue.push({ node: neighbor, distance: distance + 1 })
      }
    })
  }

  return distances
}

/**
 * Calculate clustering coefficient for a node
 */
function calculateNodeClusteringCoefficient(
  nodeId: string,
  adjacencyList: Map<string, { in: string[]; out: string[] }>
): number {
  const adj = adjacencyList.get(nodeId)
  if (!adj) return 0

  const neighbors = [...new Set([...adj.in, ...adj.out])]
  const k = neighbors.length

  if (k < 2) return 0

  // Count edges between neighbors
  let edgeCount = 0
  for (let i = 0; i < neighbors.length; i++) {
    for (let j = i + 1; j < neighbors.length; j++) {
      const n1 = neighbors[i]
      const n2 = neighbors[j]
      const n1Adj = adjacencyList.get(n1)

      if (n1Adj && (n1Adj.out.includes(n2) || n1Adj.in.includes(n2))) {
        edgeCount++
      }
    }
  }

  const maxEdges = (k * (k - 1)) / 2
  return maxEdges > 0 ? edgeCount / maxEdges : 0
}

/**
 * Find connected components (treating graph as undirected)
 */
function findConnectedComponents(
  nodeIds: string[],
  adjacencyList: Map<string, { in: string[]; out: string[] }>
): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  nodeIds.forEach(nodeId => {
    if (!visited.has(nodeId)) {
      const component = dfsComponent(nodeId, adjacencyList, visited)
      components.push(component)
    }
  })

  return components
}

/**
 * DFS to find component
 */
function dfsComponent(
  start: string,
  adjacencyList: Map<string, { in: string[]; out: string[] }>,
  visited: Set<string>
): string[] {
  const component: string[] = []
  const stack = [start]

  while (stack.length > 0) {
    const node = stack.pop()!

    if (!visited.has(node)) {
      visited.add(node)
      component.push(node)

      const adj = adjacencyList.get(node)
      if (adj) {
        stack.push(...adj.out, ...adj.in)
      }
    }
  }

  return component
}

/**
 * Detect network patterns
 */
export interface NetworkPattern {
  type: 'CLIQUE' | 'CHAIN' | 'STAR' | 'TRIANGLE'
  nodes: string[]
  significance: number
  description: string
}

export function detectPatterns(
  nodes: GraphNode[],
  edges: GraphEdge[]
): NetworkPattern[] {
  const patterns: NetworkPattern[] = []
  const adjacencyList = buildAdjacencyList(nodes, edges)

  // Detect triangles
  const triangles = detectTriangles(nodes.map(n => n.id), adjacencyList)
  triangles.forEach(triangle => {
    patterns.push({
      type: 'TRIANGLE',
      nodes: triangle,
      significance: 0.7,
      description: `Triangle: ${triangle.join(' → ')}`
    })
  })

  // Detect stars (hubs with 3+ connections)
  const stars = detectStars(nodes.map(n => n.id), adjacencyList, 3)
  stars.forEach(star => {
    patterns.push({
      type: 'STAR',
      nodes: star.nodes,
      significance: star.connections / nodes.length,
      description: `Star hub: ${star.center} with ${star.connections} connections`
    })
  })

  return patterns
}

/**
 * Detect triangles in the graph
 */
function detectTriangles(
  nodeIds: string[],
  adjacencyList: Map<string, { in: string[]; out: string[] }>
): string[][] {
  const triangles: string[][] = []
  const seen = new Set<string>()

  for (let i = 0; i < nodeIds.length; i++) {
    const a = nodeIds[i]
    const aAdj = adjacencyList.get(a)
    if (!aAdj) continue

    const aNeighbors = [...new Set([...aAdj.in, ...aAdj.out])]

    for (let j = 0; j < aNeighbors.length; j++) {
      const b = aNeighbors[j]
      const bAdj = adjacencyList.get(b)
      if (!bAdj) continue

      const bNeighbors = [...new Set([...bAdj.in, ...bAdj.out])]

      for (let k = 0; k < bNeighbors.length; k++) {
        const c = bNeighbors[k]
        if (c === a) continue

        // Check if c connects back to a
        const cAdj = adjacencyList.get(c)
        if (cAdj && (cAdj.in.includes(a) || cAdj.out.includes(a))) {
          const key = [a, b, c].sort().join('-')
          if (!seen.has(key)) {
            triangles.push([a, b, c])
            seen.add(key)
          }
        }
      }
    }
  }

  return triangles
}

/**
 * Detect star patterns (hubs)
 */
function detectStars(
  nodeIds: string[],
  adjacencyList: Map<string, { in: string[]; out: string[] }>,
  minConnections: number
): Array<{ center: string; nodes: string[]; connections: number }> {
  const stars: Array<{ center: string; nodes: string[]; connections: number }> = []

  nodeIds.forEach(nodeId => {
    const adj = adjacencyList.get(nodeId)
    if (!adj) return

    const neighbors = [...new Set([...adj.in, ...adj.out])]
    if (neighbors.length >= minConnections) {
      stars.push({
        center: nodeId,
        nodes: [nodeId, ...neighbors],
        connections: neighbors.length
      })
    }
  })

  return stars.sort((a, b) => b.connections - a.connections)
}
