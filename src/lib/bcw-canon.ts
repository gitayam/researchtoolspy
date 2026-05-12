/**
 * Behaviour Change Wheel canonical reference data — SHARED single source of truth.
 *
 * Imported by:
 *   - Client: src/utils/behaviour-change-wheel.ts (re-exports types + maps)
 *   - Client: src/utils/bct-taxonomy.ts (re-exports BCT types + maps)
 *   - Server: functions/api/frameworks/comb-analysis/_canon.ts (re-exports)
 *
 * Pages Functions can import from this file because deploy.sh rsyncs the
 * referenced shared modules into dist/src/lib/ at build time. See
 * deploy.sh Step 2 ("Copy shared src/ modules referenced by functions
 * for function bundling").
 *
 * Sources:
 *   Michie, S., van Stralen, M.M., West, R. (2011). Implementation Science 6:42.
 *   Michie, S., Atkins, L., West, R. (2014). The Behaviour Change Wheel —
 *     A Guide to Designing Interventions. Silverback Publishing.
 *   Michie, S., Richardson, M., Johnston, M., et al. (2013). BCT Taxonomy v1
 *     of 93 hierarchically clustered techniques. Annals of Behavioral
 *     Medicine 46(1):81–95.
 *
 * Wiki summary: https://irregularpedia.org/general/behavior-analysis/
 * API docs: docs/api/COM_B_API.md
 */

export type ComBComponent =
  | 'physical_capability'
  | 'psychological_capability'
  | 'physical_opportunity'
  | 'social_opportunity'
  | 'reflective_motivation'
  | 'automatic_motivation'

export type DeficitLevel = 'adequate' | 'deficit' | 'major_barrier'

export type InterventionFunction =
  | 'education'
  | 'persuasion'
  | 'incentivisation'
  | 'coercion'
  | 'training'
  | 'restriction'
  | 'environmental_restructuring'
  | 'modelling'
  | 'enablement'

export type PolicyCategory =
  | 'communication_marketing'
  | 'guidelines'
  | 'fiscal_measures'
  | 'regulation'
  | 'legislation'
  | 'environmental_social_planning'
  | 'service_provision'

export type ComBDeficits = Record<ComBComponent, DeficitLevel>

// ─── COM-B → Intervention Function (BCW Guide Table 2.3) ─────────────────────

export const COM_B_INTERVENTION_MAP: Record<ComBComponent, InterventionFunction[]> = {
  physical_capability: ['training', 'enablement', 'environmental_restructuring'],
  psychological_capability: ['education', 'training', 'enablement'],
  physical_opportunity: ['restriction', 'environmental_restructuring', 'enablement'],
  social_opportunity: ['restriction', 'environmental_restructuring', 'modelling', 'enablement'],
  reflective_motivation: [
    'education',
    'persuasion',
    'incentivisation',
    'coercion',
    'modelling',
    'enablement',
  ],
  automatic_motivation: [
    'persuasion',
    'incentivisation',
    'coercion',
    'training',
    'restriction',
    'environmental_restructuring',
    'modelling',
    'enablement',
  ],
}

// ─── Intervention Function → Policy Categories (BCW Guide Table 2.9) ─────────

export const INTERVENTION_POLICY_MAP: Record<InterventionFunction, PolicyCategory[]> = {
  education: [
    'communication_marketing',
    'guidelines',
    'regulation',
    'legislation',
    'service_provision',
  ],
  persuasion: [
    'communication_marketing',
    'guidelines',
    'regulation',
    'legislation',
    'service_provision',
  ],
  incentivisation: [
    'communication_marketing',
    'guidelines',
    'fiscal_measures',
    'regulation',
    'legislation',
    'service_provision',
  ],
  coercion: [
    'communication_marketing',
    'guidelines',
    'fiscal_measures',
    'regulation',
    'legislation',
    'service_provision',
  ],
  training: [
    'guidelines',
    'fiscal_measures',
    'regulation',
    'legislation',
    'service_provision',
  ],
  restriction: ['guidelines', 'regulation', 'legislation'],
  environmental_restructuring: [
    'guidelines',
    'fiscal_measures',
    'regulation',
    'legislation',
    'environmental_social_planning',
  ],
  modelling: ['communication_marketing', 'service_provision'],
  enablement: [
    'guidelines',
    'fiscal_measures',
    'regulation',
    'legislation',
    'environmental_social_planning',
    'service_provision',
  ],
}

// ─── Intervention Function definitions (BCW Guide Table 2.1) ─────────────────

export const INTERVENTION_DEFINITIONS: Record<
  InterventionFunction,
  { definition: string; example: string }
> = {
  education: {
    definition: 'Increasing knowledge or understanding',
    example: 'Providing information to promote healthy eating',
  },
  persuasion: {
    definition: 'Using communication to induce positive or negative feelings or stimulate action',
    example: 'Using imagery to motivate increases in physical activity',
  },
  incentivisation: {
    definition: 'Creating an expectation of reward',
    example: 'Using prize draws to induce attempts to stop smoking',
  },
  coercion: {
    definition: 'Creating an expectation of punishment or cost',
    example: 'Raising the financial cost to reduce excessive alcohol consumption',
  },
  training: {
    definition: 'Imparting skills',
    example: 'Advanced driver training to increase safe driving',
  },
  restriction: {
    definition:
      'Using rules to reduce the opportunity to engage in the target behaviour (or to increase it by reducing the opportunity to engage in competing behaviours)',
    example: 'Prohibiting sales of solvents to people under 18 to reduce use for intoxication',
  },
  environmental_restructuring: {
    definition: 'Changing the physical or social context',
    example: 'Providing on-screen prompts for GPs to ask about smoking behaviour',
  },
  modelling: {
    definition: 'Providing an example for people to aspire to or imitate',
    example: 'Using TV drama scenes involving safe-sex practices to increase condom use',
  },
  enablement: {
    definition:
      'Increasing means / reducing barriers to increase capability (beyond education and training) or opportunity (beyond environmental restructuring)',
    example: 'Behavioural support for smoking cessation, medication, prostheses',
  },
}

// ─── Policy Category definitions (BCW Guide Table 2.7) ───────────────────────

export const POLICY_DEFINITIONS: Record<PolicyCategory, { definition: string; example: string }> = {
  communication_marketing: {
    definition: 'Using print, electronic, telephonic or broadcast media',
    example: 'Conducting mass media campaigns',
  },
  guidelines: {
    definition:
      'Creating documents that recommend or mandate practice. This includes all changes to service provision',
    example: 'Producing and disseminating treatment protocols',
  },
  fiscal_measures: {
    definition: 'Using the tax system to reduce or increase the financial cost',
    example: 'Increasing duty or anti-smuggling activities',
  },
  regulation: {
    definition: 'Establishing rules or principles of behaviour or practice',
    example: 'Establishing voluntary agreements on advertising',
  },
  legislation: {
    definition: 'Making or changing laws',
    example: 'Prohibiting sale or use',
  },
  environmental_social_planning: {
    definition: 'Designing and/or controlling the physical or social environment',
    example: 'Using town planning',
  },
  service_provision: {
    definition: 'Delivering a service',
    example: 'Establishing support services in workplaces, communities etc.',
  },
}

// ─── BCT Taxonomy v1 — 16 groupings, 93 BCTs ─────────────────────────────────
// Source: Michie, Richardson, Johnston, et al. (2013). Annals of Behavioral
// Medicine 46(1):81–95. Mirrors src/utils/bct-taxonomy.ts.

export interface BCT {
  id: string
  group: number
  label: string
}

export const BCT_GROUPINGS: { number: number; name: string }[] = [
  { number: 1, name: 'Goals and planning' },
  { number: 2, name: 'Feedback and monitoring' },
  { number: 3, name: 'Social support' },
  { number: 4, name: 'Shaping knowledge' },
  { number: 5, name: 'Natural consequences' },
  { number: 6, name: 'Comparison of behaviour' },
  { number: 7, name: 'Associations' },
  { number: 8, name: 'Repetition and substitution' },
  { number: 9, name: 'Comparison of outcomes' },
  { number: 10, name: 'Reward and threat' },
  { number: 11, name: 'Regulation' },
  { number: 12, name: 'Antecedents' },
  { number: 13, name: 'Identity' },
  { number: 14, name: 'Scheduled consequences' },
  { number: 15, name: 'Self-belief' },
  { number: 16, name: 'Covert learning' },
]

// ─── Function → BCT mapping (BCW Guide Table 3.3) ────────────────────────────

export const BCT_BY_FUNCTION: Record<
  InterventionFunction,
  { mostFrequent: string[]; lessFrequent: string[] }
> = {
  education: {
    mostFrequent: ['5.3', '5.1', '2.2', '2.7', '7.1', '2.3'],
    lessFrequent: ['2.6', '2.4', '7.2', '7.6', '4.2', '4.3', '4.4', '5.6', '6.3'],
  },
  persuasion: {
    mostFrequent: ['9.1', '5.3', '5.1', '2.2', '2.7'],
    lessFrequent: ['2.6', '4.3', '15.3', '15.1', '13.2', '13.5', '13.1', '5.6', '5.2', '6.3', '6.2'],
  },
  incentivisation: {
    mostFrequent: ['2.2', '2.7', '2.1', '2.5', '2.3'],
    lessFrequent: [
      '11.4', '2.6', '2.4', '7.2', '7.5', '14.4', '14.5', '14.6', '14.7', '14.9',
      '14.8', '14.3', '10.4', '10.2', '10.10', '10.9', '10.3', '10.6', '10.8',
      '1.8', '1.9', '1.6', '16.2',
    ],
  },
  coercion: {
    mostFrequent: ['2.2', '2.7', '2.1', '2.5', '2.3'],
    lessFrequent: [
      '2.6', '2.4', '7.4', '14.2', '14.1', '14.3', '10.11', '1.8', '1.9', '1.6',
      '13.3', '5.5', '16.1',
    ],
  },
  training: {
    mostFrequent: ['6.1', '4.1', '2.2', '2.7', '2.3', '8.1'],
    lessFrequent: ['2.6', '2.4', '8.3', '8.4', '8.7', '4.4', '15.2', '15.4', '10.9'],
  },
  restriction: {
    mostFrequent: [],
    lessFrequent: [],
    // Note: BCTTv1 contains no BCTs linked to Restriction — it focuses on changing
    // how people think/feel/react rather than the external environment that limits
    // behaviour (BCW Guide p. 156).
  },
  environmental_restructuring: {
    mostFrequent: ['12.5', '7.1', '12.1'],
    lessFrequent: ['7.2', '7.4', '7.5', '7.6', '7.7', '7.8', '7.3', '12.2'],
  },
  modelling: {
    mostFrequent: ['6.1'],
    lessFrequent: [],
  },
  enablement: {
    mostFrequent: [
      '3.1', '3.2', '1.1', '1.3', '12.5', '1.2', '1.4', '2.3', '12.1', '1.5', '1.7',
    ],
    lessFrequent: [],
  },
}

// ─── Recommendation engine ───────────────────────────────────────────────────

export type Severity = 'major_barrier' | 'deficit' | 'adequate'
export type Priority = 'high' | 'medium' | 'low'

export interface InterventionRecommendation {
  function: InterventionFunction
  priority: Priority
  definition: string
  example: string
  applicable_policies: PolicyCategory[]
}

export interface ComponentRecommendation {
  component: ComBComponent
  severity: Severity
  interventions: InterventionRecommendation[]
}

function determinePriority(level: DeficitLevel): Priority {
  if (level === 'major_barrier') return 'high'
  if (level === 'deficit') return 'medium'
  return 'low'
}

/**
 * For a set of COM-B deficits, return canon-backed intervention recommendations
 * per BCW Guide Tables 2.3, 2.1, and 2.9.
 *
 * Adequate components are skipped (no intervention needed).
 * Recommendations are sorted by severity (major_barrier → deficit) then
 * priority within each component.
 */
export function recommendInterventions(
  deficits: Partial<ComBDeficits>,
): ComponentRecommendation[] {
  const out: ComponentRecommendation[] = []
  for (const [comp, level] of Object.entries(deficits) as Array<[ComBComponent, DeficitLevel]>) {
    if (!level || level === 'adequate') continue
    if (!(comp in COM_B_INTERVENTION_MAP)) continue
    const fns = COM_B_INTERVENTION_MAP[comp]
    const interventions: InterventionRecommendation[] = fns.map((fn) => ({
      function: fn,
      priority: determinePriority(level),
      definition: INTERVENTION_DEFINITIONS[fn].definition,
      example: INTERVENTION_DEFINITIONS[fn].example,
      applicable_policies: INTERVENTION_POLICY_MAP[fn],
    }))
    out.push({ component: comp, severity: level as Severity, interventions })
  }
  // Sort major_barrier first, then deficit
  out.sort((a, b) => (a.severity === 'major_barrier' ? -1 : 1) - (b.severity === 'major_barrier' ? -1 : 1))
  return out
}
