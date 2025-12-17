import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Route, Search, ArrowRight, AlertCircle } from 'lucide-react'
import { findShortestPath, findAllPaths } from '@/utils/network-metrics'

interface PathFinderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: Array<{ id: string; name: string; [key: string]: any }>
  links: Array<{ source: string; target: string; [key: string]: any }>
  onPathSelect?: (path: string[]) => void
}

export function PathFinderDialog({
  open,
  onOpenChange,
  nodes,
  links,
  onPathSelect
}: PathFinderDialogProps) {
  const [sourceQuery, setSourceQuery] = useState('')
  const [targetQuery, setTargetQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [showAllPaths, setShowAllPaths] = useState(false)

  // Filter nodes based on search query
  const filteredSourceNodes = useMemo(() => {
    if (!sourceQuery) return []
    return nodes
      .filter(n => n.name.toLowerCase().includes(sourceQuery.toLowerCase()))
      .slice(0, 10)
  }, [nodes, sourceQuery])

  const filteredTargetNodes = useMemo(() => {
    if (!targetQuery) return []
    return nodes
      .filter(n => n.name.toLowerCase().includes(targetQuery.toLowerCase()))
      .slice(0, 10)
  }, [nodes, targetQuery])

  // Calculate paths
  const pathResult = useMemo(() => {
    if (!selectedSource || !selectedTarget) return null

    if (showAllPaths) {
      const allPaths = findAllPaths(selectedSource, selectedTarget, nodes, links, 5)
      return {
        type: 'multiple' as const,
        paths: allPaths.slice(0, 10) // Limit to 10 paths
      }
    } else {
      const shortest = findShortestPath(selectedSource, selectedTarget, nodes, links)
      return shortest ? {
        type: 'single' as const,
        path: shortest.path,
        distance: shortest.distance
      } : null
    }
  }, [selectedSource, selectedTarget, nodes, links, showAllPaths])

  const getNodeName = (nodeId: string): string => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.name || nodeId.substring(0, 8)
  }

  const handleSelectSource = (nodeId: string) => {
    setSelectedSource(nodeId)
    setSourceQuery(getNodeName(nodeId))
  }

  const handleSelectTarget = (nodeId: string) => {
    setSelectedTarget(nodeId)
    setTargetQuery(getNodeName(nodeId))
  }

  const handleReset = () => {
    setSourceQuery('')
    setTargetQuery('')
    setSelectedSource(null)
    setSelectedTarget(null)
    setShowAllPaths(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Path Finder
          </DialogTitle>
          <DialogDescription>
            Find connection paths between two entities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Source Selection */}
          <div className="space-y-2">
            <Label>Source Entity</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search source entity..."
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {filteredSourceNodes.length > 0 && !selectedSource && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredSourceNodes.map(node => (
                  <div
                    key={node.id}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                    onClick={() => handleSelectSource(node.id)}
                  >
                    {node.name}
                  </div>
                ))}
              </div>
            )}
            {selectedSource && (
              <Badge variant="secondary" className="mt-2">
                Selected: {getNodeName(selectedSource)}
              </Badge>
            )}
          </div>

          {/* Target Selection */}
          <div className="space-y-2">
            <Label>Target Entity</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search target entity..."
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {filteredTargetNodes.length > 0 && !selectedTarget && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredTargetNodes.map(node => (
                  <div
                    key={node.id}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                    onClick={() => handleSelectTarget(node.id)}
                  >
                    {node.name}
                  </div>
                ))}
              </div>
            )}
            {selectedTarget && (
              <Badge variant="secondary" className="mt-2">
                Selected: {getNodeName(selectedTarget)}
              </Badge>
            )}
          </div>

          {/* Options */}
          {selectedSource && selectedTarget && (
            <div className="flex items-center gap-4">
              <Button
                variant={showAllPaths ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAllPaths(!showAllPaths)}
              >
                {showAllPaths ? "Show Shortest Only" : "Show All Paths"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>
          )}

          {/* Results */}
          {pathResult && (
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              {pathResult.type === 'single' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Shortest Path</h3>
                    <Badge>Distance: {pathResult.distance} hops</Badge>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    {pathResult.path.map((nodeId, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => onPathSelect?.([nodeId])}
                        >
                          {getNodeName(nodeId)}
                        </Badge>
                        {i < pathResult.path.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-3"
                    onClick={() => onPathSelect?.(pathResult.path)}
                  >
                    Highlight Path in Graph
                  </Button>
                </div>
              )}

              {pathResult.type === 'multiple' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Found Paths</h3>
                    <Badge>{pathResult.paths.length} paths</Badge>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {pathResult.paths.map((path, idx) => (
                      <div
                        key={idx}
                        className="border rounded p-2 hover:bg-white dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => onPathSelect?.(path)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold">Path {idx + 1}</span>
                          <Badge variant="secondary" className="text-xs">
                            {path.length - 1} hops
                          </Badge>
                        </div>
                        <div className="flex items-center flex-wrap gap-1 text-xs">
                          {path.map((nodeId, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="text-gray-700 dark:text-gray-300">
                                {getNodeName(nodeId)}
                              </span>
                              {i < path.length - 1 && (
                                <ArrowRight className="h-3 w-3 text-gray-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedSource && selectedTarget && !pathResult && (
            <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 text-center">
              <AlertCircle className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No path found between these entities
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                They may be in different network components
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
