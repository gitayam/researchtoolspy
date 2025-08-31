// Security assessment types based on evidence collection framework

export interface SecurityIncidentEvidence {
  incident_type: 'api_security_event' | 'vulnerability_discovery' | 'threat_intelligence' | 'compliance_violation'
  timestamp: string
  evidence_sources: EvidenceSource[]
  impact_assessment: ImpactAssessment
  metadata?: Record<string, any>
}

export interface EvidenceSource {
  type: 'log_entry' | 'network_capture' | 'vulnerability_scan' | 'code_review' | 'manual_observation'
  source: string
  content: string
  reliability: 'low' | 'medium' | 'high' | 'verified'
  chain_of_custody?: string[]
}

export interface ImpactAssessment {
  data_accessed: 'none' | 'limited' | 'significant' | 'critical'
  systems_affected: string[]
  business_impact: 'low' | 'medium' | 'high' | 'critical'
  estimated_cost?: number
  compliance_implications?: string[]
}

export interface VulnerabilityAssessmentEvidence {
  vulnerability_id: string
  cve_references?: string[]
  evidence_type: 'security_scan' | 'penetration_test' | 'code_review' | 'threat_modeling'
  affected_components: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  cvss_score?: number
  exploit_evidence: ExploitEvidence
  remediation_evidence: RemediationEvidence
  discovery_date: string
  disclosure_timeline?: DiscloseureEvent[]
}

export interface ExploitEvidence {
  proof_of_concept?: string
  attack_vectors: string[]
  prerequisites: string[]
  exploit_complexity: 'low' | 'medium' | 'high'
  public_exploits_available: boolean
}

export interface RemediationEvidence {
  patch_available: boolean
  patch_version?: string
  workaround_available: boolean
  workaround_description?: string
  vendor_response?: string
  estimated_fix_time?: string
  testing_required: boolean
}

export interface DiscloseureEvent {
  date: string
  event: string
  stakeholder: string
  details?: string
}

export interface SecurityAssessmentResult {
  assessment_id: string
  title: string
  description: string
  conducted_by: string
  assessment_date: string
  methodology: string[]
  scope: AssessmentScope
  findings: SecurityFinding[]
  recommendations: SecurityRecommendation[]
  risk_rating: 'low' | 'medium' | 'high' | 'critical'
  evidence_summary: EvidenceSummary
  next_assessment_date?: string
}

export interface AssessmentScope {
  systems: string[]
  applications: string[]
  networks: string[]
  data_types: string[]
  compliance_frameworks: string[]
}

export interface SecurityFinding {
  finding_id: string
  category: 'vulnerability' | 'configuration' | 'policy' | 'procedure' | 'awareness'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  affected_assets: string[]
  evidence: EvidenceSource[]
  business_risk: string
  technical_risk: string
  likelihood: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk'
}

export interface SecurityRecommendation {
  recommendation_id: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: 'technical' | 'procedural' | 'policy' | 'training'
  implementation_effort: 'low' | 'medium' | 'high'
  cost_estimate?: string
  timeline?: string
  responsible_party?: string
  success_criteria: string[]
  dependencies?: string[]
}

export interface EvidenceSummary {
  total_evidence_pieces: number
  evidence_by_type: Record<string, number>
  evidence_by_reliability: Record<string, number>
  chain_of_custody_maintained: boolean
  evidence_storage_location: string
  retention_period: string
}

// Security Question Framework Types
export interface SecurityQuestion {
  id: string
  category: 'threat_assessment' | 'vulnerability_assessment' | 'risk_analysis' | 'mitigation_analysis'
  question: string
  description?: string
  evidence_required: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  tags?: string[]
  guidance?: string
  related_frameworks?: string[] // OWASP, NIST, etc.
}

export interface SecurityQuestionResponse {
  question_id: string
  response: string
  evidence: EvidenceSource[]
  confidence_level: 'low' | 'medium' | 'high'
  reviewer?: string
  review_date?: string
  follow_up_required: boolean
  follow_up_actions?: string[]
}

// SATS (Source, Accuracy, Timeliness, Significance) Methodology
export interface SATSEvaluation {
  source_reliability: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' // A=Completely reliable to F=Cannot be judged
  information_accuracy: '1' | '2' | '3' | '4' | '5' | '6' // 1=Confirmed to 6=Cannot be judged
  timeliness: string // Date/time relevance
  significance: 'critical' | 'important' | 'routine'
  evaluation_date: string
  evaluator: string
  rationale: string
}

export interface EvidenceWithSATS extends EvidenceSource {
  sats_evaluation: SATSEvaluation
}

// Export Templates
export interface SecurityReportTemplate {
  template_id: string
  name: string
  description: string
  format: 'json' | 'docx' | 'pdf' | 'excel'
  sections: ReportSection[]
  created_date: string
  version: string
}

export interface ReportSection {
  section_id: string
  title: string
  content_type: 'text' | 'table' | 'chart' | 'evidence_list' | 'recommendation_list'
  include_evidence: boolean
  include_sats: boolean
  order: number
}