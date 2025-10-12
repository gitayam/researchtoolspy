/**
 * Match Extracted Entities to Existing Actors/Places/Events
 *
 * Takes entities extracted from claims (with temporary IDs) and matches them
 * to existing entities in the actors, places, and events tables.
 *
 * Part of Phase 3: Claims & Entity Integration
 */

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
  console.log(`[match-entities] Matching entities for claim ${claimId} in workspace ${workspaceId}`)

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
          console.log(`[match-entities] EXACT match: "${entityName}" → Actor ${matchedActorId}`)
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
            console.log(`[match-entities] FUZZY match: "${entityName}" → Actor ${matchedActorId} ("${matchedActorName}")`)
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
          console.log(`[match-entities] EXACT match: "${entityName}" → Place ${matchedActorId}`)
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
          console.log(`[match-entities] EXACT match: "${entityName}" → Event ${matchedActorId}`)
        }
      }

      // Update entity mention with matched ID if found
      if (matchedActorId) {
        await db.prepare(`
          UPDATE claim_entity_mentions
          SET entity_id = ?
          WHERE id = ?
        `).bind(matchedActorId, entityMentionId).run()

        console.log(`[match-entities] Updated entity mention ${entityMentionId} with actor ID ${matchedActorId}`)
      } else {
        console.log(`[match-entities] NO match found for "${entityName}" (${entityType})`)
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
  console.log(`[match-entities] Matched ${matchCount}/${results.length} entities for claim ${claimId}`)

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

  console.log(`[match-multiple] Processing ${claimIds.length} claims for entity matching`)

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

  console.log(`[match-multiple] Complete: ${stats.exactMatches} exact + ${stats.fuzzyMatches} fuzzy matches out of ${stats.totalEntities} entities`)

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
      console.log(`[create-actor] Entity mention ${entityMentionId} not found or already matched`)
      return null
    }

    const actorId = `actor-${crypto.randomUUID()}`
    const entityName = entity.entity_name as string
    const entityType = entity.entity_type as string

    // Create new actor
    await db.prepare(`
      INSERT INTO actors (
        id, workspace_id, name, type, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      actorId,
      workspaceId,
      entityName,
      entityType === 'person' ? 'person' : 'organization',
      `Auto-created from claim entity mention (role: ${entity.role})`
    ).run()

    // Update entity mention with new actor ID
    await db.prepare(`
      UPDATE claim_entity_mentions
      SET entity_id = ?
      WHERE id = ?
    `).bind(actorId, entityMentionId).run()

    console.log(`[create-actor] Created new actor ${actorId} for "${entityName}"`)

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
