import { Link2, FileText, Users, Database, Calendar, AlertTriangle, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { LinkedEvidence } from './EvidenceLinker'

interface EvidenceBadgeProps {
  linkedEvidence: LinkedEvidence[]
  onClick?: () => void
  showBreakdown?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function EvidenceBadge({
  linkedEvidence,
  onClick,
  showBreakdown = false,
  size = 'md'
}: EvidenceBadgeProps) {
  const count = linkedEvidence.length

  if (count === 0) {
    return null
  }

  // Calculate risk level across all evidence
  const getRiskLevel = (): 'low' | 'medium' | 'high' | 'critical' => {
    let totalRisk = 0
    let riskCount = 0

    linkedEvidence.forEach(link => {
      const item = link.entity_data as any

      // EVE assessment risk (Data)
      if (item.eve_assessment?.overall_risk) {
        const riskMap = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }
        totalRisk += riskMap[item.eve_assessment.overall_risk] || 0
        riskCount++
      }

      // MOM-POP risk (Actors)
      if (item.deception_profile?.mom) {
        const { motive, opportunity, means } = item.deception_profile.mom
        const avg = ((motive || 0) + (opportunity || 0) + (means || 0)) / 3
        totalRisk += avg >= 4 ? 4 : avg >= 3 ? 3 : avg >= 1.5 ? 2 : 1
        riskCount++
      }

      // MOSES reliability (Sources) - inverted
      if (item.moses_assessment?.reliability) {
        const relMap = { A: 1, B: 1, C: 2, D: 3, E: 4, F: 2 }
        totalRisk += relMap[item.moses_assessment.reliability] || 2
        riskCount++
      }
    })

    if (riskCount === 0) return 'low'

    const avgRisk = totalRisk / riskCount
    if (avgRisk >= 3.5) return 'critical'
    if (avgRisk >= 2.5) return 'high'
    if (avgRisk >= 1.5) return 'medium'
    return 'low'
  }

  // Count by entity type
  const breakdown = {
    data: linkedEvidence.filter(e => e.entity_type === 'data').length,
    actor: linkedEvidence.filter(e => e.entity_type === 'actor').length,
    source: linkedEvidence.filter(e => e.entity_type === 'source').length,
    event: linkedEvidence.filter(e => e.entity_type === 'event').length,
  }

  const riskLevel = getRiskLevel()

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
    }
  }

  const getRiskIcon = () => {
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return <AlertTriangle className="h-3 w-3" />
    }
    return <CheckCircle className="h-3 w-3" />
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const renderTooltipContent = () => (
    <div className="space-y-2 min-w-[200px]">
      <div className="font-semibold border-b pb-1">
        Linked Evidence ({count})
      </div>

      {breakdown.data > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          <span>{breakdown.data} Data item{breakdown.data !== 1 ? 's' : ''}</span>
        </div>
      )}

      {breakdown.actor > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          <span>{breakdown.actor} Actor{breakdown.actor !== 1 ? 's' : ''}</span>
        </div>
      )}

      {breakdown.source > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" />
          <span>{breakdown.source} Source{breakdown.source !== 1 ? 's' : ''}</span>
        </div>
      )}

      {breakdown.event > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          <span>{breakdown.event} Event{breakdown.event !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm pt-2 border-t">
        {getRiskIcon()}
        <span>Risk Level: <strong className="capitalize">{riskLevel}</strong></span>
      </div>

      {onClick && (
        <div className="text-xs text-gray-500 pt-1">
          Click to manage evidence
        </div>
      )}
    </div>
  )

  const BadgeContent = (
    <Badge
      className={`${getRiskColor()} ${sizeClasses[size]} flex items-center gap-1.5 border ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <Link2 className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      <span className="font-semibold">{count}</span>
      {showBreakdown && (
        <>
          <span className="text-xs opacity-75">|</span>
          {breakdown.data > 0 && <FileText className="h-3 w-3 opacity-75" />}
          {breakdown.actor > 0 && <Users className="h-3 w-3 opacity-75" />}
          {breakdown.source > 0 && <Database className="h-3 w-3 opacity-75" />}
          {breakdown.event > 0 && <Calendar className="h-3 w-3 opacity-75" />}
        </>
      )}
    </Badge>
  )

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {BadgeContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {renderTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for inline display
export function EvidenceCount({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count === 0) return null

  return (
    <Badge
      variant="outline"
      className={`text-xs ${onClick ? 'cursor-pointer hover:bg-gray-100' : ''}`}
      onClick={onClick}
    >
      <Link2 className="h-3 w-3 mr-1" />
      {count}
    </Badge>
  )
}
