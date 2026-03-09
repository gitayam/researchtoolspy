/**
 * EntityRelationships — displays existing relationships for an entity
 * and provides an inline form to create new ones.
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EntitySearch } from './EntitySearch'
import ConfidenceDots from './ConfidenceDots'
import type { Relationship, RelationshipType, RelationshipConfidence, EntityType } from '@/types/entities'

interface EntityRelationshipsProps {
  entityId: string
  entityType: string // 'ACTOR', 'EVENT', 'PLACE', 'SOURCE', 'BEHAVIOR'
  sessionId: string  // workspace_id
  onRelationshipCreated?: () => void
}

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'CONTROLS', 'REPORTS_TO', 'ALLIED_WITH', 'ADVERSARY_OF', 'MEMBER_OF',
  'LOCATED_AT', 'PARTICIPATED_IN', 'PROVIDED_BY', 'EXHIBITS',
  'CORROBORATES', 'CONTRADICTS', 'CUSTOM',
]

const CONFIDENCE_OPTIONS: RelationshipConfidence[] = [
  'CONFIRMED', 'PROBABLE', 'POSSIBLE', 'SUSPECTED',
]

const TYPE_BADGE_COLORS: Record<string, string> = {
  CONTROLS:        'border-purple-400 text-purple-600 dark:border-purple-500 dark:text-purple-400',
  REPORTS_TO:      'border-purple-400 text-purple-600 dark:border-purple-500 dark:text-purple-400',
  ALLIED_WITH:     'border-blue-400 text-blue-600 dark:border-blue-500 dark:text-blue-400',
  MEMBER_OF:       'border-blue-400 text-blue-600 dark:border-blue-500 dark:text-blue-400',
  ADVERSARY_OF:    'border-red-400 text-red-600 dark:border-red-500 dark:text-red-400',
  LOCATED_AT:      'border-green-400 text-green-600 dark:border-green-500 dark:text-green-400',
  PARTICIPATED_IN: 'border-amber-400 text-amber-600 dark:border-amber-500 dark:text-amber-400',
  CORROBORATES:    'border-gray-400 text-gray-600 dark:border-gray-500 dark:text-gray-400',
  CONTRADICTS:     'border-gray-400 text-gray-600 dark:border-gray-500 dark:text-gray-400',
  PROVIDED_BY:     'border-gray-400 text-gray-600 dark:border-gray-500 dark:text-gray-400',
}

const DEFAULT_BADGE_COLOR = 'border-gray-400 text-gray-600 dark:border-gray-500 dark:text-gray-400'

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

function resolveTargetName(rel: Relationship, entityId: string): string {
  // The API may return joined entity names — check common patterns
  const raw = rel as unknown as Record<string, unknown>
  const isOutgoing = rel.source_entity_id === entityId
  if (isOutgoing) {
    return (raw.target_entity_name as string)
      || (raw.target_name as string)
      || rel.target_entity_id
  }
  return (raw.source_entity_name as string)
    || (raw.source_name as string)
    || rel.source_entity_id
}

export default function EntityRelationships({
  entityId,
  entityType,
  sessionId,
  onRelationshipCreated,
}: EntityRelationshipsProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<{
    id: string; type: string; name: string
  } | null>(null)
  const [selectedType, setSelectedType] = useState<RelationshipType>('ALLIED_WITH')
  const [selectedConfidence, setSelectedConfidence] = useState<RelationshipConfidence>('PROBABLE')

  const fetchRelationships = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        entity_id: entityId,
        workspace_id: sessionId,
      })
      const response = await fetch(`/api/relationships?${params}`, {
        headers: getHeaders(),
      })
      if (!response.ok) throw new Error('Failed to load relationships')

      const data = await response.json()
      const rels: Relationship[] = data.relationships || data || []
      setRelationships(rels)
    } catch (err) {
      console.error('Failed to fetch relationships:', err)
      setError('Could not load relationships')
    } finally {
      setLoading(false)
    }
  }, [entityId, sessionId])

  useEffect(() => {
    fetchRelationships()
  }, [fetchRelationships])

  const handleSubmit = async () => {
    if (!selectedTarget) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/relationships', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          source_entity_id: entityId,
          source_entity_type: entityType as EntityType,
          target_entity_id: selectedTarget.id,
          target_entity_type: selectedTarget.type.toUpperCase() as EntityType,
          relationship_type: selectedType,
          confidence: selectedConfidence,
          workspace_id: sessionId,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.error || 'Failed to create relationship')
      }

      // Reset form and refresh
      setSelectedTarget(null)
      setSelectedType('ALLIED_WITH')
      setSelectedConfidence('PROBABLE')
      setShowForm(false)
      await fetchRelationships()
      onRelationshipCreated?.()
    } catch (err) {
      console.error('Failed to create relationship:', err)
      setError(err instanceof Error ? err.message : 'Failed to create relationship')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setSelectedTarget(null)
    setSelectedType('ALLIED_WITH')
    setSelectedConfidence('PROBABLE')
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
          Relationships ({loading ? '...' : relationships.length})
        </h4>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-blue-500 hover:text-blue-400 cursor-pointer flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Relationship
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}

      {/* Relationship list */}
      {!loading && relationships.length === 0 && !showForm && (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
          No relationships yet
        </p>
      )}

      {!loading && relationships.length > 0 && (
        <div className="space-y-0.5">
          {relationships.map((rel) => {
            const isOutgoing = rel.source_entity_id === entityId
            const direction = isOutgoing ? '\u2192' : '\u2190'
            const targetName = resolveTargetName(rel, entityId)
            const badgeColor = TYPE_BADGE_COLORS[rel.relationship_type] || DEFAULT_BADGE_COLOR

            return (
              <div
                key={rel.id}
                className="flex items-center gap-2 py-1.5"
              >
                <span className="text-gray-400 font-mono text-xs w-4 text-center shrink-0">
                  {direction}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0',
                    badgeColor,
                  )}
                >
                  {rel.relationship_type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-900 dark:text-gray-200 truncate min-w-0">
                  {targetName}
                </span>
                {rel.confidence && (
                  <ConfidenceDots
                    level={rel.confidence}
                    showLabel={false}
                    className="shrink-0 ml-auto"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <div className="mt-2 space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              New Relationship
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Target entity search */}
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
              Target Entity
            </label>
            {selectedTarget ? (
              <div className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5">
                <span className="text-gray-900 dark:text-gray-200 truncate flex-1">
                  {selectedTarget.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTarget(null)}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <EntitySearch
                sessionId={sessionId}
                excludeId={entityId}
                onSelect={(id, type, name) => setSelectedTarget({ id, type, name })}
                placeholder="Search for target entity..."
              />
            )}
          </div>

          {/* Relationship type */}
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
              Relationship Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as RelationshipType)}
              className={cn(
                'w-full text-sm rounded border px-2 py-1.5',
                'bg-white dark:bg-gray-800',
                'border-gray-300 dark:border-gray-700',
                'text-gray-900 dark:text-gray-200',
              )}
            >
              {RELATIONSHIP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
              Confidence
            </label>
            <select
              value={selectedConfidence}
              onChange={(e) => setSelectedConfidence(e.target.value as RelationshipConfidence)}
              className={cn(
                'w-full text-sm rounded border px-2 py-1.5',
                'bg-white dark:bg-gray-800',
                'border-gray-300 dark:border-gray-700',
                'text-gray-900 dark:text-gray-200',
              )}
            >
              {CONFIDENCE_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedTarget || submitting}
            className={cn(
              'w-full text-sm font-medium rounded px-3 py-1.5 mt-1',
              'bg-blue-600 hover:bg-blue-500 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-1.5',
            )}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Creating...' : 'Create Relationship'}
          </button>
        </div>
      )}
    </div>
  )
}
