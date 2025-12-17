import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Network, Activity, Target, AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react'
import { calculateNetworkMetrics, detectPatterns, detectAnomalies, type NetworkMetrics, type NetworkPattern, type NetworkAnomaly } from '@/utils/network-metrics'

interface NetworkMetricsPanelProps {
  nodes: Array<{ id: string; name: string; [key: string]: any }>
  links: Array<{ source: string; target: string; [key: string]: any }>
  onNodeClick?: (nodeId: string) => void
}

export function NetworkMetricsPanel({ nodes, links, onNodeClick }: NetworkMetricsPanelProps) {
  const metrics = useMemo<NetworkMetrics>(() => {
    if (nodes.length === 0) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        density: 0,
        avgDegree: 0,
        topByDegree: [],
        topByBetweenness: [],
        topByCloseness: [],
        avgClusteringCoefficient: 0,
        componentCount: 0,
        largestComponentSize: 0
      }
    }
    return calculateNetworkMetrics(nodes, links)
  }, [nodes, links])

  const patterns = useMemo<NetworkPattern[]>(() => {
    if (nodes.length === 0) return []
    return detectPatterns(nodes, links)
  }, [nodes, links])

  const anomalies = useMemo<NetworkAnomaly[]>(() => {
    if (nodes.length === 0) return []
    return detectAnomalies(nodes, links)
  }, [nodes, links])

  const getNodeName = (nodeId: string): string => {
    const node = nodes.find(n => n.id === nodeId)
    return node?.name || nodeId.substring(0, 8)
  }

  const getDensityColor = (density: number): string => {
    if (density > 0.5) return 'text-red-600'
    if (density > 0.2) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getClusteringColor = (coefficient: number): string => {
    if (coefficient > 0.6) return 'text-green-600'
    if (coefficient > 0.3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSeverityColor = (severity: NetworkAnomaly['severity']): string => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300',
      HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300',
      LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300'
    }
    return colors[severity]
  }

  const getSeverityIcon = (severity: NetworkAnomaly['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return <ShieldAlert className="h-4 w-4" />
      case 'HIGH':
        return <AlertTriangle className="h-4 w-4" />
      case 'MEDIUM':
        return <AlertCircle className="h-4 w-4" />
      case 'LOW':
        return <AlertCircle className="h-4 w-4" />
    }
  }

  return (
    <Card className="h-full overflow-y-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Network Metrics
        </CardTitle>
        <CardDescription>Analysis and patterns</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="centrality">Centrality</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Nodes</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {metrics.nodeCount}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Edges</div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {metrics.edgeCount}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="text-xs text-green-600 dark:text-green-400 font-semibold">Components</div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {metrics.componentCount}
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Avg Degree</div>
                <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {metrics.avgDegree.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Network Density</span>
                  <span className={`font-semibold ${getDensityColor(metrics.density)}`}>
                    {(metrics.density * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={metrics.density * 100} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.density < 0.2 ? 'Sparse network' : metrics.density < 0.5 ? 'Moderate connectivity' : 'Dense network'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Clustering Coefficient</span>
                  <span className={`font-semibold ${getClusteringColor(metrics.avgClusteringCoefficient)}`}>
                    {metrics.avgClusteringCoefficient.toFixed(2)}
                  </span>
                </div>
                <Progress value={metrics.avgClusteringCoefficient * 100} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.avgClusteringCoefficient > 0.6 ? 'High clustering' : metrics.avgClusteringCoefficient > 0.3 ? 'Moderate clustering' : 'Low clustering'}
                </p>
              </div>

              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Largest Component
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold">{metrics.largestComponentSize}</div>
                  <Badge variant="secondary">
                    {metrics.nodeCount > 0 ? ((metrics.largestComponentSize / metrics.nodeCount) * 100).toFixed(0) : 0}% of network
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Centrality Tab */}
          <TabsContent value="centrality" className="space-y-4 mt-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                Top Nodes by Degree
              </h3>
              <div className="space-y-2">
                {metrics.topByDegree.slice(0, 5).map((node, i) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded cursor-pointer"
                    onClick={() => onNodeClick?.(node.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {i + 1}
                      </Badge>
                      <span className="font-medium">{getNodeName(node.id)}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{node.value} connections</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Network className="h-4 w-4" />
                Top Nodes by Betweenness
              </h3>
              <div className="space-y-2">
                {metrics.topByBetweenness.slice(0, 5).map((node, i) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded cursor-pointer"
                    onClick={() => onNodeClick?.(node.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {i + 1}
                      </Badge>
                      <span className="font-medium">{getNodeName(node.id)}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{node.value.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Target className="h-4 w-4" />
                Top Nodes by Closeness
              </h3>
              <div className="space-y-2">
                {metrics.topByCloseness.slice(0, 5).map((node, i) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded cursor-pointer"
                    onClick={() => onNodeClick?.(node.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                        {i + 1}
                      </Badge>
                      <span className="font-medium">{getNodeName(node.id)}</span>
                    </div>
                    <span className="text-gray-600 dark:text-gray-400">{node.value.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
              <AlertCircle className="h-4 w-4" />
              <span>Detected {patterns.length} patterns</span>
            </div>

            {patterns.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No significant patterns detected</p>
                <p className="text-xs mt-1">Try adjusting filters or add more entities</p>
              </div>
            ) : (
              <div className="space-y-3">
                {patterns.slice(0, 10).map((pattern, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant={pattern.type === 'TRIANGLE' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {pattern.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Sig: {(pattern.significance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {pattern.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {pattern.nodes.slice(0, 5).map(nodeId => (
                        <Badge
                          key={nodeId}
                          variant="outline"
                          className="text-xs cursor-pointer"
                          onClick={() => onNodeClick?.(nodeId)}
                        >
                          {getNodeName(nodeId)}
                        </Badge>
                      ))}
                      {pattern.nodes.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{pattern.nodes.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-4 mt-4">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <ShieldAlert className="h-4 w-4" />
                <span>Detected {anomalies.length} anomalies</span>
              </div>
              {anomalies.some(a => a.severity === 'CRITICAL' || a.severity === 'HIGH') && (
                <Badge variant="destructive" className="text-xs">
                  Action Required
                </Badge>
              )}
            </div>

            {anomalies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No anomalies detected</p>
                <p className="text-xs mt-1">Network structure appears normal</p>
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.slice(0, 15).map((anomaly, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 ${getSeverityColor(anomaly.severity)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(anomaly.severity)}
                        <Badge variant="outline" className="text-xs">
                          {anomaly.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <Badge className="text-xs">
                        {anomaly.severity}
                      </Badge>
                    </div>

                    <p className="text-sm font-medium mb-1">
                      {anomaly.description}
                    </p>

                    <p className="text-xs opacity-90 mb-2">
                      💡 {anomaly.recommendation}
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {anomaly.nodeIds.slice(0, 3).map(nodeId => (
                        <Badge
                          key={nodeId}
                          variant="secondary"
                          className="text-xs cursor-pointer"
                          onClick={() => onNodeClick?.(nodeId)}
                        >
                          {getNodeName(nodeId)}
                        </Badge>
                      ))}
                      {anomaly.nodeIds.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{anomaly.nodeIds.length - 3} more
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="text-xs opacity-75">
                        Score: {(anomaly.score * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}

                {anomalies.length > 15 && (
                  <div className="text-center text-xs text-gray-500 pt-2">
                    +{anomalies.length - 15} more anomalies
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
