/**
 * Deception Detection Visual Dashboard
 * Real-time visualization of deception analysis with charts, gauges, and heatmaps
 * CIA SATS MOM-POP-MOSES-EVE Framework
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { DeceptionScores, DeceptionAssessment } from '@/lib/deception-scoring'
import { calculateDeceptionLikelihood } from '@/lib/deception-scoring'
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Eye, Target, Shield } from 'lucide-react'

interface DeceptionDashboardProps {
  scores: Partial<DeceptionScores>
  assessment?: DeceptionAssessment
  showHistorical?: boolean
  historicalData?: Array<{ timestamp: string; likelihood: number }>
}

export function DeceptionDashboard({
  scores,
  assessment: providedAssessment,
  showHistorical = false,
  historicalData = []
}: DeceptionDashboardProps) {
  const { t } = useTranslation('deception')

  // Calculate assessment if not provided
  const assessment = useMemo(() => {
    return providedAssessment || calculateDeceptionLikelihood(scores)
  }, [scores, providedAssessment])

  return (
    <div className="space-y-6">
      {/* Main Likelihood Gauge */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('dashboard.overallLikelihood')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.basedOnFramework')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeceptionGauge
            likelihood={assessment.overallLikelihood}
            riskLevel={assessment.riskLevel}
            confidenceLevel={assessment.confidenceLevel}
            t={t}
          />
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryCard
          title={t('dashboard.momRiskIndicators')}
          subtitle={t('dashboard.momSubtitle')}
          icon={<AlertTriangle className="h-4 w-4" />}
          score={assessment.categoryScores.mom}
          maxScore={15}
          items={[
            { label: t('criteria.motive.label'), value: scores.motive || 0, max: 5 },
            { label: t('criteria.opportunity.label'), value: scores.opportunity || 0, max: 5 },
            { label: t('criteria.means.label'), value: scores.means || 0, max: 5 }
          ]}
          color="red"
          categoryScoreLabel={t('dashboard.categoryScore')}
          invertedLabel={t('dashboard.inverted')}
        />

        <CategoryCard
          title={t('dashboard.popAnalysis')}
          subtitle={t('dashboard.popSubtitle')}
          icon={<TrendingUp className="h-4 w-4" />}
          score={assessment.categoryScores.pop}
          maxScore={15}
          items={[
            { label: t('criteria.historicalPattern.label'), value: scores.historicalPattern || 0, max: 5 },
            { label: t('criteria.sophisticationLevel.label'), value: scores.sophisticationLevel || 0, max: 5 },
            { label: t('criteria.successRate.label'), value: scores.successRate || 0, max: 5 }
          ]}
          color="orange"
          categoryScoreLabel={t('dashboard.categoryScore')}
          invertedLabel={t('dashboard.inverted')}
        />

        <CategoryCard
          title={t('dashboard.mosesAssessment')}
          subtitle={t('dashboard.mosesSubtitle')}
          icon={<Eye className="h-4 w-4" />}
          score={assessment.categoryScores.moses}
          maxScore={10}
          items={[
            { label: t('criteria.sourceVulnerability.label'), value: scores.sourceVulnerability || 0, max: 5 },
            { label: t('criteria.manipulationEvidence.label'), value: scores.manipulationEvidence || 0, max: 5 }
          ]}
          color="yellow"
          categoryScoreLabel={t('dashboard.categoryScore')}
          invertedLabel={t('dashboard.inverted')}
        />

        <CategoryCard
          title={t('dashboard.eveEvaluation')}
          subtitle={t('dashboard.eveSubtitle')}
          icon={<Shield className="h-4 w-4" />}
          score={assessment.categoryScores.eve}
          maxScore={15}
          items={[
            { label: t('criteria.internalConsistency.label'), value: 5 - (scores.internalConsistency || 3), max: 5, inverted: true },
            { label: t('criteria.externalCorroboration.label'), value: 5 - (scores.externalCorroboration || 3), max: 5, inverted: true },
            { label: t('criteria.anomalyDetection.label'), value: scores.anomalyDetection || 0, max: 5 }
          ]}
          color="blue"
          categoryScoreLabel={t('dashboard.categoryScore')}
          invertedLabel={t('dashboard.inverted')}
        />
      </div>

      {/* Source Vulnerability Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('dashboard.riskFactorMatrix')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RiskMatrix
            scores={scores}
            assessment={assessment}
            labels={{
              motive: t('criteria.motive.label'),
              opportunity: t('criteria.opportunity.label'),
              means: t('criteria.means.label'),
              historicalPattern: t('criteria.historicalPattern.label'),
              sophistication: t('criteria.sophisticationLevel.label'),
              successRate: t('criteria.successRate.label'),
              sourceVulnerability: t('criteria.sourceVulnerability.label'),
              manipulationEvidence: t('criteria.manipulationEvidence.label'),
              anomalyDetection: t('criteria.anomalyDetection.label'),
              internalConsistency: t('criteria.internalConsistency.label'),
              externalCorroboration: t('criteria.externalCorroboration.label'),
              overallLikelihood: t('dashboard.overallLikelihoodLabel')
            }}
            legend={{
              low: t('dashboard.matrixLegend.low'),
              medium: t('dashboard.matrixLegend.medium'),
              high: t('dashboard.matrixLegend.high'),
              critical: t('dashboard.matrixLegend.critical')
            }}
          />
        </CardContent>
      </Card>

      {/* Historical Trend */}
      {showHistorical && historicalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('dashboard.historicalTrend')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.likelihoodOverTime')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HistoricalChart
              data={historicalData}
              assessmentsLabel={t('dashboard.assessments')}
              trendLabel={t('dashboard.trend')}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Circular gauge showing overall deception likelihood
 */
function DeceptionGauge({
  likelihood,
  riskLevel,
  confidenceLevel,
  t
}: {
  likelihood: number
  riskLevel: string
  confidenceLevel: string
  t: (key: string) => string
}) {
  const percentage = likelihood
  const angle = (percentage / 100) * 180 // Semicircle (0-180 degrees)

  // Calculate needle position
  const needleAngle = -90 + angle // Start from -90 (left) to 90 (right)
  const needleLength = 120
  const needleX = Math.cos((needleAngle * Math.PI) / 180) * needleLength
  const needleY = Math.sin((needleAngle * Math.PI) / 180) * needleLength

  // Risk level color
  const riskColor =
    riskLevel === 'CRITICAL' ? '#dc2626' :
    riskLevel === 'HIGH' ? '#ea580c' :
    riskLevel === 'MEDIUM' ? '#ca8a04' :
    riskLevel === 'LOW' ? '#16a34a' : '#059669'

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Gauge SVG */}
      <div className="relative w-[300px] h-[180px]">
        <svg width="300" height="180" viewBox="0 0 300 180" className="overflow-visible" style={{ display: 'block' }}>
          {/* Background arc */}
          <path
            d="M 30 150 A 120 120 0 0 1 270 150"
            fill="none"
            stroke="currentColor"
            strokeWidth="20"
            className="text-muted/20"
          />

          {/* Color segments */}
          <path
            d="M 30 150 A 120 120 0 0 1 90 56"
            fill="none"
            stroke="#16a34a"
            strokeWidth="20"
            opacity="0.6"
          />
          <path
            d="M 90 56 A 120 120 0 0 1 150 30"
            fill="none"
            stroke="#ca8a04"
            strokeWidth="20"
            opacity="0.6"
          />
          <path
            d="M 150 30 A 120 120 0 0 1 210 56"
            fill="none"
            stroke="#ea580c"
            strokeWidth="20"
            opacity="0.6"
          />
          <path
            d="M 210 56 A 120 120 0 0 1 270 150"
            fill="none"
            stroke="#dc2626"
            strokeWidth="20"
            opacity="0.6"
          />

          {/* Progress arc */}
          <path
            d={`M 30 150 A 120 120 0 ${angle > 90 ? 1 : 0} 1 ${150 + needleX} ${150 + needleY}`}
            fill="none"
            stroke={riskColor}
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Needle */}
          <g transform="translate(150, 150)">
            <line
              x1="0"
              y1="0"
              x2={needleX}
              y2={needleY}
              stroke={riskColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="0" cy="0" r="8" fill={riskColor} />
          </g>

          {/* Labels */}
          <text x="30" y="170" fontSize="12" fill="currentColor" className="text-xs opacity-60">0%</text>
          <text x="135" y="20" fontSize="12" fill="currentColor" className="text-xs opacity-60">50%</text>
          <text x="260" y="170" fontSize="12" fill="currentColor" className="text-xs opacity-60">100%</text>
        </svg>
      </div>

      {/* Metrics */}
      <div className="text-center space-y-2">
        <div className="text-5xl font-bold" style={{ color: riskColor }}>
          {likelihood}%
        </div>
        <div className="flex items-center gap-2 justify-center">
          <Badge
            variant="outline"
            className="text-sm"
            style={{ borderColor: riskColor, color: riskColor }}
          >
            {t(`riskLevels.${riskLevel.toLowerCase()}`)} {t('dashboard.riskLabel')}
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {t(`confidenceLevels.${confidenceLevel === 'VERY_HIGH' ? 'veryHigh' : confidenceLevel === 'VERY_LOW' ? 'veryLow' : confidenceLevel.toLowerCase()}`)} {t('dashboard.confidenceLabel')}
          </Badge>
        </div>
      </div>
    </div>
  )
}

/**
 * Category card with horizontal bar charts
 */
function CategoryCard({
  title,
  subtitle,
  icon,
  score,
  maxScore,
  items,
  color,
  categoryScoreLabel,
  invertedLabel
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  score: number
  maxScore: number
  items: Array<{ label: string; value: number; max: number; inverted?: boolean }>
  color: 'red' | 'orange' | 'yellow' | 'blue'
  categoryScoreLabel: string
  invertedLabel: string
}) {
  const percentage = (score / maxScore) * 100

  const colorClasses = {
    red: 'text-red-600 bg-red-500/10 border-red-500/20',
    orange: 'text-orange-600 bg-orange-500/10 border-orange-500/20',
    yellow: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20',
    blue: 'text-blue-600 bg-blue-500/10 border-blue-500/20'
  }

  const progressColors = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500'
  }

  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall category score */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{categoryScoreLabel}</span>
            <span className="font-bold">{score.toFixed(1)}/{maxScore}</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        {/* Individual items */}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  {item.label}
                  {item.inverted && <span className="ml-1 text-orange-500">{invertedLabel}</span>}
                </span>
                <span className="font-medium">{item.value}/{item.max}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColors[color]} transition-all duration-300`}
                  style={{ width: `${(item.value / item.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Risk matrix heatmap
 */
function RiskMatrix({ scores, assessment, labels, legend }: {
  scores: Partial<DeceptionScores>
  assessment: DeceptionAssessment
  labels: {
    motive: string
    opportunity: string
    means: string
    historicalPattern: string
    sophistication: string
    successRate: string
    sourceVulnerability: string
    manipulationEvidence: string
    anomalyDetection: string
    internalConsistency: string
    externalCorroboration: string
    overallLikelihood: string
  }
  legend: {
    low: string
    medium: string
    high: string
    critical: string
  }
}) {
  const matrix = [
    [
      { label: labels.motive, value: scores.motive || 0, category: 'MOM' },
      { label: labels.opportunity, value: scores.opportunity || 0, category: 'MOM' },
      { label: labels.means, value: scores.means || 0, category: 'MOM' }
    ],
    [
      { label: labels.historicalPattern, value: scores.historicalPattern || 0, category: 'POP' },
      { label: labels.sophistication, value: scores.sophisticationLevel || 0, category: 'POP' },
      { label: labels.successRate, value: scores.successRate || 0, category: 'POP' }
    ],
    [
      { label: labels.sourceVulnerability, value: scores.sourceVulnerability || 0, category: 'MOSES' },
      { label: labels.manipulationEvidence, value: scores.manipulationEvidence || 0, category: 'MOSES' },
      { label: labels.anomalyDetection, value: scores.anomalyDetection || 0, category: 'EVE' }
    ],
    [
      { label: labels.internalConsistency, value: 5 - (scores.internalConsistency || 3), category: 'EVE', inverted: true },
      { label: labels.externalCorroboration, value: 5 - (scores.externalCorroboration || 3), category: 'EVE', inverted: true },
      { label: labels.overallLikelihood, value: Math.round(assessment.overallLikelihood / 20), category: 'ALL' }
    ]
  ]

  return (
    <div className="space-y-1">
      {matrix.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1">
          {row.map((cell, cellIdx) => {
            const intensity = cell.value / 5
            const bgColor =
              intensity >= 0.8 ? 'bg-red-500' :
              intensity >= 0.6 ? 'bg-orange-500' :
              intensity >= 0.4 ? 'bg-yellow-500' :
              intensity >= 0.2 ? 'bg-green-500' : 'bg-green-600'

            const textColor = intensity >= 0.4 ? 'text-white' : 'text-gray-900'

            return (
              <div
                key={cellIdx}
                className={`flex-1 p-3 rounded text-center transition-all duration-300 ${bgColor} ${textColor}`}
                style={{ opacity: 0.3 + (intensity * 0.7) }}
              >
                <div className="text-xs font-medium mb-1">{cell.label}</div>
                <div className="text-lg font-bold">
                  {cell.inverted && <span className="text-xs">~</span>}
                  {cell.value}
                  {cell.category === 'ALL' && <span className="text-xs">★</span>}
                </div>
                <div className="text-xs opacity-75">{cell.category}</div>
              </div>
            )
          })}
        </div>
      ))}

      <div className="flex gap-2 mt-4 text-xs text-muted-foreground justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-600 rounded"></div>
          <span>{legend.low}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>{legend.medium}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span>{legend.high}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>{legend.critical}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Historical trend line chart
 */
function HistoricalChart({ data, assessmentsLabel, trendLabel }: {
  data: Array<{ timestamp: string; likelihood: number }>
  assessmentsLabel: string
  trendLabel: string
}) {
  const maxValue = 100
  const width = 600
  const height = 200
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate points
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + chartHeight - (d.likelihood / maxValue) * chartHeight,
    value: d.likelihood,
    timestamp: d.timestamp
  }))

  // Create path
  const pathData = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ')

  // Trend direction
  const trend = data.length >= 2
    ? data[data.length - 1].likelihood - data[0].likelihood
    : 0

  const TrendIcon = trend > 5 ? TrendingUp : trend < -5 ? TrendingDown : Minus
  const trendColor = trend > 5 ? 'text-red-500' : trend < -5 ? 'text-green-500' : 'text-gray-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {data.length} {assessmentsLabel}
        </div>
        <div className={`flex items-center gap-2 ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {trend > 0 && '+'}
            {trend.toFixed(1)}% {trendLabel}
          </span>
        </div>
      </div>

      <svg width={width} height={height} className="w-full">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(value => {
          const y = padding.top + chartHeight - (value / maxValue) * chartHeight
          return (
            <g key={value}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-muted/20"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                fontSize="10"
                fill="currentColor"
                className="text-muted-foreground"
                textAnchor="end"
              >
                {value}%
              </text>
            </g>
          )
        })}

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
        />

        {/* Area fill */}
        <path
          d={`${pathData} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`}
          fill="currentColor"
          className="text-primary/10"
        />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="currentColor"
              className="text-primary"
            />
            {/* Tooltip on hover would go here */}
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => {
          if (i % Math.ceil(points.length / 5) === 0 || i === points.length - 1) {
            return (
              <text
                key={i}
                x={p.x}
                y={height - 10}
                fontSize="10"
                fill="currentColor"
                className="text-muted-foreground"
                textAnchor="middle"
              >
                {new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            )
          }
          return null
        })}
      </svg>
    </div>
  )
}
