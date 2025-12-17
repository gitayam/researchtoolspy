import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, FileJson, FileText, Share2 } from 'lucide-react'
import type { EntityType } from '@/types/entities'

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

interface NetworkExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: NetworkNode[]
  links: NetworkLink[]
  filters?: any
}

export type ExportFormat = 'json' | 'csv' | 'graphml' | 'gexf' | 'cypher' | 'maltego' | 'i2anb'

export function NetworkExportDialog({
  open,
  onOpenChange,
  nodes,
  links,
  filters
}: NetworkExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [includeMetadata, setIncludeMetadata] = useState(true)

  const exportAsJSON = () => {
    const exportData = {
      nodes: nodes,
      edges: links,
      metadata: includeMetadata ? {
        exported_at: new Date().toISOString(),
        total_nodes: nodes.length,
        total_edges: links.length,
        filters: filters
      } : undefined
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    downloadFile(blob, `network-graph-${getTimestamp()}.json`)
  }

  const exportAsCSV = () => {
    // Export as two CSV files: nodes and edges

    // Nodes CSV
    const nodeHeaders = ['id', 'name', 'entity_type', 'connections']
    const nodeRows = nodes.map(node => [
      node.id,
      node.name,
      node.entityType,
      node.val || 0
    ])
    const nodesCSV = [nodeHeaders, ...nodeRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    // Edges CSV
    const edgeHeaders = ['source', 'target', 'relationship_type', 'weight', 'confidence']
    const edgeRows = links.map(link => [
      link.source,
      link.target,
      link.relationshipType,
      link.weight,
      link.confidence || 'UNKNOWN'
    ])
    const edgesCSV = [edgeHeaders, ...edgeRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    // Download both files
    const nodesBlob = new Blob([nodesCSV], { type: 'text/csv' })
    const edgesBlob = new Blob([edgesCSV], { type: 'text/csv' })

    downloadFile(nodesBlob, `network-nodes-${getTimestamp()}.csv`)
    downloadFile(edgesBlob, `network-edges-${getTimestamp()}.csv`)
  }

  const exportAsGraphML = () => {
    const graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">

  <!-- Node attributes -->
  <key id="name" for="node" attr.name="name" attr.type="string"/>
  <key id="entity_type" for="node" attr.name="entity_type" attr.type="string"/>
  <key id="connections" for="node" attr.name="connections" attr.type="int"/>

  <!-- Edge attributes -->
  <key id="relationship_type" for="edge" attr.name="relationship_type" attr.type="string"/>
  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>
  <key id="confidence" for="edge" attr.name="confidence" attr.type="string"/>

  <graph id="G" edgedefault="directed">
${nodes.map(node => `    <node id="${escapeXML(node.id)}">
      <data key="name">${escapeXML(node.name)}</data>
      <data key="entity_type">${escapeXML(node.entityType)}</data>
      <data key="connections">${node.val || 0}</data>
    </node>`).join('\n')}

${links.map((link, i) => `    <edge id="e${i}" source="${escapeXML(link.source)}" target="${escapeXML(link.target)}">
      <data key="relationship_type">${escapeXML(link.relationshipType)}</data>
      <data key="weight">${link.weight}</data>
      <data key="confidence">${escapeXML(link.confidence || 'UNKNOWN')}</data>
    </edge>`).join('\n')}
  </graph>
</graphml>`

    const blob = new Blob([graphml], { type: 'application/xml' })
    downloadFile(blob, `network-graph-${getTimestamp()}.graphml`)
  }

  const exportAsGEXF = () => {
    // Entity type color mapping (for Gephi visualization)
    const ENTITY_TYPE_COLORS: Record<EntityType, {r: number, g: number, b: number}> = {
      ACTOR: {r: 59, g: 130, b: 246},      // blue
      SOURCE: {r: 139, g: 92, b: 246},     // purple
      EVENT: {r: 239, g: 68, b: 68},       // red
      PLACE: {r: 16, g: 185, b: 129},      // green
      BEHAVIOR: {r: 245, g: 158, b: 11},   // orange
      EVIDENCE: {r: 99, g: 102, b: 241}    // indigo
    }

    const gexf = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.3" xmlns:viz="http://www.gexf.net/1.3/viz" version="1.3">
  <meta lastmodifieddate="${new Date().toISOString()}">
    <creator>Research Tools - Network Analysis</creator>
    <description>Entity Network Graph Export</description>
  </meta>
  <graph mode="static" defaultedgetype="directed">
    <attributes class="node">
      <attribute id="0" title="entity_type" type="string"/>
      <attribute id="1" title="connections" type="integer"/>
      <attribute id="2" title="export_date" type="string"/>
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="relationship_type" type="string"/>
      <attribute id="1" title="weight" type="float"/>
      <attribute id="2" title="confidence" type="string"/>
    </attributes>

    <nodes>
${nodes.map(node => {
      const color = ENTITY_TYPE_COLORS[node.entityType] || {r: 128, g: 128, b: 128}
      const size = Math.max(5, Math.min(50, (node.val || 1) * 3)) // Size based on connections
      return `      <node id="${escapeXML(node.id)}" label="${escapeXML(node.name)}">
        <attvalues>
          <attvalue for="0" value="${escapeXML(node.entityType)}"/>
          <attvalue for="1" value="${node.val || 0}"/>
          <attvalue for="2" value="${new Date().toISOString()}"/>
        </attvalues>
        <viz:color r="${color.r}" g="${color.g}" b="${color.b}"/>
        <viz:size value="${size}"/>
      </node>`
    }).join('\n')}
    </nodes>

    <edges>
${links.map((link, i) => {
      const confidence = link.confidence || 'UNKNOWN'
      const edgeWeight = link.weight || 1
      // Thicker lines for higher confidence
      const thickness = confidence === 'CONFIRMED' ? 3 : confidence === 'PROBABLE' ? 2 : 1
      return `      <edge id="${i}" source="${escapeXML(link.source)}" target="${escapeXML(link.target)}" weight="${edgeWeight}">
        <attvalues>
          <attvalue for="0" value="${escapeXML(link.relationshipType)}"/>
          <attvalue for="1" value="${edgeWeight}"/>
          <attvalue for="2" value="${escapeXML(confidence)}"/>
        </attvalues>
        <viz:thickness value="${thickness}"/>
      </edge>`
    }).join('\n')}
    </edges>
  </graph>
</gexf>`

    const blob = new Blob([gexf], { type: 'application/xml' })
    downloadFile(blob, `network-graph-${getTimestamp()}.gexf`)
  }

  const exportAsCypher = () => {
    // Helper function to escape Cypher strings
    const escapeCypher = (str: string): string => {
      return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    }

    // Helper to sanitize property names (Neo4j doesn't allow spaces)
    const sanitizeProp = (str: string): string => {
      return str.replace(/\s+/g, '_').toLowerCase()
    }

    let cypher = `// Neo4j Cypher Script - Network Graph Export
// Generated: ${new Date().toISOString()}
// Total Nodes: ${nodes.length} | Total Relationships: ${links.length}
//
// USAGE:
// 1. Open Neo4j Browser (http://localhost:7474) or Neo4j Desktop
// 2. Copy and paste this entire script
// 3. Execute to create the graph
// 4. Run queries to analyze (see bottom of file for examples)

// ============================================================================
// STEP 1: Create Constraints and Indexes (for performance and data integrity)
// ============================================================================

// Unique constraint on entity ID (ensures no duplicates)
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.id IS UNIQUE;

// Indexes for fast lookups
CREATE INDEX entity_name_index IF NOT EXISTS
FOR (e:Entity) ON (e.name);

CREATE INDEX entity_type_index IF NOT EXISTS
FOR (e:Entity) ON (e.type);

// ============================================================================
// STEP 2: Create Nodes
// ============================================================================

`

    // Group nodes by entity type for cleaner output
    const nodesByType = nodes.reduce((acc, node) => {
      if (!acc[node.entityType]) acc[node.entityType] = []
      acc[node.entityType].push(node)
      return acc
    }, {} as Record<string, NetworkNode[]>)

    Object.entries(nodesByType).forEach(([entityType, typeNodes]) => {
      cypher += `// ${entityType} entities (${typeNodes.length} total)\n`
      typeNodes.forEach(node => {
        cypher += `CREATE (:Entity:${entityType} {
  id: '${escapeCypher(node.id)}',
  name: '${escapeCypher(node.name)}',
  type: '${entityType}',
  connections: ${node.val || 0}
});\n`
      })
      cypher += '\n'
    })

    cypher += `// ============================================================================
// STEP 3: Create Relationships
// ============================================================================

`

    // Group relationships by type for cleaner output
    const linksByType = links.reduce((acc, link) => {
      const relType = sanitizeProp(link.relationshipType)
      if (!acc[relType]) acc[relType] = []
      acc[relType].push(link)
      return acc
    }, {} as Record<string, NetworkLink[]>)

    Object.entries(linksByType).forEach(([relType, typeLinks]) => {
      cypher += `// ${relType.toUpperCase()} relationships (${typeLinks.length} total)\n`
      typeLinks.forEach(link => {
        const sanitizedRelType = sanitizeProp(link.relationshipType).toUpperCase()
        cypher += `MATCH (source:Entity {id: '${escapeCypher(link.source)}'})
MATCH (target:Entity {id: '${escapeCypher(link.target)}'})
CREATE (source)-[:${sanitizedRelType} {
  type: '${escapeCypher(link.relationshipType)}',
  weight: ${link.weight},
  confidence: '${escapeCypher(link.confidence || 'UNKNOWN')}'
}]->(target);
`
      })
      cypher += '\n'
    })

    cypher += `// ============================================================================
// DONE! Your graph has been created in Neo4j.
// ============================================================================

// ============================================================================
// EXAMPLE QUERIES (uncomment and run to analyze your network)
// ============================================================================

// --- Query 1: View all nodes ---
// MATCH (e:Entity)
// RETURN e.name, e.type, e.connections
// ORDER BY e.connections DESC
// LIMIT 25;

// --- Query 2: Find most connected entities (top hubs) ---
// MATCH (e:Entity)
// RETURN e.name, e.type, e.connections
// ORDER BY e.connections DESC
// LIMIT 10;

// --- Query 3: Find all relationships for a specific entity ---
// MATCH (e:Entity {name: 'ENTITY_NAME_HERE'})-[r]-(connected)
// RETURN e.name as entity, type(r) as relationship, connected.name as connected_entity, r.confidence
// LIMIT 50;

// --- Query 4: Find shortest path between two entities ---
// MATCH path = shortestPath(
//   (start:Entity {name: 'START_ENTITY'})-[*]-(end:Entity {name: 'END_ENTITY'})
// )
// RETURN path;

// --- Query 5: Find communities (densely connected subgraphs) ---
// CALL gds.louvain.stream('myGraph')
// YIELD nodeId, communityId
// RETURN gds.util.asNode(nodeId).name AS name, communityId
// ORDER BY communityId;

// --- Query 6: PageRank (find most influential entities) ---
// CALL gds.pageRank.stream('myGraph')
// YIELD nodeId, score
// RETURN gds.util.asNode(nodeId).name AS name, score
// ORDER BY score DESC
// LIMIT 10;

// --- Query 7: Betweenness Centrality (find information brokers) ---
// CALL gds.betweenness.stream('myGraph')
// YIELD nodeId, score
// RETURN gds.util.asNode(nodeId).name AS name, score
// ORDER BY score DESC
// LIMIT 10;

// --- Query 8: Find entities by type ---
// MATCH (e:ACTOR)  // Change to: SOURCE, EVENT, PLACE, BEHAVIOR, EVIDENCE
// RETURN e.name, e.connections
// ORDER BY e.connections DESC;

// --- Query 9: Find confirmed relationships only ---
// MATCH (source)-[r {confidence: 'CONFIRMED'}]->(target)
// RETURN source.name, type(r), target.name, r.weight
// ORDER BY r.weight DESC;

// --- Query 10: Export to CSV (for further analysis in R/Python) ---
// MATCH (e:Entity)
// RETURN e.id, e.name, e.type, e.connections
// INTO OUTFILE 'neo4j_nodes_export.csv'
// FIELDS TERMINATED BY ','
// ENCLOSED BY '"'
// LINES TERMINATED BY '\\n';

// ============================================================================
// VISUALIZATION TIP: Run "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 100" to see graph
// ============================================================================
`

    const blob = new Blob([cypher], { type: 'text/plain' })
    downloadFile(blob, `network-graph-${getTimestamp()}.cypher`)
  }

  const exportAsMaltego = () => {
    /**
     * Maltego Transform CSV Format
     * Columns: Entity Type, Entity Value, Additional Fields (properties)
     *
     * Maltego entity types mapping:
     * - ACTOR → maltego.Person
     * - SOURCE → maltego.Document
     * - EVENT → maltego.Phrase
     * - PLACE → maltego.Location
     * - BEHAVIOR → maltego.Phrase
     * - EVIDENCE → maltego.Document
     */

    const maltegoTypeMap: Record<EntityType, string> = {
      ACTOR: 'maltego.Person',
      SOURCE: 'maltego.Document',
      EVENT: 'maltego.Phrase',
      PLACE: 'maltego.Location',
      BEHAVIOR: 'maltego.Phrase',
      EVIDENCE: 'maltego.Document'
    }

    // Entities CSV for Maltego
    const headers = ['Entity Type', 'Entity Value', 'Weight', 'Connections', 'Notes']
    const rows = nodes.map(node => [
      maltegoTypeMap[node.entityType] || 'maltego.Phrase',
      node.name,
      node.val || 0,
      node.val || 0,
      `Original Type: ${node.entityType}`
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    downloadFile(blob, `maltego-entities-${getTimestamp()}.csv`)

    // Also create a links file for reference (Maltego doesn't directly import links)
    const linkHeaders = ['Source', 'Target', 'Relationship', 'Weight', 'Confidence']
    const linkRows = links.map(link => [
      link.source,
      link.target,
      link.relationshipType,
      link.weight,
      link.confidence || 'UNKNOWN'
    ])
    const linksCSV = [linkHeaders, ...linkRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const linksBlob = new Blob([linksCSV], { type: 'text/csv' })
    downloadFile(linksBlob, `maltego-links-${getTimestamp()}.csv`)
  }

  const exportAsI2ANB = () => {
    /**
     * i2 Analyst's Notebook CSV Format
     *
     * Entities CSV: EntityID, Label, EntityType, Icon, Properties
     * Links CSV: LinkID, SourceID, TargetID, LinkType, LinkStrength, Properties
     */

    // i2 ANB entity type mapping
    const i2TypeMap: Record<EntityType, string> = {
      ACTOR: 'Person',
      SOURCE: 'Document',
      EVENT: 'Event',
      PLACE: 'Location',
      BEHAVIOR: 'Activity',
      EVIDENCE: 'Evidence Item'
    }

    const i2IconMap: Record<EntityType, string> = {
      ACTOR: 'Person',
      SOURCE: 'Document',
      EVENT: 'Calendar',
      PLACE: 'Location',
      BEHAVIOR: 'Activity',
      EVIDENCE: 'Evidence'
    }

    // Entities CSV
    const entityHeaders = ['EntityID', 'Label', 'EntityType', 'Icon', 'Connections', 'OriginalType']
    const entityRows = nodes.map(node => [
      node.id,
      node.name,
      i2TypeMap[node.entityType] || 'Entity',
      i2IconMap[node.entityType] || 'Circle',
      node.val || 0,
      node.entityType
    ])

    const entitiesCSV = [entityHeaders, ...entityRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    // Links CSV
    const linkHeaders = ['LinkID', 'SourceID', 'TargetID', 'LinkType', 'LinkStrength', 'Confidence', 'Weight']
    const linkRows = links.map((link, idx) => [
      `link-${idx + 1}`,
      link.source,
      link.target,
      link.relationshipType,
      link.weight,
      link.confidence || 'UNKNOWN',
      link.weight
    ])

    const linksCSV = [linkHeaders, ...linkRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    // Download both files
    const entitiesBlob = new Blob([entitiesCSV], { type: 'text/csv; charset=utf-8' })
    const linksBlob = new Blob([linksCSV], { type: 'text/csv; charset=utf-8' })

    downloadFile(entitiesBlob, `i2anb-entities-${getTimestamp()}.csv`)
    downloadFile(linksBlob, `i2anb-links-${getTimestamp()}.csv`)
  }

  const handleExport = () => {
    switch (format) {
      case 'json':
        exportAsJSON()
        break
      case 'csv':
        exportAsCSV()
        break
      case 'graphml':
        exportAsGraphML()
        break
      case 'gexf':
        exportAsGEXF()
        break
      case 'cypher':
        exportAsCypher()
        break
      case 'maltego':
        exportAsMaltego()
        break
      case 'i2anb':
        exportAsI2ANB()
        break
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Network Graph</DialogTitle>
          <DialogDescription>
            Choose a format to export your network data for external analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="json" id="json" />
                <div className="flex-1">
                  <label
                    htmlFor="json"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <FileJson className="h-4 w-4" />
                    JSON
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Standard format with full metadata support
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="csv" id="csv" />
                <div className="flex-1">
                  <label
                    htmlFor="csv"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    CSV Edge List
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Two files: nodes.csv and edges.csv (Excel-compatible)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="graphml" id="graphml" />
                <div className="flex-1">
                  <label
                    htmlFor="graphml"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    GraphML
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    For Gephi, Cytoscape, yEd (XML-based)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="gexf" id="gexf" />
                <div className="flex-1">
                  <label
                    htmlFor="gexf"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    GEXF
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Gephi native format with rich metadata
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="cypher" id="cypher" />
                <div className="flex-1">
                  <label
                    htmlFor="cypher"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Neo4j Cypher
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Ready-to-run Cypher script for Neo4j graph database
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="maltego" id="maltego" />
                <div className="flex-1">
                  <label
                    htmlFor="maltego"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Maltego CSV
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    OSINT tool CSV format (entities + links) for Maltego transforms
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="i2anb" id="i2anb" />
                <div className="flex-1">
                  <label
                    htmlFor="i2anb"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    i2 Analyst's Notebook
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    IBM i2 ANB CSV format (entities.csv + links.csv) for law enforcement analysis
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Options */}
          {format === 'json' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={includeMetadata}
                onCheckedChange={(checked) => setIncludeMetadata(!!checked)}
              />
              <label
                htmlFor="metadata"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Include metadata (timestamps, filters, stats)
              </label>
            </div>
          )}

          {/* Stats */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Nodes:</span>
                <span className="font-semibold ml-2">{nodes.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Edges:</span>
                <span className="font-semibold ml-2">{links.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Utility functions
function getTimestamp(): string {
  return new Date().toISOString().split('T')[0]
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
