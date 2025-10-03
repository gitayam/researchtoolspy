/**
 * Deception Detection Visual Dashboard
 * Real-time visualization of deception analysis with charts, gauges, and heatmaps
 * CIA SATS MOM-POP-MOSES-EVE Framework
 */

import { useMemo } from 'react'
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
            Overall Deception Likelihood
          </CardTitle>
          <CardDescription>
            Based on MOM-POP-MOSES-EVE analysis framework
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeceptionGauge
            likelihood={assessment.overallLikelihood}
            riskLevel={assessment.riskLevel}
            confidenceLevel={assessment.confidenceLevel}
          />
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryCard
          title="MOM Risk Indicators"
          subtitle="Motive, Opportunity, Means"
          icon={<AlertTriangle className="h-4 w-4" />}
          score={assessment.categoryScores.mom}
          maxScore={15}
          items={[
            { label: 'Motive', value: scores.motive || 0, max: 5 },
            { label: 'Opportunity', value: scores.opportunity || 0, max: 5 },
            { label: 'Means', value: scores.means || 0, max: 5 }
          ]}
          color="red"
        />

        <CategoryCard
          title="POP Analysis"
          subtitle="Patterns of Practice"
          icon={<TrendingUp className="h-4 w-4" />}
          score={assessment.categoryScores.pop}
          maxScore={15}
          items={[
            { label: 'Historical Pattern', value: scores.historicalPattern || 0, max: 5 },
            { label: 'Sophistication', value: scores.sophisticationLevel || 0, max: 5 },
            { label: 'Success Rate', value: scores.successRate || 0, max: 5 }
          ]}
          color="orange"
        />

        <CategoryCard
          title="MOSES Assessment"
          subtitle="My Own Sources Evaluation"
          icon={<Eye className="h-4 w-4" />}
          score={assessment.categoryScores.moses}
          maxScore={10}
          items={[
            { label: 'Source Vulnerability', value: scores.sourceVulnerability || 0, max: 5 },
            { label: 'Manipulation Evidence', value: scores.manipulationEvidence || 0, max: 5 }
          ]}
          color="yellow"
        />

        <CategoryCard
          title="EVE Evaluation"
          subtitle="Evidence Quality Assessment"
          icon={<Shield className="h-4 w-4" />}
          score={assessment.categoryScores.eve}
          maxScore={15}
          items={[
            { label: 'Internal Consistency', value: 5 - (scores.internalConsistency || 3), max: 5, inverted: true },
            { label: 'External Corroboration', value: 5 - (scores.externalCorroboration || 3), max: 5, inverted: true },
            { label: 'Anomaly Detection', value: scores.anomalyDetection || 0, max: 5 }
          ]}
          color="blue"
        />
      </div>

      {/* Source Vulnerability Radar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Risk Factor Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RiskMatrix scores={scores} assessment={assessment} />
        </CardContent>
      </Card>

      {/* Historical Trend */}
      {showHistorical && historicalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Historical Trend Analysis
            </CardTitle>
            <CardDescription>
              Deception likelihood over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HistoricalChart data={historicalData} />
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
  confidenceLevel
}: {
  likelihood: number
  riskLevel: string
  confidenceLevel: string
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
      <div className="relative">
        <svg width="300" height="180" viewBox="0 0 300 180" className="overflow-visible">
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
            {riskLevel.replace('_', ' ')} RISK
          </Badge>
          <Badge variant="secondary" className="text-sm">
            {confidenceLevel.replace('_', ' ')} CONFIDENCE
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
  color
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  score: number
  maxScore: number
  items: Array<{ label: string; value: number; max: number; inverted?: boolean }>
  color: 'red' | 'orange' | 'yellow' | 'blue'
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
            <span className="font-medium">Category Score</span>
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
                  {item.inverted && <span className="ml-1 text-orange-500">(inverted)</span>}
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
function RiskMatrix({ scores, assessment }: { scores: Partial<DeceptionScores>; assessment: DeceptionAssessment }) {
  const matrix = [
    [
      { label: 'Motive', value: scores.motive || 0, category: 'MOM' },
      { label: 'Opportunity', value: scores.opportunity || 0, category: 'MOM' },
      { label: 'Means', value: scores.means || 0, category: 'MOM' }
    ],
    [
      { label: 'Historical Pattern', value: scores.historicalPattern || 0, category: 'POP' },
      { label: 'Sophistication', value: scores.sophisticationLevel || 0, category: 'POP' },
      { label: 'Success Rate', value: scores.successRate || 0, category: 'POP' }
    ],
    [
      { label: 'Source Vulnerability', value: scores.sourceVulnerability || 0, category: 'MOSES' },
      { label: 'Manipulation Evidence', value: scores.manipulationEvidence || 0, category: 'MOSES' },
      { label: 'Anomaly Detection', value: scores.anomalyDetection || 0, category: 'EVE' }
    ],
    [
      { label: 'Internal Consistency', value: 5 - (scores.internalConsistency || 3), category: 'EVE', inverted: true },
      { label: 'External Corroboration', value: 5 - (scores.externalCorroboration || 3), category: 'EVE', inverted: true },
      { label: 'Overall Likelihood', value: Math.round(assessment.overallLikelihood / 20), category: 'ALL' }
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
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span>High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Critical</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Historical trend line chart
 */
function HistoricalChart({ data }: { data: Array<{ timestamp: string; likelihood: number }> }) {
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
          {data.length} assessments
        </div>
        <div className={`flex items-center gap-2 ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {trend > 0 && '+'}
            {trend.toFixed(1)}% trend
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
