// ─── KPI Types ──────────────────────────────────────────────────────────────

export interface IntelligenceKpi {
  active_frameworks: number
  frameworks_by_type: Record<string, number>
  entities_tracked: number
  entities_by_type: Record<string, number>
  evidence_count: number
  avg_confidence: number
  confidence_sparkline: number[]
  deception_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  deception_risk_score: number
  coverage_gap_pct: number
}

// ─── Synthesis Types ────────────────────────────────────────────────────────

export interface SynthesisFinding {
  finding: string
  supporting_frameworks: string[]
  confidence: number
  evidence_count: number
}

export interface ConvergencePoint {
  description: string
  frameworks: { type: string; session_id: string; element: string }[]
  strength: 'strong' | 'moderate' | 'weak'
}

export interface Contradiction {
  description: string
  side_a: { framework_type: string; session_id: string; claim: string }
  side_b: { framework_type: string; session_id: string; claim: string }
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  suggested_resolution: string
}

export interface SynthesisResponse {
  key_findings: SynthesisFinding[]
  convergence_points: ConvergencePoint[]
  contradictions: Contradiction[]
  overall_confidence: number
  confidence_breakdown: { framework_type: string; confidence: number }[]
  generated_at: string
}

// ─── Entity Convergence Types ───────────────────────────────────────────────

export interface EntityConvergenceRow {
  entity_id: string
  entity_name: string
  entity_type: 'ACTOR' | 'SOURCE' | 'EVENT' | 'PLACE' | 'BEHAVIOR'
  frameworks_count: number
  convergence_score: number
  relationship_count: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  mom_score: number | null
}

export interface EntityConvergenceResponse {
  entities: EntityConvergenceRow[]
  total_frameworks: number
}

// ─── Timeline Types ─────────────────────────────────────────────────────────

export interface TimelinePoint {
  date: string
  frameworks_created: number
  frameworks_updated: number
  evidence_added: number
  entities_added: number
}

export interface Milestone {
  date: string
  type: 'first_framework' | 'entity_spike' | 'deception_added' | 'evidence_milestone'
  description: string
}

export interface TimelineResponse {
  activity: TimelinePoint[]
  evidence_accumulation: { date: string; cumulative: number }[]
  milestones: Milestone[]
}

// ─── Network Intelligence Types ─────────────────────────────────────────────

export interface NetworkNode {
  id: string
  name: string
  type: string
  community_id: number
  degree_centrality: number
  betweenness_centrality: number
  frameworks_count: number
}

export interface NetworkEdge {
  source: string
  target: string
  relationship_type: string
  confidence: number
}

export interface Community {
  id: number
  members: string[]
  dominant_type: string
  size: number
}

export interface KeyInfluencer {
  entity_id: string
  entity_name: string
  composite_score: number
  role: string
}

export interface NetworkIntelligenceResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  communities: Community[]
  key_influencers: KeyInfluencer[]
  bridge_nodes: string[]
  metrics: {
    total_nodes: number
    total_edges: number
    community_count: number
    network_density: number
  }
}

// ─── Contradictions Types ───────────────────────────────────────────────────

export interface ContradictionsResponse {
  contradictions: Contradiction[]
  total_count: number
  by_severity: { INFO: number; WARNING: number; CRITICAL: number }
}

// ─── Predictions Types ──────────────────────────────────────────────────────

export interface WatchItem {
  entity_or_topic: string
  reason: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  related_frameworks: string[]
}

export interface CollectionGap {
  area: string
  current_evidence_count: number
  recommended_action: string
  impact_if_filled: string
}

export interface PredictionsResponse {
  watch_list: WatchItem[]
  emerging_patterns: { description: string; confidence: number }[]
  collection_gaps: CollectionGap[]
  risk_trajectory: 'ESCALATING' | 'STABLE' | 'DE_ESCALATING'
  risk_trajectory_reasoning: string
  generated_at: string
}
