/**
 * Hamilton's Rule Analysis Types
 *
 * Hamilton's Rule: A behavior is favored by natural selection when rB > C
 * - r = relatedness (genetic/social closeness between actor and recipient, 0-1)
 * - B = benefit to recipient (fitness/resource units)
 * - C = cost to actor (same units as B)
 *
 * Supports both pairwise (1v1) analysis and network (1-to-many) analysis.
 */

/**
 * Analysis mode
 */
export type HamiltonMode = 'pairwise' | 'network'

/**
 * Actor type classification
 */
export type HamiltonActorType = 'individual' | 'group' | 'organization' | 'state' | 'other'

/**
 * Network stability assessment
 */
export type NetworkStability = 'stable' | 'unstable' | 'transitional'

/**
 * An actor in the Hamilton Rule analysis
 */
export interface HamiltonActor {
  id: string
  name: string
  type: HamiltonActorType
  role?: string
  description?: string
  group?: string  // For grouping actors in network view
}

/**
 * A relationship between two actors
 * This is the core unit of Hamilton's Rule analysis
 */
export interface HamiltonRelationship {
  id: string
  actor_id: string        // Who performs the behavior
  recipient_id: string    // Who benefits/suffers

  // Hamilton's Rule components
  relatedness: number     // r: 0.0-1.0 (genetic/social closeness)
  benefit: number         // B: benefit to recipient (any unit)
  cost: number            // C: cost to actor (same unit as B)

  // Calculated fields
  hamilton_score: number  // rB - C
  passes_rule: boolean    // rB > C

  // Context
  behavior_description?: string
  evidence_notes?: string
  confidence?: number     // 0-100, confidence in r, B, C values
}

/**
 * Network-level analysis results (for 1-to-many mode)
 */
export interface HamiltonNetworkAnalysis {
  total_cooperation_score: number     // Sum of positive Hamilton scores
  total_defection_score: number       // Sum of negative Hamilton scores
  net_cooperation: number             // total_cooperation - total_defection
  cooperation_threshold: number       // rB > C threshold (usually 0)
  predicted_cooperators: string[]     // Actor IDs with positive scores
  predicted_defectors: string[]       // Actor IDs with negative scores
  network_stability: NetworkStability
  average_relatedness: number
  average_benefit: number
  average_cost: number
}

/**
 * AI interpretation of the Hamilton analysis
 */
export interface HamiltonAIAnalysis {
  summary: string
  cooperation_likelihood: number  // 0-100
  key_drivers: string[]           // Most influential relationships
  vulnerabilities: string[]       // What could disrupt cooperation
  recommendations: string[]       // Suggested interventions
  spite_risk?: string             // Analysis of potential spite behaviors
  kin_competition_factor?: number // Impact of local competition
}

/**
 * Main Hamilton Rule Analysis interface
 */
export interface HamiltonRuleAnalysis {
  id?: string
  title: string
  description: string
  linked_behavior_id?: string
  linked_behavior_title?: string

  // Analysis mode
  mode: HamiltonMode

  // Actors involved
  actors: HamiltonActor[]

  // Relationships (1v1 pairs or full network)
  relationships: HamiltonRelationship[]

  // Network summary (computed for network mode)
  network_analysis?: HamiltonNetworkAnalysis

  // AI interpretation
  ai_analysis?: HamiltonAIAnalysis

  // Metadata
  workspace_id?: string
  created_by?: number
  created_at?: string
  updated_at?: string
  is_public?: boolean
  tags?: string[]
}

/**
 * Request payload for creating/updating Hamilton analysis
 */
export interface HamiltonRuleRequest {
  title: string
  description?: string
  linked_behavior_id?: string
  mode: HamiltonMode
  actors?: HamiltonActor[]
  relationships?: HamiltonRelationship[]
  workspace_id: string
  is_public?: boolean
  tags?: string[]
}

/**
 * Response from AI Hamilton analysis
 */
export interface HamiltonAIResponse {
  cooperation_likelihood: number
  cooperators: string[]
  defectors: string[]
  stability: NetworkStability
  key_drivers: string[]
  vulnerabilities: string[]
  recommendations: string[]
  summary: string
}

/**
 * Network graph node for visualization
 */
export interface HamiltonGraphNode {
  id: string
  label: string
  type: HamiltonActorType
  group?: string
  cooperator?: boolean
}

/**
 * Network graph edge for visualization
 */
export interface HamiltonGraphEdge {
  id: string
  source: string
  target: string
  weight: number        // |Hamilton score|
  passes_rule: boolean  // Color coding
  label?: string        // "rB - C = X"
}

/**
 * Helper function to calculate Hamilton score
 */
export function calculateHamiltonScore(r: number, B: number, C: number): {
  score: number
  passes: boolean
} {
  const score = r * B - C
  return {
    score,
    passes: score > 0
  }
}

/**
 * Helper function to calculate network statistics
 */
export function calculateNetworkStats(relationships: HamiltonRelationship[]): HamiltonNetworkAnalysis {
  const cooperators = new Set<string>()
  const defectors = new Set<string>()

  let totalCooperation = 0
  let totalDefection = 0
  let totalR = 0
  let totalB = 0
  let totalC = 0

  for (const rel of relationships) {
    if (rel.passes_rule) {
      totalCooperation += rel.hamilton_score
      cooperators.add(rel.actor_id)
    } else {
      totalDefection += Math.abs(rel.hamilton_score)
      defectors.add(rel.actor_id)
    }
    totalR += rel.relatedness
    totalB += rel.benefit
    totalC += rel.cost
  }

  const n = relationships.length || 1
  const netCooperation = totalCooperation - totalDefection

  let stability: NetworkStability = 'stable'
  if (netCooperation < 0) {
    stability = 'unstable'
  } else if (cooperators.size > 0 && defectors.size > 0) {
    stability = 'transitional'
  }

  return {
    total_cooperation_score: totalCooperation,
    total_defection_score: totalDefection,
    net_cooperation: netCooperation,
    cooperation_threshold: 0,
    predicted_cooperators: Array.from(cooperators),
    predicted_defectors: Array.from(defectors),
    network_stability: stability,
    average_relatedness: totalR / n,
    average_benefit: totalB / n,
    average_cost: totalC / n
  }
}

/**
 * Relatedness presets for common relationship types
 */
export const RELATEDNESS_PRESETS: Record<string, number> = {
  'identical_twin': 1.0,
  'parent_child': 0.5,
  'full_sibling': 0.5,
  'half_sibling': 0.25,
  'grandparent_grandchild': 0.25,
  'aunt_uncle_niece_nephew': 0.25,
  'first_cousin': 0.125,
  'close_friend': 0.1,      // Social relatedness
  'colleague': 0.05,
  'acquaintance': 0.02,
  'stranger': 0.01,
  'same_organization': 0.08,
  'same_community': 0.05,
  'same_nation': 0.02,
  'adversary': 0.0
}
