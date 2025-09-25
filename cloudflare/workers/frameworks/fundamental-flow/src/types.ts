/**
 * FUNDAMENTAL_FLOW Framework Type Definitions
 */

// Core data structure
export interface FUNDAMENTAL_FLOWData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface FUNDAMENTAL_FLOWCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface FUNDAMENTAL_FLOWUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface FUNDAMENTAL_FLOWAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: FUNDAMENTAL_FLOWData;
}

// Export types
export type FUNDAMENTAL_FLOWExportFormat = 'pdf' | 'docx' | 'json';
