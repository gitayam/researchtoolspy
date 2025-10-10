import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Edit, Trash2, Download, Network, FileText, Table2, ExternalLink, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { COGVulnerabilityMatrix } from '@/components/frameworks/COGVulnerabilityMatrix'
import { CommentThread } from '@/components/comments/CommentThread'
import { COGNetworkVisualization } from '@/components/frameworks/COGNetworkVisualization'
import { COGPowerPointExport } from '@/components/frameworks/COGPowerPointExport'
import { COGExcelExport } from '@/components/frameworks/COGExcelExport'
import { COGPDFExport } from '@/components/frameworks/COGPDFExport'
import { PublishDialog } from '@/components/library/PublishDialog'
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
  const { t } = useTranslation(['cog'])
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedCogs, setExpandedCogs] = useState<Set<string>>(new Set())
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

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
      `${t('view.export.csvHeaders.source')},${t('view.export.csvHeaders.sourceType')},${t('view.export.csvHeaders.target')},${t('view.export.csvHeaders.targetType')},${t('view.export.csvHeaders.weight')},${t('view.export.csvHeaders.relationship')}`,
      ...edgeList.map(e => `${e.source},${e.source_type},${e.target},${e.target_type},${e.weight},${e.relationship}`),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('view.export.edgeListFilename', { title: data.title.replace(/\s+/g, '_') })
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportReport = () => {
    const ranked = rankVulnerabilitiesByScore(data.critical_vulnerabilities)

    const md = `# ${t('view.markdown.title', { title: data.title })}

${data.description}

## ${t('view.markdown.operationalContextTitle')}

- **${t('view.markdown.objective')}:** ${data.operational_context.objective}
- **${t('view.markdown.desiredImpact')}:** ${data.operational_context.desired_impact}
- **${t('view.markdown.ourIdentity')}:** ${data.operational_context.our_identity}
- **${t('view.markdown.operatingEnvironment')}:** ${data.operational_context.operating_environment}
- **${t('view.markdown.constraints')}:** ${data.operational_context.constraints.join(', ')}
- **${t('view.markdown.restraints')}:** ${data.operational_context.restraints.join(', ')}
- **${t('view.markdown.timeframe')}:** ${data.operational_context.timeframe}
- **${t('view.markdown.strategicLevel')}:** ${data.operational_context.strategic_level.toUpperCase()}

## ${t('view.markdown.centersOfGravity')}

${data.centers_of_gravity
  .map(
    cog => `
### ${cog.actor_category.toUpperCase()} - ${cog.domain.toUpperCase()}

${cog.description}

**${t('view.markdown.rationale')}:** ${cog.rationale}

**${t('view.markdown.criticalCapabilities')}:**
${getCogCapabilities(cog.id)
  .map(
    cap => `
- **${cap.capability}**
  - ${cap.description}
  - ${t('view.markdown.strategicContribution')}: ${cap.strategic_contribution}
  - ${t('view.markdown.requirements')}:
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

## ${t('view.markdown.criticalVulnerabilitiesPrioritized')}

${ranked
  .map(
    (v, i) => `
### ${i + 1}. ${v.vulnerability} (Score: ${v.composite_score})

- **${t('view.markdown.type')}:** ${v.vulnerability_type}
- **${t('view.markdown.descriptionLabel')}:** ${v.description || t('view.markdown.notAvailable')}
- **${t('view.markdown.impactOnCOG')}:** ${v.scoring.impact_on_cog}
- **${t('view.markdown.attainability')}:** ${v.scoring.attainability}
- **${t('view.markdown.followUpPotential')}:** ${v.scoring.follow_up_potential}
${v.exploitation_method ? `- **${t('view.markdown.exploitationMethod')}:** ${v.exploitation_method}` : ''}
`
  )
  .join('\n')}

## ${t('view.markdown.networkAnalysis')}

### ${t('view.markdown.topNodesByDegreeCentrality')}

${Object.entries(centralityMeasures.degree_centrality)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([node, score], i) => `${i + 1}. ${node.substring(0, 8)} (${score} ${t('view.network.connections')})`)
  .join('\n')}

---

*${t('view.markdown.generatedFrom')}*
*${t('view.markdown.referenceLink')}*
`

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('view.export.reportFilename', { title: data.title.replace(/\s+/g, '_') })
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportVulnerabilitiesCSV = () => {
    const ranked = rankVulnerabilitiesByScore(data.critical_vulnerabilities)
    const csv = [
      `${t('view.export.csvHeaders.rank')},${t('view.export.csvHeaders.vulnerability')},${t('view.export.csvHeaders.type')},${t('view.export.csvHeaders.impact')},${t('view.export.csvHeaders.attainability')},${t('view.export.csvHeaders.followUp')},${t('view.export.csvHeaders.compositeScore')},${t('view.export.csvHeaders.description')}`,
      ...ranked.map(
        (v, i) =>
          `${i + 1},"${v.vulnerability}","${v.vulnerability_type}",${v.scoring.impact_on_cog},${v.scoring.attainability},${v.scoring.follow_up_potential},${v.composite_score},"${v.description || ''}"`
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('view.export.vulnerabilitiesFilename', { title: data.title.replace(/\s+/g, '_') })
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = () => {
    if (confirm(t('view.alerts.confirmDelete', { title: data.title }))) {
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
            {t('view.header.back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{t('view.header.cogAnalysis')} • {data.scoring_system === 'linear' ? t('view.header.linearScoring') : t('view.header.logarithmicScoring')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open('https://irregularpedia.org/index.php/Center_of_Gravity_Analysis_Guide', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('view.header.reference')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Collect all linked actor IDs from COGs
              const linkedActorIds = data.centers_of_gravity
                .filter(cog => cog.actor_id)
                .map(cog => cog.actor_id!)

              navigate('/dashboard/network-graph', {
                state: {
                  source: 'cog',
                  title: data.title,
                  highlightEntities: linkedActorIds
                }
              })
            }}
          >
            <Network className="h-4 w-4 mr-2" />
            {t('view.header.viewInNetwork')}
          </Button>
          <Button variant="outline" onClick={() => setPublishDialogOpen(true)}>
            <Share2 className="h-4 w-4 mr-2" />
            {t('view.header.publishToLibrary')}
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            {t('view.header.edit')}
          </Button>
          <Button variant="outline" onClick={handleDelete} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('view.header.delete')}
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">{t('view.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="hierarchy">{t('view.tabs.hierarchy')}</TabsTrigger>
          <TabsTrigger value="vulnerabilities">{t('view.tabs.vulnerabilities')}</TabsTrigger>
          <TabsTrigger value="network">{t('view.tabs.network')}</TabsTrigger>
          <TabsTrigger value="comments">{t('view.tabs.comments')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Operational Context */}
          <Card>
            <CardHeader>
              <CardTitle>{t('view.operationalContext.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t('view.operationalContext.objective')}</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.objective || t('view.operationalContext.notSpecified')}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t('view.operationalContext.desiredImpact')}</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.desired_impact || t('view.operationalContext.notSpecified')}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t('view.operationalContext.ourIdentity')}</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.our_identity || t('view.operationalContext.notSpecified')}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t('view.operationalContext.operatingEnvironment')}</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.operating_environment || t('view.operationalContext.notSpecified')}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t('view.operationalContext.timeframe')}</div>
                  <div className="text-gray-900 dark:text-white">{data.operational_context.timeframe || t('view.operationalContext.notSpecified')}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">{t('view.operationalContext.strategicLevel')}</div>
                  <Badge variant="outline">{data.operational_context.strategic_level.toUpperCase()}</Badge>
                </div>
              </div>
              {data.operational_context.constraints.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('view.operationalContext.constraints')}</div>
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
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('view.operationalContext.restraints')}</div>
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
                    <span className="text-gray-500 text-sm font-normal">({t('view.cogsByActor.count', { count: cogs.length })})</span>
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
                              <span className="font-semibold text-gray-600">{t('view.markdown.rationale')}:</span> {cog.rationale}
                            </div>
                          )}
                          <div className="mt-2 text-sm text-gray-500">
                            {t('view.metrics.capabilitiesCount', { count: getCogCapabilities(cog.id).length })} • {t('view.metrics.requirementsCount', { count: data.critical_requirements.filter(req => getCogCapabilities(cog.id).some(cap => cap.id === req.capability_id)).length })} •{' '}
                            {t('view.metrics.vulnerabilitiesCount', { count: data.critical_vulnerabilities.filter(vuln => data.critical_requirements.filter(req => getCogCapabilities(cog.id).some(cap => cap.id === req.capability_id)).some(req => req.id === vuln.requirement_id)).length })}
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
                <div className="text-sm text-gray-600">{t('view.statistics.cogs')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-green-600">{data.critical_capabilities.length}</div>
                <div className="text-sm text-gray-600">{t('view.statistics.capabilities')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-yellow-600">{data.critical_requirements.length}</div>
                <div className="text-sm text-gray-600">{t('view.statistics.requirements')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-orange-600">{data.critical_vulnerabilities.length}</div>
                <div className="text-sm text-gray-600">{t('view.statistics.vulnerabilities')}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('view.hierarchy.title')}</CardTitle>
                <div className="text-sm text-gray-500">{t('view.hierarchy.clickToExpandCollapse')}</div>
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
                      <Badge variant="outline">{expandedCogs.has(cog.id) ? t('view.hierarchy.collapseIcon') : t('view.hierarchy.expandIcon')}</Badge>
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
                  <CardTitle>{t('view.vulnerabilitiesTab.title')}</CardTitle>
                  <CardDescription>{t('view.vulnerabilitiesTab.description')}</CardDescription>
                </div>
                <Button variant="outline" onClick={exportVulnerabilitiesCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('view.vulnerabilitiesTab.exportCSV')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">{t('view.vulnerabilitiesTab.tableHeaders.rank')}</TableHead>
                    <TableHead>{t('view.vulnerabilitiesTab.tableHeaders.vulnerability')}</TableHead>
                    <TableHead>{t('view.vulnerabilitiesTab.tableHeaders.type')}</TableHead>
                    <TableHead className="text-center">{t('view.vulnerabilitiesTab.tableHeaders.impact')}</TableHead>
                    <TableHead className="text-center">{t('view.vulnerabilitiesTab.tableHeaders.attainability')}</TableHead>
                    <TableHead className="text-center">{t('view.vulnerabilitiesTab.tableHeaders.followUp')}</TableHead>
                    <TableHead className="text-center">{t('view.vulnerabilitiesTab.tableHeaders.score')}</TableHead>
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
                <CardTitle>{t('view.network.title')}</CardTitle>
                <CardDescription>{t('view.network.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-2">{t('view.network.topNodesDegree')}</div>
                    <div className="space-y-1">
                      {Object.entries(centralityMeasures.degree_centrality)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([node, score]) => (
                          <div key={node} className="flex items-center justify-between text-sm">
                            <span className="font-mono text-xs">{node.substring(0, 12)}...</span>
                            <Badge variant="secondary">{score} {t('view.network.connections')}</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{t('view.network.statistics')}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>{t('view.network.totalNodes')}: {Object.keys(centralityMeasures.degree_centrality).length}</div>
                      <div>{t('view.network.totalEdges')}: {edgeList.length}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('view.network.exportOptions')}</CardTitle>
                <CardDescription>{t('view.network.exportDescription')}</CardDescription>
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
                  {t('view.network.edgeListCSV')}
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={exportReport}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t('view.network.fullReportMarkdown')}
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={exportVulnerabilitiesCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('view.vulnerabilitiesTab.exportCSV')}
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

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          <CommentThread
            entityType="cog_analysis"
            entityId={data.id}
          />
        </TabsContent>
      </Tabs>

      {/* Publish Dialog */}
      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        frameworkId={data.id}
        frameworkType="cog"
        defaultTitle={data.title}
        defaultDescription={data.description}
      />
    </div>
  )
}
