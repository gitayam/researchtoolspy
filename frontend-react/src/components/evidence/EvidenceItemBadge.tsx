import { X, FileText, Users, Database, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LinkedEvidence } from '@/types/framework-evidence'

interface EvidenceItemBadgeProps {
  evidence: LinkedEvidence
  onRemove?: () => void
  showDetails?: boolean
}

export function EvidenceItemBadge({
  evidence,
  onRemove,
  showDetails = true
}: EvidenceItemBadgeProps) {
  const getIcon = () => {
    switch (evidence.entity_type) {
      case 'data':
        return <FileText className="h-3 w-3" />
      case 'actor':
        return <Users className="h-3 w-3" />
      case 'source':
        return <Database className="h-3 w-3" />
      case 'event':
        return <Calendar className="h-3 w-3" />
    }
  }

  const getTypeLabel = () => {
    const labels = {
      data: 'Data',
      actor: 'Actor',
      source: 'Source',
      event: 'Event'
    }
    return labels[evidence.entity_type]
  }

  const getTitle = () => {
    const data = evidence.entity_data as any
    if (data.title) return data.title
    if (data.name) return data.name
    if (data.text && data.text.length > 0) return data.text.substring(0, 50) + (data.text.length > 50 ? '...' : '')
    return `${getTypeLabel()} #${evidence.entity_id}`
  }

  const getTypeColor = () => {
    switch (evidence.entity_type) {
      case 'data':
        return 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
      case 'actor':
        return 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
      case 'source':
        return 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
      case 'event':
        return 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
    }
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${getTypeColor()}`}>
      <div className="flex items-center gap-1.5">
        {getIcon()}
        <span className="text-xs font-medium">{getTypeLabel()}</span>
      </div>

      {showDetails && (
        <>
          <span className="text-xs opacity-50">•</span>
          <span className="text-xs max-w-[150px] truncate" title={getTitle()}>
            {getTitle()}
          </span>
        </>
      )}

      {evidence.relation && (
        <>
          <span className="text-xs opacity-50">•</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
            {evidence.relation}
          </Badge>
        </>
      )}

      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
