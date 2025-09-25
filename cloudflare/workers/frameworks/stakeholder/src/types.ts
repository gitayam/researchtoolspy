/**
 * STAKEHOLDER Framework Type Definitions
 */

// Core data structure
export interface STAKEHOLDERData {
  objective: string;
  context: string;
  created_at: string;
  updated_at: string;
  // Add framework-specific fields here
}

// Request/Response types
export interface STAKEHOLDERCreateRequest {
  title: string;
  objective: string;
  context?: string;
  tags?: string[];
}

export interface STAKEHOLDERUpdateRequest {
  title?: string;
  objective?: string;
  context?: string;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
}

export interface STAKEHOLDERAnalysisResponse {
  session_id: number;
  title: string;
  objective: string;
  context: string;
  status: string;
  version: number;
  data: STAKEHOLDERData;
}

// Export types
export type STAKEHOLDERExportFormat = 'pdf' | 'docx' | 'json';
