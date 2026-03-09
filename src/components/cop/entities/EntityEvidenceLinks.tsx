import { useState, useEffect, useCallback } from 'react'
import { FileText, Link2, Plus, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ConfidenceDots from './ConfidenceDots'
import type { Relationship, RelationshipType } from '@/types/entities'

// ── Types ────────────────────────────────────────────────────────

interface EntityEvidenceLinksProps {
  entityId: string
  entityType: string // 'ACTOR', 'EVENT', 'PLACE', 'SOURCE', 'BEHAVIOR'
  sessionId: string  // workspace_id
  workspaceId?: string
}

interface EvidenceItem {
  id: string | number
  title: string
  status?: string
}

type EvidenceRelationType = 'CORROBORATES' | 'CONTRADICTS' | 'PROVIDED_BY'

const EVIDENCE_REL_TYPES: EvidenceRelationType[] = [
  'CORROBORATES',
  'CONTRADICTS',
  'PROVIDED_BY',
]

const REL_TYPE_STYLES: Record<EvidenceRelationType, string> = {
  CORROBORATES: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CONTRADICTS: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  PROVIDED_BY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
}

// ── Helpers ──────────────────────────────────────────────────────

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const userHash = localStorage.getItem('omnicore_user_hash')
  if (userHash) headers['X-User-Hash'] = userHash
  return headers
}

function truncate(text: string, max = 50): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '...'
}

function isEvidenceRelType(t: string): t is EvidenceRelationType {
  return EVIDENCE_REL_TYPES.includes(t as EvidenceRelationType)
}

// ── Component ────────────────────────────────────────────────────

export default function EntityEvidenceLinks({
  entityId,
  entityType,
  sessionId,
  workspaceId,
}: EntityEvidenceLinksProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Link form state
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [availableEvidence, setAvailableEvidence] = useState<EvidenceItem[]>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('')
  const [selectedRelType, setSelectedRelType] = useState<EvidenceRelationType>('CORROBORATES')
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch linked relationships ─────────────────────────────────

  const fetchRelationships = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(
        `/api/relationships?entity_id=${encodeURIComponent(entityId)}&workspace_id=${encodeURIComponent(workspaceId || sessionId)}`,
        { headers: getHeaders() },
      )
      if (!res.ok) throw new Error(`Failed to fetch relationships (${res.status})`)
      const data = await res.json()
      const rels: Relationship[] = Array.isArray(data) ? data : data.relationships ?? []

      // Filter to evidence-related relationship types only
      const evidenceRels = rels.filter(
        (r) =>
          isEvidenceRelType(r.relationship_type) &&
          (r.source_entity_type === 'EVIDENCE' || r.target_entity_type === 'EVIDENCE'),
      )
      setRelationships(evidenceRels)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence links')
    } finally {
      setLoading(false)
    }
  }, [entityId, sessionId, workspaceId])

  useEffect(() => {
    fetchRelationships()
  }, [fetchRelationships])

  // ── Fetch available evidence for linking ───────────────────────

  const fetchAvailableEvidence = useCallback(async () => {
    try {
      setLoadingEvidence(true)
      const res = await fetch(
        `/api/evidence?workspace_id=${encodeURIComponent(workspaceId || sessionId)}`,
        { headers: getHeaders() },
      )
      if (!res.ok) throw new Error('Failed to fetch evidence')
      const data = await res.json()
      const items: EvidenceItem[] = Array.isArray(data)
        ? data
        : data.evidence ?? data.items ?? []
      setAvailableEvidence(items)
    } catch {
      setAvailableEvidence([])
    } finally {
      setLoadingEvidence(false)
    }
  }, [sessionId, workspaceId])

  // ── Open link form ─────────────────────────────────────────────

  function handleOpenLinkForm() {
    setShowLinkForm(true)
    setSelectedEvidenceId('')
    setSelectedRelType('CORROBORATES')
    fetchAvailableEvidence()
  }

  // ── Submit new link ────────────────────────────────────────────

  async function handleSubmitLink() {
    if (!selectedEvidenceId) return
    try {
      setSubmitting(true)
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          source_entity_id: String(selectedEvidenceId),
          source_entity_type: 'EVIDENCE',
          target_entity_id: entityId,
          target_entity_type: entityType,
          relationship_type: selectedRelType,
          workspace_id: workspaceId || sessionId,
        }),
      })
      if (!res.ok) throw new Error(`Failed to create link (${res.status})`)
      setShowLinkForm(false)
      fetchRelationships()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link evidence')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derive display info for a relationship ─────────────────────

  function getLinkedLabel(rel: Relationship): string {
    // The "other" side is the evidence item; display its ID or embedded title
    const isSourceEvidence = rel.source_entity_type === 'EVIDENCE'
    const evidenceId = isSourceEvidence ? rel.source_entity_id : rel.target_entity_id

    // Try to find a matching evidence item from the available list
    const match = availableEvidence.find((e) => String(e.id) === String(evidenceId))
    if (match) return truncate(match.title)

    // Fallback: use description or a generic label
    if (rel.description) return truncate(rel.description)
    return `Evidence #${evidenceId}`
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-200 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Evidence ({relationships.length})
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleOpenLinkForm}
        >
          <Plus className="h-3 w-3 mr-1" />
          Link Evidence
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 py-1">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && relationships.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-2 text-center">
          No evidence linked yet
        </p>
      )}

      {/* Linked evidence list */}
      {!loading && relationships.length > 0 && (
        <ul className="space-y-0.5">
          {relationships.map((rel) => (
            <li
              key={rel.id}
              className={cn(
                'flex items-center gap-2 px-2 rounded-md',
                'h-8 min-h-[32px]',
                'bg-gray-50 dark:bg-gray-800/30',
              )}
            >
              <Link2 className="h-3 w-3 shrink-0 text-gray-400" />
              <span className="text-xs text-gray-900 dark:text-gray-200 truncate flex-1">
                {getLinkedLabel(rel)}
              </span>
              {isEvidenceRelType(rel.relationship_type) && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4 border-0 font-medium',
                    REL_TYPE_STYLES[rel.relationship_type],
                  )}
                >
                  {rel.relationship_type.replace('_', ' ')}
                </Badge>
              )}
              {rel.confidence && (
                <ConfidenceDots
                  level={rel.confidence}
                  showLabel={false}
                  className="shrink-0"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Inline link form */}
      {showLinkForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 space-y-2 bg-gray-50 dark:bg-gray-800/30">
          {/* Evidence selector */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Evidence
            </label>
            {loadingEvidence ? (
              <div className="flex items-center gap-1.5 py-1">
                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Loading...</span>
              </div>
            ) : (
              <select
                value={selectedEvidenceId}
                onChange={(e) => setSelectedEvidenceId(e.target.value)}
                className={cn(
                  'w-full mt-0.5 rounded border border-gray-300 dark:border-gray-700',
                  'bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-200',
                  'px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500',
                )}
              >
                <option value="">Select evidence...</option>
                {availableEvidence.map((ev) => (
                  <option key={ev.id} value={String(ev.id)}>
                    {truncate(ev.title, 60)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Relationship type selector */}
          <div>
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Relationship
            </label>
            <select
              value={selectedRelType}
              onChange={(e) => setSelectedRelType(e.target.value as EvidenceRelationType)}
              className={cn(
                'w-full mt-0.5 rounded border border-gray-300 dark:border-gray-700',
                'bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-200',
                'px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500',
              )}
            >
              {EVIDENCE_REL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              size="sm"
              className="h-6 px-3 text-xs"
              disabled={!selectedEvidenceId || submitting}
              onClick={handleSubmitLink}
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Link2 className="h-3 w-3 mr-1" />
              )}
              Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-3 text-xs"
              onClick={() => setShowLinkForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
