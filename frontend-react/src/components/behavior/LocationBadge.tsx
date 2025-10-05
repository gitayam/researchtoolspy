import { Badge } from '@/components/ui/badge'
import { MapPin, Globe } from 'lucide-react'
import type { LocationContext } from '@/types/behavior'

interface LocationBadgeProps {
  locationContext: LocationContext
  variant?: 'default' | 'outline' | 'secondary'
  showIcon?: boolean
  className?: string
}

export function LocationBadge({
  locationContext,
  variant = 'secondary',
  showIcon = true,
  className = ''
}: LocationBadgeProps) {
  const { geographic_scope, specific_locations } = locationContext

  const scopeIcons: Record<string, string> = {
    local: '📍',
    regional: '🗺️',
    national: '🏛️',
    international: '🌍',
    global: '🌐'
  }

  const scopeLabels: Record<string, string> = {
    local: 'Local',
    regional: 'Regional',
    national: 'National',
    international: 'International',
    global: 'Global'
  }

  const locationText = specific_locations && specific_locations.length > 0
    ? specific_locations.slice(0, 2).join(', ') + (specific_locations.length > 2 ? '...' : '')
    : scopeLabels[geographic_scope]

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showIcon && (
        <span className="text-base">{scopeIcons[geographic_scope]}</span>
      )}
      <Badge variant={variant} className="gap-1">
        <MapPin className="h-3 w-3" />
        {locationText}
      </Badge>
      <Badge variant="outline" className="text-xs">
        {scopeLabels[geographic_scope]}
      </Badge>
    </div>
  )
}
