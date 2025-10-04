/**
 * Framework Relationship Auto-Generation
 *
 * Utilities for automatically generating entity relationships from analytical frameworks
 * (MOM, COG, Causeway)
 */

import type { CreateRelationshipRequest, RelationshipType, RelationshipConfidence } from '@/types/entities'

// MOM Assessment types (simplified - adjust based on actual types)
interface MOMAssessment {
  id: string
  actor_id: string
  event_id: string
  scenario_description: string
  motive_score: number
  opportunity_score: number
  means_score: number
  overall_likelihood: number
  created_at: string
}

// COG Analysis types (simplified)
interface COGElement {
  id: string
  type: 'CAPABILITY' | 'REQUIREMENT' | 'VULNERABILITY' | 'CRITICAL_FACTOR'
  name: string
  description: string
  entity_id?: string
  entity_type?: string
  depends_on?: string[]
}

// Causeway Row types (simplified)
interface CausewayRow {
  id: string
  action: string
  actor: string
  target: string
  means: string
  when: string
  where?: string
  actor_entity_id?: string
  target_entity_id?: string
}

/**
 * Auto-generate relationships from MOM assessments
 */
export function generateRelationshipsFromMOM(
  assessment: MOMAssessment,
  workspaceId: string
): CreateRelationshipRequest[] {
  const relationships: CreateRelationshipRequest[] = []

  // Create ASSESSED_FOR relationship between Actor and Event
  const confidence: RelationshipConfidence =
    assessment.overall_likelihood > 0.7 ? 'CONFIRMED' :
    assessment.overall_likelihood > 0.5 ? 'PROBABLE' :
    assessment.overall_likelihood > 0.3 ? 'POSSIBLE' : 'SUSPECTED'

  relationships.push({
    source_entity_id: assessment.actor_id,
    source_entity_type: 'ACTOR',
    target_entity_id: assessment.event_id,
    target_entity_type: 'EVENT',
    relationship_type: 'ASSESSED_FOR',
    description: `MOM Assessment: ${assessment.scenario_description}`,
    weight: assessment.overall_likelihood,
    confidence,
    workspace_id: workspaceId,
    // Additional metadata
    evidence_ids: [], // Could link to evidence supporting the assessment
  })

  // If high motive, create additional relationship
  if (assessment.motive_score > 0.7) {
    relationships.push({
      source_entity_id: assessment.actor_id,
      source_entity_type: 'ACTOR',
      target_entity_id: assessment.event_id,
      target_entity_type: 'EVENT',
      relationship_type: 'PARTICIPATED_IN',
      description: `High motive detected (${(assessment.motive_score * 100).toFixed(0)}%) - likely involvement`,
      weight: assessment.motive_score,
      confidence: 'PROBABLE',
      workspace_id: workspaceId
    })
  }

  return relationships
}

/**
 * Auto-generate relationships from COG analysis
 */
export function generateRelationshipsFromCOG(
  elements: COGElement[],
  workspaceId: string
): CreateRelationshipRequest[] {
  const relationships: CreateRelationshipRequest[] = []

  elements.forEach(element => {
    // Create DEPENDS_ON relationships
    if (element.depends_on && element.depends_on.length > 0) {
      element.depends_on.forEach(dependencyId => {
        const dependency = elements.find(e => e.id === dependencyId)
        if (dependency && element.entity_id && dependency.entity_id) {
          relationships.push({
            source_entity_id: element.entity_id,
            source_entity_type: element.entity_type as any || 'ACTOR',
            target_entity_id: dependency.entity_id,
            target_entity_type: dependency.entity_type as any || 'ACTOR',
            relationship_type: 'DEPENDS_ON',
            description: `COG Dependency: ${element.name} depends on ${dependency.name}`,
            weight: 0.8, // High weight for COG dependencies
            confidence: 'CONFIRMED',
            workspace_id: workspaceId
          })
        }
      })
    }

    // Create relationships for critical factors
    if (element.type === 'CRITICAL_FACTOR' && element.entity_id) {
      // Could link critical factors to actors/places/systems
      // Implementation depends on specific COG structure
    }
  })

  return relationships
}

/**
 * Auto-generate relationships from Causeway analysis
 */
export function generateRelationshipsFromCauseway(
  rows: CausewayRow[],
  workspaceId: string
): CreateRelationshipRequest[] {
  const relationships: CreateRelationshipRequest[] = []

  rows.forEach(row => {
    // Actor PERFORMED Action (if action is an event entity)
    if (row.actor_entity_id) {
      // Note: Would need to create/link action as an EVENT entity
      // For now, create relationship between actor and target

      if (row.target_entity_id) {
        relationships.push({
          source_entity_id: row.actor_entity_id,
          source_entity_type: 'ACTOR',
          target_entity_id: row.target_entity_id,
          target_entity_type: 'ACTOR', // Or could be PLACE, etc.
          relationship_type: 'TARGETED',
          description: `Causeway: ${row.actor} → ${row.action} → ${row.target}`,
          weight: 0.7,
          confidence: 'PROBABLE',
          workspace_id: workspaceId,
          start_date: row.when
        })
      }

      // Could also create USED relationship for means
      // if means is linked to a BEHAVIOR or SYSTEM entity
    }
  })

  return relationships
}

/**
 * Batch generate relationships from multiple MOM assessments
 */
export async function batchGenerateFromMOM(
  assessments: MOMAssessment[],
  workspaceId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{
  generated: CreateRelationshipRequest[]
  errors: Array<{ assessment: MOMAssessment; error: string }>
}> {
  const generated: CreateRelationshipRequest[] = []
  const errors: Array<{ assessment: MOMAssessment; error: string }> = []

  for (let i = 0; i < assessments.length; i++) {
    try {
      const relationships = generateRelationshipsFromMOM(assessments[i], workspaceId)
      generated.push(...relationships)
      onProgress?.(i + 1, assessments.length)
    } catch (error) {
      errors.push({
        assessment: assessments[i],
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return { generated, errors }
}

/**
 * Deduplicate relationships (avoid creating duplicates)
 */
export function deduplicateRelationships(
  relationships: CreateRelationshipRequest[]
): CreateRelationshipRequest[] {
  const seen = new Set<string>()
  return relationships.filter(rel => {
    const key = `${rel.source_entity_id}-${rel.relationship_type}-${rel.target_entity_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Validate relationships before creation
 */
export function validateRelationship(rel: CreateRelationshipRequest): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!rel.source_entity_id) errors.push('Missing source entity')
  if (!rel.target_entity_id) errors.push('Missing target entity')
  if (!rel.relationship_type) errors.push('Missing relationship type')
  if (rel.source_entity_id === rel.target_entity_id) {
    errors.push('Self-referential relationship not allowed')
  }
  if (rel.weight !== undefined && (rel.weight < 0 || rel.weight > 1)) {
    errors.push('Weight must be between 0 and 1')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Create relationships in bulk with error handling
 */
export async function bulkCreateRelationships(
  relationships: CreateRelationshipRequest[],
  onProgress?: (current: number, total: number, status: 'success' | 'error') => void
): Promise<{
  created: number
  failed: number
  errors: Array<{ relationship: CreateRelationshipRequest; error: string }>
}> {
  const errors: Array<{ relationship: CreateRelationshipRequest; error: string }> = []
  let created = 0
  let failed = 0

  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i]

    // Validate first
    const validation = validateRelationship(rel)
    if (!validation.valid) {
      failed++
      errors.push({
        relationship: rel,
        error: validation.errors.join(', ')
      })
      onProgress?.(i + 1, relationships.length, 'error')
      continue
    }

    try {
      const response = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rel)
      })

      if (response.ok) {
        created++
        onProgress?.(i + 1, relationships.length, 'success')
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
        failed++
        errors.push({
          relationship: rel,
          error: errorData.message || `HTTP ${response.status}`
        })
        onProgress?.(i + 1, relationships.length, 'error')
      }
    } catch (error) {
      failed++
      errors.push({
        relationship: rel,
        error: error instanceof Error ? error.message : 'Network error'
      })
      onProgress?.(i + 1, relationships.length, 'error')
    }
  }

  return { created, failed, errors }
}

/**
 * Get relationship type suggestions based on entity types
 */
export function suggestRelationshipTypes(
  sourceType: string,
  targetType: string
): RelationshipType[] {
  const suggestions: Record<string, Record<string, RelationshipType[]>> = {
    ACTOR: {
      ACTOR: ['CONTROLS', 'REPORTS_TO', 'ALLIED_WITH', 'ADVERSARY_OF', 'MEMBER_OF'],
      EVENT: ['PARTICIPATED_IN', 'ASSESSED_FOR', 'PERFORMED', 'TARGETED'],
      PLACE: ['LOCATED_AT'],
      SOURCE: ['PROVIDED_BY'],
      BEHAVIOR: ['EXHIBITS'],
      EVIDENCE: ['PROVIDED_BY']
    },
    EVENT: {
      ACTOR: ['PERFORMED'],
      EVENT: ['CORROBORATES', 'CONTRADICTS'],
      PLACE: ['LOCATED_AT']
    },
    SOURCE: {
      EVIDENCE: ['PROVIDED_BY'],
      ACTOR: ['PROVIDED_BY']
    }
  }

  return suggestions[sourceType]?.[targetType] || ['CUSTOM']
}
