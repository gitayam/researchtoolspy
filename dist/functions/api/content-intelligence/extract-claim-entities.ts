/**
 * Extract Entities from Claims
 *
 * Uses GPT to identify entities mentioned in claims and their roles.
 * Extracts claim makers, subjects, and affected parties for entity linking.
 *
 * Part of Phase 2: Claims & Entity Integration
 */

import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export interface ClaimEntity {
  name: string
  type: 'person' | 'organization' | 'location' | 'event' | 'political_party' | 'government_agency'
  role: 'claim_maker' | 'subject' | 'mentioned' | 'affected'
  credibility_impact: number // -50 to +50
  context: string
}

/**
 * Extract entities from a single claim using GPT
 *
 * @param claimText - The claim text to analyze
 * @param env - Environment with API keys
 * @returns Array of extracted entities
 */
export async function extractClaimEntities(
  claimText: string,
  env: Env
): Promise<ClaimEntity[]> {
  console.log(`[extract-claim-entities] Extracting entities from claim: "${claimText.substring(0, 100)}..."`)

  const prompt = `Analyze this claim and extract ALL entities mentioned:

CLAIM: "${claimText}"

Extract entities with these details:

1. **name** - Full name of the entity (person, organization, location, etc.)

2. **type** - Choose one:
   - person: Individual people
   - organization: Companies, NGOs, groups
   - political_party: Political parties (Democrats, Republicans, etc.)
   - government_agency: Government departments (TSA, FBI, State Department, etc.)
   - location: Places, cities, countries
   - event: Named events, incidents, policies

3. **role** - Choose one:
   - claim_maker: Who is making or stating this claim? (most important!)
   - subject: Who/what is the claim primarily about?
   - mentioned: Other entities referenced
   - affected: Who is impacted by this claim?

4. **credibility_impact** - How does this entity affect claim credibility? (-50 to +50)
   Guidelines:
   - Politicians with known partisan bias: -30 to -40
   - Political party spokespersons: -25 to -35
   - Industry representatives with financial interest: -20 to -30
   - Anonymous sources: -15 to -25
   - Neutral experts/academics: +20 to +30
   - Official government agencies: +30 to +40
   - Peer-reviewed studies: +40 to +50
   - Fact-checking organizations: +35 to +45

5. **context** - Brief note explaining why this entity is relevant

IMPORTANT RULES:
- ALWAYS identify the claim_maker (who is saying this)
- If claim_maker is not explicitly stated, mark as "Unattributed Source" with role=claim_maker and credibility_impact=-20
- Extract ALL mentioned entities, not just the main ones
- Be specific with names (full names, not abbreviations unless that's how they appear)
- Political entities get negative credibility impact due to bias
- Official sources get positive credibility impact

Return ONLY valid JSON with this exact structure:
{
  "entities": [
    {
      "name": "string",
      "type": "person|organization|political_party|government_agency|location|event",
      "role": "claim_maker|subject|mentioned|affected",
      "credibility_impact": number,
      "context": "string"
    }
  ]
}`

  try {
    const response = await callOpenAIViaGateway(
      env.OPENAI_API_KEY,
      'gpt-4o-mini',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      },
      env.AI_GATEWAY_ACCOUNT_ID
    )

    const content = response.choices[0].message.content
    console.log(`[extract-claim-entities] GPT response: ${content.substring(0, 200)}...`)

    const result = JSON.parse(content)
    const entities = result.entities || []

    // Validate entities
    const validatedEntities = entities.filter((e: any) => {
      if (!e.name || !e.type || !e.role) {
        console.warn(`[extract-claim-entities] Invalid entity (missing fields):`, e)
        return false
      }
      if (typeof e.credibility_impact !== 'number' || e.credibility_impact < -50 || e.credibility_impact > 50) {
        console.warn(`[extract-claim-entities] Invalid credibility_impact for ${e.name}:`, e.credibility_impact)
        e.credibility_impact = 0 // Default to neutral
      }
      return true
    })

    console.log(`[extract-claim-entities] Extracted ${validatedEntities.length} valid entities`)

    // Ensure we have at least a claim_maker
    const hasClaimMaker = validatedEntities.some((e: ClaimEntity) => e.role === 'claim_maker')
    if (!hasClaimMaker) {
      console.warn(`[extract-claim-entities] No claim_maker found, adding unattributed source`)
      validatedEntities.unshift({
        name: 'Unattributed Source',
        type: 'organization',
        role: 'claim_maker',
        credibility_impact: -20,
        context: 'Claim maker not identified in text'
      })
    }

    return validatedEntities
  } catch (error) {
    console.error('[extract-claim-entities] GPT extraction failed:', error)
    console.error('[extract-claim-entities] Error details:', error instanceof Error ? error.message : String(error))

    // Return minimal entity on failure
    return [{
      name: 'Unknown Source',
      type: 'organization',
      role: 'claim_maker',
      credibility_impact: -25,
      context: 'Entity extraction failed'
    }]
  }
}

/**
 * Save extracted entities to database
 *
 * @param db - D1 Database instance
 * @param claimId - Claim adjustment ID
 * @param entities - Extracted entities
 * @returns Number of entities saved
 */
export async function saveClaimEntities(
  db: D1Database,
  claimId: string,
  entities: ClaimEntity[]
): Promise<number> {
  let savedCount = 0

  console.log(`[save-claim-entities] Saving ${entities.length} entities for claim ${claimId}`)

  for (const entity of entities) {
    try {
      const entityId = `entity-temp-${crypto.randomUUID()}` // Temporary ID, will be matched to real actor later

      await db.prepare(`
        INSERT INTO claim_entity_mentions (
          id,
          claim_adjustment_id,
          entity_id,
          entity_name,
          entity_type,
          role,
          context,
          credibility_impact,
          extracted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        claimId,
        entityId,
        entity.name,
        entity.type,
        entity.role,
        entity.context || '',
        entity.credibility_impact || 0
      ).run()

      savedCount++
    } catch (error) {
      console.error(`[save-claim-entities] Failed to save entity "${entity.name}":`, error)
      // Continue with other entities
    }
  }

  console.log(`[save-claim-entities] Successfully saved ${savedCount}/${entities.length} entities`)

  return savedCount
}

/**
 * Extract and save entities for multiple claims
 *
 * @param db - D1 Database instance
 * @param claimsWithIds - Array of {claimId, claimText} objects
 * @param env - Environment with API keys
 * @returns Statistics about entity extraction
 */
export async function extractAndSaveClaimEntities(
  db: D1Database,
  claimsWithIds: Array<{ claimId: string; claimText: string }>,
  env: Env
): Promise<{
  totalClaims: number
  totalEntities: number
  claimsWithEntities: number
  errors: number
}> {
  const stats = {
    totalClaims: claimsWithIds.length,
    totalEntities: 0,
    claimsWithEntities: 0,
    errors: 0
  }

  console.log(`[extract-and-save] Processing ${stats.totalClaims} claims for entity extraction`)

  for (const { claimId, claimText } of claimsWithIds) {
    try {
      // Extract entities from claim
      const entities = await extractClaimEntities(claimText, env)

      if (entities.length > 0) {
        // Save entities to database
        const savedCount = await saveClaimEntities(db, claimId, entities)

        stats.totalEntities += savedCount
        stats.claimsWithEntities++

        console.log(`[extract-and-save] Claim ${claimId}: ${savedCount} entities saved`)
      } else {
        console.warn(`[extract-and-save] Claim ${claimId}: No entities extracted`)
      }
    } catch (error) {
      console.error(`[extract-and-save] Error processing claim ${claimId}:`, error)
      stats.errors++
      // Continue with other claims
    }
  }

  console.log(`[extract-and-save] Complete: ${stats.totalEntities} entities from ${stats.claimsWithEntities}/${stats.totalClaims} claims (${stats.errors} errors)`)

  return stats
}

/**
 * Get entities for a claim
 *
 * @param db - D1 Database instance
 * @param claimId - Claim adjustment ID
 * @returns Array of entities linked to this claim
 */
export async function getClaimEntities(
  db: D1Database,
  claimId: string
): Promise<ClaimEntity[]> {
  const result = await db.prepare(`
    SELECT
      entity_name as name,
      entity_type as type,
      role,
      credibility_impact,
      context,
      entity_id
    FROM claim_entity_mentions
    WHERE claim_adjustment_id = ?
    ORDER BY
      CASE role
        WHEN 'claim_maker' THEN 1
        WHEN 'subject' THEN 2
        WHEN 'affected' THEN 3
        WHEN 'mentioned' THEN 4
      END,
      credibility_impact DESC
  `).bind(claimId).all()

  return result.results.map(row => ({
    name: row.name as string,
    type: row.type as ClaimEntity['type'],
    role: row.role as ClaimEntity['role'],
    credibility_impact: row.credibility_impact as number,
    context: row.context as string
  }))
}
