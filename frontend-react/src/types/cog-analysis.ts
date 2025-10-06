// Center of Gravity (COG) Analysis Types
// Based on Joint Publication 3-0 and Irregularpedia COG Analysis Guide

// DIMEFIL Domains (extended from DIME to include Full Spectrum)
export const DIMEFILDomain = {
  DIPLOMATIC: 'diplomatic',
  INFORMATION: 'information',
  MILITARY: 'military',
  ECONOMIC: 'economic',
  FINANCIAL: 'financial',
  INTELLIGENCE: 'intelligence',
  LAW_ENFORCEMENT: 'law_enforcement',
  CYBER: 'cyber',
  SPACE: 'space',
} as const

export type DIMEFILDomain = typeof DIMEFILDomain[keyof typeof DIMEFILDomain]

// Actor Categories for COG Analysis
export const ActorCategory = {
  FRIENDLY: 'friendly',
  ADVERSARY: 'adversary',
  HOST_NATION: 'host_nation',
  THIRD_PARTY: 'third_party',
} as const

export type ActorCategory = typeof ActorCategory[keyof typeof ActorCategory]

// Scoring Systems
export const ScoringSystem = {
  LINEAR: 'linear',        // 1-5 linear scale
  LOGARITHMIC: 'logarithmic', // 1, 3, 5, 8, 12 scale for exponential impact
} as const

export type ScoringSystem = typeof ScoringSystem[keyof typeof ScoringSystem]

// Linear scoring scale: 1-5
export const LinearScoreValues = [1, 2, 3, 4, 5] as const
export type LinearScore = typeof LinearScoreValues[number]

// Logarithmic scoring scale: 1, 3, 5, 8, 12
export const LogarithmicScoreValues = [1, 3, 5, 8, 12] as const
export type LogarithmicScore = typeof LogarithmicScoreValues[number]

// Score type (union of both)
export type Score = LinearScore | LogarithmicScore

// Scoring Criteria
export interface ScoringCriteria {
  impact_on_cog: Score          // How significantly would this affect the COG?
  attainability: Score          // How feasible is addressing this?
  follow_up_potential: Score    // What strategic advantages does this enable?
}

// Operational Context (Guided Questions)
export interface OperationalContext {
  objective: string              // What is the operational objective?
  desired_impact: string         // What impact do we want to achieve?
  our_identity: string          // Who are we? (friendly forces description)
  operating_environment: string  // Where are we operating? (PMESII-PT context)
  constraints: string[]         // What constraints limit us? (legal, policy, resource)
  restraints: string[]          // What restraints restrict us? (rules of engagement, etc.)
  timeframe: string             // What is the operational timeframe?
  strategic_level: 'tactical' | 'operational' | 'strategic'
}

// Center of Gravity Entity
export interface CenterOfGravity {
  id: string
  actor_category: ActorCategory
  actor_name?: string           // Optional: Link to actor entity
  actor_id?: string             // Optional: Link to actor entity ID
  domain: DIMEFILDomain
  description: string
  rationale: string             // Why is this a COG?
  linked_evidence: string[]     // Evidence IDs supporting this COG
}

// Critical Capability (VERBS - what the COG can DO)
export interface CriticalCapability {
  id: string
  cog_id: string                // Parent COG
  capability: string            // Action/verb (e.g., "Project Power", "Influence Public Perception")
  description: string
  strategic_contribution: string // How does this support the actor's objectives?
  scoring?: ScoringCriteria     // Optional scoring
  composite_score?: number      // Calculated composite score
  linked_evidence: string[]
}

// Critical Requirement (NOUNS - resources/conditions NEEDED)
export interface CriticalRequirement {
  id: string
  capability_id: string         // Parent capability
  requirement: string           // Resource/condition (e.g., "Logistics Support", "Trained Personnel")
  requirement_type: 'personnel' | 'equipment' | 'logistics' | 'information' | 'infrastructure' | 'other'
  description: string
  linked_evidence: string[]
}

// Critical Vulnerability (NOUNS - deficient or vulnerable aspects)
export interface CriticalVulnerability {
  id: string
  requirement_id: string        // Parent requirement
  vulnerability: string         // Specific weakness (e.g., "Single Point of Failure", "Resource Constraint")
  vulnerability_type: 'physical' | 'cyber' | 'human' | 'logistical' | 'informational' | 'other'
  description: string
  exploitation_method?: string  // How can this be exploited?
  scoring: ScoringCriteria      // Required scoring for prioritization
  composite_score: number       // Calculated composite score
  priority_rank?: number        // Calculated rank based on score
  linked_evidence: string[]
}

// Complete COG Analysis
export interface COGAnalysis {
  id: string
  title: string
  description: string

  // Operational Context
  operational_context: OperationalContext

  // Scoring Configuration
  scoring_system: ScoringSystem

  // COG Entities and their breakdown
  centers_of_gravity: CenterOfGravity[]
  critical_capabilities: CriticalCapability[]
  critical_requirements: CriticalRequirement[]
  critical_vulnerabilities: CriticalVulnerability[]

  // Network Analysis Results
  network_analysis?: {
    edge_list: NetworkEdge[]
    centrality_measures: CentralityMeasures
    key_nodes: string[]          // Most critical nodes
  }

  // Metadata
  created_at: string
  updated_at: string
  created_by: number
  status: 'draft' | 'active' | 'archived'
}

// Network Edge (for edge list export)
export interface NetworkEdge {
  source: string                 // Node ID
  source_type: 'cog' | 'capability' | 'requirement' | 'vulnerability'
  target: string                 // Node ID
  target_type: 'cog' | 'capability' | 'requirement' | 'vulnerability'
  weight: number                 // Edge weight (composite score or 1)
  relationship: 'enables' | 'requires' | 'exposes'
}

// Centrality Measures (for network analysis)
export interface CentralityMeasures {
  degree_centrality: Record<string, number>      // Number of connections
  betweenness_centrality: Record<string, number> // How often node is on shortest paths
  closeness_centrality: Record<string, number>   // Average distance to all nodes
  eigenvector_centrality: Record<string, number> // Importance based on connections to important nodes
}

// COG Form Data (for creating/editing)
export interface COGFormData {
  title: string
  description: string
  operational_context: OperationalContext
  scoring_system: ScoringSystem
  centers_of_gravity: Omit<CenterOfGravity, 'id'>[]
  critical_capabilities: Omit<CriticalCapability, 'id'>[]
  critical_requirements: Omit<CriticalRequirement, 'id'>[]
  critical_vulnerabilities: Omit<CriticalVulnerability, 'id'>[]
}

// Scoring Descriptions
export const ScoringDescriptions = {
  impact_on_cog: {
    name: 'Impact on COG (I)',
    definition: 'How significantly would exploiting the vulnerability affect the COG\'s essential functionality or stability?',
    linear: {
      1: 'Negligible - Minimal impact',
      2: 'Minor - Some disruption',
      3: 'Moderate - Noticeable degradation',
      4: 'Major - Significant impairment',
      5: 'Critical - Complete failure',
    },
    logarithmic: {
      1: 'Negligible impact',
      3: 'Minor disruption',
      5: 'Moderate degradation',
      8: 'Major impairment',
      12: 'Critical failure or mission failure',
    },
  },
  attainability: {
    name: 'Attainability (A)',
    definition: 'How feasible is exploiting or mitigating this vulnerability with available resources, capabilities, and constraints?',
    linear: {
      1: 'Very difficult - Requires extraordinary resources',
      2: 'Difficult - Significant resources required',
      3: 'Moderate - Standard resources needed',
      4: 'Easy - Readily available resources',
      5: 'Very easy - Minimal resources required',
    },
    logarithmic: {
      1: 'Extreme difficulty',
      3: 'Significant challenge',
      5: 'Moderate effort',
      8: 'Readily achievable',
      12: 'Easily achievable with minimal resources',
    },
  },
  follow_up_potential: {
    name: 'Potential for Follow-Up Actions (F)',
    definition: 'What strategic advantages or additional actions does addressing this vulnerability enable?',
    linear: {
      1: 'None - No follow-up opportunities',
      2: 'Limited - Few additional options',
      3: 'Moderate - Some strategic advantages',
      4: 'Significant - Multiple follow-up options',
      5: 'Extensive - Opens many strategic opportunities',
    },
    logarithmic: {
      1: 'No follow-up potential',
      3: 'Limited opportunities',
      5: 'Moderate strategic advantage',
      8: 'Significant cascading effects',
      12: 'Transformational strategic advantage',
    },
  },
} as const

// Helper functions
export function calculateCompositeScore(scoring: ScoringCriteria): number {
  return scoring.impact_on_cog + scoring.attainability + scoring.follow_up_potential
}

export function rankVulnerabilitiesByScore(vulnerabilities: CriticalVulnerability[]): CriticalVulnerability[] {
  return [...vulnerabilities]
    .sort((a, b) => b.composite_score - a.composite_score)
    .map((v, index) => ({ ...v, priority_rank: index + 1 }))
}

export function generateEdgeList(analysis: COGAnalysis): NetworkEdge[] {
  const edges: NetworkEdge[] = []

  // COG -> Capabilities
  analysis.critical_capabilities.forEach(cap => {
    edges.push({
      source: cap.cog_id,
      source_type: 'cog',
      target: cap.id,
      target_type: 'capability',
      weight: cap.composite_score || 1,
      relationship: 'enables',
    })
  })

  // Capabilities -> Requirements
  analysis.critical_requirements.forEach(req => {
    edges.push({
      source: req.capability_id,
      source_type: 'capability',
      target: req.id,
      target_type: 'requirement',
      weight: 1,
      relationship: 'requires',
    })
  })

  // Requirements -> Vulnerabilities
  analysis.critical_vulnerabilities.forEach(vuln => {
    edges.push({
      source: vuln.requirement_id,
      source_type: 'requirement',
      target: vuln.id,
      target_type: 'vulnerability',
      weight: vuln.composite_score,
      relationship: 'exposes',
    })
  })

  return edges
}

// Calculate basic centrality measures
export function calculateCentralityMeasures(edges: NetworkEdge[]): CentralityMeasures {
  // Build adjacency map
  const adjacency = new Map<string, Set<string>>()
  const nodes = new Set<string>()

  edges.forEach(edge => {
    nodes.add(edge.source)
    nodes.add(edge.target)

    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set())
    }
    adjacency.get(edge.source)!.add(edge.target)
  })

  // Degree Centrality
  const degree_centrality: Record<string, number> = {}
  nodes.forEach(node => {
    degree_centrality[node] = adjacency.get(node)?.size || 0
  })

  // For this simplified version, we'll use degree as a proxy for other measures
  // A full implementation would use proper algorithms (BFS for betweenness, etc.)
  const betweenness_centrality: Record<string, number> = { ...degree_centrality }
  const closeness_centrality: Record<string, number> = { ...degree_centrality }
  const eigenvector_centrality: Record<string, number> = { ...degree_centrality }

  return {
    degree_centrality,
    betweenness_centrality,
    closeness_centrality,
    eigenvector_centrality,
  }
}
