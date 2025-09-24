/**
 * SWOT Framework Type Definitions
 */

// Request/Response types
export interface SWOTCreateRequest {
  title: string;
  objective: string;
  context?: string;
  initial_strengths?: string[];
  initial_weaknesses?: string[];
  initial_opportunities?: string[];
  initial_threats?: string[];
  request_ai_suggestions?: boolean;
  tags?: string[];
}

export interface SWOTAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context?: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  ai_suggestions?: AISuggestions | null;
  status: string;
  version: number;
}

export interface SWOTUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

// Core data structure
export interface SWOTData {
  objective: string;
  context: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  created_at: string;
  updated_at: string;
  ai_suggestions?: AISuggestions;
  metrics?: SWOTMetrics;
}

// AI-related types
export interface AISuggestions {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
  insights?: string[];
  recommendations?: string[];
  confidence?: number;
  generated_at?: string;
}

export interface AIValidation {
  is_valid: boolean;
  completeness_score: number;
  consistency_score: number;
  quality_score: number;
  issues?: ValidationIssue[];
  suggestions?: string[];
}

export interface ValidationIssue {
  category: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  issue_type: 'missing' | 'vague' | 'contradictory' | 'duplicate';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Industry analysis types
export interface IndustryAnalysisRequest {
  industry: string;
  company_size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  geographic_scope?: string;
  time_horizon?: string;
}

export interface IndustryAnalysisResponse {
  industry_trends: string[];
  market_conditions: string[];
  regulatory_factors: string[];
  technological_disruptions: string[];
  swot_implications: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}

// Competitive intelligence types
export interface CompetitiveIntelligenceRequest {
  competitors: string[];
  market_segment?: string;
  analysis_depth?: 'basic' | 'detailed' | 'comprehensive';
}

export interface CompetitiveIntelligenceResponse {
  competitive_landscape: {
    market_leaders: string[];
    emerging_players: string[];
    market_share_distribution?: Record<string, number>;
  };
  competitive_advantages: string[];
  competitive_gaps: string[];
  strategic_recommendations: string[];
}

// Predictive modeling types
export interface PredictiveModelingRequest {
  time_horizons: number[]; // in months: [6, 12, 24]
  scenarios?: ('optimistic' | 'base' | 'pessimistic')[];
  external_factors?: string[];
}

export interface PredictiveModelingResponse {
  projections: {
    [horizon: string]: {
      [scenario: string]: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
        probability: number;
      };
    };
  };
  key_indicators: string[];
  risk_factors: string[];
}

// Export types
export type SWOTExportFormat = 'pdf' | 'docx' | 'json';

export interface SWOTExportResult {
  download_url: string;
  format: SWOTExportFormat;
  file_size: number;
  expires_at: string;
}

// Template types
export interface SWOTTemplate {
  id: number;
  name: string;
  description: string;
  template_data: SWOTTemplateData;
  is_public: boolean;
  usage_count: number;
  created_by: string;
}

export interface SWOTTemplateData {
  objective_template: string;
  context_template: string;
  default_strengths: string[];
  default_weaknesses: string[];
  default_opportunities: string[];
  default_threats: string[];
  industry_specific?: boolean;
  industry?: string;
}

// Metrics and analytics
export interface SWOTMetrics {
  total_items: number;
  balance_score: number; // Balance between categories
  completeness_score: number;
  ai_enhancement_score?: number;
  last_analysis_date?: string;
}

export interface SWOTAnalytics {
  session_count: number;
  average_items_per_category: {
    strengths: number;
    weaknesses: number;
    opportunities: number;
    threats: number;
  };
  ai_usage_rate: number;
  export_formats_used: Record<string, number>;
  average_completion_time?: number;
}

// Enhanced analysis types
export interface StrategicOption {
  strategy: string;
  type: 'SO' | 'WO' | 'ST' | 'WT'; // SWOT matrix combinations
  description: string;
  priority: 'high' | 'medium' | 'low';
  implementation_complexity: 'simple' | 'moderate' | 'complex';
  expected_impact: 'high' | 'medium' | 'low';
}

export interface SWOTMatrix {
  SO_strategies: StrategicOption[]; // Strengths-Opportunities
  WO_strategies: StrategicOption[]; // Weaknesses-Opportunities
  ST_strategies: StrategicOption[]; // Strengths-Threats
  WT_strategies: StrategicOption[]; // Weaknesses-Threats
}

// Sentiment analysis types
export interface SentimentAnalysisRequest {
  data_sources?: ('social_media' | 'news' | 'reviews' | 'forums')[];
  time_period?: string;
  keywords?: string[];
}

export interface SentimentAnalysisResponse {
  overall_sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number; // -1 to 1
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  key_themes: {
    positive: string[];
    negative: string[];
  };
  swot_implications: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}