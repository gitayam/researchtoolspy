/**
 * POST /api/frameworks/comb-analysis/recommend-bcts
 *
 * Given a list of selected intervention functions, return the recommended
 * Behaviour Change Techniques (BCTs) per BCW Guide Table 3.3 and BCTTv1.
 *
 * Request body:
 *   { functions: ['education', 'training', ...] }
 *
 * Response:
 *   {
 *     by_function: {
 *       education: { mostFrequent: ['5.3', '5.1', ...], lessFrequent: [...] },
 *       training: { mostFrequent: ['6.1', '4.1', ...], lessFrequent: [...] }
 *     },
 *     all_recommended: [   // de-duplicated union, with grouping context
 *       { id: '5.3', group: 5, group_name: 'Natural consequences',
 *         from_functions: ['education'], priority: 'most_frequent' },
 *       { id: '6.1', group: 6, group_name: 'Comparison of behaviour',
 *         from_functions: ['training'], priority: 'most_frequent' },
 *       ...
 *     ],
 *     citations: ['Michie/Atkins/West 2014, Table 3.3', 'Michie 2013, BCTTv1']
 *   }
 *
 * Sources:
 *   Michie, Atkins, West (2014) BCW Guide, Table 3.3 (function → BCT mapping).
 *   Michie, Richardson, Johnston, et al. (2013). Annals of Behavioral
 *     Medicine 46(1):81–95 (BCTTv1).
 *   Official taxonomy: https://www.ucl.ac.uk/health-psychology/BCTtaxonomy/
 */

import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import {
  BCT_BY_FUNCTION,
  BCT_GROUPINGS,
  type InterventionFunction,
} from './_canon'

interface Env {
  DB: D1Database
}

const VALID_FUNCTIONS: InterventionFunction[] = [
  'education',
  'persuasion',
  'incentivisation',
  'coercion',
  'training',
  'restriction',
  'environmental_restructuring',
  'modelling',
  'enablement',
]

const groupNumberFromBctId = (id: string): number => Number(id.split('.')[0])
const groupNameByNumber = (n: number): string =>
  BCT_GROUPINGS.find((g) => g.number === n)?.name ?? `Group ${n}`

export const onRequestOptions: PagesFunction<Env> = async () => optionsResponse()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { functions?: string[] }

    if (!body || !Array.isArray(body.functions) || body.functions.length === 0) {
      return new Response(JSON.stringify({
        error: 'Request body must include a non-empty "functions" array.',
        example: { functions: ['education', 'training'] },
      }), { status: 400, headers: JSON_HEADERS })
    }

    // Validate functions
    const invalid = body.functions.filter((f) => !VALID_FUNCTIONS.includes(f as InterventionFunction))
    if (invalid.length > 0) {
      return new Response(JSON.stringify({
        error: `Invalid intervention functions: ${invalid.join(', ')}. Valid: ${VALID_FUNCTIONS.join(', ')}.`,
      }), { status: 400, headers: JSON_HEADERS })
    }

    const fns = body.functions as InterventionFunction[]

    // Per-function breakdown
    const byFunction: Record<string, { mostFrequent: string[]; lessFrequent: string[] }> = {}
    for (const fn of fns) {
      byFunction[fn] = BCT_BY_FUNCTION[fn]
    }

    // Aggregated, de-duplicated, with provenance
    type AggBCT = {
      id: string
      group: number
      group_name: string
      from_functions: InterventionFunction[]
      priority: 'most_frequent' | 'less_frequent'
    }
    const agg = new Map<string, AggBCT>()
    for (const fn of fns) {
      for (const id of BCT_BY_FUNCTION[fn].mostFrequent) {
        const g = groupNumberFromBctId(id)
        const existing = agg.get(id)
        if (existing) {
          if (!existing.from_functions.includes(fn)) existing.from_functions.push(fn)
          // most_frequent wins over less_frequent
          existing.priority = 'most_frequent'
        } else {
          agg.set(id, {
            id,
            group: g,
            group_name: groupNameByNumber(g),
            from_functions: [fn],
            priority: 'most_frequent',
          })
        }
      }
      for (const id of BCT_BY_FUNCTION[fn].lessFrequent) {
        const g = groupNumberFromBctId(id)
        const existing = agg.get(id)
        if (existing) {
          if (!existing.from_functions.includes(fn)) existing.from_functions.push(fn)
        } else {
          agg.set(id, {
            id,
            group: g,
            group_name: groupNameByNumber(g),
            from_functions: [fn],
            priority: 'less_frequent',
          })
        }
      }
    }
    const allRecommended = Array.from(agg.values()).sort((a, b) => {
      // most_frequent first, then by group number, then by id numerically
      if (a.priority !== b.priority) return a.priority === 'most_frequent' ? -1 : 1
      if (a.group !== b.group) return a.group - b.group
      return a.id.localeCompare(b.id, undefined, { numeric: true })
    })

    return new Response(JSON.stringify({
      by_function: byFunction,
      all_recommended: allRecommended,
      citations: [
        'Michie, Atkins & West (2014). The Behaviour Change Wheel: A Guide to Designing Interventions, Table 3.3.',
        'Michie, Richardson, Johnston, et al. (2013). Annals of Behavioral Medicine 46(1):81–95.',
      ],
      wiki: 'https://irregularpedia.org/general/behavior-analysis/',
      taxonomy: 'https://www.ucl.ac.uk/health-psychology/BCTtaxonomy/',
    }), { status: 200, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[comb-analysis/recommend-bcts] Error:', error)
    return new Response(JSON.stringify({ error: 'BCT recommendation failed' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
