/**
 * GET /api/frameworks/comb-analysis/canon
 *
 * Returns the full canonical Behaviour Change Wheel reference data:
 *   - 6 COM-B sub-components
 *   - 9 intervention functions (with definitions, examples)
 *   - 7 policy categories (with definitions, examples)
 *   - COM-B → intervention function matrix (Table 2.3)
 *   - intervention function → policy category matrix (Table 2.9)
 *   - 16 BCT groupings + the 93 BCTs in BCTTv1
 *   - function → BCT mapping (Table 3.3)
 *
 * No auth required; this is reference data. Cached at the edge for 1 hour.
 *
 * Response shape:
 *   {
 *     comb_components: [...],
 *     intervention_functions: [{ id, definition, example, applicable_to_comb: [...] }, ...],
 *     policy_categories: [{ id, definition, example, deliverable_intervention_functions: [...] }, ...],
 *     comb_to_intervention: { ... },          // Table 2.3
 *     intervention_to_policy: { ... },        // Table 2.9
 *     bct_groupings: [{ number, name }, ...],  // 16 groupings
 *     bct_by_function: { ... },                // Table 3.3
 *     citations: [...]
 *   }
 *
 * For agents/integrations that want the full canon as a single JSON document.
 */

import { optionsResponse } from '../../_shared/api-utils'
import {
  COM_B_INTERVENTION_MAP,
  INTERVENTION_POLICY_MAP,
  INTERVENTION_DEFINITIONS,
  POLICY_DEFINITIONS,
  BCT_GROUPINGS,
  BCT_BY_FUNCTION,
  type InterventionFunction,
  type PolicyCategory,
} from './_canon'

interface Env {}

export const onRequestOptions: PagesFunction<Env> = async () => optionsResponse()

export const onRequestGet: PagesFunction<Env> = async () => {
  // Build self-describing intervention functions
  const interventionFunctions = (Object.keys(INTERVENTION_DEFINITIONS) as InterventionFunction[]).map((id) => {
    const applicable = (Object.keys(COM_B_INTERVENTION_MAP) as Array<keyof typeof COM_B_INTERVENTION_MAP>)
      .filter((c) => COM_B_INTERVENTION_MAP[c].includes(id))
    return {
      id,
      definition: INTERVENTION_DEFINITIONS[id].definition,
      example: INTERVENTION_DEFINITIONS[id].example,
      applicable_to_comb: applicable,
      deliverable_via_policies: INTERVENTION_POLICY_MAP[id],
    }
  })

  // Build self-describing policy categories
  const policyCategories = (Object.keys(POLICY_DEFINITIONS) as PolicyCategory[]).map((id) => {
    const fns = (Object.keys(INTERVENTION_POLICY_MAP) as InterventionFunction[])
      .filter((f) => INTERVENTION_POLICY_MAP[f].includes(id))
    return {
      id,
      definition: POLICY_DEFINITIONS[id].definition,
      example: POLICY_DEFINITIONS[id].example,
      delivers_intervention_functions: fns,
    }
  })

  const body = {
    comb_components: [
      { id: 'physical_capability', label: 'Physical Capability', dimension: 'capability' },
      { id: 'psychological_capability', label: 'Psychological Capability', dimension: 'capability' },
      { id: 'physical_opportunity', label: 'Physical Opportunity', dimension: 'opportunity' },
      { id: 'social_opportunity', label: 'Social Opportunity', dimension: 'opportunity' },
      { id: 'reflective_motivation', label: 'Reflective Motivation', dimension: 'motivation' },
      { id: 'automatic_motivation', label: 'Automatic Motivation', dimension: 'motivation' },
    ],
    intervention_functions: interventionFunctions,
    policy_categories: policyCategories,
    comb_to_intervention: COM_B_INTERVENTION_MAP,
    intervention_to_policy: INTERVENTION_POLICY_MAP,
    bct_groupings: BCT_GROUPINGS,
    bct_by_function: BCT_BY_FUNCTION,
    citations: [
      'Michie, S., van Stralen, M.M., West, R. (2011). The behaviour change wheel: A new method for characterising and designing behaviour change interventions. Implementation Science 6:42.',
      'Michie, S., Atkins, L., West, R. (2014). The Behaviour Change Wheel: A Guide to Designing Interventions. Silverback Publishing. Tables 2.1, 2.3, 2.7, 2.9, 3.3.',
      'Michie, S., Richardson, M., Johnston, M., et al. (2013). The Behavior Change Technique Taxonomy (v1) of 93 hierarchically clustered techniques. Annals of Behavioral Medicine 46(1):81–95.',
    ],
    wiki: 'https://irregularpedia.org/general/behavior-analysis/',
    bct_taxonomy: 'https://www.ucl.ac.uk/health-psychology/BCTtaxonomy/',
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
