/**
 * DECEPTION Framework Type Definitions
 */

// Core data structure
export interface DECEPTIONData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface DECEPTIONCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface DECEPTIONUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface DECEPTIONAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: DECEPTIONData;
}

// Export types
export type DECEPTIONExportFormat = 'pdf' | 'docx' | 'json';
