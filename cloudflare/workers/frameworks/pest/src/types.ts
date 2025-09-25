/**
 * PEST Framework Type Definitions
 */

// Core data structure
export interface PESTData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface PESTCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface PESTUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface PESTAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: PESTData;
}

// Export types
export type PESTExportFormat = 'pdf' | 'docx' | 'json';
