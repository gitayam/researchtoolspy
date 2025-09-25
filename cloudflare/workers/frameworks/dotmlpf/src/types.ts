/**
 * DOTMLPF Framework Type Definitions
 * Doctrine, Organization, Training, Materiel, Leadership, Personnel, Facilities
 */

// Core DOTMLPF Categories
export type DOTMLPFCategory =
  | 'doctrine'
  | 'organization'
  | 'training'
  | 'materiel'
  | 'leadership'
  | 'personnel'
  | 'facilities';

// DOTMLPF Element
export interface DOTMLPFElement {
  id: string;
  category: DOTMLPFCategory;
  title: string;
  description: string;
  current_state: string;
  desired_state: string;
  gap_analysis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  implementation_complexity: 'simple' | 'moderate' | 'complex';
  resource_requirements: string[];
  timeline: string;
  dependencies?: string[]; // IDs of other elements
  stakeholders?: string[];
  risks?: string[];
  success_metrics?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

// Request/Response types
export interface DOTMLPFCreateRequest {
  title: string;
  objective: string;
  context?: string;
  scope?: string;
  current_situation?: string;
  initial_elements?: {
    [K in DOTMLPFCategory]?: DOTMLPFElement[];
  };
  request_ai_suggestions?: boolean;
  tags?: string[];
}

export interface DOTMLPFAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context?: string;
  scope?: string;
  current_situation?: string;
  elements: {
    [K in DOTMLPFCategory]: DOTMLPFElement[];
  };
  gap_summary?: DOTMLPFGapSummary;
  implementation_roadmap?: DOTMLPFRoadmap;
  ai_suggestions?: AISuggestions | null;
  status: string;
  version: number;
}

export interface DOTMLPFUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  scope?: string;
  current_situation?: string;
  elements?: {
    [K in DOTMLPFCategory]?: DOTMLPFElement[];
  };
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

// Core data structure
export interface DOTMLPFData {
  objective: string;
  context: string;
  scope?: string;
  current_situation?: string;
  elements: {
    [K in DOTMLPFCategory]: DOTMLPFElement[];
  };
  gap_summary: DOTMLPFGapSummary;
  implementation_roadmap: DOTMLPFRoadmap;
  created_at: string;
  updated_at: string;
  ai_suggestions?: AISuggestions;
  metrics?: DOTMLPFMetrics;
}

// Gap analysis types
export interface DOTMLPFGapSummary {
  critical_gaps: DOTMLPFElement[];
  high_priority_gaps: DOTMLPFElement[];
  quick_wins: DOTMLPFElement[];
  resource_intensive: DOTMLPFElement[];
  category_readiness: {
    [K in DOTMLPFCategory]: {
      readiness_percentage: number;
      critical_gaps: number;
      recommendations: string[];
    };
  };
}

// Implementation roadmap types
export interface DOTMLPFRoadmap {
  phases: DOTMLPFPhase[];
  total_timeline: string;
  resource_summary: {
    personnel: string[];
    budget: string[];
    facilities: string[];
    equipment: string[];
  };
  risk_mitigation: DOTMLPFRisk[];
}

export interface DOTMLPFPhase {
  id: string;
  name: string;
  description: string;
  duration: string;
  elements: string[]; // Element IDs
  prerequisites: string[];
  deliverables: string[];
  success_criteria: string[];
}

export interface DOTMLPFRisk {
  id: string;
  description: string;
  category: DOTMLPFCategory | 'general';
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation_strategy: string;
  contingency_plan?: string;
}

// AI-related types
export interface AISuggestions {
  elements?: {
    [K in DOTMLPFCategory]?: DOTMLPFElement[];
  };
  gap_insights?: string[];
  implementation_recommendations?: string[];
  risk_assessments?: DOTMLPFRisk[];
  quick_wins?: DOTMLPFElement[];
  confidence?: number;
  generated_at?: string;
}

export interface AIValidation {
  is_valid: boolean;
  completeness_score: number;
  gap_analysis_quality: number;
  implementation_feasibility: number;
  issues?: ValidationIssue[];
  suggestions?: string[];
}

export interface ValidationIssue {
  category: DOTMLPFCategory | 'roadmap' | 'general';
  issue_type: 'missing' | 'vague' | 'unrealistic' | 'contradictory' | 'incomplete_gap';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Analysis types
export interface DOTMLPFAnalysisRequest {
  focus_categories?: DOTMLPFCategory[];
  analysis_depth?: 'basic' | 'detailed' | 'comprehensive';
  include_roadmap?: boolean;
  include_risk_assessment?: boolean;
  timeline_constraint?: string;
}

export interface DOTMLPFAnalysisResult {
  readiness_assessment: {
    overall_readiness: number;
    category_readiness: {
      [K in DOTMLPFCategory]: {
        score: number;
        gaps: DOTMLPFElement[];
        strengths: string[];
        recommendations: string[];
      };
    };
  };
  critical_path_analysis: {
    critical_elements: DOTMLPFElement[];
    bottlenecks: string[];
    acceleration_opportunities: string[];
  };
  resource_optimization: {
    resource_conflicts: string[];
    sharing_opportunities: string[];
    cost_reduction_options: string[];
  };
}

// Export types
export type DOTMLPFExportFormat = 'pdf' | 'docx' | 'json';

export interface DOTMLPFExportResult {
  download_url: string;
  format: DOTMLPFExportFormat;
  file_size: number;
  expires_at: string;
}

// Metrics and analytics
export interface DOTMLPFMetrics {
  total_elements: number;
  elements_by_category: {
    [K in DOTMLPFCategory]: number;
  };
  gap_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  implementation_complexity: {
    simple: number;
    moderate: number;
    complex: number;
  };
  overall_readiness: number;
  estimated_timeline: string;
  ai_enhancement_score?: number;
  last_analysis_date?: string;
}

// Template types
export interface DOTMLPFTemplate {
  id: number;
  name: string;
  description: string;
  template_data: DOTMLPFTemplateData;
  is_public: boolean;
  usage_count: number;
  created_by: string;
}

export interface DOTMLPFTemplateData {
  objective_template: string;
  context_template: string;
  default_elements: {
    [K in DOTMLPFCategory]?: DOTMLPFElement[];
  };
  common_gaps: string[];
  typical_timeline: string;
  domain_specific?: boolean;
  domain?: string;
}