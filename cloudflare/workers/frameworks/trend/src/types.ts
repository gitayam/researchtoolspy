/**
 * TREND Framework Type Definitions
 */

// Core data structure
export interface TRENDData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface TRENDCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface TRENDUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface TRENDAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: TRENDData;
}

// Export types
export type TRENDExportFormat = 'pdf' | 'docx' | 'json';
