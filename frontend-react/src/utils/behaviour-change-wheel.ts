/**
 * Behaviour Change Wheel (BCW) Utility Functions
 *
 * Based on Michie, S., van Stralen, M. M., & West, R. (2011).
 * The behaviour change wheel: A new method for characterising and
 * designing behaviour change interventions.
 * Implementation Science, 6(1), 42.
 *
 * This module implements the BCW methodology for translating COM-B
 * deficits into intervention function recommendations and policy categories.
 */

import type {
  ComBComponent,
  DeficitLevel,
  InterventionFunction,
  PolicyCategory,
  ComBDeficits,
  InterventionDetail,
  InterventionRecommendation,
  PolicyRecommendation,
} from '@/types/behavior-change-wheel'

/**
 * COM-B to Intervention Function Mapping
 * Based on Michie et al. (2011) Table 3
 *
 * Maps each COM-B component to applicable intervention functions.
 * An 'X' in the original paper indicates applicability.
 */
export const COM_B_INTERVENTION_MAP: Record<ComBComponent, InterventionFunction[]> = {
  physical_capability: [
    'training',
    'enablement',
    'environmental_restructuring',
  ],
  psychological_capability: [
    'education',
    'training',
    'enablement',
  ],
  physical_opportunity: [
    'restriction',
    'environmental_restructuring',
    'enablement',
  ],
  social_opportunity: [
    'restriction',
    'environmental_restructuring',
    'modelling',
    'enablement',
  ],
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

/**
 * Intervention Function Descriptions
 * Provides detailed information about each intervention type
 */
export const INTERVENTION_DESCRIPTIONS: Record<
  InterventionFunction,
  {
    name: string
    definition: string
    examples: string[]
    evidenceBase: string
  }
> = {
  education: {
    name: 'Education',
    definition: 'Increasing knowledge or understanding',
    examples: [
      'Providing information to promote healthy eating',
      'Teaching literacy skills',
      'Public health awareness campaigns',
      'Safety training workshops',
    ],
    evidenceBase:
      'Most effective when combined with other interventions. Works best for reflective motivation and psychological capability deficits.',
  },
  persuasion: {
    name: 'Persuasion',
    definition: 'Using communication to induce positive or negative feelings or stimulate action',
    examples: [
      'Using imagery to motivate increases in physical activity',
      'Promoting healthy behaviors through testimonials',
      'Fear appeals for smoking cessation',
      'Social marketing campaigns',
    ],
    evidenceBase:
      'Effective for both reflective and automatic motivation. Often combined with education and modeling.',
  },
  incentivisation: {
    name: 'Incentivisation',
    definition: 'Creating expectation of reward',
    examples: [
      'Using prize draws to induce attempts to quit smoking',
      'Financial incentives for health behaviors',
      'Loyalty programs for desired behaviors',
      'Recognition and awards systems',
    ],
    evidenceBase:
      'Strong short-term effects on motivation. May require continued reinforcement for sustained behavior change.',
  },
  coercion: {
    name: 'Coercion',
    definition: 'Creating expectation of punishment or cost',
    examples: [
      'Raising the financial cost to reduce excessive alcohol consumption',
      'Fines for undesired behaviors',
      'Legal penalties for non-compliance',
      'Social sanctions',
    ],
    evidenceBase:
      'Can be effective but may have negative side effects. Consider ethical implications and acceptability.',
  },
  training: {
    name: 'Training',
    definition: 'Imparting skills through repeated practice and feedback',
    examples: [
      'Training healthcare professionals in behavior change methods',
      'Skills workshops for smoking cessation',
      'Physical rehabilitation programs',
      'Communication skills training',
    ],
    evidenceBase:
      'Highly effective for capability deficits. Requires active practice and feedback mechanisms.',
  },
  restriction: {
    name: 'Restriction',
    definition: 'Using rules to reduce the opportunity to engage in the target behavior',
    examples: [
      'Prohibiting smoking in public places',
      'Age restrictions on alcohol purchase',
      'Limiting access to unhealthy foods',
      'Regulatory controls on advertising',
    ],
    evidenceBase:
      'Effective for reducing opportunity for undesired behaviors. May face acceptability and equity challenges.',
  },
  environmental_restructuring: {
    name: 'Environmental Restructuring',
    definition: 'Changing the physical or social context',
    examples: [
      'Providing free fruit in schools',
      'Designing buildings to promote stair use',
      'Urban planning for walkability',
      'Reorganizing workplace layouts',
    ],
    evidenceBase:
      'Addresses both physical and social opportunity. Often sustainable and equitable but may require significant resources.',
  },
  modelling: {
    name: 'Modelling',
    definition: 'Providing an example for people to aspire to or imitate',
    examples: [
      'Using social norm feedback to reduce alcohol consumption',
      'Celebrity endorsements of healthy behaviors',
      'Peer support and mentoring programs',
      'Demonstrating desired techniques',
    ],
    evidenceBase:
      'Leverages social learning theory. Effective for social opportunity and motivation when models are credible and relatable.',
  },
  enablement: {
    name: 'Enablement',
    definition: 'Increasing means/reducing barriers to increase capability or opportunity',
    examples: [
      'Behavioral support for smoking cessation',
      'Providing free or subsidized resources',
      'Medication to reduce withdrawal symptoms',
      'Assistive technologies and tools',
    ],
    evidenceBase:
      'Broadly applicable across COM-B components. Often used in combination with other interventions for maximum effectiveness.',
  },
}

/**
 * Intervention to Policy Category Mapping
 * Based on Michie et al. (2011) Table 4
 */
export const INTERVENTION_POLICY_MAP: Record<InterventionFunction, PolicyCategory[]> = {
  education: ['communication_marketing', 'guidelines', 'service_provision'],
  persuasion: ['communication_marketing', 'guidelines', 'service_provision'],
  incentivisation: [
    'communication_marketing',
    'fiscal_measures',
    'regulation',
    'legislation',
    'service_provision',
  ],
  coercion: ['fiscal_measures', 'regulation', 'legislation', 'service_provision'],
  training: ['guidelines', 'service_provision'],
  restriction: ['regulation', 'legislation', 'environmental_social_planning'],
  environmental_restructuring: [
    'fiscal_measures',
    'regulation',
    'legislation',
    'environmental_social_planning',
    'service_provision',
  ],
  modelling: ['communication_marketing', 'guidelines', 'environmental_social_planning'],
  enablement: [
    'communication_marketing',
    'guidelines',
    'fiscal_measures',
    'regulation',
    'legislation',
    'environmental_social_planning',
    'service_provision',
  ],
}

/**
 * Policy Category Descriptions
 */
export const POLICY_DESCRIPTIONS: Record<
  PolicyCategory,
  {
    name: string
    description: string
    examples: string[]
  }
> = {
  communication_marketing: {
    name: 'Communication/Marketing',
    description: 'Using print, electronic, telephonic or broadcast media',
    examples: [
      'Mass media campaigns',
      'Social media initiatives',
      'Public service announcements',
      'Health promotion materials',
    ],
  },
  guidelines: {
    name: 'Guidelines',
    description: 'Creating documents that recommend or mandate practice',
    examples: [
      'Clinical practice guidelines',
      'Best practice recommendations',
      'Professional standards',
      'Organizational policies',
    ],
  },
  fiscal_measures: {
    name: 'Fiscal Measures',
    description: 'Using the tax system to reduce or increase financial cost',
    examples: [
      'Taxation on tobacco and alcohol',
      'Subsidies for healthy foods',
      'Tax incentives for desired behaviors',
      'Financial penalties for violations',
    ],
  },
  regulation: {
    name: 'Regulation',
    description: 'Establishing rules or principles of behavior or practice',
    examples: [
      'Setting industry standards',
      'Licensing requirements',
      'Safety regulations',
      'Advertising restrictions',
    ],
  },
  legislation: {
    name: 'Legislation',
    description: 'Making or changing laws',
    examples: [
      'Smoking bans in public places',
      'Seatbelt laws',
      'Age restrictions on purchases',
      'Environmental protection laws',
    ],
  },
  environmental_social_planning: {
    name: 'Environmental/Social Planning',
    description: 'Designing and controlling the physical or social environment',
    examples: [
      'Urban planning for walkability',
      'Workplace layout design',
      'Community development programs',
      'Infrastructure improvements',
    ],
  },
  service_provision: {
    name: 'Service Provision',
    description: 'Delivering a service',
    examples: [
      'Smoking cessation clinics',
      'Health screening services',
      'Counseling and support programs',
      'Educational workshops',
    ],
  },
}

/**
 * Determine priority level based on deficit severity
 */
function determinePriority(
  deficitLevel: DeficitLevel,
  interventionType: InterventionFunction
): 'high' | 'medium' | 'low' {
  // Major barriers always get high priority
  if (deficitLevel === 'major_barrier') {
    return 'high'
  }

  // Deficits get medium or high priority based on intervention type
  if (deficitLevel === 'deficit') {
    // Core interventions that directly address deficits get high priority
    const highPriorityInterventions: InterventionFunction[] = [
      'education',
      'training',
      'environmental_restructuring',
      'enablement',
    ]
    return highPriorityInterventions.includes(interventionType) ? 'high' : 'medium'
  }

  // Adequate capability/opportunity/motivation - low priority for intervention
  return 'low'
}

/**
 * Get implementation considerations for an intervention
 */
function getImplementationConsiderations(
  intervention: InterventionFunction,
  component: ComBComponent
): string[] {
  const baseConsiderations: Record<InterventionFunction, string[]> = {
    education: [
      'Ensure information is accessible and culturally appropriate',
      'Use multiple channels for delivery',
      'Combine with skill-building components',
      'Assess baseline knowledge before designing content',
    ],
    persuasion: [
      'Use credible and relatable messengers',
      'Frame messages positively when possible',
      'Consider emotional and rational appeals',
      'Test messages with target audience',
    ],
    incentivisation: [
      'Design sustainable incentive structures',
      'Consider intrinsic vs. extrinsic motivation',
      'Monitor for unintended consequences',
      'Plan for incentive withdrawal or reduction',
    ],
    coercion: [
      'Assess ethical implications carefully',
      'Ensure fairness and equity in application',
      'Provide support for compliance',
      'Monitor for displacement or avoidance behaviors',
    ],
    training: [
      'Include repeated practice opportunities',
      'Provide constructive feedback',
      'Ensure trainers are qualified',
      'Assess skill acquisition and retention',
    ],
    restriction: [
      'Consider acceptability and equity impacts',
      'Ensure enforcement mechanisms are in place',
      'Provide alternatives or support',
      'Monitor for workarounds or black markets',
    ],
    environmental_restructuring: [
      'Conduct environmental assessment before changes',
      'Engage stakeholders in design',
      'Consider maintenance and sustainability',
      'Evaluate impact on different population groups',
    ],
    modelling: [
      'Select credible and relatable models',
      'Demonstrate complete behavior sequences',
      'Make behavior observable and concrete',
      'Reinforce positive role models',
    ],
    enablement: [
      'Identify specific barriers to address',
      'Provide ongoing support and resources',
      'Ensure accessibility and availability',
      'Monitor utilization and outcomes',
    ],
  }

  const componentSpecific: Record<ComBComponent, string[]> = {
    physical_capability: [
      'Assess current physical abilities',
      'Provide adaptive equipment if needed',
      'Monitor for health and safety issues',
    ],
    psychological_capability: [
      'Address literacy and comprehension levels',
      'Consider cognitive load and complexity',
      'Provide decision aids if needed',
    ],
    physical_opportunity: [
      'Audit environmental barriers',
      'Ensure equitable access to resources',
      'Consider geographical and temporal factors',
    ],
    social_opportunity: [
      'Understand cultural context and norms',
      'Engage community leaders and influencers',
      'Address stigma and social barriers',
    ],
    reflective_motivation: [
      'Align with personal values and goals',
      'Address competing priorities',
      'Support goal-setting and planning',
    ],
    automatic_motivation: [
      'Address emotional barriers and triggers',
      'Build positive associations and habits',
      'Manage stress and negative emotions',
    ],
  }

  return [...baseConsiderations[intervention], ...componentSpecific[component]]
}

/**
 * Generate intervention recommendations based on COM-B deficits
 */
export function generateInterventionRecommendations(
  deficits: ComBDeficits
): InterventionRecommendation[] {
  const recommendations: InterventionRecommendation[] = []

  // Component display names
  const componentNames: Record<ComBComponent, string> = {
    physical_capability: 'Physical Capability',
    psychological_capability: 'Psychological Capability',
    physical_opportunity: 'Physical Opportunity',
    social_opportunity: 'Social Opportunity',
    reflective_motivation: 'Reflective Motivation',
    automatic_motivation: 'Automatic Motivation',
  }

  // Iterate through each COM-B component
  for (const [component, deficitLevel] of Object.entries(deficits) as Array<
    [ComBComponent, DeficitLevel]
  >) {
    // Skip if adequate (no intervention needed)
    if (deficitLevel === 'adequate') {
      continue
    }

    // Get applicable interventions for this component
    const applicableInterventions = COM_B_INTERVENTION_MAP[component]

    // Generate intervention details for each applicable intervention
    const interventions: InterventionDetail[] = applicableInterventions.map((intervention) => {
      const info = INTERVENTION_DESCRIPTIONS[intervention]
      const priority = determinePriority(deficitLevel, intervention)
      const policies = INTERVENTION_POLICY_MAP[intervention]
      const considerations = getImplementationConsiderations(intervention, component)

      return {
        name: intervention,
        priority,
        description: info.definition,
        evidence_base: info.evidenceBase,
        implementation_considerations: considerations,
        applicable_policies: policies,
      }
    })

    // Sort interventions by priority (high first)
    interventions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    recommendations.push({
      component: componentNames[component],
      component_code: component,
      severity: deficitLevel,
      interventions,
    })
  }

  // Sort recommendations by severity (major_barrier first)
  recommendations.sort((a, b) => {
    const severityOrder = { major_barrier: 0, deficit: 1, adequate: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  return recommendations
}

/**
 * Generate policy recommendations based on selected interventions
 */
export function generatePolicyRecommendations(
  selectedInterventions: InterventionFunction[]
): PolicyRecommendation[] {
  // Aggregate all applicable policies across selected interventions
  const policySet = new Set<PolicyCategory>()
  const policyToInterventions: Record<PolicyCategory, InterventionFunction[]> = {
    communication_marketing: [],
    guidelines: [],
    fiscal_measures: [],
    regulation: [],
    legislation: [],
    environmental_social_planning: [],
    service_provision: [],
  }

  for (const intervention of selectedInterventions) {
    const policies = INTERVENTION_POLICY_MAP[intervention]
    for (const policy of policies) {
      policySet.add(policy)
      policyToInterventions[policy].push(intervention)
    }
  }

  // Generate policy recommendations
  const recommendations: PolicyRecommendation[] = Array.from(policySet).map((policy) => {
    const info = POLICY_DESCRIPTIONS[policy]
    return {
      policy,
      name: info.name,
      description: info.description,
      suitable_for_interventions: policyToInterventions[policy],
      examples: info.examples,
    }
  })

  return recommendations
}

/**
 * Assess overall behavior change feasibility
 */
export function assessBehaviorChangeFeasibility(deficits: ComBDeficits): {
  feasibility: 'high' | 'medium' | 'low'
  barriers: string[]
  strengths: string[]
  recommendations: string[]
} {
  let majorBarrierCount = 0
  let deficitCount = 0
  let adequateCount = 0
  const barriers: string[] = []
  const strengths: string[] = []

  const componentNames: Record<ComBComponent, string> = {
    physical_capability: 'Physical Capability',
    psychological_capability: 'Psychological Capability',
    physical_opportunity: 'Physical Opportunity',
    social_opportunity: 'Social Opportunity',
    reflective_motivation: 'Reflective Motivation',
    automatic_motivation: 'Automatic Motivation',
  }

  for (const [component, level] of Object.entries(deficits) as Array<[ComBComponent, DeficitLevel]>) {
    if (level === 'major_barrier') {
      majorBarrierCount++
      barriers.push(`${componentNames[component]} is a major barrier`)
    } else if (level === 'deficit') {
      deficitCount++
      barriers.push(`${componentNames[component]} shows deficits`)
    } else {
      adequateCount++
      strengths.push(`${componentNames[component]} is adequate`)
    }
  }

  // Determine feasibility
  let feasibility: 'high' | 'medium' | 'low'
  if (majorBarrierCount >= 3) {
    feasibility = 'low'
  } else if (majorBarrierCount >= 1 || deficitCount >= 4) {
    feasibility = 'medium'
  } else {
    feasibility = 'high'
  }

  // Generate recommendations
  const recommendations: string[] = []

  if (majorBarrierCount > 0) {
    recommendations.push(
      'Address major barriers first before implementing other interventions'
    )
    recommendations.push(
      'Consider multi-component interventions targeting multiple COM-B domains'
    )
  }

  if (deficitCount > 2) {
    recommendations.push(
      'Prioritize interventions based on resource availability and evidence base'
    )
  }

  if (adequateCount >= 4) {
    recommendations.push(
      'Leverage existing strengths in capability, opportunity, or motivation'
    )
  }

  recommendations.push(
    'Use the Behaviour Change Wheel to select appropriate intervention functions'
  )
  recommendations.push(
    'Consider policy categories to support and scale selected interventions'
  )

  return {
    feasibility,
    barriers,
    strengths,
    recommendations,
  }
}
