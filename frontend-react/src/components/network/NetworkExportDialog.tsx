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

export type ExportFormat = 'json' | 'csv' | 'graphml' | 'gexf'

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
    const gexf = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
  <meta lastmodifieddate="${new Date().toISOString()}">
    <creator>OmniCore Network Analysis</creator>
    <description>Entity Network Graph</description>
  </meta>
  <graph mode="static" defaultedgetype="directed">
    <attributes class="node">
      <attribute id="0" title="entity_type" type="string"/>
      <attribute id="1" title="connections" type="integer"/>
    </attributes>
    <attributes class="edge">
      <attribute id="0" title="relationship_type" type="string"/>
      <attribute id="1" title="weight" type="float"/>
      <attribute id="2" title="confidence" type="string"/>
    </attributes>

    <nodes>
${nodes.map(node => `      <node id="${escapeXML(node.id)}" label="${escapeXML(node.name)}">
        <attvalues>
          <attvalue for="0" value="${escapeXML(node.entityType)}"/>
          <attvalue for="1" value="${node.val || 0}"/>
        </attvalues>
      </node>`).join('\n')}
    </nodes>

    <edges>
${links.map((link, i) => `      <edge id="${i}" source="${escapeXML(link.source)}" target="${escapeXML(link.target)}">
        <attvalues>
          <attvalue for="0" value="${escapeXML(link.relationshipType)}"/>
          <attvalue for="1" value="${link.weight}"/>
          <attvalue for="2" value="${escapeXML(link.confidence || 'UNKNOWN')}"/>
        </attvalues>
      </edge>`).join('\n')}
    </edges>
  </graph>
</gexf>`

    const blob = new Blob([gexf], { type: 'application/xml' })
    downloadFile(blob, `network-graph-${getTimestamp()}.gexf`)
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
