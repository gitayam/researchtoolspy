/**
 * Unified Deception Risk Dashboard
 * Aggregates all 5 deception systems: MOM, POP, EVE, MOSES, Claims
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Shield, AlertTriangle, TrendingUp, Eye, Target, CheckCircle2,
  XCircle, Clock, BarChart3, Activity, ExternalLink, RefreshCw, FolderKanban
} from 'lucide-react'

interface RiskStats {
  high: number
  medium: number
  low: number
  avg_score: number
  total: number
}

interface SourceStats {
  compromised: number
  unreliable: number
  solid: number
  avg_score: number
  total: number
}

interface EVEStats {
  suspicious: number
  needs_review: number
  verified: number
  avg_score: number
  total: number
}

interface Alert {
  type: 'ACTOR_MOM' | 'ACTOR_POP' | 'EVIDENCE_EVE' | 'SOURCE_MOSES' | 'CLAIM_DECEPTION'
  entity_type: 'ACTOR' | 'EVIDENCE' | 'SOURCE' | 'CLAIM'
  entity_id: string | number
  entity_name: string
  risk_score: number
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  details: string
  url?: string
}

interface RecommendedAction {
  priority: number
  action: string
  entity_type: string
  entity_id: string | number
  url?: string
}

interface DeceptionAggregateData {
  overall_risk_score: number
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  critical_alerts: Alert[]
  high_alerts: Alert[]
  all_alerts: Alert[]
  risk_breakdown: {
    actors_mom: RiskStats
    actors_pop: RiskStats
    evidence_eve: EVEStats
    sources_moses: SourceStats
    claims: RiskStats
  }
  recommended_actions: RecommendedAction[]
  metadata: {
    workspace_id: string
    generated_at: string
    data_sources: {
      actors: number
      sources: number
      content_analyses: number
    }
  }
}

interface Workspace {
  id: string
  name: string
  description?: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
  entity_count: {
    actors: number
    sources: number
    evidence: number
    events: number
    places: number
    behaviors: number
  }
}

export default function DeceptionRiskDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DeceptionAggregateData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('1')
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)

  const loadWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true)
      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch('/api/workspaces', {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}`, 'X-User-Hash': userHash })
        }
      })

      if (response.ok) {
        const result = await response.json()
        const allWorkspaces = [...(result.owned || []), ...(result.member || [])]
        setWorkspaces(allWorkspaces)

        // If no workspaces, keep default workspace ID '1'
        if (allWorkspaces.length > 0 && !allWorkspaces.find(w => w.id === selectedWorkspaceId)) {
          setSelectedWorkspaceId(allWorkspaces[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const userHash = localStorage.getItem('omnicore_user_hash')
      const response = await fetch(`/api/deception/aggregate?workspace_id=${selectedWorkspaceId}`, {
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load deception risk data')
      }

      const result = await response.json()
      setData(result)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load deception dashboard:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspaces()
  }, [])

  useEffect(() => {
    if (!loadingWorkspaces) {
      loadData()
    }
  }, [selectedWorkspaceId, loadingWorkspaces])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading deception risk data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error || 'Failed to load deception risk data'}
            </p>
            <Button onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20 border-red-500'
      case 'HIGH': return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20 border-orange-500'
      case 'MEDIUM': return 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20 border-yellow-500'
      case 'LOW': return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20 border-green-500'
      default: return 'text-gray-700 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20 border-gray-500'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <XCircle className="h-4 w-4" />
      case 'HIGH': return <AlertTriangle className="h-4 w-4" />
      case 'MEDIUM': return <Clock className="h-4 w-4" />
      case 'LOW': return <CheckCircle2 className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="h-8 w-8" />
            Deception Risk Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Unified view of all deception detection systems: MOM, POP, EVE, MOSES, Claims
          </p>

          {/* Workspace Selector */}
          <div className="mt-4 flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select workspace..." />
              </SelectTrigger>
              <SelectContent>
                {workspaces.length === 0 ? (
                  <SelectItem value="1">Default Workspace</SelectItem>
                ) : (
                  workspaces.map(workspace => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{workspace.name}</span>
                        {workspace.type === 'TEAM' && (
                          <Badge variant="outline" className="text-xs">Team</Badge>
                        )}
                        {workspace.type === 'PUBLIC' && (
                          <Badge variant="outline" className="text-xs">Public</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedWorkspace && (
              <div className="text-sm text-muted-foreground">
                {selectedWorkspace.entity_count.actors} actors · {selectedWorkspace.entity_count.sources} sources · {selectedWorkspace.entity_count.evidence} evidence
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-2">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Overall Risk Score Card */}
      <Card className={`border-2 ${getRiskColor(data.risk_level)}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Overall Risk Score
            </span>
            <Badge variant="outline" className={`text-lg px-4 py-2 ${getRiskColor(data.risk_level)}`}>
              {data.risk_level}
            </Badge>
          </CardTitle>
          <CardDescription>
            Aggregated from {data.metadata.data_sources.actors} actors, {data.metadata.data_sources.sources} sources, {data.metadata.data_sources.content_analyses} analyses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-6xl font-bold">
              {data.overall_risk_score}
              <span className="text-3xl text-muted-foreground">/100</span>
            </div>
            <div className="flex-1">
              <Progress value={data.overall_risk_score} className="h-4" />
              <p className="text-sm text-muted-foreground mt-2">
                Risk threshold: {data.overall_risk_score >= 75 ? 'CRITICAL' : data.overall_risk_score >= 60 ? 'HIGH' : data.overall_risk_score >= 40 ? 'MEDIUM' : 'LOW'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {(data.critical_alerts.length > 0 || data.high_alerts.length > 0) && (
        <Card className="border-2 border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts ({data.critical_alerts.length + data.high_alerts.length})
            </CardTitle>
            <CardDescription>
              Immediate attention required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...data.critical_alerts, ...data.high_alerts].map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 ${getRiskColor(alert.severity)} flex items-start justify-between gap-4`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">{alert.entity_name}</div>
                    <div className="text-sm opacity-80">{alert.details}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {alert.type.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Risk: {alert.risk_score.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
                {alert.url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(alert.url!)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risk Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Actors MOM */}
        <RiskBreakdownCard
          title="Actors (MOM)"
          subtitle="Motive-Opportunity-Means"
          icon={<Target className="h-5 w-5" />}
          stats={{
            high: data.risk_breakdown.actors_mom.high,
            medium: data.risk_breakdown.actors_mom.medium,
            low: data.risk_breakdown.actors_mom.low,
            total: data.risk_breakdown.actors_mom.total,
            avgScore: data.risk_breakdown.actors_mom.avg_score
          }}
          onViewAll={() => navigate('/dashboard/entities/actors')}
        />

        {/* Actors POP */}
        <RiskBreakdownCard
          title="Actors (POP)"
          subtitle="Patterns of Performance"
          icon={<TrendingUp className="h-5 w-5" />}
          stats={{
            high: data.risk_breakdown.actors_pop.high,
            medium: data.risk_breakdown.actors_pop.medium,
            low: data.risk_breakdown.actors_pop.low,
            total: data.risk_breakdown.actors_pop.total,
            avgScore: data.risk_breakdown.actors_pop.avg_score
          }}
          onViewAll={() => navigate('/dashboard/entities/actors')}
        />

        {/* Sources MOSES */}
        <RiskBreakdownCard
          title="Sources (MOSES)"
          subtitle="Source Vulnerability"
          icon={<Eye className="h-5 w-5" />}
          stats={{
            high: data.risk_breakdown.sources_moses.compromised,
            medium: data.risk_breakdown.sources_moses.unreliable,
            low: data.risk_breakdown.sources_moses.solid,
            total: data.risk_breakdown.sources_moses.total,
            avgScore: data.risk_breakdown.sources_moses.avg_score
          }}
          labels={{ high: 'Compromised', medium: 'Unreliable', low: 'Solid' }}
          onViewAll={() => navigate('/dashboard/entities/sources')}
        />

        {/* Evidence EVE */}
        <RiskBreakdownCard
          title="Evidence (EVE)"
          subtitle="Evidence Validation"
          icon={<BarChart3 className="h-5 w-5" />}
          stats={{
            high: data.risk_breakdown.evidence_eve.suspicious,
            medium: data.risk_breakdown.evidence_eve.needs_review,
            low: data.risk_breakdown.evidence_eve.verified,
            total: data.risk_breakdown.evidence_eve.total,
            avgScore: data.risk_breakdown.evidence_eve.avg_score
          }}
          labels={{ high: 'Suspicious', medium: 'Needs Review', low: 'Verified' }}
          onViewAll={() => navigate('/dashboard/evidence')}
        />

        {/* Claims */}
        <RiskBreakdownCard
          title="Claims Analysis"
          subtitle="Content Deception Detection"
          icon={<Shield className="h-5 w-5" />}
          stats={{
            high: data.risk_breakdown.claims.high,
            medium: data.risk_breakdown.claims.medium,
            low: data.risk_breakdown.claims.low,
            total: data.risk_breakdown.claims.total,
            avgScore: data.risk_breakdown.claims.avg_score
          }}
          onViewAll={() => navigate('/dashboard/tools/content-intelligence')}
        />
      </div>

      {/* Recommended Actions */}
      {data.recommended_actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Recommended Actions
            </CardTitle>
            <CardDescription>
              Priority tasks based on current risk profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommended_actions.map((action, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">#{action.priority}</Badge>
                  <span>{action.action}</span>
                </div>
                {action.url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(action.url!)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Review
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface RiskBreakdownCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  stats: {
    high: number
    medium: number
    low: number
    total: number
    avgScore: number
  }
  labels?: {
    high?: string
    medium?: string
    low?: string
  }
  onViewAll: () => void
}

function RiskBreakdownCard({ title, subtitle, icon, stats, labels, onViewAll }: RiskBreakdownCardProps) {
  const defaultLabels = { high: 'High Risk', medium: 'Medium Risk', low: 'Low Risk' }
  const actualLabels = { ...defaultLabels, ...labels }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold text-center">
          {stats.total}
          <div className="text-xs font-normal text-muted-foreground">Total Items</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              {actualLabels.high}
            </span>
            <span className="font-bold">{stats.high}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              {actualLabels.medium}
            </span>
            <span className="font-bold">{stats.medium}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              {actualLabels.low}
            </span>
            <span className="font-bold">{stats.low}</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            Avg Score: <span className="font-bold">{stats.avgScore.toFixed(1)}</span>
          </div>
        </div>

        <Button onClick={onViewAll} variant="outline" size="sm" className="w-full">
          View All
        </Button>
      </CardContent>
    </Card>
  )
}
