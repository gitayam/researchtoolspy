/**
 * PMESII-PT Framework Type Definitions
 * Political, Military, Economic, Social, Information, Infrastructure - Physical Environment, Time
 */

// Core PMESII-PT Categories
export type PMESIICategory =
  | 'political'
  | 'military'
  | 'economic'
  | 'social'
  | 'information'
  | 'infrastructure'
  | 'physical_environment'
  | 'time';

// PMESII-PT Factor
export interface PMESIIFactor {
  id: string;
  category: PMESIICategory;
  title: string;
  description: string;
  impact_level: 'high' | 'medium' | 'low';
  likelihood: number; // 0-100
  time_horizon: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  stakeholders?: string[];
  interconnections?: string[]; // IDs of related factors
  evidence?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

// Request/Response types
export interface PMESIICreateRequest {
  title: string;
  objective: string;
  context?: string;
  area_of_interest?: string;
  time_frame?: string;
  initial_factors?: {
    [K in PMESIICategory]?: PMESIIFactor[];
  };
  request_ai_suggestions?: boolean;
  tags?: string[];
}

export interface PMESIIAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context?: string;
  area_of_interest?: string;
  time_frame?: string;
  factors: {
    [K in PMESIICategory]: PMESIIFactor[];
  };
  interconnections?: PMESIIInterconnection[];
  ai_suggestions?: AISuggestions | null;
  status: string;
  version: number;
}

export interface PMESIIUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  area_of_interest?: string;
  time_frame?: string;
  factors?: {
    [K in PMESIICategory]?: PMESIIFactor[];
  };
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

// Core data structure
export interface PMESIIData {
  objective: string;
  context: string;
  area_of_interest?: string;
  time_frame?: string;
  factors: {
    [K in PMESIICategory]: PMESIIFactor[];
  };
  interconnections: PMESIIInterconnection[];
  created_at: string;
  updated_at: string;
  ai_suggestions?: AISuggestions;
  metrics?: PMESIIMetrics;
}

// Interconnection analysis
export interface PMESIIInterconnection {
  id: string;
  factor_a: string; // Factor ID
  factor_b: string; // Factor ID
  relationship_type: 'reinforces' | 'conflicts' | 'enables' | 'depends_on' | 'influences';
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
  bidirectional: boolean;
}

// AI-related types
export interface AISuggestions {
  factors?: {
    [K in PMESIICategory]?: PMESIIFactor[];
  };
  interconnections?: PMESIIInterconnection[];
  insights?: string[];
  recommendations?: string[];
  confidence?: number;
  generated_at?: string;
}

export interface AIValidation {
  is_valid: boolean;
  completeness_score: number;
  interconnection_score: number;
  quality_score: number;
  issues?: ValidationIssue[];
  suggestions?: string[];
}

export interface ValidationIssue {
  category: PMESIICategory | 'interconnections' | 'general';
  issue_type: 'missing' | 'vague' | 'contradictory' | 'duplicate' | 'weak_interconnection';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Analysis types
export interface PMESIIAnalysisRequest {
  focus_area?: PMESIICategory[];
  analysis_depth?: 'basic' | 'detailed' | 'comprehensive';
  include_predictions?: boolean;
  time_horizons?: ('immediate' | 'short_term' | 'medium_term' | 'long_term')[];
}

export interface PMESIIAnalysisResult {
  category_analysis: {
    [K in PMESIICategory]: {
      factor_count: number;
      average_impact: number;
      critical_factors: PMESIIFactor[];
      trends: string[];
      recommendations: string[];
    };
  };
  cross_category_effects: PMESIIInterconnection[];
  risk_assessment: {
    high_risk_factors: PMESIIFactor[];
    cascading_risks: string[];
    mitigation_strategies: string[];
  };
  opportunities: {
    leverage_points: PMESIIFactor[];
    strategic_advantages: string[];
    timing_considerations: string[];
  };
}

// Export types
export type PMESIIExportFormat = 'pdf' | 'docx' | 'json';

export interface PMESIIExportResult {
  download_url: string;
  format: PMESIIExportFormat;
  file_size: number;
  expires_at: string;
}

// Metrics and analytics
export interface PMESIIMetrics {
  total_factors: number;
  factors_by_category: {
    [K in PMESIICategory]: number;
  };
  interconnection_density: number;
  average_impact_level: number;
  completeness_score: number;
  ai_enhancement_score?: number;
  last_analysis_date?: string;
}

// Template types
export interface PMESIITemplate {
  id: number;
  name: string;
  description: string;
  template_data: PMESIITemplateData;
  is_public: boolean;
  usage_count: number;
  created_by: string;
}

export interface PMESIITemplateData {
  objective_template: string;
  context_template: string;
  default_factors: {
    [K in PMESIICategory]?: PMESIIFactor[];
  };
  common_interconnections: PMESIIInterconnection[];
  area_specific?: boolean;
  area_type?: string;
}