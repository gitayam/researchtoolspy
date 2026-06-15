/**
 * GPT-Powered Relationship Type Inference API
 * Automatically determines relationship type based on context
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS } from '../_shared/api-utils'
import { requireConsent } from '../_shared/consent'
import { callOpenAIViaGateway, ANALYST_SYSTEM_PREFIX } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  OPENAI_API_KEY: string
}

interface InferTypeRequest {
  source_entity_id: string
  source_entity_type: 'ACTOR' | 'SOURCE' | 'EVENT' | 'PLACE'
  target_entity_id: string
  target_entity_type: 'ACTOR' | 'SOURCE' | 'EVENT' | 'PLACE'
  context?: string  // Optional context about the relationship
  evidence_text?: string  // Text from evidence mentioning both entities
}

const RELATIONSHIP_TYPES = [
  'CONTROLS',
  'ALLIED_WITH',
  'OPPOSES',
  'SUBORDINATE_TO',
  'COMMUNICATES_WITH',
  'FUNDS',
  'SUPPLIES',
  'COORDINATES_WITH',
  'MENTIONED_WITH',
  'LOCATED_IN',
  'MEMBER_OF',
  'OWNS',
  'INFLUENCES',
  'TARGETS',
  'REPORTS_TO',
  'PART_OF',
  'ASSOCIATED_WITH',
  'OTHER'
]

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    // Sensitive-use gate: inferring relationships between entities requires recorded consent
    const consentGate = await requireConsent(env as any, authUserId)
    if (consentGate) return consentGate

    const body: InferTypeRequest = await request.json()

    if (!body.source_entity_id || !body.target_entity_id) {
      return new Response(JSON.stringify({
        error: 'source_entity_id and target_entity_id are required'
      }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // Fetch entity details
    const sourceEntity = await getEntityDetails(env.DB, body.source_entity_id, body.source_entity_type)
    const targetEntity = await getEntityDetails(env.DB, body.target_entity_id, body.target_entity_type)

    if (!sourceEntity || !targetEntity) {
      return new Response(JSON.stringify({
        error: 'One or both entities not found'
      }), {
        status: 404,
        headers: JSON_HEADERS,
      })
    }

    // Build context for GPT
    const contextText = buildContextText(sourceEntity, targetEntity, body.context, body.evidence_text)

    // Call GPT to infer relationship type
    const inferredType = await inferRelationshipType(env, contextText, sourceEntity, targetEntity)

    // Generate confidence explanation
    const explanation = await generateExplanation(env, contextText, sourceEntity, targetEntity, inferredType)

    return new Response(JSON.stringify({
      inferred_type: inferredType,
      confidence: inferredType === 'MENTIONED_WITH' ? 'LOW' : 'MEDIUM',
      explanation: explanation,
      source_entity: {
        id: sourceEntity.id,
        name: sourceEntity.name,
        type: body.source_entity_type
      },
      target_entity: {
        id: targetEntity.id,
        name: targetEntity.name,
        type: body.target_entity_type
      }
    }), {
      status: 200,
      headers: JSON_HEADERS,
    })

  } catch (error) {
    console.error('Relationship type inference error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to infer relationship type'

    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}

async function getEntityDetails(db: D1Database, entityId: string, entityType: string): Promise<any> {
  let table = 'actors'
  if (entityType === 'SOURCE') table = 'sources'
  else if (entityType === 'EVENT') table = 'events'
  else if (entityType === 'PLACE') table = 'places'

  const result = await db.prepare(`
    SELECT id, name, description, type FROM ${table} WHERE id = ?
  `).bind(entityId).first()

  return result
}

function buildContextText(
  sourceEntity: any,
  targetEntity: any,
  userContext?: string,
  evidenceText?: string
): string {
  let context = `Analyzing relationship between:\n`
  context += `Source: ${sourceEntity.name} (${sourceEntity.type || 'Unknown'})\n`
  if (sourceEntity.description) {
    context += `  Description: ${sourceEntity.description}\n`
  }
  context += `Target: ${targetEntity.name} (${targetEntity.type || 'Unknown'})\n`
  if (targetEntity.description) {
    context += `  Description: ${targetEntity.description}\n`
  }

  if (userContext) {
    context += `\nAdditional Context: ${userContext}\n`
  }

  if (evidenceText) {
    context += `\nEvidence Text: ${evidenceText}\n`
  }

  return context
}

async function inferRelationshipType(
  env: Env,
  contextText: string,
  sourceEntity: any,
  targetEntity: any
): Promise<string> {
  const prompt = `${contextText}

Based on the information above, determine the most appropriate relationship type from this list:
${RELATIONSHIP_TYPES.join(', ')}

Relationship Type Guidelines:
- CONTROLS: One entity has authority/control over another
- ALLIED_WITH: Cooperative relationship, working together
- OPPOSES: Adversarial relationship, working against each other
- SUBORDINATE_TO: Hierarchical reporting relationship
- COMMUNICATES_WITH: Regular communication/coordination
- FUNDS: Financial support relationship
- SUPPLIES: Provides resources/equipment
- COORDINATES_WITH: Operational coordination
- MENTIONED_WITH: Co-mentioned but relationship unclear
- LOCATED_IN: Geographic containment
- MEMBER_OF: Membership in organization
- OWNS: Ownership relationship
- INFLUENCES: Has influence over (non-control)
- TARGETS: Adversarial targeting
- REPORTS_TO: Formal reporting structure
- PART_OF: Structural component
- ASSOCIATED_WITH: Generic association
- OTHER: None of the above fit

Respond with ONLY the relationship type, no explanation.`

  try {
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content: `${ANALYST_SYSTEM_PREFIX}You are an intelligence analyst expert at identifying relationship types between entities. Respond only with the relationship type from the provided list.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      reasoning_effort: 'none',
      temperature: 0.3,
      max_completion_tokens: 50
    }, { metadata: { endpoint: 'relationships/infer-type' }, cacheTTL: 3600 })

    const inferredType = data.choices[0].message.content.trim().toUpperCase()

    // Validate it's one of our types
    if (RELATIONSHIP_TYPES.includes(inferredType)) {
      return inferredType
    }

    return 'MENTIONED_WITH'  // Fallback if GPT returns something unexpected
  } catch (error) {
    console.error('Error calling OpenAI:', error)
    return 'MENTIONED_WITH'  // Fallback
  }
}

async function generateExplanation(
  env: Env,
  contextText: string,
  sourceEntity: any,
  targetEntity: any,
  inferredType: string
): Promise<string> {
  const prompt = `${contextText}

The relationship type has been determined as: ${inferredType}

Provide a brief 1-2 sentence explanation of why this relationship type fits, based on the available information.`

  try {
    const data = await callOpenAIViaGateway(env, {
      model: 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content: `${ANALYST_SYSTEM_PREFIX}You are an intelligence analyst. Provide clear, concise explanations.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      reasoning_effort: 'none',
      temperature: 0.7,
      max_completion_tokens: 150
    }, { metadata: { endpoint: 'relationships/infer-type' }, cacheTTL: 3600 })

    return data.choices[0].message.content.trim()
  } catch (error) {
    return 'Relationship type inferred from available context.'
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

