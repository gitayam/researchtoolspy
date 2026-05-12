# Neo4j Import Guide
**Created**: 2025-10-06
**Neo4j Version**: 5.x (Community or Enterprise)

---

## 📊 Quick Start: Export & Import in 10 Minutes

### Step 1: Export from Research Tools

1. Navigate to **Network Graph** page (`/dashboard/network-graph`)
2. Click the **Export** button (download icon)
3. Select **Neo4j Cypher** format
4. Click **Export**
5. File downloads: `network-graph-YYYY-MM-DD.cypher`

### Step 2: Install Neo4j

**Option A: Neo4j Desktop** (Recommended for beginners)
1. Download from https://neo4j.com/download/
2. Install and create a new project
3. Click **Add** → **Local DBMS**
4. Name: "Research Tools Network"
5. Password: (choose secure password)
6. Click **Start**

**Option B: Docker** (For developers)
```bash
docker run \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  -v $HOME/neo4j/data:/data \
  neo4j:latest
```

### Step 3: Import Your Data

1. Open Neo4j Browser: http://localhost:7474
2. Login with credentials
3. Open your exported `.cypher` file in a text editor
4. Copy **all content** (Ctrl+A, Ctrl+C)
5. Paste into Neo4j Browser query window
6. Click **Run** (play button) or press Ctrl+Enter

🎉 **Done!** Your network is now in Neo4j.

### Step 4: Visualize

Run this query to see your graph:

```cypher
MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 100
```

---

## 🔧 Installation Guide

### Neo4j Desktop (Recommended)

#### Installation
1. Visit https://neo4j.com/download/
2. Fill out form (free for Community Edition)
3. Download for your OS:
   - **Windows**: `.exe` installer
   - **macOS**: `.dmg` file
   - **Linux**: `.AppImage`
4. Run installer and follow prompts

#### Creating a Database
1. Launch Neo4j Desktop
2. **New Project** → Name: "Research Tools"
3. **Add** → **Local DBMS**
4. Configure:
   - **Name**: Research Network
   - **Version**: 5.x (latest)
   - **Password**: (secure password - save it!)
5. Click **Create**
6. Click **Start** to launch database

#### Opening Neo4j Browser
1. Once database is running, click **Open**
2. Browser opens at http://localhost:7474
3. Login:
   - **Username**: neo4j
   - **Password**: (your password)

### Docker Installation

#### Pull and Run
```bash
# Pull latest image
docker pull neo4j:latest

# Run with persistent storage
docker run \
  --name research-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/research123 \
  -e NEO4J_apoc_export_file_enabled=true \
  -e NEO4J_apoc_import_file_enabled=true \
  -v $HOME/neo4j/data:/data \
  -v $HOME/neo4j/plugins:/plugins \
  -v $HOME/neo4j/import:/import \
  neo4j:latest
```

#### Verify Installation
```bash
# Check running container
docker ps

# Check logs
docker logs research-neo4j

# Access Neo4j Browser
open http://localhost:7474
```

#### Stop/Start
```bash
# Stop
docker stop research-neo4j

# Start
docker start research-neo4j

# Remove (deletes data if no volume)
docker rm research-neo4j
```

### Cloud Deployment (Neo4j Aura)

1. Visit https://neo4j.com/cloud/aura/
2. Click **Start Free**
3. Create account
4. **Create Database**:
   - **Name**: research-tools-network
   - **Region**: (choose closest)
   - **Size**: Free tier (sufficient for most analyses)
5. Save credentials (shown only once!)
6. Connect via URL provided

---

## 📤 Importing Your Data

### Method 1: Copy-Paste (Simplest)

1. Open exported `.cypher` file in text editor
2. Select all (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)
4. Open Neo4j Browser
5. Paste into query window
6. Click **Run** (▶️) or Ctrl+Enter

**Pros**: Easy, no file management
**Cons**: Slow for large graphs (>1000 nodes)

### Method 2: File Import (Faster)

#### Desktop
1. Click **...** (three dots) next to your database
2. **Open Folder** → **Import**
3. Copy your `.cypher` file here
4. In Neo4j Browser:
   ```cypher
   // Read file (requires APOC plugin)
   CALL apoc.cypher.runFile('file:///network-graph-2025-10-06.cypher')
   ```

#### Docker
```bash
# Copy file to import directory
docker cp network-graph-2025-10-06.cypher research-neo4j:/import/

# Run import
docker exec -it research-neo4j cypher-shell \
  -u neo4j -p research123 \
  -f /import/network-graph-2025-10-06.cypher
```

### Method 3: Programmatic Import (Python)

```python
from neo4j import GraphDatabase

class Neo4jImporter:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def import_cypher_file(self, filepath):
        with open(filepath, 'r') as f:
            cypher_script = f.read()

        with self.driver.session() as session:
            session.run(cypher_script)

        print(f"Imported {filepath} successfully!")

# Usage
importer = Neo4jImporter("bolt://localhost:7687", "neo4j", "your-password")
importer.import_cypher_file("network-graph-2025-10-06.cypher")
importer.close()
```

---

## 🔍 Essential Queries

### Basic Exploration

#### View All Nodes
```cypher
MATCH (n:Entity)
RETURN n.name, n.type, n.connections
ORDER BY n.connections DESC
LIMIT 25
```

#### View Entire Graph (small networks)
```cypher
MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 100
```

#### Count Nodes and Relationships
```cypher
MATCH (n:Entity)
RETURN count(n) as total_nodes

MATCH ()-[r]->()
RETURN count(r) as total_relationships
```

#### Node Distribution by Type
```cypher
MATCH (n:Entity)
RETURN n.type, count(*) as count
ORDER BY count DESC
```

### Finding Central Entities

#### Most Connected (Degree Centrality)
```cypher
MATCH (n:Entity)
RETURN n.name, n.type, n.connections
ORDER BY n.connections DESC
LIMIT 10
```

#### PageRank (Influence)
```cypher
CALL gds.pageRank.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
LIMIT 10
```

**Note**: Requires Graph Data Science library (see below)

#### Betweenness Centrality (Brokers)
```cypher
CALL gds.betweenness.stream('myGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC
LIMIT 10
```

### Relationship Analysis

#### All Relationships for a Node
```cypher
MATCH (e:Entity {name: 'Russian GRU'})-[r]-(connected)
RETURN e.name, type(r), connected.name, r.confidence
ORDER BY r.weight DESC
```

#### Confirmed Relationships Only
```cypher
MATCH (source)-[r {confidence: 'CONFIRMED'}]->(target)
RETURN source.name, type(r), target.name, r.weight
ORDER BY r.weight DESC
```

#### Relationship Type Distribution
```cypher
MATCH ()-[r]->()
RETURN type(r) as relationship_type, count(*) as count
ORDER BY count DESC
```

### Path Finding

#### Shortest Path Between Two Entities
```cypher
MATCH path = shortestPath(
  (start:Entity {name: 'Entity A'})-[*]-(end:Entity {name: 'Entity B'})
)
RETURN path
```

#### All Paths (up to 3 hops)
```cypher
MATCH path = (start:Entity {name: 'Entity A'})-[*1..3]-(end:Entity {name: 'Entity B'})
RETURN path
LIMIT 10
```

#### Path Through Specific Relationship Type
```cypher
MATCH path = (start:Entity {name: 'Entity A'})-[:OPERATES_WITH*1..3]-(end:Entity {name: 'Entity B'})
RETURN path
```

### Community Detection

#### Louvain Algorithm
```cypher
CALL gds.louvain.stream('myGraph')
YIELD nodeId, communityId
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type,
       communityId
ORDER BY communityId, name
```

#### Community Sizes
```cypher
CALL gds.louvain.stream('myGraph')
YIELD communityId
RETURN communityId, count(*) as size
ORDER BY size DESC
```

---

## 📈 Graph Data Science Library

### Installation

#### Neo4j Desktop
1. Database → **Plugins**
2. Find **Graph Data Science**
3. Click **Install**
4. **Restart** database

#### Docker
```bash
# Download plugin
wget https://github.com/neo4j/graph-data-science/releases/download/2.5.4/neo4j-graph-data-science-2.5.4.jar

# Copy to plugins
docker cp neo4j-graph-data-science-2.5.4.jar research-neo4j:/plugins/

# Restart container
docker restart research-neo4j
```

### Creating a Graph Projection

Before running GDS algorithms, create a graph projection:

```cypher
CALL gds.graph.project(
  'myGraph',                    // Graph name
  'Entity',                     // Node label
  {
    RELATIONSHIP: {             // Relationship type (use actual type or '*')
      orientation: 'UNDIRECTED', // or 'NATURAL' for directed
      properties: ['weight', 'confidence']
    }
  }
)
```

### Available Algorithms

#### Centrality
- **PageRank**: `gds.pageRank.stream('myGraph')`
- **Betweenness**: `gds.betweenness.stream('myGraph')`
- **Closeness**: `gds.closeness.stream('myGraph')`
- **Degree**: `gds.degree.stream('myGraph')`

#### Community Detection
- **Louvain**: `gds.louvain.stream('myGraph')`
- **Label Propagation**: `gds.labelPropagation.stream('myGraph')`
- **Weakly Connected Components**: `gds.wcc.stream('myGraph')`

#### Pathfinding
- **Shortest Path**: `gds.shortestPath.dijkstra.stream(...)`
- **All Shortest Paths**: `gds.allShortestPaths.stream(...)`
- **Minimum Spanning Tree**: `gds.spanningTree.stream(...)`

#### Similarity
- **Node Similarity**: `gds.nodeSimilarity.stream('myGraph')`
- **K-Nearest Neighbors**: `gds.knn.stream('myGraph')`

---

## 🎨 Visualization Tips

### Neo4j Browser Visualization

#### Color by Entity Type
```cypher
MATCH (n:Entity)
RETURN n
// Then click "Graph" view
// Click node → Style → Set color by n.type
```

#### Size by Connections
```cypher
MATCH (n:Entity)
RETURN n
// In visualization settings:
// Size: n.connections (min: 5, max: 50)
```

#### Show Labels
```cypher
// Settings → Visualization
// Check "Node Label: n.name"
```

### Neo4j Bloom (Visual Exploration)

Neo4j Bloom is a graph visualization tool included with Neo4j Desktop.

#### Activate Bloom
1. Neo4j Desktop → Your database
2. Click **Open** → **Neo4j Bloom**
3. Create **Perspective** (defines visual rules)

#### Create Perspective
1. **Add Category**: Entity
2. **Styling**:
   - Color: By `type`
   - Size: By `connections`
   - Caption: `name`
3. **Save**

#### Use Bloom
- **Search**: Type entity name in search bar
- **Expand**: Double-click node to see neighbors
- **Filter**: Right panel → Apply filters
- **Layout**: Try different algorithms (Force, Hierarchical, Grid)

### Export Visualization

#### As Image (Neo4j Browser)
```cypher
MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 100
// Click "Download" → SVG or PNG
```

#### As Interactive HTML
Requires `neoviz.js` library:
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/neovis.js@2.0.2"></script>
</head>
<body>
  <div id="viz"></div>
  <script>
    var config = {
      container_id: "viz",
      server_url: "bolt://localhost:7687",
      server_user: "neo4j",
      server_password: "your-password",
      labels: {
        "Entity": {
          caption: "name",
          size: "connections",
          community: "type"
        }
      },
      relationships: {},
      initial_cypher: "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 100"
    };
    var viz = new NeoVis.default(config);
    viz.render();
  </script>
</body>
</html>
```

---

## 💼 Common Use Cases

### Use Case 1: Investigate Operational Network

**Goal**: Find all entities connected to a specific actor

```cypher
// Step 1: Find the actor
MATCH (actor:ACTOR {name: 'Russian GRU'})
RETURN actor

// Step 2: Find direct connections
MATCH (actor:ACTOR {name: 'Russian GRU'})-[r]-(connected)
RETURN actor, r, connected

// Step 3: Find 2-hop network
MATCH path = (actor:ACTOR {name: 'Russian GRU'})-[*1..2]-(connected)
RETURN path

// Step 4: Summarize connections by type
MATCH (actor:ACTOR {name: 'Russian GRU'})-[r]-(connected)
RETURN connected.type, count(*) as count
ORDER BY count DESC
```

### Use Case 2: Identify Key Information Brokers

**Goal**: Find entities that bridge different communities

```cypher
// Calculate betweenness centrality
CALL gds.graph.project('brokerGraph', 'Entity', '*')

CALL gds.betweenness.stream('brokerGraph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name,
       gds.util.asNode(nodeId).type AS type,
       score
ORDER BY score DESC
LIMIT 20

// Visualize their networks
MATCH (broker:Entity {name: 'TOP_BROKER_NAME'})-[r]-(connected)
RETURN broker, r, connected
```

### Use Case 3: Track Information Flow

**Goal**: Find how information could flow from source to target

```cypher
// All shortest paths
MATCH path = allShortestPaths(
  (source:SOURCE {name: 'Media Outlet A'})-[*]-(target:ACTOR {name: 'Entity B'})
)
RETURN path

// Weighted shortest path (by confidence)
CALL gds.shortestPath.dijkstra.stream('myGraph', {
  sourceNode: id(source),
  targetNode: id(target),
  relationshipWeightProperty: 'weight'
})
YIELD path
RETURN path
```

### Use Case 4: Find Hidden Connections

**Goal**: Discover non-obvious relationships through shared connections

```cypher
// Entities that share many connections
MATCH (e1:Entity)--(shared)--(e2:Entity)
WHERE id(e1) < id(e2)  // Avoid duplicates
WITH e1, e2, count(shared) as shared_connections
WHERE shared_connections > 3
RETURN e1.name, e2.name, shared_connections
ORDER BY shared_connections DESC
LIMIT 20

// Visualize
MATCH path = (e1:Entity {name: 'Entity A'})--(shared)--(e2:Entity {name: 'Entity B'})
RETURN path
```

### Use Case 5: Temporal Analysis

**Goal**: Track network changes over time (requires multiple exports)

```cypher
// Add timestamps to relationships (manual)
MATCH ()-[r]->()
SET r.created_at = timestamp()

// Find recent relationships
MATCH ()-[r]->()
WHERE r.created_at > timestamp() - 30*24*60*60*1000  // Last 30 days
RETURN r

// Compare network snapshots (requires exporting at different times)
// Export 1: network-2025-01-01.cypher
// Export 2: network-2025-10-06.cypher
// Import both with different labels:
// :Entity_Jan vs :Entity_Oct
```

---

## 🛠️ Troubleshooting

### Problem: "Heap memory error" during import

**Cause**: Graph too large for default memory settings

**Solution 1: Increase Heap Size (Desktop)**
1. Database → **...** → **Settings**
2. Find `dbms.memory.heap.max_size`
3. Change from `512M` to `2G` (or higher)
4. **Restart** database

**Solution 2: Increase Heap Size (Docker)**
```bash
docker run \
  --name neo4j \
  -e NEO4J_dbms_memory_heap_max__size=2G \
  ... (other parameters)
```

**Solution 3: Import in Batches**
Split your Cypher file into smaller chunks:
1. Nodes first
2. Relationships in batches of 10,000

### Problem: "Transaction timeout"

**Cause**: Large import exceeds timeout

**Solution: Increase Transaction Timeout**
```cypher
// Before import, run:
CALL dbms.setConfigValue('dbms.transaction.timeout', '600s')
```

Or in settings:
```
dbms.transaction.timeout=600s
```

### Problem: Graph Data Science queries fail

**Cause**: Graph projection doesn't exist

**Solution: Create Projection First**
```cypher
// Check existing projections
CALL gds.graph.list()

// Create if missing
CALL gds.graph.project('myGraph', 'Entity', '*')
```

### Problem: Visualization is messy

**Solution 1: Limit Results**
```cypher
MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 50  // Start small
```

**Solution 2: Filter by Confidence**
```cypher
MATCH (n)-[r {confidence: 'CONFIRMED'}]->(m)
RETURN n, r, m
```

**Solution 3: Use Bloom**
Neo4j Bloom handles large graphs better than Browser

### Problem: Can't connect to database

**Check 1: Database Running?**
- Desktop: Is it started? (green indicator)
- Docker: `docker ps` shows container?

**Check 2: Correct Port?**
- Browser: 7474
- Bolt: 7687

**Check 3: Firewall?**
```bash
# Test connection
curl http://localhost:7474

# Should return HTML or JSON
```

---

## 📚 Additional Resources

### Official Documentation
- **Neo4j Manual**: https://neo4j.com/docs/
- **Cypher Manual**: https://neo4j.com/docs/cypher-manual/current/
- **Graph Data Science**: https://neo4j.com/docs/graph-data-science/current/

### Tutorials
- **Neo4j GraphAcademy** (free courses): https://graphacademy.neo4j.com/
- **Cypher Basics**: https://neo4j.com/developer/cypher/
- **Graph Data Modeling**: https://neo4j.com/developer/guide-data-modeling/

### Books
- *Graph Algorithms* by Mark Needham & Amy Hodler (O'Reilly)
- *Learning Neo4j* by Rik Van Bruggen (Packt)

### Community
- **Neo4j Community Forum**: https://community.neo4j.com/
- **Discord**: https://discord.gg/neo4j
- **Stack Overflow**: Tag `neo4j`

### Research Tools Support
- **GitHub Issues**: https://github.com/gitayam/researchtoolspy/issues
- **Integration Plan**: See `EXTERNAL_TOOLS_INTEGRATION_PLAN.md`

---

## 💡 Tips & Best Practices

### Tip 1: Use Parameters for Reusable Queries

Instead of hardcoding values:
```cypher
// ❌ Bad: Hardcoded
MATCH (e:Entity {name: 'Russian GRU'})
RETURN e

// ✅ Good: Parameterized
:param entityName => 'Russian GRU'
MATCH (e:Entity {name: $entityName})
RETURN e
```

### Tip 2: Create Indexes for Performance

```cypher
// Before querying frequently on a property
CREATE INDEX entity_name_index IF NOT EXISTS
FOR (e:Entity) ON (e.name)

// Composite index
CREATE INDEX entity_name_type_index IF NOT EXISTS
FOR (e:Entity) ON (e.name, e.type)
```

### Tip 3: Use EXPLAIN and PROFILE

```cypher
// See query plan
EXPLAIN
MATCH (e:Entity)-[r]->(connected)
WHERE e.connections > 10
RETURN e, r, connected

// See execution metrics
PROFILE
MATCH (e:Entity)-[r]->(connected)
WHERE e.connections > 10
RETURN e, r, connected
```

### Tip 4: Regular Backups

```bash
# Stop database
neo4j stop

# Backup (Desktop)
cp -r ~/Neo4jDesktop/relate-data/dbmss/dbms-{id}/data/databases/neo4j ~/backups/neo4j-backup-2025-10-06

# Backup (Docker)
docker exec research-neo4j neo4j-admin dump --database=neo4j --to=/backups/neo4j-backup.dump

# Restore
neo4j-admin load --from=/backups/neo4j-backup.dump --database=neo4j --force
```

### Tip 5: Combine with Python for Advanced Analysis

```python
from neo4j import GraphDatabase
import pandas as pd
import networkx as nx

# Connect to Neo4j
driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))

# Query data
with driver.session() as session:
    result = session.run("""
        MATCH (n:Entity)
        RETURN n.name as name, n.type as type, n.connections as connections
    """)
    df = pd.DataFrame([dict(record) for record in result])

# Analyze in pandas
print(df.groupby('type')['connections'].mean())

# Export to NetworkX for additional algorithms
G = nx.DiGraph()
with driver.session() as session:
    result = session.run("MATCH (n)-[r]->(m) RETURN n.id, m.id")
    for record in result:
        G.add_edge(record['n.id'], record['m.id'])

# Run NetworkX algorithms
centrality = nx.betweenness_centrality(G)
```

---

## 🎯 Next Steps

After mastering Neo4j basics:

1. **Graph Data Science**: Explore advanced algorithms (node embeddings, link prediction)
2. **APOC Procedures**: 450+ utility procedures for data manipulation
3. **Full-Text Search**: Create search indexes for entity names
4. **Spatial Queries**: If you have location data (coordinates)
5. **GraphQL API**: Expose your graph via GraphQL
6. **Neo4j Streams**: Real-time data integration with Kafka
7. **Multi-Database**: Separate graphs for different operations
8. **Causal Clustering**: Scale horizontally for production

---

**Questions or Issues?**

- Research Tools: https://github.com/gitayam/researchtoolspy/issues
- Neo4j: https://community.neo4j.com/

**Happy Graph Analysis! 🎉**
