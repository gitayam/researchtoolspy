/**
 * STARBURSTING Framework Type Definitions
 */

// Core data structure
export interface STARBURSTINGData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface STARBURSTINGCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface STARBURSTINGUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface STARBURSTINGAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: STARBURSTINGData;
}

// Export types
export type STARBURSTINGExportFormat = 'pdf' | 'docx' | 'json';
