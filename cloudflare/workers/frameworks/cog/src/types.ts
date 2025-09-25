/**
 * COG Framework Type Definitions
 */

// Core data structure
export interface COGData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface COGCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface COGUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface COGAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: COGData;
}

// Export types
export type COGExportFormat = 'pdf' | 'docx' | 'json';
