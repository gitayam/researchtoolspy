// ============================================================================
// Research Tools - Neo4j Query Collection
// ============================================================================
// Description: Ready-to-use Cypher queries for network analysis
// Author: Research Tools Team
// Date: 2025-10-06
// Version: 1.0.0
//
// USAGE:
// 1. Copy individual queries below
// 2. Replace placeholder values (e.g., 'ENTITY_NAME_HERE')
// 3. Paste into Neo4j Browser and run
// ============================================================================

// ============================================================================
// SECTION 1: BASIC EXPLORATION
// ============================================================================

// Query 1.1: Count all nodes and relationships
// Purpose: Get overview of network size
MATCH (n:Entity)
WITH count(n) as total_nodes
MATCH ()-[r]->()
WITH total_nodes, count(r) as total_relationships
RETURN total_nodes, total_relationships;

// Query 1.2: View all entity types and their counts
// Purpose: Understand entity type distribution
MATCH (n:Entity)
RETURN n.type as entity_type, count(*) as count
ORDER BY count DESC;

// Query 1.3: Sample of nodes (random 25)
// Purpose: Quick preview of data
MATCH (n:Entity)
RETURN n.name, n.type, n.connections
ORDER BY rand()
LIMIT 25;

// Query 1.4: View all relationship types
// Purpose: See what relationship types exist in the graph
MATCH ()-[r]->()
RETURN DISTINCT type(r) as relationship_type, count(*) as count
ORDER BY count DESC;

// Query 1.5: View entire graph (SMALL NETWORKS ONLY)
// Purpose: Visualize complete network
// WARNING: Only use for networks with <200 nodes
MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 200;

// ============================================================================
// SECTION 2: FINDING CENTRAL ENTITIES (HUBS & INFLUENCERS)
// ============================================================================

// Query 2.1: Top 10 most connected entities (Degree Centrality)
// Purpose: Find entities with most direct connections
MATCH (n:Entity)
RETURN n.name, n.type, n.connections
ORDER BY n.connections DESC
LIMIT 10;

// Query 2.2: Top entities by type
// Purpose: Find most connected entities within each type
MATCH (n:Entity)
WITH n.type as entity_type, n
ORDER BY n.connections DESC
WITH entity_type, collect({name: n.name, connections: n.connections})[0..5] as top_entities
RETURN entity_type, top_entities;

// Query 2.3: Find entities with connections above threshold
// Purpose: Filter for highly connected entities
MATCH (n:Entity)
WHERE n.connections >= 5  // Adjust threshold
RETURN n.name, n.type, n.connections
ORDER BY n.connections DESC;

// Query 2.4: PageRank (requires GDS library)
// Purpose: Find most influential entities (importance based on connections)
// Prerequisites: Run graph projection first (see Query 9.1)
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type,
       score
ORDER BY score DESC
LIMIT 20;

// Query 2.5: Betweenness Centrality (requires GDS library)
// Purpose: Find information brokers (entities that bridge communities)
// Prerequisites: Run graph projection first (see Query 9.1)
CALL gds.betweenness.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type,
       score
ORDER BY score DESC
LIMIT 20;

// Query 2.6: Closeness Centrality (requires GDS library)
// Purpose: Find entities that can reach others quickly
// Prerequisites: Run graph projection first (see Query 9.1)
CALL gds.closeness.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type,
       score
ORDER BY score DESC
LIMIT 20;

// ============================================================================
// SECTION 3: RELATIONSHIP ANALYSIS
// ============================================================================

// Query 3.1: All relationships for a specific entity
// Purpose: Investigate connections of a single entity
// REPLACE: 'ENTITY_NAME_HERE' with actual entity name
MATCH (e:Entity {name: 'ENTITY_NAME_HERE'})-[r]-(connected)
RETURN e.name as entity,
       type(r) as relationship,
       connected.name as connected_entity,
       connected.type as connected_type,
       r.confidence,
       r.weight
ORDER BY r.weight DESC;

// Query 3.2: Incoming vs Outgoing relationships
// Purpose: Understand directionality of entity's connections
// REPLACE: 'ENTITY_NAME_HERE' with actual entity name
MATCH (e:Entity {name: 'ENTITY_NAME_HERE'})
OPTIONAL MATCH (e)-[r_out]->(target)
WITH e, count(r_out) as outgoing_count
OPTIONAL MATCH (e)<-[r_in]-(source)
RETURN e.name,
       outgoing_count,
       count(r_in) as incoming_count,
       outgoing_count + count(r_in) as total_connections;

// Query 3.3: Strongest relationships (by weight)
// Purpose: Find most significant connections
MATCH (source)-[r]->(target)
RETURN source.name, type(r), target.name, r.weight, r.confidence
ORDER BY r.weight DESC
LIMIT 25;

// Query 3.4: Confirmed relationships only
// Purpose: Filter for high-confidence relationships
MATCH (source)-[r {confidence: 'CONFIRMED'}]->(target)
RETURN source.name, source.type, type(r), target.name, target.type, r.weight
ORDER BY r.weight DESC;

// Query 3.5: Find all relationships between two entities
// Purpose: Examine multi-faceted connections
// REPLACE: 'ENTITY_A' and 'ENTITY_B' with actual names
MATCH (a:Entity {name: 'ENTITY_A'})-[r]-(b:Entity {name: 'ENTITY_B'})
RETURN a.name, type(r), b.name, r.confidence, r.weight;

// Query 3.6: Mutual relationships (bidirectional)
// Purpose: Find entities with reciprocal connections
MATCH (a:Entity)-[r1]->(b:Entity)-[r2]->(a)
WHERE id(a) < id(b)  // Avoid duplicates
RETURN a.name, type(r1), type(r2), b.name
LIMIT 50;

// ============================================================================
// SECTION 4: PATHFINDING
// ============================================================================

// Query 4.1: Shortest path between two entities
// Purpose: Find how two entities are connected
// REPLACE: 'START_ENTITY' and 'END_ENTITY' with actual names
MATCH path = shortestPath(
  (start:Entity {name: 'START_ENTITY'})-[*]-(end:Entity {name: 'END_ENTITY'})
)
RETURN path,
       length(path) as path_length,
       [node in nodes(path) | node.name] as entities_in_path;

// Query 4.2: All shortest paths (multiple routes)
// Purpose: Find all equally short paths
MATCH path = allShortestPaths(
  (start:Entity {name: 'START_ENTITY'})-[*]-(end:Entity {name: 'END_ENTITY'})
)
RETURN path,
       length(path) as path_length;

// Query 4.3: Paths up to N hops
// Purpose: Find all paths within distance limit
// REPLACE: Numbers 1..3 to set hop limit (e.g., 1..5)
MATCH path = (start:Entity {name: 'START_ENTITY'})-[*1..3]-(end:Entity {name: 'END_ENTITY'})
RETURN path
LIMIT 10;

// Query 4.4: Paths through specific relationship type
// Purpose: Find paths using only certain relationship types
// REPLACE: OPERATES_WITH with actual relationship type
MATCH path = (start:Entity {name: 'START_ENTITY'})-[:OPERATES_WITH*1..3]-(end:Entity {name: 'END_ENTITY'})
RETURN path
LIMIT 5;

// Query 4.5: Find common connections (triangles)
// Purpose: Discover entities that both connect to
MATCH (a:Entity {name: 'ENTITY_A'})--(common)--(b:Entity {name: 'ENTITY_B'})
WHERE a <> b AND a <> common AND b <> common
RETURN DISTINCT common.name as common_connection,
                common.type as type,
                common.connections
ORDER BY common.connections DESC;

// ============================================================================
// SECTION 5: COMMUNITY DETECTION
// ============================================================================

// Query 5.1: Louvain Community Detection (requires GDS library)
// Purpose: Find densely connected groups
// Prerequisites: Run graph projection first (see Query 9.1)
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type,
       communityId
ORDER BY communityId, name;

// Query 5.2: Community sizes
// Purpose: Count members in each community
CALL gds.louvain.stream('myGraph')
YIELD communityId
RETURN communityId, count(*) as size
ORDER BY size DESC;

// Query 5.3: Entities in specific community
// Purpose: List all members of a community
// REPLACE: 123 with actual community ID from Query 5.2
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
WHERE communityId = 123  // Replace with your community ID
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type;

// Query 5.4: Label Propagation (alternative community detection)
// Purpose: Fast community detection for large graphs
CALL gds.labelPropagation.stream('myGraph')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).name AS name,
       communityId
ORDER BY communityId;

// Query 5.5: Weakly Connected Components
// Purpose: Find disconnected subgraphs
CALL gds.wcc.stream('myGraph')
YIELD nodeId, componentId
RETURN gds.util.asNode(nodeId).name AS name,
       componentId
ORDER BY componentId;

// ============================================================================
// SECTION 6: PATTERN MATCHING
// ============================================================================

// Query 6.1: Find entities of type A connected to type B
// Purpose: Discover cross-type relationships
// REPLACE: ACTOR and SOURCE with desired types
MATCH (a:ACTOR)-[r]->(s:SOURCE)
RETURN a.name, type(r), s.name, r.confidence
ORDER BY r.weight DESC
LIMIT 25;

// Query 6.2: Triangle pattern (A → B → C → A)
// Purpose: Find closed loops (potential coordination)
MATCH (a:Entity)-[r1]->(b:Entity)-[r2]->(c:Entity)-[r3]->(a)
RETURN a.name, b.name, c.name
LIMIT 10;

// Query 6.3: Star pattern (hub with multiple connections)
// Purpose: Find entities with many connections to similar types
MATCH (hub:Entity)-[r]-(connected:Entity)
WITH hub, connected.type as connected_type, count(*) as count
WHERE count >= 5  // Adjust threshold
RETURN hub.name, hub.type, connected_type, count
ORDER BY count DESC;

// Query 6.4: Chain pattern (A → B → C)
// Purpose: Find sequential connections
MATCH (a:Entity)-[r1]->(b:Entity)-[r2]->(c:Entity)
WHERE a <> c  // Ensure not a triangle
RETURN a.name, type(r1), b.name, type(r2), c.name
LIMIT 20;

// Query 6.5: Find isolated entities (no connections)
// Purpose: Identify disconnected nodes
MATCH (n:Entity)
WHERE NOT (n)-[]-()
RETURN n.name, n.type;

// ============================================================================
// SECTION 7: FILTERING & AGGREGATION
// ============================================================================

// Query 7.1: Entities by type
// Purpose: View all entities of specific type
// REPLACE: ACTOR with desired type (SOURCE, EVENT, PLACE, BEHAVIOR, EVIDENCE)
MATCH (n:ACTOR)
RETURN n.name, n.connections
ORDER BY n.connections DESC;

// Query 7.2: Entities with name matching pattern
// Purpose: Search for entities by name
// REPLACE: '.*GRU.*' with your regex pattern
MATCH (n:Entity)
WHERE n.name =~ '.*GRU.*'
RETURN n.name, n.type, n.connections
ORDER BY n.connections DESC;

// Query 7.3: Aggregate statistics by entity type
// Purpose: Summary statistics per type
MATCH (n:Entity)
RETURN n.type,
       count(*) as total,
       avg(n.connections) as avg_connections,
       max(n.connections) as max_connections,
       min(n.connections) as min_connections
ORDER BY total DESC;

// Query 7.4: Relationship statistics by type
// Purpose: Summary of relationship types
MATCH ()-[r]->()
RETURN type(r) as relationship_type,
       count(*) as total,
       avg(r.weight) as avg_weight,
       collect(DISTINCT r.confidence) as confidence_levels
ORDER BY total DESC;

// Query 7.5: Top entities per confidence level
// Purpose: Find most reliable connections
MATCH (source)-[r]->(target)
WHERE r.confidence = 'CONFIRMED'  // Or 'PROBABLE', 'POSSIBLE'
WITH source, count(r) as confirmed_count
RETURN source.name, source.type, confirmed_count
ORDER BY confirmed_count DESC
LIMIT 20;

// ============================================================================
// SECTION 8: SIMILARITY & RECOMMENDATIONS
// ============================================================================

// Query 8.1: Similar entities (shared connections)
// Purpose: Find entities with similar connection patterns
// REPLACE: 'ENTITY_NAME_HERE' with target entity
MATCH (target:Entity {name: 'ENTITY_NAME_HERE'})--(common)--(similar:Entity)
WHERE target <> similar
WITH similar, count(DISTINCT common) as shared_connections
WHERE shared_connections >= 3  // Adjust threshold
RETURN similar.name, similar.type, shared_connections
ORDER BY shared_connections DESC
LIMIT 10;

// Query 8.2: Node Similarity (requires GDS library)
// Purpose: Compute similarity scores based on relationships
CALL gds.nodeSimilarity.stream('myGraph', {topK: 10})
YIELD node1, node2, similarity
RETURN gds.util.asNode(node1).name AS entity1,
       gds.util.asNode(node2).name AS entity2,
       similarity
ORDER BY similarity DESC
LIMIT 20;

// Query 8.3: Recommend connections (link prediction)
// Purpose: Suggest potential relationships
MATCH (a:Entity {name: 'ENTITY_NAME_HERE'})
MATCH (b:Entity)
WHERE NOT (a)--(b) AND a <> b
MATCH (a)--(common)--(b)
WITH a, b, count(common) as common_connections
WHERE common_connections >= 2
RETURN b.name, b.type, common_connections
ORDER BY common_connections DESC
LIMIT 10;

// ============================================================================
// SECTION 9: GRAPH DATA SCIENCE SETUP
// ============================================================================

// Query 9.1: Create graph projection (REQUIRED before GDS queries)
// Purpose: Project graph into memory for algorithm execution
// Run this ONCE before using GDS algorithms
CALL gds.graph.project(
  'myGraph',              // Graph name (use in other queries)
  'Entity',               // Node label
  {
    RELATIONSHIP: {       // Use '*' for all relationships or specific type
      orientation: 'UNDIRECTED',  // or 'NATURAL' for directed
      properties: ['weight', 'confidence']
    }
  }
);

// Query 9.2: List existing projections
// Purpose: See what graph projections are available
CALL gds.graph.list()
YIELD graphName, nodeCount, relationshipCount, memoryUsage
RETURN graphName, nodeCount, relationshipCount, memoryUsage;

// Query 9.3: Drop projection (free memory)
// Purpose: Remove projection when done
CALL gds.graph.drop('myGraph', false);

// ============================================================================
// SECTION 10: EXPORT & REPORTING
// ============================================================================

// Query 10.1: Export nodes to table format
// Purpose: Generate report of all entities
MATCH (n:Entity)
RETURN n.id as id,
       n.name as name,
       n.type as type,
       n.connections as connections
ORDER BY n.connections DESC;

// Query 10.2: Export relationships to table format
// Purpose: Generate report of all relationships
MATCH (source:Entity)-[r]->(target:Entity)
RETURN source.id as source_id,
       source.name as source_name,
       type(r) as relationship,
       target.id as target_id,
       target.name as target_name,
       r.weight as weight,
       r.confidence as confidence
ORDER BY r.weight DESC;

// Query 10.3: Network summary statistics
// Purpose: Generate executive summary
MATCH (n:Entity)
WITH count(n) as total_nodes
MATCH ()-[r]->()
WITH total_nodes, count(r) as total_relationships
MATCH (n:Entity)
RETURN total_nodes,
       total_relationships,
       total_relationships * 1.0 / total_nodes as avg_degree,
       max(n.connections) as max_degree,
       min(n.connections) as min_degree;

// Query 10.4: Entity type cross-tabulation
// Purpose: Matrix of connections between entity types
MATCH (source:Entity)-[r]->(target:Entity)
RETURN source.type as from_type,
       target.type as to_type,
       count(r) as relationship_count
ORDER BY from_type, to_type;

// Query 10.5: Top influential entities report
// Purpose: Executive summary of key entities
MATCH (n:Entity)
RETURN n.name as entity_name,
       n.type as entity_type,
       n.connections as degree_centrality
ORDER BY n.connections DESC
LIMIT 20;

// ============================================================================
// SECTION 11: TEMPORAL ANALYSIS (requires timestamp properties)
// ============================================================================

// Query 11.1: Recent relationships (last 30 days)
// Purpose: Find newest connections
// NOTE: Requires timestamp property on relationships
MATCH ()-[r]->()
WHERE r.created_at > timestamp() - 30*24*60*60*1000  // 30 days in milliseconds
RETURN r
ORDER BY r.created_at DESC;

// Query 11.2: Network growth over time
// Purpose: Track when entities were added
// NOTE: Requires timestamp property on nodes
MATCH (n:Entity)
WITH date(datetime({epochMillis: n.created_at})) as creation_date
RETURN creation_date, count(*) as entities_added
ORDER BY creation_date;

// ============================================================================
// SECTION 12: ADVANCED PATTERNS
// ============================================================================

// Query 12.1: Find cliques (fully connected subgraphs)
// Purpose: Identify tightly coordinated groups
MATCH (a:Entity)-[r1]-(b:Entity),
      (b)-[r2]-(c:Entity),
      (c)-[r3]-(a)
WHERE id(a) < id(b) AND id(b) < id(c)  // Avoid duplicates
RETURN a.name, b.name, c.name
LIMIT 10;

// Query 12.2: Find bridges (single connection between communities)
// Purpose: Identify critical links
MATCH (a:Entity)-[r:RELATIONSHIP]-(b:Entity)
WHERE NOT EXISTS {
  MATCH (a)-[r2:RELATIONSHIP]-(other:Entity)-[r3:RELATIONSHIP]-(b)
  WHERE other <> a AND other <> b
}
RETURN a.name, type(r), b.name;

// Query 12.3: k-hop neighborhood
// Purpose: Find all entities within k hops
// REPLACE: k with desired distance (e.g., 1..2, 1..3)
MATCH path = (center:Entity {name: 'ENTITY_NAME_HERE'})-[*1..2]-(neighbor)
RETURN DISTINCT neighbor.name, neighbor.type, length(path) as distance
ORDER BY distance, neighbor.name;

// ============================================================================
// END OF QUERY COLLECTION
// ============================================================================

// Need more help?
// - Neo4j Documentation: https://neo4j.com/docs/
// - Cypher Manual: https://neo4j.com/docs/cypher-manual/current/
// - Graph Data Science: https://neo4j.com/docs/graph-data-science/current/
// - Research Tools: See NEO4J_IMPORT_GUIDE.md
