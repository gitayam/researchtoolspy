/**
 * Type definitions for ACH Framework
 */

export type ConsistencyRating =
  | 'very_consistent'
  | 'consistent'
  | 'neutral'
  | 'inconsistent'
  | 'very_inconsistent';

export type CredibilityLevel =
  | 'very_high'
  | 'high'
  | 'medium'
  | 'low'
  | 'very_low';

export interface Evidence {
  id: string;
  text: string;
  source?: string;
  credibility: CredibilityLevel;
  date?: string;
  tags?: string[];
  notes?: string;
}

export interface EvidenceRating {
  evidence_id: string;
  consistency: ConsistencyRating;
  weight?: number;
  notes?: string;
}

export interface Hypothesis {
  id: string;
  text: string;
  description?: string;
  likelihood?: number; // 0-100
  evidence_ratings?: EvidenceRating[];
  analysis?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ACHData {
  title: string;
  description?: string;
  hypotheses: Hypothesis[];
  evidence: Evidence[];
  matrix: Record<string, Record<string, ConsistencyRating>>;
  conclusion?: string;
  ai_suggestions?: {
    hypotheses?: Hypothesis[];
    evidence?: Evidence[];
    analysis?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ACHAnalysis {
  hypothesis_id: string;
  likelihood: number;
  strengths: string[];
  weaknesses: string[];
  critical_evidence: string[];
  analysis: string;
  recommendation?: string;
}

export interface EvidenceEvaluation {
  evidence_id: string;
  ratings: {
    hypothesis_id: string;
    consistency: ConsistencyRating;
    explanation: string;
  }[];
}