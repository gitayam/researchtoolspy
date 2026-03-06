import { type ReactNode, useState, useCallback } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Props ────────────────────────────────────────────────────────

interface CopPanelExpanderProps {
  title: string
  icon: ReactNode
  badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  children: (expanded: boolean) => ReactNode
  className?: string
  collapsedHeight?: string
  defaultHidden?: boolean
}

// ── Component ────────────────────────────────────────────────────

export default function CopPanelExpander({
  title,
  icon,
  badge,
  badgeVariant = 'secondary',
  children,
  className,
  collapsedHeight = 'h-[320px]',
  defaultHidden = false,
}: CopPanelExpanderProps) {
  const [expanded, setExpanded] = useState(false)
  const [hidden, setHidden] = useState(defaultHidden)

  const handleExpand = useCallback(() => setExpanded(true), [])
  const handleCollapse = useCallback(() => setExpanded(false), [])

  if (hidden) return null

  // ── Expanded: full-screen overlay ────────────────────────────

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <span className="shrink-0">{icon}</span>
          <span className="font-semibold text-sm flex-1">{title}</span>
          {badge != null && (
            <Badge variant={badgeVariant}>{badge}</Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCollapse}
            aria-label="Minimize panel"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCollapse}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children(true)}
        </div>
      </div>
    )
  }

  // ── Collapsed: compact card ──────────────────────────────────

  return (
    <Card className={cn('overflow-hidden flex flex-col', collapsedHeight, className)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 px-4 py-3">
        <span className="shrink-0">{icon}</span>
        <CardTitle className="text-sm flex-1">{title}</CardTitle>
        {badge != null && (
          <Badge variant={badgeVariant}>{badge}</Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleExpand}
          aria-label="Expand panel"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-4 pb-4 pt-0">
        {children(false)}
      </CardContent>
    </Card>
  )
}
