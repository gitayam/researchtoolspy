/**
 * POST /api/frameworks/comb-analysis/recommend
 *
 * Given a map of COM-B deficits, return canon-backed intervention function
 * recommendations per BCW Guide Tables 2.3, 2.1, and 2.9.
 *
 * Request body:
 *   {
 *     deficits: {
 *       physical_capability?: 'adequate' | 'deficit' | 'major_barrier',
 *       psychological_capability?: ...,
 *       physical_opportunity?: ...,
 *       social_opportunity?: ...,
 *       reflective_motivation?: ...,
 *       automatic_motivation?: ...
 *     }
 *   }
 *
 * Response:
 *   {
 *     recommendations: [
 *       {
 *         component: 'psychological_capability',
 *         severity: 'major_barrier',
 *         interventions: [
 *           {
 *             function: 'training',
 *             priority: 'high',
 *             definition: 'Imparting skills',
 *             example: 'Advanced driver training to increase safe driving',
 *             applicable_policies: ['guidelines', 'fiscal_measures', ...]
 *           },
 *           ...
 *         ]
 *       },
 *       ...
 *     ],
 *     citation: 'Michie, Atkins, West (2014). The Behaviour Change Wheel: ...'
 *   }
 *
 * Sources:
 *   Michie, Atkins, West (2014) BCW Guide, Tables 2.1, 2.3, 2.7, 2.9.
 *   Wiki: https://irregularpedia.org/general/behavior-analysis/
 *
 * This endpoint exposes the BCW recommendation logic for integrations
 * (CLI tools, Signal bot, MCP servers, third-party agents). The same
 * logic also runs client-side in src/utils/behaviour-change-wheel.ts.
 */

import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { recommendInterventions, type ComBDeficits, type DeficitLevel } from './_canon'

interface Env {
  DB: D1Database
}

const VALID_LEVELS: DeficitLevel[] = ['adequate', 'deficit', 'major_barrier']
const VALID_COMPONENTS = [
  'physical_capability',
  'psychological_capability',
  'physical_opportunity',
  'social_opportunity',
  'reflective_motivation',
  'automatic_motivation',
] as const

export const onRequestOptions: PagesFunction<Env> = async () => optionsResponse()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { deficits?: Partial<ComBDeficits> }

    if (!body || typeof body !== 'object' || !body.deficits || typeof body.deficits !== 'object') {
      return new Response(JSON.stringify({
        error: 'Request body must include a "deficits" object with COM-B component keys.',
        example: { deficits: { psychological_capability: 'major_barrier', physical_opportunity: 'deficit' } },
      }), { status: 400, headers: JSON_HEADERS })
    }

    // Validate component names and severity levels
    const cleaned: Partial<ComBDeficits> = {}
    for (const [k, v] of Object.entries(body.deficits)) {
      if (!VALID_COMPONENTS.includes(k as any)) {
        return new Response(JSON.stringify({
          error: `Invalid COM-B component "${k}". Valid: ${VALID_COMPONENTS.join(', ')}.`,
        }), { status: 400, headers: JSON_HEADERS })
      }
      if (typeof v !== 'string' || !VALID_LEVELS.includes(v as DeficitLevel)) {
        return new Response(JSON.stringify({
          error: `Invalid deficit level "${v}" for "${k}". Valid: ${VALID_LEVELS.join(', ')}.`,
        }), { status: 400, headers: JSON_HEADERS })
      }
      cleaned[k as keyof ComBDeficits] = v as DeficitLevel
    }

    const recommendations = recommendInterventions(cleaned)

    return new Response(JSON.stringify({
      recommendations,
      citation: 'Michie, Atkins & West (2014). The Behaviour Change Wheel: A Guide to Designing Interventions. Silverback Publishing. Tables 2.1, 2.3, 2.7, 2.9.',
      wiki: 'https://irregularpedia.org/general/behavior-analysis/',
    }), { status: 200, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[comb-analysis/recommend] Error:', error)
    return new Response(JSON.stringify({ error: 'Recommendation failed' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
