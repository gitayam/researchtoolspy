import { X, ExternalLink, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Evidence } from '@/types/evidence'

interface EvidenceBadgeProps {
  evidence: Evidence
  onRemove?: () => void
  onView?: () => void
  showDetails?: boolean
}

export function EvidenceBadge({
  evidence,
  onRemove,
  onView,
  showDetails = false
}: EvidenceBadgeProps) {
  const getCredibilityColor = (credibility?: string) => {
    if (!credibility) return 'bg-gray-100 dark:bg-gray-800'
    const level = parseInt(credibility)
    if (level <= 2) return 'bg-green-100 dark:bg-green-900/30 border-green-500'
    if (level <= 4) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500'
    return 'bg-red-100 dark:bg-red-900/30 border-red-500'
  }

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg border
        ${getCredibilityColor(evidence.source.credibility)}
        transition-all hover:shadow-md
      `}
    >
      <FileText className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{evidence.title}</div>
        {showDetails && evidence.source.name && (
          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {evidence.source.name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {evidence.source.credibility && (
          <Badge variant="secondary" className="text-xs">
            C:{evidence.source.credibility}
          </Badge>
        )}
        {onView && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-red-100 dark:hover:bg-red-900/30"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
