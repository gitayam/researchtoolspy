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

export interface NetworkAnomaly {
  type: 'ISOLATED' | 'SUPER_CONNECTED' | 'BRIDGE' | 'STRUCTURAL_HOLE' | 'SUSPICIOUS_LINK'
  nodeIds: string[]
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  score: number
  description: string
  recommendation: string
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

/**
 * Detect network anomalies
 */
export function detectAnomalies(
  nodes: GraphNode[],
  edges: GraphEdge[]
): NetworkAnomaly[] {
  const anomalies: NetworkAnomaly[] = []
  const adjacencyList = buildAdjacencyList(nodes, edges)
  const nodeIds = nodes.map(n => n.id)

  // Calculate basic statistics
  const degrees = nodeIds.map(id => {
    const adj = adjacencyList.get(id)
    return (adj?.in.length || 0) + (adj?.out.length || 0)
  })
  const avgDegree = degrees.reduce((sum, d) => sum + d, 0) / nodeIds.length
  const stdDev = Math.sqrt(
    degrees.reduce((sum, d) => sum + Math.pow(d - avgDegree, 2), 0) / nodeIds.length
  )

  // 1. Detect isolated nodes (0 or 1 connections)
  nodeIds.forEach(nodeId => {
    const adj = adjacencyList.get(nodeId)
    const degree = (adj?.in.length || 0) + (adj?.out.length || 0)

    if (degree === 0) {
      anomalies.push({
        type: 'ISOLATED',
        nodeIds: [nodeId],
        severity: 'MEDIUM',
        score: 0.6,
        description: `Isolated node with no connections`,
        recommendation: 'Verify if this entity should be connected or removed from the network'
      })
    } else if (degree === 1 && nodeIds.length > 10) {
      anomalies.push({
        type: 'ISOLATED',
        nodeIds: [nodeId],
        severity: 'LOW',
        score: 0.3,
        description: `Node with only 1 connection in network of ${nodeIds.length} nodes`,
        recommendation: 'May indicate peripheral or newly added entity'
      })
    }
  })

  // 2. Detect super-connected nodes (outliers > 2 std dev above mean)
  const threshold = avgDegree + (2 * stdDev)
  nodeIds.forEach(nodeId => {
    const adj = adjacencyList.get(nodeId)
    const degree = (adj?.in.length || 0) + (adj?.out.length || 0)

    if (degree > threshold && degree > 5) {
      const severity: NetworkAnomaly['severity'] =
        degree > avgDegree + (3 * stdDev) ? 'CRITICAL' :
        degree > avgDegree + (2.5 * stdDev) ? 'HIGH' : 'MEDIUM'

      anomalies.push({
        type: 'SUPER_CONNECTED',
        nodeIds: [nodeId],
        severity,
        score: Math.min((degree - avgDegree) / (3 * stdDev), 1),
        description: `Hub node with ${degree} connections (avg: ${avgDegree.toFixed(1)})`,
        recommendation: 'Central hub - may be critical for network connectivity or a data collection point'
      })
    }
  })

  // 3. Detect bridge nodes (high betweenness relative to degree)
  const betweenness = calculateBetweennessCentrality(nodeIds, adjacencyList)
  nodeIds.forEach(nodeId => {
    const adj = adjacencyList.get(nodeId)
    const degree = (adj?.in.length || 0) + (adj?.out.length || 0)
    const bet = betweenness[nodeId] || 0

    // High betweenness but low degree = bridge
    if (bet > 0.1 && degree < avgDegree && degree > 2) {
      anomalies.push({
        type: 'BRIDGE',
        nodeIds: [nodeId],
        severity: 'HIGH',
        score: bet,
        description: `Bridge node connecting separate network regions (betweenness: ${bet.toFixed(3)})`,
        recommendation: 'Critical connector - removal may fragment the network'
      })
    }
  })

  // 4. Detect structural holes (nodes connecting disconnected groups)
  nodeIds.forEach(nodeId => {
    const adj = adjacencyList.get(nodeId)
    if (!adj) return

    const neighbors = [...new Set([...adj.in, ...adj.out])]
    if (neighbors.length < 3) return

    // Check if neighbors are NOT connected to each other
    let disconnectedNeighborPairs = 0
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const n1Adj = adjacencyList.get(neighbors[i])
        const isConnected = n1Adj &&
          (n1Adj.out.includes(neighbors[j]) || n1Adj.in.includes(neighbors[j]))

        if (!isConnected) {
          disconnectedNeighborPairs++
        }
      }
    }

    const totalPairs = (neighbors.length * (neighbors.length - 1)) / 2
    const disconnectedRatio = disconnectedNeighborPairs / totalPairs

    if (disconnectedRatio > 0.7 && neighbors.length >= 3) {
      anomalies.push({
        type: 'STRUCTURAL_HOLE',
        nodeIds: [nodeId],
        severity: 'MEDIUM',
        score: disconnectedRatio,
        description: `Structural hole - connects ${neighbors.length} otherwise unconnected entities`,
        recommendation: 'Broker position - controls information flow between groups'
      })
    }
  })

  // 5. Detect suspicious links (if edge data includes confidence/weight)
  edges.forEach(edge => {
    const weight = edge.weight || 0.5
    const confidence = edge.confidence

    // Low confidence but high weight = suspicious
    if (confidence === 'SUSPECTED' && weight > 0.8) {
      anomalies.push({
        type: 'SUSPICIOUS_LINK',
        nodeIds: [edge.source, edge.target],
        severity: 'MEDIUM',
        score: weight - 0.5,
        description: `High-weight relationship (${weight.toFixed(2)}) with low confidence (SUSPECTED)`,
        recommendation: 'Verify this relationship - high importance but unconfirmed'
      })
    }

    // Confirmed but very low weight = unusual
    if (confidence === 'CONFIRMED' && weight < 0.2) {
      anomalies.push({
        type: 'SUSPICIOUS_LINK',
        nodeIds: [edge.source, edge.target],
        severity: 'LOW',
        score: 0.2 - weight,
        description: `Confirmed relationship but very low weight (${weight.toFixed(2)})`,
        recommendation: 'May indicate a weak or historical connection'
      })
    }
  })

  // Sort by severity and score
  const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  return anomalies.sort((a, b) => {
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
    return severityDiff !== 0 ? severityDiff : b.score - a.score
  })
}

/**
 * Find shortest path between two nodes (BFS)
 */
export function findShortestPath(
  sourceId: string,
  targetId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): { path: string[]; distance: number } | null {
  const adjacencyList = buildAdjacencyList(nodes, edges)

  const queue: Array<{ node: string; path: string[] }> = [{ node: sourceId, path: [sourceId] }]
  const visited = new Set<string>([sourceId])

  while (queue.length > 0) {
    const { node, path } = queue.shift()!

    if (node === targetId) {
      return { path, distance: path.length - 1 }
    }

    const adj = adjacencyList.get(node)
    if (!adj) continue

    const neighbors = [...new Set([...adj.out, ...adj.in])]

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push({ node: neighbor, path: [...path, neighbor] })
      }
    }
  }

  return null // No path found
}

/**
 * Find all paths between two nodes (limited depth)
 */
export function findAllPaths(
  sourceId: string,
  targetId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxDepth: number = 5
): string[][] {
  const adjacencyList = buildAdjacencyList(nodes, edges)
  const paths: string[][] = []

  function dfs(currentNode: string, path: string[], depth: number) {
    if (depth > maxDepth) return

    if (currentNode === targetId) {
      paths.push([...path])
      return
    }

    const adj = adjacencyList.get(currentNode)
    if (!adj) return

    const neighbors = [...new Set([...adj.out, ...adj.in])]

    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        dfs(neighbor, [...path, neighbor], depth + 1)
      }
    }
  }

  dfs(sourceId, [sourceId], 0)
  return paths
}
