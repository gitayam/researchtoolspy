/**
 * Match Extracted Entities to Existing Actors/Places/Events
 *
 * POST /api/content-intelligence/match-entities-to-actors
 *   Body: { entities: [{ name, type }], workspace_id? }
 *   Returns: { matches: { [name]: { id, name } } }
 *
 * Also exports utility functions for internal use by other endpoints.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

// POST handler — match entity names to existing actors/places/events
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as {
      entities?: Array<{ name: string; type: string }>
      workspace_id?: string
    }

    if (!body.entities || !Array.isArray(body.entities) || body.entities.length === 0) {
      return new Response(JSON.stringify({ error: 'entities array required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const workspaceId = body.workspace_id || request.headers.get('X-Workspace-ID') || '1'
    const matches: Record<string, { id: string; name: string }> = {}

    for (const entity of body.entities.slice(0, 100)) {
      if (!entity.name) continue

      try {
        // Try actors first
        const actor = await env.DB.prepare(
          'SELECT id, name FROM actors WHERE workspace_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1'
        ).bind(workspaceId, entity.name).first()

        if (actor) {
          matches[entity.name] = { id: actor.id as string, name: actor.name as string }
          continue
        }

        // Try places
        if (entity.type === 'location' || entity.type === 'place') {
          const place = await env.DB.prepare(
            'SELECT id, name FROM places WHERE workspace_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1'
          ).bind(workspaceId, entity.name).first()

          if (place) {
            matches[entity.name] = { id: place.id as string, name: place.name as string }
            continue
          }
        }

        // Try events
        if (entity.type === 'event') {
          const event = await env.DB.prepare(
            'SELECT id, name FROM events WHERE workspace_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1'
          ).bind(workspaceId, entity.name).first()

          if (event) {
            matches[entity.name] = { id: event.id as string, name: event.name as string }
          }
        }
      } catch (err) {
        console.warn(`[match-entities] Error matching "${entity.name}":`, err)
      }
    }

    return new Response(JSON.stringify(matches), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[match-entities] POST error:', error)
    return new Response(JSON.stringify({ error: 'Failed to match entities' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// Reject GET requests
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// --- Internal utility functions (used by other endpoints) ---

interface MatchResult {
  entityMentionId: string
  tempEntityId: string
  entityName: string
  entityType: string
  matchedActorId: string | null
  matchedActorName: string | null
  matchConfidence: 'exact' | 'fuzzy' | 'none'
}

/**
 * Match entities for a specific claim to existing actors/places/events
 *
 * @param db - D1 Database instance
 * @param claimId - Claim adjustment ID
 * @param workspaceId - Workspace ID for scoping matches
 * @returns Array of match results
 */
export async function matchClaimEntitiesToActors(
  db: D1Database,
  claimId: string,
  workspaceId: string
): Promise<MatchResult[]> {

  // Get all entities for this claim that have temp IDs
  const entities = await db.prepare(`
    SELECT id, entity_id, entity_name, entity_type
    FROM claim_entity_mentions
    WHERE claim_adjustment_id = ?
      AND entity_id LIKE 'entity-temp-%'
  `).bind(claimId).all()

  const results: MatchResult[] = []

  for (const entity of entities.results) {
    const entityMentionId = entity.id as string
    const tempEntityId = entity.entity_id as string
    const entityName = entity.entity_name as string
    const entityType = entity.entity_type as string

    let matchedActorId: string | null = null
    let matchedActorName: string | null = null
    let matchConfidence: 'exact' | 'fuzzy' | 'none' = 'none'

    try {
      // Try exact match first (case-insensitive)
      if (entityType === 'person' || entityType === 'organization' || entityType === 'political_party' || entityType === 'government_agency') {
        const exactMatch = await db.prepare(`
          SELECT id, name FROM actors
          WHERE workspace_id = ?
            AND LOWER(TRIM(name)) = LOWER(TRIM(?))
          LIMIT 1
        `).bind(workspaceId, entityName).first()

        if (exactMatch) {
          matchedActorId = exactMatch.id as string
          matchedActorName = exactMatch.name as string
          matchConfidence = 'exact'
        }
      }

      // Try fuzzy match if no exact match (look for partial name matches)
      if (!matchedActorId && (entityType === 'person' || entityType === 'organization' || entityType === 'political_party')) {
        // Extract first and last words for fuzzy matching
        const nameParts = entityName.trim().split(/\s+/)
        const firstName = nameParts[0]
        const lastName = nameParts[nameParts.length - 1]

        if (nameParts.length >= 2) {
          const fuzzyMatch = await db.prepare(`
            SELECT id, name FROM actors
            WHERE workspace_id = ?
              AND (
                LOWER(name) LIKE LOWER(?)
                OR LOWER(name) LIKE LOWER(?)
                OR LOWER(name) LIKE LOWER(?)
              )
            LIMIT 1
          `).bind(
            workspaceId,
            `%${firstName}%${lastName}%`,  // "John Smith" matches "John Q. Smith"
            `${lastName}%`,                // "Smith" matches "Smith Corp"
            `%${entityName}%`              // Contains full name
          ).first()

          if (fuzzyMatch) {
            matchedActorId = fuzzyMatch.id as string
            matchedActorName = fuzzyMatch.name as string
            matchConfidence = 'fuzzy'
          }
        }
      }

      // Try matching to places
      if (!matchedActorId && entityType === 'location') {
        const placeMatch = await db.prepare(`
          SELECT id, name FROM places
          WHERE workspace_id = ?
            AND LOWER(TRIM(name)) = LOWER(TRIM(?))
          LIMIT 1
        `).bind(workspaceId, entityName).first()

        if (placeMatch) {
          matchedActorId = placeMatch.id as string
          matchedActorName = placeMatch.name as string
          matchConfidence = 'exact'
        }
      }

      // Try matching to events
      if (!matchedActorId && entityType === 'event') {
        const eventMatch = await db.prepare(`
          SELECT id, name FROM events
          WHERE workspace_id = ?
            AND LOWER(TRIM(name)) = LOWER(TRIM(?))
          LIMIT 1
        `).bind(workspaceId, entityName).first()

        if (eventMatch) {
          matchedActorId = eventMatch.id as string
          matchedActorName = eventMatch.name as string
          matchConfidence = 'exact'
        }
      }

      // Update entity mention with matched ID if found
      if (matchedActorId) {
        await db.prepare(`
          UPDATE claim_entity_mentions
          SET entity_id = ?
          WHERE id = ?
        `).bind(matchedActorId, entityMentionId).run()
      }

      results.push({
        entityMentionId,
        tempEntityId,
        entityName,
        entityType,
        matchedActorId,
        matchedActorName,
        matchConfidence
      })
    } catch (error) {
      console.error(`[match-entities] Error matching "${entityName}":`, error)
      results.push({
        entityMentionId,
        tempEntityId,
        entityName,
        entityType,
        matchedActorId: null,
        matchedActorName: null,
        matchConfidence: 'none'
      })
    }
  }

  const matchCount = results.filter(r => r.matchedActorId !== null).length

  return results
}

/**
 * Match entities for multiple claims in batch
 *
 * @param db - D1 Database instance
 * @param claimIds - Array of claim adjustment IDs
 * @param workspaceId - Workspace ID for scoping matches
 * @returns Statistics about matching
 */
export async function matchMultipleClaimsEntities(
  db: D1Database,
  claimIds: string[],
  workspaceId: string
): Promise<{
  totalEntities: number
  exactMatches: number
  fuzzyMatches: number
  noMatches: number
  claimsProcessed: number
}> {
  const stats = {
    totalEntities: 0,
    exactMatches: 0,
    fuzzyMatches: 0,
    noMatches: 0,
    claimsProcessed: 0
  }


  for (const claimId of claimIds) {
    try {
      const results = await matchClaimEntitiesToActors(db, claimId, workspaceId)

      stats.totalEntities += results.length
      stats.exactMatches += results.filter(r => r.matchConfidence === 'exact').length
      stats.fuzzyMatches += results.filter(r => r.matchConfidence === 'fuzzy').length
      stats.noMatches += results.filter(r => r.matchConfidence === 'none').length
      stats.claimsProcessed++
    } catch (error) {
      console.error(`[match-multiple] Error processing claim ${claimId}:`, error)
      // Continue with other claims
    }
  }


  return stats
}

/**
 * Create actor from unmatched entity
 *
 * If an entity cannot be matched, optionally create a new actor entry
 *
 * @param db - D1 Database instance
 * @param entityMentionId - Entity mention ID
 * @param workspaceId - Workspace ID
 * @param userId - User ID for creation tracking
 * @returns Created actor ID or null
 */
export async function createActorFromUnmatchedEntity(
  db: D1Database,
  entityMentionId: string,
  workspaceId: string,
  userId: number
): Promise<string | null> {
  try {
    // Get entity details
    const entity = await db.prepare(`
      SELECT entity_name, entity_type, role, credibility_impact
      FROM claim_entity_mentions
      WHERE id = ?
        AND entity_id LIKE 'entity-temp-%'
    `).bind(entityMentionId).first()

    if (!entity) {
      return null
    }

    const actorId = `actor-${crypto.randomUUID()}`
    const entityName = entity.entity_name as string
    const entityType = entity.entity_type as string

    // Create new actor
    await db.prepare(`
      INSERT INTO actors (
        id, workspace_id, name, type, description, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      actorId,
      workspaceId,
      entityName,
      entityType === 'person' ? 'PERSON' : 'ORGANIZATION',
      `Auto-created from claim entity mention (role: ${entity.role})`,
      userId
    ).run()

    // Update entity mention with new actor ID
    await db.prepare(`
      UPDATE claim_entity_mentions
      SET entity_id = ?
      WHERE id = ?
    `).bind(actorId, entityMentionId).run()


    return actorId
  } catch (error) {
    console.error(`[create-actor] Failed to create actor for entity ${entityMentionId}:`, error)
    return null
  }
}

/**
 * Get matching statistics for a content analysis
 *
 * @param db - D1 Database instance
 * @param contentAnalysisId - Content analysis ID
 * @returns Statistics about entity matching for this analysis
 */
export async function getMatchingStatistics(
  db: D1Database,
  contentAnalysisId: number
): Promise<{
  totalEntities: number
  matched: number
  unmatched: number
  matchRate: number
}> {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN entity_id NOT LIKE 'entity-temp-%' THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN entity_id LIKE 'entity-temp-%' THEN 1 ELSE 0 END) as unmatched
    FROM claim_entity_mentions cem
    JOIN claim_adjustments ca ON cem.claim_adjustment_id = ca.id
    WHERE ca.content_analysis_id = ?
  `).bind(contentAnalysisId).first()

  const total = stats?.total as number || 0
  const matched = stats?.matched as number || 0
  const unmatched = stats?.unmatched as number || 0
  const matchRate = total > 0 ? (matched / total) * 100 : 0

  return {
    totalEntities: total,
    matched,
    unmatched,
    matchRate: Math.round(matchRate * 10) / 10
  }
}
