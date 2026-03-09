/**
 * EntityCard -- Generic entity card for Actor, Event, Place, Source, or Behavior.
 *
 * Renders collapsed summary (name, type badge, subtitle, confidence, counts, actions)
 * and expanded detail (description, type-specific fields, placeholder slots).
 * Used inside CopEntityDrawer.
 */

import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Link2,
  FileText,
  Edit2,
  User,
  Building2,
  Shield,
  Users,
  Calendar,
  Radio,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import ConfidenceDots from '@/components/cop/entities/ConfidenceDots'
import type { Actor, Event, Place, Source, Behavior } from '@/types/entities'

// ── Types ────────────────────────────────────────────────────────

type EntityTypeKey = 'actors' | 'events' | 'places' | 'sources' | 'behaviors'

interface EntityCardProps {
  entity: Actor | Event | Place | Source | Behavior
  entityType: EntityTypeKey
  expanded: boolean
  onToggleExpand: () => void
  onPinToMap?: () => void
  onEdit?: () => void
  onLinkEvidence?: () => void
  onAddRelationship?: () => void
  relCount?: number
  evidenceCount?: number
}

// ── Helpers ──────────────────────────────────────────────────────

const ACTOR_ICONS: Record<string, typeof User> = {
  PERSON: User,
  ORGANIZATION: Building2,
  UNIT: Shield,
  GOVERNMENT: Shield,
  GROUP: Users,
  OTHER: User,
}

function getEntityIcon(entityType: EntityTypeKey, entity: Actor | Event | Place | Source | Behavior) {
  if (entityType === 'actors') return ACTOR_ICONS[(entity as Actor).type] ?? User
  if (entityType === 'events') return Calendar
  if (entityType === 'places') return MapPin
  if (entityType === 'sources') return Radio
  if (entityType === 'behaviors') return Zap
  return User
}

function getTypeBadgeLabel(entityType: EntityTypeKey, entity: Actor | Event | Place | Source | Behavior): string {
  if (entityType === 'actors') return (entity as Actor).type ?? 'ACTOR'
  if (entityType === 'events') return (entity as Event).event_type ?? 'EVENT'
  if (entityType === 'places') return (entity as Place).place_type ?? 'PLACE'
  if (entityType === 'sources') return (entity as Source).type ?? 'SOURCE'
  if (entityType === 'behaviors') return (entity as Behavior).behavior_type ?? 'BEHAVIOR'
  return 'ENTITY'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const SIGNIFICANCE_COLORS: Record<string, string> = {
  CRITICAL: 'border-red-500/50 text-red-400',
  HIGH: 'border-orange-500/50 text-orange-400',
  MEDIUM: 'border-amber-500/50 text-amber-400',
  LOW: 'border-gray-500/50 text-gray-400',
}

// ── Subtitle renderers ───────────────────────────────────────────

function ActorSubtitle({ entity }: { entity: Actor }) {
  const parts = [entity.category, entity.affiliation].filter(Boolean)
  if (parts.length === 0) return null
  return <span>{parts.join(' \u00b7 ')}</span>
}

function EventSubtitle({ entity }: { entity: Event }) {
  return (
    <span className="flex items-center gap-1.5">
      {entity.date_start && <span>{formatDate(entity.date_start)}</span>}
      {entity.significance && (
        <Badge
          variant="outline"
          className={cn('text-[9px] px-1 py-0 leading-tight', SIGNIFICANCE_COLORS[entity.significance])}
        >
          {entity.significance}
        </Badge>
      )}
    </span>
  )
}

function PlaceSubtitle({ entity }: { entity: Place }) {
  const parts = [entity.country, entity.region].filter(Boolean)
  if (parts.length === 0) return null
  return <span>{parts.join(' \u00b7 ')}</span>
}

function SourceSubtitle({ entity }: { entity: Source }) {
  return (
    <span className="flex items-center gap-1.5">
      {entity.source_type && <span>{entity.source_type}</span>}
      {entity.moses_assessment?.reliability && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight border-blue-500/50 text-blue-400">
          {entity.moses_assessment.reliability}
        </Badge>
      )}
    </span>
  )
}

function BehaviorSubtitle({ entity }: { entity: Behavior }) {
  const parts = [
    entity.frequency?.toLowerCase().replace('_', ' '),
    entity.sophistication?.toLowerCase(),
  ].filter(Boolean)
  if (parts.length === 0) return null
  return <span className="capitalize">{parts.join(' \u00b7 ')}</span>
}

// ── MOM Score Bars (small inline bars for deception_profile) ─────

function MomBars({ mom }: { mom: { motive: number; opportunity: number; means: number } }) {
  const bars = [
    { label: 'M', value: mom.motive },
    { label: 'O', value: mom.opportunity },
    { label: 'M', value: mom.means },
  ]
  return (
    <div className="flex items-center gap-2">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium w-3">{b.label}</span>
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                b.value >= 4 ? 'bg-red-500' : b.value >= 2 ? 'bg-amber-500' : 'bg-green-500',
              )}
              style={{ width: `${(b.value / 5) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-500 dark:text-gray-400">{b.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Expanded detail renderers ────────────────────────────────────

function ActorDetail({ entity }: { entity: Actor }) {
  return (
    <div className="space-y-2">
      {entity.aliases?.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aliases</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {entity.aliases.map((a, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {entity.role && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</span>
          <p className="text-xs text-gray-700 dark:text-gray-300">{entity.role}</p>
        </div>
      )}
      {entity.affiliation && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Affiliation</span>
          <p className="text-xs text-gray-700 dark:text-gray-300">{entity.affiliation}</p>
        </div>
      )}
      {entity.deception_profile?.mom && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Deception Profile (MOM)
          </span>
          <div className="mt-1">
            <MomBars mom={entity.deception_profile.mom} />
          </div>
        </div>
      )}
    </div>
  )
}

function EventDetail({ entity }: { entity: Event }) {
  return (
    <div className="space-y-2">
      {(entity.date_start || entity.date_end) && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Range</span>
          <p className="text-xs text-gray-700 dark:text-gray-300">
            {formatDate(entity.date_start)}
            {entity.date_end && ` \u2014 ${formatDate(entity.date_end)}`}
          </p>
        </div>
      )}
      {entity.significance && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Significance</span>
          <p className="text-xs text-gray-700 dark:text-gray-300">{entity.significance}</p>
        </div>
      )}
    </div>
  )
}

function PlaceDetail({ entity }: { entity: Place }) {
  return (
    <div className="space-y-2">
      {entity.coordinates && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Coordinates</span>
          <p className="text-xs text-gray-700 dark:text-gray-300 font-mono">
            {entity.coordinates.lat.toFixed(4)}, {entity.coordinates.lng.toFixed(4)}
          </p>
        </div>
      )}
      {entity.strategic_importance && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Strategic Importance
          </span>
          <Badge
            variant="outline"
            className={cn('text-[10px] ml-1', SIGNIFICANCE_COLORS[entity.strategic_importance])}
          >
            {entity.strategic_importance}
          </Badge>
        </div>
      )}
      {entity.controlled_by && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Controlled By
          </span>
          <p className="text-xs text-gray-700 dark:text-gray-300">{entity.controlled_by}</p>
        </div>
      )}
    </div>
  )
}

function SourceDetail({ entity }: { entity: Source }) {
  const moses = entity.moses_assessment
  return (
    <div className="space-y-2">
      {moses && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            MOSES Assessment
          </span>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-20">Reliability</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/50 text-blue-400">
                Grade {moses.reliability}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-20">Vulnerability</span>
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    moses.source_vulnerability >= 4
                      ? 'bg-red-500'
                      : moses.source_vulnerability >= 2
                        ? 'bg-amber-500'
                        : 'bg-green-500',
                  )}
                  style={{ width: `${(moses.source_vulnerability / 5) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500">{moses.source_vulnerability}/5</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-20">Access</span>
              <span className="text-[10px] text-gray-700 dark:text-gray-300">{moses.access_level}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BehaviorDetail({ entity }: { entity: Behavior }) {
  return (
    <div className="space-y-2">
      {entity.indicators?.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Indicators</span>
          <ul className="mt-0.5 space-y-0.5">
            {entity.indicators.map((ind, i) => (
              <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1">
                <span className="text-gray-400 mt-0.5 shrink-0">&bull;</span>
                <span>{ind}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {entity.effectiveness && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Effectiveness</span>
          <p className="text-xs text-gray-700 dark:text-gray-300 capitalize">
            {entity.effectiveness.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
      )}
      {(entity.first_observed || entity.last_observed) && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Observed</span>
          <p className="text-xs text-gray-700 dark:text-gray-300">
            {entity.first_observed && `First: ${formatDate(entity.first_observed)}`}
            {entity.first_observed && entity.last_observed && ' \u00b7 '}
            {entity.last_observed && `Last: ${formatDate(entity.last_observed)}`}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export default function EntityCard({
  entity,
  entityType,
  expanded,
  onToggleExpand,
  onPinToMap,
  onEdit,
  onLinkEvidence,
  onAddRelationship,
  relCount = 0,
  evidenceCount = 0,
}: EntityCardProps) {
  const Icon = getEntityIcon(entityType, entity)
  const badgeLabel = getTypeBadgeLabel(entityType, entity)

  // Confidence level (events have it directly)
  const confidence = entityType === 'events' ? (entity as Event).confidence : undefined

  return (
    <div
      className={cn(
        'bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg',
        'hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors duration-200',
        expanded && 'ring-1 ring-blue-500/30',
      )}
    >
      {/* ── Collapsed header (always visible) ── */}
      <div
        className="p-3 cursor-pointer select-none"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpand()
          }
        }}
      >
        {/* Row 1: Name + type badge + chevron */}
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate flex-1">
            {entity.name}
          </span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {badgeLabel}
          </Badge>
          <div className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            )}
          </div>
        </div>

        {/* Row 2: Type-specific subtitle */}
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 pl-5.5">
          {entityType === 'actors' && <ActorSubtitle entity={entity as Actor} />}
          {entityType === 'events' && <EventSubtitle entity={entity as Event} />}
          {entityType === 'places' && <PlaceSubtitle entity={entity as Place} />}
          {entityType === 'sources' && <SourceSubtitle entity={entity as Source} />}
          {entityType === 'behaviors' && <BehaviorSubtitle entity={entity as Behavior} />}
        </div>

        {/* Row 3: Confidence dots (events only) */}
        {confidence && (
          <div className="mt-1.5 pl-5.5">
            <ConfidenceDots level={confidence} showLabel={true} className="text-[10px]" />
          </div>
        )}

        {/* Row 4: Counts + action buttons */}
        <div className="mt-2 flex items-center justify-between pl-5.5">
          <span className="text-[10px] text-gray-500 dark:text-gray-500">
            {relCount} relationship{relCount !== 1 ? 's' : ''} &middot; {evidenceCount} evidence
          </span>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {onPinToMap && (
              <button
                type="button"
                onClick={onPinToMap}
                className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Pin to map"
              >
                <MapPin className="h-3.5 w-3.5" />
              </button>
            )}
            {onAddRelationship && (
              <button
                type="button"
                onClick={onAddRelationship}
                className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Add relationship"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            )}
            {onLinkEvidence && (
              <button
                type="button"
                onClick={onLinkEvidence}
                className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Link evidence"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="h-7 w-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title="Edit entity"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3 space-y-3">
          {/* Description */}
          {entity.description && (
            <div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Description
              </span>
              <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed whitespace-pre-wrap">
                {entity.description}
              </p>
            </div>
          )}

          {/* Type-specific details */}
          {entityType === 'actors' && <ActorDetail entity={entity as Actor} />}
          {entityType === 'events' && <EventDetail entity={entity as Event} />}
          {entityType === 'places' && <PlaceDetail entity={entity as Place} />}
          {entityType === 'sources' && <SourceDetail entity={entity as Source} />}
          {entityType === 'behaviors' && <BehaviorDetail entity={entity as Behavior} />}

          {/* Placeholder slots for parent drawer to populate */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
            <h4 className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Relationships
            </h4>
            <div data-slot="entity-relationships" className="min-h-[24px]" />
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
            <h4 className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Evidence Links
            </h4>
            <div data-slot="entity-evidence-links" className="min-h-[24px]" />
          </div>
        </div>
      )}
    </div>
  )
}
