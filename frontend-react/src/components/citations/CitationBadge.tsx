import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CitationBadgeProps {
  citationId?: string
  sourceTitle?: string
  sourceDate?: string
  sourceAuthor?: string
  sourceUrl?: string
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}

export function CitationBadge({
  citationId,
  sourceTitle,
  sourceDate,
  sourceAuthor,
  sourceUrl,
  onClick,
  size = 'sm'
}: CitationBadgeProps) {
  // Don't render if no citation
  if (!citationId) {
    return null
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const renderTooltipContent = () => (
    <div className="space-y-2 min-w-[250px] max-w-[400px]">
      <div className="font-semibold border-b pb-1">
        Source Citation
      </div>

      {sourceTitle && (
        <div className="text-sm">
          <span className="font-medium">Title:</span>
          <div className="text-gray-700 dark:text-gray-300 mt-0.5">{sourceTitle}</div>
        </div>
      )}

      {sourceAuthor && (
        <div className="text-sm">
          <span className="font-medium">Author:</span> {sourceAuthor}
        </div>
      )}

      {sourceDate && (
        <div className="text-sm">
          <span className="font-medium">Date:</span> {sourceDate}
        </div>
      )}

      {sourceUrl && (
        <div className="text-sm">
          <span className="font-medium">URL:</span>
          <div className="text-blue-600 dark:text-blue-400 truncate mt-0.5 text-xs">{sourceUrl}</div>
        </div>
      )}

      {onClick && (
        <div className="text-xs text-gray-500 pt-2 border-t">
          Click to view/edit citation
        </div>
      )}
    </div>
  )

  const BadgeContent = (
    <Badge
      variant="outline"
      className={`${sizeClasses[size]} flex items-center gap-1 border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <BookOpen className={iconSizes[size]} />
      <span className="font-medium">Source</span>
    </Badge>
  )

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {BadgeContent}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md">
          {renderTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
