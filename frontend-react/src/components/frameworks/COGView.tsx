import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Download, Network, FileText, Table2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COGVulnerabilityMatrix } from '@/components/frameworks/COGVulnerabilityMatrix'
import { COGNetworkVisualization } from '@/components/frameworks/COGNetworkVisualization'
import { COGPowerPointExport } from '@/components/frameworks/COGPowerPointExport'
import { COGExcelExport } from '@/components/frameworks/COGExcelExport'
import { COGPDFExport } from '@/components/frameworks/COGPDFExport'
import {
  type COGAnalysis,
  type CenterOfGravity,
  type CriticalCapability,
  type CriticalRequirement,
  type CriticalVulnerability,
  rankVulnerabilitiesByScore,
  generateEdgeList,
  calculateCentralityMeasures,
} from '@/types/cog-analysis'

interface COGViewProps {
  data: COGAnalysis
  onEdit: () => void
  onDelete: () => void
  backPath: string
}

const ACTOR_COLOR_MAP = {
  friendly: 'bg-green-100 text-green-800 border-green-300',
  adversary: 'bg-red-100 text-red-800 border-red-300',
  host_nation: 'bg-blue-100 text-blue-800 border-blue-300',
  third_party: 'bg-gray-100 text-gray-800 border-gray-300',
}

const DOMAIN_ICONS = {
  diplomatic: '🤝',
  information: '📡',
  military: '🎖️',
  economic: '💰',
  financial: '💵',
  intelligence: '🔍',
  law_enforcement: '👮',
  cyber: '💻',
  space: '🛰️',
}

export function COGView({ data, onEdit, onDelete, backPath }: COGViewProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedCogs, setExpandedCogs] = useState<Set<string>>(new Set())

  // Calculate ranked vulnerabilities
  const rankedVulnerabilities = useMemo(() => {
    return rankVulnerabilitiesByScore(data.critical_vulnerabilities)
  }, [data.critical_vulnerabilities])

  // Generate network data
  const edgeList = useMemo(() => generateEdgeList(data), [data])
  const centralityMeasures = useMemo(() => calculateCentralityMeasures(edgeList), [edgeList])

  // Group COGs by actor category
  const cogsByActor = useMemo(() => {
    const grouped: Record<string, CenterOfGravity[]> = {
      friendly: [],
      adversary: [],
      host_nation: [],
      third_party: [],
    }
    data.centers_of_gravity.forEach(cog => {
      if (grouped[cog.actor_category]) {
        grouped[cog.actor_category].push(cog)
      }
    })
    return grouped
  }, [data.centers_of_gravity])

  const getScoreColor = (score: number): string => {
    const maxScore = data.scoring_system === 'linear' ? 15 : 36
    const percentage = (score / maxScore) * 100

    if (percentage >= 80) return 'bg-red-100 text-red-900 border-red-300'
    if (percentage >= 60) return 'bg-orange-100 text-orange-900 border-orange-300'
    if (percentage >= 40) return 'bg-yellow-100 text-yellow-900 border-yellow-300'
    return 'bg-gray-100 text-gray-900 border-gray-300'
  }

  const getCogCapabilities = (cogId: string) => {
    return data.critical_capabilities.filter(cap => cap.cog_id === cogId)
  }

  const getCapabilityRequirements = (capId: string) => {
    return data.critical_requirements.filter(req => req.capability_id === capId)
  }

  const getRequirementVulnerabilities = (reqId: string) => {
    return data.critical_vulnerabilities.filter(vuln => vuln.requirement_id === reqId)
  }

  const toggleExpanded = (cogId: string) => {
    const newSet = new Set(expandedCogs)
    if (newSet.has(cogId)) {
      newSet.delete(cogId)
    } else {
      newSet.add(cogId)
    }
    setExpandedCogs(newSet)
  }

  const exportEdgeList = () => {
    const csv = [
      'Source,Source Type,Target,Target Type,Weight,Relationship',
      ...edgeList.map(e => `${e.source},${e.source_type},${e.target},${e.target_type},${e.weight},${e.relationship}`),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cog_edge_list_${data.title.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportReport = () => {
    const ranked = rankVulnerabilitiesByScore(data.critical_vulnerabilities)

    const md = `# COG Analysis: ${data.title}

${data.description}

## Operational Context

- **Objective:** ${data.operational_context.objective}
- **Desired Impact:** ${data.operational_context.desired_impact}
- **Our Identity:** ${data.operational_context.our_identity}
- **Operating Environment:** ${data.operational_context.operating_environment}
- **Constraints:** ${data.operational_context.constraints.join(', ')}
- **Restraints:** ${data.operational_context.restraints.join(', ')}
- **Timeframe:** ${data.operational_context.timeframe}
- **Strategic Level:** ${data.operational_context.strategic_level.toUpperCase()}

## Centers of Gravity

${data.centers_of_gravity
  .map(
    cog => `
### ${cog.actor_category.toUpperCase()} - ${cog.domain.toUpperCase()}

${cog.description}

**Rationale:** ${cog.rationale}

**Critical Capabilities:**
${getCogCapabilities(cog.id)
  .map(
    cap => `
- **${cap.capability}**
  - ${cap.description}
  - Strategic Contribution: ${cap.strategic_contribution}
  - Requirements:
${getCapabilityRequirements(cap.id)
  .map(
    req => `    - ${req.requirement} (${req.requirement_type})
${getRequirementVulnerabilities(req.id)
  .map(
    vuln => `      - ⚠️ **${vuln.vulnerability}** (${vuln.vulnerability_type})
        - Score: ${vuln.composite_score} (I:${vuln.scoring.impact_on_cog}, A:${vuln.scoring.attainability}, F:${vuln.scoring.follow_up_potential})`
  )
  .join('\n')}`
  )
  .join('\n')}`
  )
  .join('\n')}
`
  )
  .join('\n')}

## Critical Vulnerabilities (Prioritized)

${ranked
  .map(
    (v, i) => `
### ${i + 1}. ${v.vulnerability} (Score: ${v.composite_score})

- **Type:** ${v.vulnerability_type}
- **Description:** ${v.description || 'N/A'}
- **Impact on COG:** ${v.scoring.impact_on_cog}
- **Attainability:** ${v.scoring.attainability}
- **Follow-up Potential:** ${v.scoring.follow_up_potential}
${v.exploitation_method ? `- **Exploitation Method:** ${v.exploitation_method}` : ''}
`
  )
  .join('\n')}

## Network Analysis

### Top Nodes by Degree Centrality

${Object.entries(centralityMeasures.degree_centrality)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([node, score], i) => `${i + 1}. ${node.substring(0, 8)} (${score} connections)`)
  .join('\n')}

---

*Generated from COG Analysis Tool*
*Reference: [Irregularpedia COG Analysis Guide](https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide)*
`

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cog_report_${data.title.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportVulnerabilitiesCSV = () => {
    const ranked = rankVulnerabilitiesByScore(data.critical_vulnerabilities)
    const csv = [
      'Rank,Vulnerability,Type,Impact,Attainability,Follow-up,Composite Score,Description',
      ...ranked.map(
        (v, i) =>
          `${i + 1},"${v.vulnerability}","${v.vulnerability_type}",${v.scoring.impact_on_cog},${v.scoring.attainability},${v.scoring.follow_up_potential},${v.composite_score},"${v.description || ''}"`
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cog_vulnerabilities_${data.title.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${data.title}"?`)) {
      onDelete()
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-gray-950 z-10 py-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">COG Analysis • {data.scoring_system === 'linear' ? 'Linear Scoring' : 'Logarithmic Scoring'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Reference
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDelete} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-700 dark:text-gray-300">{data.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Operational Context */}
          <Card>
            <CardHeader>
              <CardTitle>Operational Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Objective</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.objective || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Desired Impact</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.desired_impact || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Our Identity</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.our_identity || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Operating Environment</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.operating_environment || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Timeframe</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.timeframe || 'Not specified'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Strategic Level</div>
                  <Badge variant="outline">{data.operational_context.strategic_level.toUpperCase()}</Badge>
                </div>
              </div>
              {data.operational_context.constraints.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Constraints</div>
                  <div className="flex flex-wrap gap-2">
                    {data.operational_context.constraints.map((c, i) => (
                      <Badge key={i} variant="secondary">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {data.operational_context.restraints.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Restraints</div>
                  <div className="flex flex-wrap gap-2">
                    {data.operational_context.restraints.map((r, i) => (
                      <Badge key={i} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* COGs by Actor Category */}
          {Object.entries(cogsByActor).map(([actor, cogs]) => (
            cogs.length > 0 && (
              <Card key={actor}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge className={ACTOR_COLOR_MAP[actor as keyof typeof ACTOR_COLOR_MAP]}>{actor.replace('_', ' ').toUpperCase()}</Badge>
                    <span className="text-gray-500 text-sm font-normal">({cogs.length} COG{cogs.length > 1 ? 's' : ''})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cogs.map(cog => (
                    <div key={cog.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{DOMAIN_ICONS[cog.domain]}</div>
                        <div className="flex-1">
                          <div className="font-semibold text-lg">{cog.domain.replace('_', ' ').toUpperCase()}</div>
                          <p className="text-gray-700 dark:text-gray-300 mt-1">{cog.description}</p>
                          {cog.rationale && (
                            <div className="mt-2 text-sm">
                              <span className="font-semibold text-gray-600">Rationale:</span> {cog.rationale}
                            </div>
                          )}
                          <div className="mt-2 text-sm text-gray-500">
                            {getCogCapabilities(cog.id).length} Capabilities • {data.critical_requirements.filter(req => getCogCapabilities(cog.id).some(cap => cap.id === req.capability_id)).length} Requirements •{' '}
                            {data.critical_vulnerabilities.filter(vuln => data.critical_requirements.filter(req => getCogCapabilities(cog.id).some(cap => cap.id === req.capability_id)).some(req => req.id === vuln.requirement_id)).length}{' '}
                            Vulnerabilities
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          ))}

          {/* Summary Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{data.centers_of_gravity.length}</div>
                <div className="text-sm text-gray-600">COGs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">{data.critical_capabilities.length}</div>
                <div className="text-sm text-gray-600">Capabilities</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-yellow-600">{data.critical_requirements.length}</div>
                <div className="text-sm text-gray-600">Requirements</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600">{data.critical_vulnerabilities.length}</div>
                <div className="text-sm text-gray-600">Vulnerabilities</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>COG Hierarchy</CardTitle>
                <div className="text-sm text-gray-500">Click to expand/collapse</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.centers_of_gravity.map(cog => (
                <div key={cog.id} className="border rounded-lg">
                  <div className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => toggleExpanded(cog.id)}>
                    <div className="flex items-center gap-3">
                      <div className="text-xl">{DOMAIN_ICONS[cog.domain]}</div>
                      <div className="flex-1">
                        <div className="font-semibold">
                          🎯 {cog.actor_category.toUpperCase()} - {cog.domain.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="text-sm text-gray-600">{cog.description}</div>
                      </div>
                      <Badge variant="outline">{expandedCogs.has(cog.id) ? '▼' : '▶'}</Badge>
                    </div>
                  </div>

                  {expandedCogs.has(cog.id) && (
                    <div className="p-4 pt-0 space-y-3">
                      {getCogCapabilities(cog.id).map(cap => (
                        <div key={cap.id} className="ml-8 border-l-2 border-blue-300 pl-4 space-y-2">
                          <div className="font-medium">⚡ {cap.capability}</div>
                          <div className="text-sm text-gray-600">{cap.description}</div>

                          {getCapabilityRequirements(cap.id).map(req => (
                            <div key={req.id} className="ml-6 border-l-2 border-yellow-300 pl-3 space-y-2">
                              <div className="text-sm font-medium">
                                📋 {req.requirement} <Badge variant="secondary">{req.requirement_type}</Badge>
                              </div>

                              {getRequirementVulnerabilities(req.id).map(vuln => (
                                <div key={vuln.id} className="ml-4 border-l-2 border-orange-300 pl-3">
                                  <div className="text-sm">
                                    <span className="font-medium">⚠️ {vuln.vulnerability}</span>
                                    <Badge className={`ml-2 ${getScoreColor(vuln.composite_score)}`}>Score: {vuln.composite_score}</Badge>
                                    <Badge variant="outline" className="ml-1">
                                      Rank #{vuln.priority_rank}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">I:{vuln.scoring.impact_on_cog} • A:{vuln.scoring.attainability} • F:{vuln.scoring.follow_up_potential}</div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Critical Vulnerabilities</CardTitle>
                  <CardDescription>Ranked by composite score (Impact + Attainability + Follow-up)</CardDescription>
                </div>
                <Button variant="outline" onClick={exportVulnerabilitiesCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Vulnerability</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">I</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">F</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedVulnerabilities.map((vuln, idx) => (
                    <TableRow key={vuln.id}>
                      <TableCell className="font-bold">#{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{vuln.vulnerability}</div>
                        {vuln.description && <div className="text-sm text-gray-500 mt-1">{vuln.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{vuln.vulnerability_type}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{vuln.scoring.impact_on_cog}</TableCell>
                      <TableCell className="text-center">{vuln.scoring.attainability}</TableCell>
                      <TableCell className="text-center">{vuln.scoring.follow_up_potential}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={getScoreColor(vuln.composite_score)}>{vuln.composite_score}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Network Metrics</CardTitle>
                <CardDescription>Centrality measures for key nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-2">Top Nodes by Degree Centrality</div>
                    <div className="space-y-1">
                      {Object.entries(centralityMeasures.degree_centrality)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([node, score]) => (
                          <div key={node} className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs">{node.substring(0, 12)}...</span>
                            <Badge variant="secondary">{score} connections</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-sm font-semibold text-gray-600 mb-1">Network Statistics</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Total Nodes: {Object.keys(centralityMeasures.degree_centrality).length}</div>
                      <div>Total Edges: {edgeList.length}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
                <CardDescription>Download network data and reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <COGPowerPointExport
                  analysis={data}
                  vulnerabilities={rankedVulnerabilities}
                  edges={edgeList}
                  variant="outline"
                  className="w-full justify-start"
                />
                <COGExcelExport
                  analysis={data}
                  vulnerabilities={rankedVulnerabilities}
                  edges={edgeList}
                  variant="outline"
                  className="w-full justify-start"
                />
                <COGPDFExport
                  analysis={data}
                  vulnerabilities={rankedVulnerabilities}
                  edges={edgeList}
                  variant="outline"
                  className="w-full justify-start"
                />
                <Button variant="outline" className="w-full justify-start" onClick={exportEdgeList}>
                  <Table2 className="h-4 w-4 mr-2" />
                  Edge List CSV
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={exportReport}>
                  <FileText className="h-4 w-4 mr-2" />
                  Full Report (Markdown)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={exportVulnerabilitiesCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Vulnerabilities CSV
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Network Visualization */}
          <COGNetworkVisualization
            analysis={data}
            edges={edgeList}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
